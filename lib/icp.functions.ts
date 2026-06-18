import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

export const getIcpConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("icp_config")
    .select("*")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

const UpdateSchema = z.object({
  industries: z.array(z.string().trim().min(1).max(80)).max(50),
  funding_stages: z.array(z.string().trim().min(1).max(40)).max(20),
  regions: z.array(z.string().trim().min(1).max(80)).max(30),
  company_size_min: z.number().int().min(0).max(1_000_000).nullable(),
  company_size_max: z.number().int().min(0).max(1_000_000).nullable(),
  revenue_min_usd: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  revenue_max_usd: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  countries_min: z.number().int().min(0).max(250).nullable(),
  countries_max: z.number().int().min(0).max(250).nullable(),
  scoring_prompt: z.string().trim().min(1).max(4000),
  outreach_voice: z.string().trim().min(1).max(2000).optional(),
  auto_enrich_contacts_min_score: z.number().int().min(0).max(100).optional(),
});


export const updateIcpConfig = createServerFn({ method: "POST" })
  .inputValidator((data) => UpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("icp_config")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", SINGLETON_ID);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
