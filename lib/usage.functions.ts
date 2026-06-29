import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Cost assumptions (tweak here as pricing evolves)
const COST = {
  // Bright Data SERP API: ~$1.50 per 1,000 successful requests
  brightdataPerQuery: 0.0015,
  // We fire ~6 role queries per enrichment
  queriesPerEnrichment: 6,
  // Anthropic API (Haiku-first with Sonnet for heavier reasoning)
  aiPerLeadScored: 0.004,
  // AI cost per outreach draft generated
  aiPerOutreachDraft: 0.0015,
  // Firecrawl per article ingestion (rough)
  firecrawlPerArticle: 0.002,
};

export const getUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    try {

    const [leadsRes, contactsRes, articlesRes, draftsRes, icpRes] = await Promise.all([
      supabase.from("leads").select("id, fit_score, created_at, contacts_enriched_at").gte("created_at", since),
      supabase.from("lead_contacts").select("id, lead_id, created_at").gte("created_at", since),
      supabase.from("articles").select("id, created_at").gte("created_at", since),
      supabase.from("outreach_drafts").select("id, created_at").gte("created_at", since),
      supabase.from("icp_config").select("auto_enrich_contacts_min_score").maybeSingle(),
    ]);

    const leads = leadsRes.data ?? [];
    const contacts = contactsRes.data ?? [];
    const articles = articlesRes.data ?? [];
    const drafts = draftsRes.data ?? [];
    const autoEnrichThreshold = (icpRes.data?.auto_enrich_contacts_min_score ?? 0) as number;

    // Distinct leads that actually had contact enrichment performed
    const enrichedLeadIds = new Set(contacts.map((c) => c.lead_id));
    const leadsEnriched30d = enrichedLeadIds.size;

    // Projection: per-day rates over the 30-day window
    const days = 30;
    const leadsPerDay = leads.length / days;
    const enrichmentsPerDay = leadsEnriched30d / days;
    const articlesPerDay = articles.length / days;
    const draftsPerDay = drafts.length / days;

    // Forward-looking monthly projection (30 days)
    const projected = {
      leads: leadsPerDay * 30,
      enrichments: enrichmentsPerDay * 30,
      articles: articlesPerDay * 30,
      drafts: draftsPerDay * 30,
    };

    // If auto-enrich is on, project future enrichments based on share of leads above threshold
    let autoEnrichSharePct = 0;
    if (autoEnrichThreshold > 0 && leads.length > 0) {
      const above = leads.filter((l) => (l.fit_score ?? 0) >= autoEnrichThreshold).length;
      autoEnrichSharePct = (above / leads.length) * 100;
      // Override projected enrichments to assume the threshold runs automatically going forward
      projected.enrichments = Math.max(projected.enrichments, leadsPerDay * 30 * (above / leads.length));
    }

    const costs = {
      brightdataLast30: leadsEnriched30d * COST.queriesPerEnrichment * COST.brightdataPerQuery,
      brightdataProjected: projected.enrichments * COST.queriesPerEnrichment * COST.brightdataPerQuery,
      aiScoringLast30: leads.length * COST.aiPerLeadScored,
      aiScoringProjected: projected.leads * COST.aiPerLeadScored,
      aiOutreachLast30: drafts.length * COST.aiPerOutreachDraft,
      aiOutreachProjected: projected.drafts * COST.aiPerOutreachDraft,
      firecrawlLast30: articles.length * COST.firecrawlPerArticle,
      firecrawlProjected: projected.articles * COST.firecrawlPerArticle,
    };

    const totalLast30 =
      costs.brightdataLast30 + costs.aiScoringLast30 + costs.aiOutreachLast30 + costs.firecrawlLast30;
    const totalProjected =
      costs.brightdataProjected +
      costs.aiScoringProjected +
      costs.aiOutreachProjected +
      costs.firecrawlProjected;

    return {
      window: { days, since },
      usage: {
        leads: leads.length,
        leadsEnriched: leadsEnriched30d,
        contactsDiscovered: contacts.length,
        articlesProcessed: articles.length,
        outreachDrafts: drafts.length,
      },
      perDay: {
        leads: leadsPerDay,
        enrichments: enrichmentsPerDay,
        articles: articlesPerDay,
        drafts: draftsPerDay,
      },
      autoEnrich: {
        threshold: autoEnrichThreshold,
        sharePct: autoEnrichSharePct,
      },
      costs,
      totals: {
        last30: totalLast30,
        projected: totalProjected,
        fixedMonthly: 0, // No fixed Anthropic subscription assumed
      },
      assumptions: COST,
    };
    } catch (err) {
      console.error("[usage] getUsageStats failed", err);
      return {
        window: { days: 30, since },
        usage: { leads: 0, leadsEnriched: 0, contactsDiscovered: 0, articlesProcessed: 0, outreachDrafts: 0 },
        perDay: { leads: 0, enrichments: 0, articles: 0, drafts: 0 },
        autoEnrich: { threshold: 0, sharePct: 0 },
        costs: {
          brightdataLast30: 0, brightdataProjected: 0,
          aiScoringLast30: 0, aiScoringProjected: 0,
          aiOutreachLast30: 0, aiOutreachProjected: 0,
          firecrawlLast30: 0, firecrawlProjected: 0,
        },
        totals: { last30: 0, projected: 0, fixedMonthly: 0 },
        assumptions: COST,
        error: err instanceof Error ? err.message : "Failed to load usage stats",
      };
    }
  });
