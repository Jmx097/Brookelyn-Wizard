import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLE_COLUMNS = {
  ceo: { name: "ceo_name", link: "ceo_linkedin" },
  cfo: { name: "cfo_name", link: "cfo_linkedin" },
  coo: { name: "coo_name", link: "coo_linkedin" },
  chro: { name: "chro_name", link: "chro_linkedin" },
  gc: { name: "general_counsel_name", link: "general_counsel_linkedin" },
  controller: { name: "controller_name", link: "controller_linkedin" },
  finance1: { name: "finance_leader_1_name", link: "finance_leader_1_linkedin" },
  finance2: { name: "finance_leader_2_name", link: "finance_leader_2_linkedin" },
} as const;

export type ContactRoleKey = keyof typeof ROLE_COLUMNS;

const linkedInUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+\/?$/i, {
    message: "Must be a linkedin.com/in/... profile URL",
  });

const UpdateSchema = z.object({
  leadId: z.string().uuid(),
  role: z.enum(["ceo", "cfo", "coo", "chro", "gc", "controller", "finance1", "finance2"]),
  name: z.string().trim().max(200).optional().default(""),
  linkedinUrl: z.union([linkedInUrl, z.literal("")]).optional().default(""),
});

export const updateLeadContact = createServerFn({ method: "POST" })
  .inputValidator((input) => UpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const cols = ROLE_COLUMNS[data.role];
    const name = data.name?.trim() || null;
    const link = data.linkedinUrl?.trim() || null;

    const update: Record<string, string | null> = {};
    update[cols.name] = name;
    update[cols.link] = link;

    const { error } = await supabaseAdmin
      .from("leads")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("id", data.leadId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
