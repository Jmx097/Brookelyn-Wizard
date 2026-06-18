import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processDigestForUser } from "@/lib/ingest.functions";

// Accepts inbound email webhooks from Postmark, SendGrid Inbound Parse,
// Cloudflare Email Workers, Mailgun, etc. Body shape is normalized below.
// Auth: shared secret via `x-inbound-secret` header OR `?secret=` query string.

const PayloadSchema = z
  .object({
    // generic
    to: z.string().optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    // Postmark
    To: z.string().optional(),
    From: z.string().optional(),
    Subject: z.string().optional(),
    TextBody: z.string().optional(),
    HtmlBody: z.string().optional(),
    // SendGrid Inbound Parse (form-encoded normally; included if JSON)
    envelope: z.unknown().optional(),
  })
  .passthrough();

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveUserId(): Promise<string | null> {
  // Single-user app — route inbound mail to the only configured owner.
  const { data: rows } = await supabaseAdmin
    .from("icp_config")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(2);
  if (rows && rows.length >= 1) return rows[0].user_id as string;
  return null;
}

export const Route = createFileRoute("/api/public/inbound-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.INBOUND_EMAIL_SECRET;
        if (!expected) {
          return new Response("Server not configured", { status: 500 });
        }
        const url = new URL(request.url);
        const provided =
          request.headers.get("x-inbound-secret") ?? url.searchParams.get("secret") ?? "";
        if (provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400 });
        }
        const p = parsed.data;

        const subject = p.subject ?? p.Subject ?? "";
        const textBody = p.text ?? p.TextBody ?? "";
        const htmlBody = p.html ?? p.HtmlBody ?? "";
        const body = textBody || (htmlBody ? stripHtml(htmlBody) : "");
        const combined = `Subject: ${subject}\n\n${body}`.trim();

        if (combined.length < 20) {
          return Response.json({ ok: true, skipped: "empty body" });
        }

        const userId = await resolveUserId();
        if (!userId) {
          return new Response("No user mapping for inbound address", { status: 404 });
        }

        const from = (p.from ?? p.From ?? "").toLowerCase();

        // Detect Gmail forwarding confirmation emails so the user can grab
        // the verification code from the app instead of needing inbox access.
        if (
          from.includes("forwarding-noreply@google.com") ||
          /gmail forwarding confirmation/i.test(subject)
        ) {
          const codeMatch = body.match(/\b(\d{9})\b/);
          const urlMatch = body.match(/https?:\/\/mail-settings\.google\.com\/[^\s)>"']+/i);
          await supabaseAdmin.from("gmail_forwarding_confirmations").insert({
            user_id: userId,
            from_address: p.from ?? p.From ?? null,
            subject,
            code: codeMatch?.[1] ?? null,
            verify_url: urlMatch?.[0] ?? null,
            raw_body: body.slice(0, 4000),
          });
          return Response.json({ ok: true, gmail_confirmation: true, code: codeMatch?.[1] ?? null });
        }

        // Detect LinkedIn reply notifications and auto-mark the matching
        // outreach row as `replied`. LinkedIn notification emails come from
        // *@linkedin.com with subjects like:
        //   "Jane Doe sent you a message"
        //   "You have a new message from Jane Doe"
        if (from.includes("linkedin.com")) {
          const replyMatch =
            subject.match(/^(.+?)\s+sent you a (?:message|new message)/i) ??
            subject.match(/new message from\s+(.+?)(?:\s+[-—|].*)?$/i);
          const contactName = replyMatch?.[1]?.trim();
          if (contactName) {
            const { data: matches } = await supabaseAdmin
              .from("linkedin_outreach")
              .select("id")
              .eq("user_id", userId)
              .eq("contact_name", contactName)
              .in("status", ["sent", "queued", "no_response"])
              .order("sent_at", { ascending: false })
              .limit(1);
            if (matches && matches.length > 0) {
              const now = new Date().toISOString();
              await supabaseAdmin
                .from("linkedin_outreach")
                .update({
                  status: "replied",
                  replied_at: now,
                  last_status_change_at: now,
                })
                .eq("id", matches[0].id);
              return Response.json({
                ok: true,
                linkedin_reply_detected: true,
                contact: contactName,
              });
            }
            return Response.json({
              ok: true,
              linkedin_reply_detected: true,
              matched: false,
              contact: contactName,
            });
          }
        }


        try {
          const stats = await processDigestForUser(userId, combined);
          return Response.json({ ok: true, ...stats });
        } catch (err) {
          console.error("inbound-email processing failed", err);
          return new Response("Processing failed", { status: 500 });
        }
      },
    },
  },
});
