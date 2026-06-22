import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processDigestForUser } from "@/lib/ingest.functions";

// Accepts inbound email webhooks from Postmark, SendGrid Inbound Parse,
// Cloudflare Email Workers, Mailgun, etc. Body shape is normalized below.
// Auth: shared secret via `x-inbound-secret` header OR `?secret=` query string.
// Routing: prefers explicit inbound_email_routes matches by destination address.
// Fallback: if exactly one user exists in icp_config, route there for backward compatibility.

const PayloadSchema = z
  .object({
    to: z.string().optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    To: z.string().optional(),
    From: z.string().optional(),
    Subject: z.string().optional(),
    TextBody: z.string().optional(),
    HtmlBody: z.string().optional(),
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

function normalizeEmailAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim().toLowerCase() ?? null;
}

async function resolveUserId(toValue: string | undefined): Promise<string | null> {
  const normalizedTo = normalizeEmailAddress(toValue);

  if (normalizedTo) {
    const { data: route, error: routeError } = await supabaseAdmin
      .from("inbound_email_routes")
      .select("user_id")
      .eq("route_key", normalizedTo)
      .eq("is_active", true)
      .maybeSingle();

    if (routeError) {
      console.error("inbound-email route lookup failed", routeError);
    }

    if (route?.user_id) {
      return route.user_id as string;
    }
  }

  const { data: rows, error } = await supabaseAdmin
    .from("icp_config")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(2);

  if (error) {
    console.error("inbound-email fallback user lookup failed", error);
    return null;
  }

  if (rows && rows.length === 1) return rows[0].user_id as string;
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

        const toValue = p.to ?? p.To;
        const userId = await resolveUserId(toValue);
        if (!userId) {
          return new Response("No user mapping for inbound address", { status: 404 });
        }

        const from = (p.from ?? p.From ?? "").toLowerCase();

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
                .eq("id", matches[0].id)
                .eq("user_id", userId);
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
