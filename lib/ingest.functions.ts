import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ANTHROPIC_MODELS, callAnthropicTool } from "@/lib/anthropic";
import {
  buildGoogleAlertScoringSystemPrompt,
  buildGoogleAlertUserPrompt,
  extractArticleUrlsFromDigest,
} from "@/lib/google-alerts";

type ExtractedLead = {
  company_name: string;
  website?: string | null;
  domain?: string | null;
  hq?: string | null;
  industry?: string | null;
  company_size?: string | null;
  funding_stage?: string | null;
  funding_amount?: string | null;
  trigger_summary: string;
  expansion_signals?: string[];
  fit_score: number;
  fit_reasoning: string;
  source_url?: string | null;
  source_title?: string | null;
};

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

async function runDigestStep<T>(
  step: string,
  details: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    console.info("[digest] step ok", {
      step,
      elapsedMs: Date.now() - startedAt,
      ...details,
    });
    return result;
  } catch (error) {
    console.error("[digest] step failed", {
      step,
      elapsedMs: Date.now() - startedAt,
      ...details,
      error: summarizeError(error),
    });
    throw error;
  }
}

async function callAI<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: object,
  fnName: string,
  useGrounding = false,
): Promise<T> {
  return callAnthropicTool<T>(
    systemPrompt,
    userPrompt,
    schema as Record<string, unknown>,
    fnName,
    {
      model: useGrounding ? ANTHROPIC_MODELS.complex : ANTHROPIC_MODELS.cheap,
      toolDescription: "Return structured leads",
    },
  );
}

const LEAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    leads: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          company_name: { type: "string" },
          website: { type: "string" },
          domain: { type: "string" },
          hq: { type: "string" },
          industry: { type: "string" },
          company_size: { type: "string" },
          funding_stage: { type: "string" },
          funding_amount: { type: "string" },
          trigger_summary: { type: "string" },
          expansion_signals: { type: "array", items: { type: "string" } },
          fit_score: { type: "number" },
          fit_reasoning: { type: "string" },
          source_url: { type: "string" },
          source_title: { type: "string" },
        },
        required: [
          "company_name",
          "trigger_summary",
          "fit_score",
          "fit_reasoning",
        ],
      },
    },
  },
  required: ["leads"],
};

function defaultIcpContext(): string {
  return "GoGlobal ICP: companies signaling international expansion (Series B-E funding, opening offices abroad, hiring outside home country).";
}

