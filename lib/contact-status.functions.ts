import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CONTACT_STATUSES = [
  "not_responded",
  "engaged",
  "meeting",
  "no_show",
  "opportunity",
] as const;

export type ContactProgressStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABEL: Record<ContactProgressStatus, string> = {
  not_responded: "Not Responded",
  engaged: "Engaged",
  meeting: "Meeting",
  no_show: "No Show",
  opportunity: "Opportunity",
};

export type ContactStatusRow = {
  id: string;
  user_id: string;
  lead_id: string;
  contact_name: string;
  status: ContactProgressStatus;
  created_at: string;
  updated_at: string;
};

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

export const listContactStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("contact_status")
      .select("*")
      .eq("user_id", context.userId)
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as ContactStatusRow[];
  });

const UpsertInput = z.object({
  leadId: z.string().uuid(),
  contactName: z.string().min(1).max(255),
  status: z.enum(CONTACT_STATUSES),
});

export const upsertContactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnedLead(context.userId, data.leadId);

    const { data: row, error } = await supabaseAdmin
      .from("contact_status")
      .upsert(
        {
          user_id: context.userId,
          lead_id: data.leadId,
          contact_name: data.contactName,
          status: data.status,
        },
        { onConflict: "user_id,lead_id,contact_name" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as ContactStatusRow;
  });
