import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { researchJobsForLead } from "./import-companies.server";
import { ANTHROPIC_MODELS, callAnthropicTool } from "@/lib/anthropic";

async function callAI<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  schema: object,
  fnName: string,
): Promise<T> {
  return callAnthropicTool<T>(systemPrompt, userPrompt, schema as Record<string, unknown>, fnName, {
    model: ANTHROPIC_MODELS.complex,
  });
}

async function scrapeWithFirecrawl(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const md: string | undefined = j?.data?.markdown ?? j?.markdown;
    return md ? md.slice(0, 12000) : null;
  } catch {
    return null;
  }
}

function defaultIcpText() {
  return "GoGlobal ICP: companies signaling international expansion (Series B-E funding, opening offices abroad, hiring outside home country).";
}

async function getIcpFor(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin
    .from("icp_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function formatIcp(c: Record<string, unknown> | null): string {
  if (!c) return defaultIcpText();
  return `GoGlobal ICP:
- Industries: ${(c.industries as string[])?.join(", ") || "any"}
- Funding stages: ${(c.funding_stages as string[])?.join(", ") || "any"}
- Regions: ${(c.regions as string[])?.join(", ") || "any"}
- Company size: ${c.company_size_min || "?"}-${c.company_size_max || "?"} employees
- Scoring guidance: ${c.scoring_prompt || ""}`;
}

function formatLead(l: Record<string, unknown>): string {
  return `Company: ${l.company_name}
Website: ${l.website ?? "—"}
Domain: ${l.domain ?? "—"}
HQ: ${l.hq ?? "—"}
Industry: ${l.industry ?? "—"}
Company size: ${l.company_size ?? "—"}
Funding stage: ${l.funding_stage ?? "—"}
Funding amount: ${l.funding_amount ?? "—"}
Trigger: ${l.trigger_summary ?? "—"}
Expansion signals: ${((l.expansion_signals as string[]) ?? []).join("; ") || "—"}
Current fit reasoning: ${l.fit_reasoning ?? "—"}`;
}

async function getOwnedLead(userId: string, leadId: string) {
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found");
  return lead;
}

const ENRICH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    website: { type: "string" },
    domain: { type: "string" },
    hq: { type: "string" },
    industry: { type: "string" },
    company_size: { type: "string" },
    funding_stage: { type: "string" },
    funding_amount: { type: "string" },
    trigger_summary: { type: "string" },
    expansion_signals: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
};

type EnrichResult = {
  website?: string;
  domain?: string;
  hq?: string;
  industry?: string;
  company_size?: string;
  funding_stage?: string;
  funding_amount?: string;
  trigger_summary?: string;
  expansion_signals?: string[];
  notes?: string;
};

export const enrichLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        leadId: z.string().uuid(),
        extraContext: z.string().trim().max(20000).optional().default(""),
        websiteOverride: z.string().trim().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const lead = await getOwnedLead(context.userId, data.leadId);

    const candidateUrls = Array.from(
      new Set(
        [data.websiteOverride, lead.website as string | null, lead.domain ? `https://${lead.domain}` : null]
          .filter(Boolean)
          .map((u) => ((u as string).startsWith("http") ? (u as string) : `https://${u}`)),
      ),
    ).slice(0, 2);

    const scraped: { url: string; md: string }[] = [];
    for (const u of candidateUrls) {
      const md = await scrapeWithFirecrawl(u);
      if (md) scraped.push({ url: u, md });
    }

    if (scraped.length === 0 && !data.extraContext) {
      return {
        ok: false as const,
        scrapedUrls: [] as string[],
        updatedFields: [] as string[],
        message: candidateUrls.length
          ? `Could not fetch ${candidateUrls.join(", ")}. Paste notes or try a different URL.`
          : "No website on file. Add a website URL or paste notes.",
      };
    }

    const sys = `You are a B2B research analyst for GoGlobal (Employer of Record / global expansion).

You will receive (a) the current data we have on a company, (b) the scraped content of its website (if available), and (c) optional user-supplied notes.

Refine and fill in the company profile. Return ONLY fields you are confident about based on the provided context — leave others blank. Keep values concise and specific. expansion_signals must be short concrete phrases (e.g. "Opened London office Q4 2025", "Hiring Head of EMEA"). trigger_summary should be a 1-sentence reason this company is interesting now. Put any extra qualitative context in "notes".`;

    const userPrompt = `CURRENT LEAD:
${formatLead(lead)}

WEBSITE CONTENT:
${scraped.map((s, i) => `--- SOURCE ${i + 1}: ${s.url} ---\n${s.md}`).join("\n\n") || "(none)"}

USER NOTES:
${data.extraContext || "(none)"}`;

    const result = await callAI<EnrichResult>(sys, userPrompt, ENRICH_SCHEMA, "enrich_company");

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields: (keyof EnrichResult)[] = [
      "website",
      "domain",
      "hq",
      "industry",
      "company_size",
      "funding_stage",
      "funding_amount",
      "trigger_summary",
    ];
    for (const f of fields) {
      const v = result[f];
      if (typeof v === "string" && v.trim()) update[f] = v.trim();
    }
    if (Array.isArray(result.expansion_signals) && result.expansion_signals.length) {
      const merged = Array.from(new Set([...(lead.expansion_signals ?? []), ...result.expansion_signals])).slice(0, 20);
      update.expansion_signals = merged;
    }

    const { error: upErr } = await supabaseAdmin
      .from("leads")
      .update(update)
      .eq("id", data.leadId)
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);

    if (result.notes?.trim()) {
      await supabaseAdmin.from("notes").insert({
        user_id: context.userId,
        lead_id: data.leadId,
        body: `[AI enrichment] ${result.notes.trim()}`,
      });
    }

    return {
      ok: true as const,
      scrapedUrls: scraped.map((s) => s.url),
      updatedFields: Object.keys(update).filter((k) => k !== "updated_at"),
    };
  });

const RESCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fit_score: { type: "number" },
    fit_reasoning: { type: "string" },
  },
  required: ["fit_score", "fit_reasoning"],
};

export const rescoreLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const lead = await getOwnedLead(context.userId, data.leadId);

    const icp = await getIcpFor(context.userId);
    const icpText = formatIcp(icp);

    const sys = `You are a B2B prospect scorer for GoGlobal (Employer of Record / global expansion).

${icpText}

Score the company below 0-100 against this ICP. Reward fresh international-expansion signals (recent funding, opening offices abroad, hiring outside HQ country, M&A across borders, leadership hires for international markets). Penalize early stage, single-country focus, mismatched industry. Provide 2-3 sentences of fit reasoning that cites specific signals.`;

    const result = await callAI<{ fit_score: number; fit_reasoning: string }>(
      sys,
      formatLead(lead),
      RESCORE_SCHEMA,
      "score_lead",
    );

    const score = Math.max(0, Math.min(100, Math.round(result.fit_score)));

    const { error: upErr } = await supabaseAdmin
      .from("leads")
      .update({
        fit_score: score,
        fit_reasoning: result.fit_reasoning,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.leadId)
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, fit_score: score, fit_reasoning: result.fit_reasoning };
  });

export const researchJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await getOwnedLead(context.userId, data.leadId);
    const counts = await researchJobsForLead(context.userId, data.leadId);
    return { ok: true as const, ...counts };
  });
