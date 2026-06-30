import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGuard } from "@/components/auth-guard";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getUsageStats } from "@/lib/usage.functions";

export const Route = createFileRoute("/usage")({
  component: () => (
    <AuthGuard>
      <UsagePage />
    </AuthGuard>
  ),
});

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = (n: number, digits = 1) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });

type UsageStats = {
  window: { days: number; since: string };
  usage: {
    leads: number;
    leadsEnriched: number;
    contactsDiscovered: number;
    articlesProcessed: number;
    outreachDrafts: number;
  };
  perDay: {
    leads: number;
    enrichments: number;
    articles: number;
    drafts: number;
  };
  autoEnrich: {
    threshold: number;
    sharePct: number;
  };
  costs: {
    brightdataLast30: number;
    brightdataProjected: number;
    aiScoringLast30: number;
    aiScoringProjected: number;
    aiOutreachLast30: number;
    aiOutreachProjected: number;
    firecrawlLast30: number;
    firecrawlProjected: number;
  };
  totals: {
    last30: number;
    projected: number;
    fixedMonthly: number;
  };
  assumptions: {
    brightdataPerQuery: number;
    queriesPerEnrichment: number;
    aiPerLeadScored: number;
    aiPerOutreachDraft: number;
    firecrawlPerArticle: number;
  };
  error?: string;
};

