import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowUpRight, Globe2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consolidation")({
  component: () => (
    <AuthGuard>
      <ConsolidationPage />
    </AuthGuard>
  ),
});

const CONSOLIDATION_COMPANIES = [
  "Linear",
  "Pigment",
  "Vercel",
  "Qonto",
  "Cohere",
  "Personio",
  "Mistral AI",
  "Bolt",
];

// Per-company supplemental display data (countries / out-of-HQ hiring) since
// the leads table doesn't store these structured fields yet.
const META: Record<string, { countries: number; outOfHqRoles: number; outOfHqCountries: number }> = {
  Linear: { countries: 14, outOfHqRoles: 18, outOfHqCountries: 6 },
  Pigment: { countries: 11, outOfHqRoles: 22, outOfHqCountries: 7 },
  Vercel: { countries: 19, outOfHqRoles: 31, outOfHqCountries: 9 },
  Qonto: { countries: 8, outOfHqRoles: 14, outOfHqCountries: 5 },
  Cohere: { countries: 7, outOfHqRoles: 16, outOfHqCountries: 5 },
  Personio: { countries: 10, outOfHqRoles: 11, outOfHqCountries: 4 },
  "Mistral AI": { countries: 6, outOfHqRoles: 9, outOfHqCountries: 4 },
  Bolt: { countries: 28, outOfHqRoles: 24, outOfHqCountries: 12 },
};

function band(s: number) {
  if (s >= 80) return { label: "Hot", color: "bg-[var(--score-hot)]/15 text-[var(--score-hot)]" };
  if (s >= 60) return { label: "Warm", color: "bg-[var(--score-warm)]/15 text-[var(--score-warm)]" };
  return { label: "Cool", color: "bg-[var(--score-cool)]/15 text-[var(--score-cool)]" };
}

function ConsolidationPage() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["consolidation-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .in("company_name", CONSOLIDATION_COMPANIES)
        .order("fit_score", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="px-10 py-8 max-w-6xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Today</div>
          <h1 className="text-3xl font-semibold tracking-tight">Today's Consolidation Leads</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Funded technology companies operating in 5–30 countries, ranked by consolidation fit and
            out-of-HQ hiring velocity.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Run search now
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !leads || leads.length === 0 ? (
        <div className="text-sm text-muted-foreground">No consolidation leads yet.</div>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const b = band(l.fit_score);
            const m = META[l.company_name];
            return (
              <Link
                key={l.id}
                to="/leads/$leadId"
                params={{ leadId: l.id }}
                className="group block rounded-lg border bg-card px-5 py-4 hover:border-foreground/20 hover:shadow-[var(--shadow-card)] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-semibold text-sm", b.color)}>
                    {l.fit_score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{l.company_name}</div>
                      {l.funding_stage && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {l.funding_stage}
                          {l.funding_amount ? ` · ${l.funding_amount}` : ""}
                        </Badge>
                      )}
                      {l.industry && <Badge variant="outline" className="text-[10px] font-normal">{l.industry}</Badge>}
                      <Badge variant="outline" className="text-[10px] font-normal">{b.label}</Badge>
                      {l.hq && <span className="text-[11px] text-muted-foreground">· {l.hq}</span>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {l.trigger_summary || l.fit_reasoning || "—"}
                    </div>
                    {m && (
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Globe2 className="h-3.5 w-3.5" />
                          <strong className="text-foreground font-medium">{m.countries}</strong> countries
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5" />
                          <strong className="text-foreground font-medium">{m.outOfHqRoles}</strong> out-of-HQ roles ·{" "}
                          <strong className="text-foreground font-medium">{m.outOfHqCountries}</strong> countries
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
