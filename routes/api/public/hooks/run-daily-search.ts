import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { discoverContactsForCompany } from "@/lib/contacts.server";

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
        required: ["company_name", "trigger_summary", "fit_score", "fit_reasoning"],
      },
    },
  },
  required: ["leads"],
};

async function callAI(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "function", function: { name: "emit_leads", parameters: LEAD_SCHEMA } }],
      tool_choice: { type: "function", function: { name: "emit_leads" } },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { leads: [] as ExtractedLead[] };
  return JSON.parse(args) as { leads: ExtractedLead[] };
}

function formatIcp(c: Record<string, unknown> | null): string {
  if (!c)
    return "GoGlobal ICP: companies signaling international expansion (Series B-E funding, opening offices abroad, hiring outside home country).";
  return `GoGlobal ICP:
- Industries: ${(c.industries as string[])?.join(", ") || "any"}
- Funding stages: ${(c.funding_stages as string[])?.join(", ") || "any"}
- Regions: ${(c.regions as string[])?.join(", ") || "any"}
- Company size: ${c.company_size_min || "?"}-${c.company_size_max || "?"} employees
- Scoring guidance: ${c.scoring_prompt || ""}`;
}

async function persistLeads(userId: string, leads: ExtractedLead[], autoEnrichMin: number) {
  let created = 0;
  for (const l of leads) {
    if (!l.company_name || l.fit_score == null) continue;
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id, fit_score")
      .eq("user_id", userId)
      .ilike("company_name", l.company_name)
      .maybeSingle();
    let leadId: string;
    let isNew = false;
    const finalScore = Math.round(l.fit_score);
    if (existing) {
      leadId = existing.id;
      await supabaseAdmin
        .from("leads")
        .update({
          trigger_summary: l.trigger_summary,
          fit_score: Math.max(existing.fit_score ?? 0, finalScore),
          fit_reasoning: l.fit_reasoning,
          expansion_signals: l.expansion_signals ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId);
    } else {
      const { data: ins } = await supabaseAdmin
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
          fit_score: finalScore,
          fit_reasoning: l.fit_reasoning,
          expansion_signals: l.expansion_signals ?? [],
          status: "new",
        })
        .select("id")
        .single();
      if (!ins) continue;
      leadId = ins.id;
      created++;
      isNew = true;
    }
    if (l.source_url) {
      await supabaseAdmin.from("articles").insert({
        user_id: userId,
        url: l.source_url,
        title: l.source_title ?? l.trigger_summary.slice(0, 120),
        snippet: l.trigger_summary,
        source: "web_search",
        lead_id: leadId,
        processed: true,
        published_at: new Date().toISOString(),
      });
    }

    if (isNew && autoEnrichMin > 0 && finalScore >= autoEnrichMin) {
      try {
        const discovered = await discoverContactsForCompany(l.company_name);
        for (const c of discovered) {
          await supabaseAdmin.from("lead_contacts").upsert(
            {
              user_id: userId,
              lead_id: leadId,
              full_name: c.full_name,
              title: c.title,
              linkedin_url: c.linkedin_url,
              location: c.location,
              seniority: c.seniority,
              relevance_score: c.relevance_score,
              source: "brightdata",
            },
            { onConflict: "lead_id,linkedin_url", ignoreDuplicates: false },
          );
        }
        await supabaseAdmin
          .from("leads")
          .update({ contacts_enriched_at: new Date().toISOString() })
          .eq("id", leadId)
          .eq("user_id", userId);
      } catch (e) {
        console.error(`Auto-enrich failed for ${l.company_name}:`, (e as Error).message);
      }
    }
  }
  return created;
}

function authorizeScheduler(request: Request) {
  const expected = process.env.RUN_DAILY_SEARCH_SECRET;
  if (!expected) {
    return new Response("Server not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const provided =
    request.headers.get("x-run-daily-search-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";

  if (provided !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}

export const Route = createFileRoute("/api/public/hooks/run-daily-search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = authorizeScheduler(request);
        if (authError) return authError;

        const { data: queries } = await supabaseAdmin
          .from("search_queries")
          .select("*")
          .eq("enabled", true);

        const byUser = new Map<string, typeof queries>();
        for (const q of queries ?? []) {
          const arr = byUser.get(q.user_id) ?? [];
          arr.push(q);
          byUser.set(q.user_id, arr);
        }

        let totalCreated = 0;
        let totalQueries = 0;

        for (const [userId, userQueries] of byUser) {
          const { data: icp } = await supabaseAdmin
            .from("icp_config")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          const icpText = formatIcp(icp ?? null);
          const autoEnrichMin =
            (icp as { auto_enrich_contacts_min_score?: number } | null)?.auto_enrich_contacts_min_score ?? 0;
          for (const q of userQueries ?? []) {
            try {
              const sys = `You are a B2B prospect researcher for GoGlobal (Employer of Record / global expansion).

${icpText}

Use your knowledge of recent (last 30 days) news to find companies matching this query. Return up to 8 high-quality matches with company info, trigger event, source URL if known, expansion signals, and 0-100 fit score with reasoning. Skip generic results.`;
              const result = await callAI(sys, `Search query: ${q.query}`);
              totalCreated += await persistLeads(userId, result.leads ?? [], autoEnrichMin);

              totalQueries++;
              await supabaseAdmin
                .from("search_queries")
                .update({ last_run_at: new Date().toISOString() })
                .eq("id", q.id)
                .eq("user_id", userId);
            } catch (err) {
              console.error(`Daily search failed for query ${q.id}:`, err);
            }
          }
        }

        return Response.json({ ok: true, queries: totalQueries, created: totalCreated });
      },
    },
  },
});
