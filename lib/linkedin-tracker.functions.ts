import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StatusEnum = z.enum([
  "queued",
  "sent",
  "replied",
  "meeting",
  "no_response",
  "passed",
]);

const MarkSentInput = z.object({
  leadId: z.string().uuid(),
  companyName: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  contactRole: z.string().max(255).optional().nullable(),
  approach: z.number().int().min(1).max(5),
  messageText: z.string().max(5000).optional().nullable(),
});

async function assertOwnedLead(userId: string, leadId: string) {
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found");
}

export const markOutreachSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => MarkSentInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedLead(context.userId, data.leadId);

    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("linkedin_outreach")
      .upsert(
        {
          user_id: context.userId,
          lead_id: data.leadId,
          company_name: data.companyName,
          contact_name: data.contactName,
          contact_role: data.contactRole ?? null,
          approach: data.approach,
          status: "sent",
          message_text: data.messageText ?? null,
          sent_at: now,
          last_status_change_at: now,
        },
        { onConflict: "user_id,lead_id,contact_name,approach" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateStatusInput = z.object({
  id: z.string().uuid(),
  status: StatusEnum,
  notes: z.string().max(2000).optional().nullable(),
});

export const updateOutreachStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => UpdateStatusInput.parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const patch: {
      status: typeof data.status;
      last_status_change_at: string;
      notes?: string | null;
      replied_at?: string;
      meeting_at?: string;
    } = {
      status: data.status,
      last_status_change_at: now,
    };
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.status === "replied") patch.replied_at = now;
    if (data.status === "meeting") patch.meeting_at = now;
    const { data: row, error } = await supabaseAdmin
      .from("linkedin_outreach")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("linkedin_outreach")
      .select("*")
      .eq("user_id", context.userId)
      .order("last_status_change_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type OutreachRow = {
  id: string;
  user_id: string;
  lead_id: string;
  company_name: string;
  contact_name: string;
  contact_role: string | null;
  approach: number;
  status:
    | "queued"
    | "sent"
    | "replied"
    | "meeting"
    | "no_response"
    | "passed";
  message_text: string | null;
  sent_at: string | null;
  replied_at: string | null;
  meeting_at: string | null;
  last_status_change_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
