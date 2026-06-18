import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

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

export const listContactStatuses = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("contact_status")
      .select("*")
      .eq("user_id", DEMO_USER_ID)
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as ContactStatusRow[];
  },
);

const UpsertInput = z.object({
  leadId: z.string().uuid(),
  contactName: z.string().min(1).max(255),
  status: z.enum(CONTACT_STATUSES),
});

export const upsertContactStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => UpsertInput.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("contact_status")
      .upsert(
        {
          user_id: DEMO_USER_ID,
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
