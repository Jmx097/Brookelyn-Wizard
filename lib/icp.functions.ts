import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getOrCreateOwnedIcpConfig(userId: string) {
  const { data: existing, error: readError } = await supabaseAdmin
    .from("icp_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("icp_config")
    .insert({
      user_id: userId,
      industries: [],
      funding_stages: [],
      regions: [],
      company_size_min: null,
      company_size_max: null,
      revenue_min_usd: null,
      revenue_max_usd: null,
      countries_min: null,
      countries_max: null,
      scoring_prompt: "",
      outreach_voice: null,
      auto_enrich_contacts_min_score: 0,
    })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  return inserted;
}

export const getIcpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await getOrCreateOwnedIcpConfig(context.userId);
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
  .middleware([requireSupabaseAuth])
  .validator((data) => UpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const current = await getOrCreateOwnedIcpConfig(context.userId);

    const { error } = await supabaseAdmin
      .from("icp_config")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