function UsagePage() {
  const { user, loading: authLoading } = useAuth();
  const usageStatsFn = useServerFn(getUsageStats);
  const { data, isLoading, error, dataUpdatedAt } = useQuery<UsageStats, Error>({
    queryKey: ["usage-stats", user?.id],
    queryFn: async () => usageStatsFn({}),
    enabled: !!user && !authLoading,
    retry: false,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const refreshedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="px-10 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Costs</div>
        <h1 className="text-3xl font-semibold tracking-tight">Monthly cost &amp; usage</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Estimated spend based on the last 30 days of activity. Projections assume your current
          lead volume and auto-enrich threshold stay the same.
        </p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {refreshedAt && !isLoading && (
        <div className="text-[11px] text-muted-foreground mb-4">Last updated: {refreshedAt}</div>
      )}
      {error && <div className="text-sm text-destructive">Couldn't load usage stats. Please sign in and try again.</div>}
      {data?.error && <div className="text-sm text-destructive">{data.error}</div>}
      {!isLoading && !error && !data?.totals && (
        <div className="text-sm text-muted-foreground">No usage data yet. Create a few leads to see cost estimates here.</div>
      )}

      {data && data.totals && (
        <div className="space-y-8">
          {/* Headline */}
          <div className="grid grid-cols-3 gap-4">
            <Stat
              label="Last 30 days (actual)"
              value={fmtUSD(data.totals.last30)}
              hint="Variable spend only"
            />
            <Stat
              label="Next 30 days (projected)"
              value={fmtUSD(data.totals.projected)}
              hint="At current pace + auto-enrich setting"
            />
            <Stat
              label="All-in monthly"
              value={fmtUSD(data.totals.projected + data.totals.fixedMonthly)}
              hint={data.totals.fixedMonthly > 0 ? `Includes ~${fmtUSD(data.totals.fixedMonthly)} Anthropic baseline` : "No fixed platform fee assumed"}
            />
          </div>

          {/* Usage */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Activity (last 30 days)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Leads created" value={fmtNum(data.usage.leads, 0)} sub={`${fmtNum(data.perDay.leads)}/day`} />
              <MiniStat label="Leads enriched" value={fmtNum(data.usage.leadsEnriched, 0)} sub={`${fmtNum(data.perDay.enrichments)}/day`} />
              <MiniStat label="Contacts discovered" value={fmtNum(data.usage.contactsDiscovered, 0)} sub="via Bright Data" />
              <MiniStat label="Articles processed" value={fmtNum(data.usage.articlesProcessed, 0)} sub={`${fmtNum(data.perDay.articles)}/day`} />
            </div>
          </section>

          {/* Auto-enrich status */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Auto-enrichment
            </h2>
            <Card className="p-4">
              {data.autoEnrich.threshold > 0 ? (
                <div className="text-sm">
                  Auto-enrich is <span className="font-medium">on</span> for leads with fit score ≥{" "}
                  <span className="font-mono">{data.autoEnrich.threshold}</span>. Over the last 30 days,{" "}
                  <span className="font-medium">{fmtNum(data.autoEnrich.sharePct, 0)}%</span> of new leads
                  met that bar — that share drives the projected Bright Data spend below.
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Auto-enrich is <span className="font-medium text-foreground">off</span>. Bright Data
                  only runs when you click <span className="font-mono">Find decision-makers</span> on a
                  lead. Turn it on in{" "}
                  <a className="underline" href="/settings">ICP Profile</a> to scale discovery.
                </div>
              )}
            </Card>
          </section>

          {/* Cost breakdown — one card per driver */}
          <section>
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Cost drivers
              </h2>
              <div className="text-sm font-medium">
                Total variable: {fmtUSD(data.totals.last30)}{" "}
                <span className="text-muted-foreground font-normal">
                  → {fmtUSD(data.totals.projected)} projected
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CostCard
                label="Bright Data — LinkedIn discovery"
                last={data.costs.brightdataLast30}
                projected={data.costs.brightdataProjected}
                totalProjected={data.totals.projected}
                detail={`${fmtNum(data.usage.leadsEnriched, 0)} enrichments × ~${data.assumptions.queriesPerEnrichment} SERP queries × ${fmtUSD(data.assumptions.brightdataPerQuery)}`}
                driver="Driven by auto-enrich threshold and how many new leads clear it."
                manageHref="/settings"
                manageLabel="Adjust auto-enrich threshold"
              />
              <CostCard
                label="Anthropic — lead scoring & enrichment"
                last={data.costs.aiScoringLast30}
                projected={data.costs.aiScoringProjected}
                totalProjected={data.totals.projected}
                detail={`${fmtNum(data.usage.leads, 0)} leads × ~${fmtUSD(data.assumptions.aiPerLeadScored)}`}
                driver="Driven by total new leads ingested from Google Alerts, Auto Search, and Manual Upload."
                manageHref="/settings"
                manageLabel="Tune ICP & search queries"
              />
              <CostCard
                label="Anthropic — outreach drafts"
                last={data.costs.aiOutreachLast30}
                projected={data.costs.aiOutreachProjected}
                totalProjected={data.totals.projected}
                detail={`${fmtNum(data.usage.outreachDrafts, 0)} drafts × ~${fmtUSD(data.assumptions.aiPerOutreachDraft)}`}
                driver="Driven by how often you click Generate outreach on a lead."
                manageHref="/my-leads"
                manageLabel="Review outreach activity"
              />
              <CostCard
                label="Firecrawl — article ingestion"
                last={data.costs.firecrawlLast30}
                projected={data.costs.firecrawlProjected}
                totalProjected={data.totals.projected}
                detail={`${fmtNum(data.usage.articlesProcessed, 0)} articles × ~${fmtUSD(data.assumptions.firecrawlPerArticle)}`}
                driver="Driven by forwarded Google Alerts and Auto Search article volume."
                manageHref="/settings"
                manageLabel="Manage search queries"
              />
            </div>
          </section>

          <section className="text-xs text-muted-foreground leading-relaxed border-t pt-4">
            <p className="font-medium text-foreground mb-1">Notes</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Bright Data is billed only for queries that actually run. We fire ~6 role-specific SERP queries per lead enriched (CEO, CFO, CHRO, COO, International, Talent).</li>
              <li>Anthropic costs are estimates — actual charges depend on whether a workflow stays on Haiku or needs Sonnet, plus prompt size. See real numbers in Workspace → Usage.</li>
              <li>Lower the auto-enrich threshold to catch more leads automatically; raise it to cut Bright Data spend.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold tracking-tight mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function CostCard({
  label,
  detail,
  driver,
  last,
  projected,
  totalProjected,
  manageHref,
  manageLabel,
}: {
  label: string;
  detail: string;
  driver: string;
  last: number;
  projected: number;
  totalProjected: number;
  manageHref: string;
  manageLabel: string;
}) {
  const sharePct = totalProjected > 0 ? Math.round((projected / totalProjected) * 100) : 0;
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{driver}</div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Last 30d</div>
          <div className="text-lg font-semibold tabular-nums">{fmtUSD(last)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Next 30d ({sharePct}% of total)
          </div>
          <div className="text-lg font-semibold tabular-nums text-muted-foreground">
            {fmtUSD(projected)}
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground border-t pt-2">{detail}</div>
      <a
        href={manageHref}
        className="text-xs font-medium underline underline-offset-2 hover:text-foreground"
      >
        {manageLabel} →
      </a>
    </Card>
  );
}