async function getIcpContext(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("icp_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return defaultIcpContext();
  return formatIcp(data);
}

function formatIcp(c: Record<string, unknown>): string {
  return `GoGlobal ICP:
- Industries: ${(c.industries as string[])?.join(", ") || "any"}
- Funding stages: ${(c.funding_stages as string[])?.join(", ") || "any"}
- Regions: ${(c.regions as string[])?.join(", ") || "any"}
- Company size: ${c.company_size_min || "?"}-${c.company_size_max || "?"} employees
- Scoring guidance: ${c.scoring_prompt || ""}`;
}

async function persistLeads(
  userId: string,
  leads: ExtractedLead[],
  source: "alert_email" | "web_search",
) {
  let created = 0;
  let updated = 0;
  for (const l of leads) {
    if (!l.company_name || l.fit_score == null) continue;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("leads")
      .select("id, fit_score")
      .eq("user_id", userId)
      .ilike("company_name", l.company_name)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Lead lookup failed for ${l.company_name}: ${existingError.message}`,
      );
    }

    let leadId: string;
    if (existing) {
      leadId = existing.id;
      const { error: updateError } = await supabaseAdmin
        .from("leads")
        .update({
          website: l.website ?? undefined,
          domain: l.domain ?? undefined,
          hq: l.hq ?? undefined,
          industry: l.industry ?? undefined,
          company_size: l.company_size ?? undefined,
          funding_stage: l.funding_stage ?? undefined,
          funding_amount: l.funding_amount ?? undefined,
          trigger_summary: l.trigger_summary,
          fit_score: Math.max(existing.fit_score ?? 0, Math.round(l.fit_score)),
          fit_reasoning: l.fit_reasoning,
          expansion_signals: l.expansion_signals ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);
      if (updateError) {
        throw new Error(
          `Lead update failed for ${l.company_name}: ${updateError.message}`,
        );
      }
      updated++;
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("leads")
        .insert({
          user_id: userId,
          company_name: l.company_name,
          website: l.website ?? null,
          domain: l.domain ?? null,
          hq: l.hq ?? null,
          industry: l.industry ?? null,
          company_size: l.company_size ?? null,
          funding_stage: l.funding_stage ?? null,
          funding_amount: l.funding_amount ?? null,
          trigger_summary: l.trigger_summary,
          fit_score: Math.round(l.fit_score),
          fit_reasoning: l.fit_reasoning,
          expansion_signals: l.expansion_signals ?? [],
          status: "new",
        })
        .select("id")
        .single();
      if (error || !ins) {
        throw new Error(
          `Lead insert failed for ${l.company_name}: ${error?.message ?? "no row returned"}`,
        );
      }
      leadId = ins.id;
      created++;
    }

    if (l.source_url) {
      const { error: articleError } = await supabaseAdmin
        .from("articles")
        .upsert(
          {
            user_id: userId,
            url: l.source_url,
            title: l.source_title ?? l.trigger_summary.slice(0, 120),
            snippet: l.trigger_summary,
            source,
            lead_id: leadId,
            processed: true,
            published_at: new Date().toISOString(),
          },
          { onConflict: "user_id,url" },
        );
      if (articleError) {
        throw new Error(
          `Article persistence failed for ${l.company_name} (${l.source_url}): ${articleError.message}`,
        );
      }
    }
  }
  return { created, updated };
}

async function scrapeWithFirecrawl(
  url: string,
): Promise<{ url: string; title?: string; markdown?: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const md: string | undefined = j?.data?.markdown ?? j?.markdown;
    const title: string | undefined =
      j?.data?.metadata?.title ?? j?.metadata?.title;
    if (!md) return null;
    return { url, title, markdown: md.slice(0, 8000) };
  } catch {
    return null;
  }
}

export async function processDigestForUser(userId: string, text: string) {
  console.info("[digest] processDigestForUser start", {
    userId,
    textLength: text.length,
  });

  const icp = await runDigestStep("load_icp", { userId }, () =>
    getIcpContext(userId),
  );

  const urls = extractArticleUrlsFromDigest(text);
  console.info("[digest] extracted urls", {
    userId,
    urlCount: urls.length,
    urls: urls.slice(0, 10),
  });
  const scraped = await runDigestStep(
    "scrape_articles",
    { userId, urlCount: urls.length },
    async () => {
      return (await Promise.all(urls.map(scrapeWithFirecrawl))).filter(
        Boolean,
      ) as Array<{
        url: string;
        title?: string;
        markdown?: string;
      }>;
    },
  );

  const sys = buildGoogleAlertScoringSystemPrompt(icp);

  const userPrompt = buildGoogleAlertUserPrompt(text, scraped);

  const result = await runDigestStep<{ leads?: ExtractedLead[] }>(
    "anthropic_extract_leads",
    {
      userId,
      scrapedCount: scraped.length,
      promptLength: userPrompt.length,
    },
    () =>
      callAI<{ leads?: ExtractedLead[] }>(
        sys,
        userPrompt,
        LEAD_SCHEMA,
        "emit_leads",
      ),
  );
  const leads: ExtractedLead[] = result.leads ?? [];
  console.info("[digest] anthropic extracted leads", {
    userId,
    leadCount: leads.length,
    topCompanies: leads.slice(0, 5).map((lead) => lead.company_name),
  });
  const stats = await runDigestStep(
    "persist_leads",
    {
      userId,
      leadCount: leads.length,
      scrapedCount: scraped.length,
    },
    () => persistLeads(userId, leads, "alert_email"),
  );
  console.info("[digest] processDigestForUser complete", {
    userId,
    extracted: leads.length,
    scraped: scraped.length,
    ...stats,
  });
  return { extracted: leads.length, scraped: scraped.length, ...stats };
}

export const processDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ text: z.string().min(20).max(200000) }).parse(d))
  .handler(async ({ data, context }) => {
    return processDigestForUser(context.userId, data.text);
  });

export const runDailySearchNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const icp = await getIcpContext(userId);

    const { data: queries } = await supabaseAdmin
      .from("search_queries")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true);

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalExtracted = 0;
    const queryList = queries ?? [];

    for (const q of queryList) {
      const sys = `You are a B2B prospect researcher for GoGlobal (Employer of Record / global expansion).

${icp}

Use your knowledge of recent (last 30 days) news to find companies matching this query. For each, return company info, the trigger event (with source URL if you know it), expansion signals, and a 0-100 fit score with reasoning. Return up to 8 high-quality matches. Skip generic results.`;

      try {
        const result = await callAI<{ leads?: ExtractedLead[] }>(
          sys,
          `Search query: ${q.query}`,
          LEAD_SCHEMA,
          "emit_leads",
          true,
        );
        const leads: ExtractedLead[] = result.leads ?? [];
        totalExtracted += leads.length;
        const s = await persistLeads(userId, leads, "web_search");
        totalCreated += s.created;
        totalUpdated += s.updated;
        await supabaseAdmin
          .from("search_queries")
          .update({ last_run_at: new Date().toISOString() })
          .eq("id", q.id)
          .eq("user_id", userId);
      } catch (err) {
        console.error(`Search query failed: ${q.query}`, err);
      }
    }

    return {
      queries: queryList.length,
      extracted: totalExtracted,
      created: totalCreated,
      updated: totalUpdated,
    };
  });
