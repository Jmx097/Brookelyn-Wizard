import { useState } from "react";
import { ChevronDown, Sparkles, TrendingUp, TrendingDown, Briefcase, Building2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Lead = {
  fit_score: number;
  fit_reasoning?: string | null;
  trigger_summary?: string | null;
  expansion_signals?: string[] | null;
  industry?: string | null;
  funding_stage?: string | null;
  hq?: string | null;
  company_size?: string | null;
  website?: string | null;
  ceo_name?: string | null;
  cfo_name?: string | null;
  chro_name?: string | null;
  coo_name?: string | null;
  general_counsel_name?: string | null;
};

const EXEC_ROLES: { key: keyof Lead; label: string }[] = [
  { key: "ceo_name", label: "CEO" },
  { key: "cfo_name", label: "CFO" },
  { key: "chro_name", label: "HR Lead" },
  { key: "coo_name", label: "COO" },
  { key: "general_counsel_name", label: "General Counsel" },
];

function scoreBand(s: number) {
  if (s >= 80) return { label: "Hot", tone: "text-[var(--score-hot)]", bg: "bg-[var(--score-hot)]" };
  if (s >= 60) return { label: "Warm", tone: "text-[var(--score-warm)]", bg: "bg-[var(--score-warm)]" };
  return { label: "Cool", tone: "text-[var(--score-cool)]", bg: "bg-[var(--score-cool)]" };
}

// Heuristic categorization of free-text signals into lifts vs drags so the
// panel reads like an actual score breakdown rather than a tag dump.
function classifySignal(s: string): "lift" | "drag" | "neutral" {
  const t = s.toLowerCase();
  if (/(hir|job|posting|role|opening|expan|launch|raise|raised|funding|series|growth|new market|office|country|region|emea|apac|latam)/.test(t)) return "lift";
  if (/(layoff|cut|shrink|wind\s*down|exit|pause|freeze|sanction|lawsuit|already global|enterprise)/.test(t)) return "drag";
  return "neutral";
}

function isJobSignal(s: string) {
  return /(hir|job|posting|role|opening|recruit)/i.test(s);
}

export function WhyThisScore({ lead, compact = false }: { lead: Lead; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const band = scoreBand(lead.fit_score);
  const signals = lead.expansion_signals ?? [];
  const lifts = signals.filter((s) => classifySignal(s) === "lift");
  const drags = signals.filter((s) => classifySignal(s) === "drag");
  const neutrals = signals.filter((s) => classifySignal(s) === "neutral");
  const hasJobSignal = signals.some(isJobSignal);

  return (
    <div className={cn("rounded-md border bg-background/40", compact ? "mt-2" : "mt-3")}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-md"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Why this score
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold tabular-nums", band.tone)}>
            {lead.fit_score} · {band.label}
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 text-xs">
          {/* Score bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span><span>60 Warm</span><span>80 Hot</span><span>100</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn("absolute inset-y-0 left-0 rounded-full", band.bg)} style={{ width: `${lead.fit_score}%` }} />
            </div>
          </div>

          {/* Reasoning */}
          {lead.fit_reasoning && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reasoning</div>
              <p className="text-foreground/90 leading-relaxed">{lead.fit_reasoning}</p>
            </div>
          )}

          {/* Trigger */}
          {lead.trigger_summary && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Trigger</div>
              <p className="text-foreground/80 leading-relaxed">{lead.trigger_summary}</p>
            </div>
          )}

          {/* ICP match */}
          {(lead.industry || lead.funding_stage || lead.hq || lead.company_size) && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">ICP match</div>
              <div className="flex flex-wrap gap-1">
                {lead.industry && <Badge variant="outline" className="text-[10px] font-normal">Industry · {lead.industry}</Badge>}
                {lead.funding_stage && <Badge variant="outline" className="text-[10px] font-normal">Stage · {lead.funding_stage}</Badge>}
                {lead.company_size && <Badge variant="outline" className="text-[10px] font-normal">Size · {lead.company_size}</Badge>}
                {lead.hq && <Badge variant="outline" className="text-[10px] font-normal">HQ · {lead.hq}</Badge>}
              </div>
            </div>
          )}

          {/* Signals */}
          {(lifts.length > 0 || drags.length > 0 || neutrals.length > 0) && (
            <div className="space-y-2">
              {lifts.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--score-hot)] mb-1.5">
                    <TrendingUp className="h-3 w-3" /> Lifts the score
                  </div>
                  <ul className="space-y-1">
                    {lifts.map((s, i) => (
                      <li key={i} className="flex gap-2 text-foreground/90">
                        {isJobSignal(s) ? (
                          <Briefcase className="h-3 w-3 mt-0.5 shrink-0 text-[var(--score-hot)]" />
                        ) : (
                          <span className="mt-1 h-1 w-1 rounded-full bg-[var(--score-hot)] shrink-0" />
                        )}
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(lead.website || EXEC_ROLES.some((r) => lead[r.key])) && (
                <div className="rounded-md border bg-muted/20 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    <Building2 className="h-3 w-3" /> Company Details
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    {EXEC_ROLES.map((r) =>
                      lead[r.key] ? (
                        <div key={r.key} className="contents">
                          <dt className="text-muted-foreground">{r.label}</dt>
                          <dd className="text-foreground/90 font-medium">{lead[r.key] as string}</dd>
                        </div>
                      ) : null
                    )}
                    {lead.website && (
                      <div className="contents">
                        <dt className="text-muted-foreground">Website</dt>
                        <dd>
                          <a
                            href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-foreground hover:text-primary underline-offset-2 hover:underline"
                          >
                            {lead.website}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
              {drags.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--score-cool)] mb-1.5">
                    <TrendingDown className="h-3 w-3" /> Pulls the score down
                  </div>
                  <ul className="space-y-1">
                    {drags.map((s, i) => (
                      <li key={i} className="flex gap-2 text-foreground/80">
                        <span className="mt-1 h-1 w-1 rounded-full bg-[var(--score-cool)] shrink-0" />
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {neutrals.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Other signals</div>
                  <div className="flex flex-wrap gap-1">
                    {neutrals.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasJobSignal && (
            <div className="rounded-md border border-[var(--score-hot)]/30 bg-[var(--score-hot)]/5 px-2.5 py-2 flex gap-2">
              <Briefcase className="h-3.5 w-3.5 text-[var(--score-hot)] shrink-0 mt-0.5" />
              <span className="text-[11px] text-foreground/90 leading-relaxed">
                High-premium signal: out-of-HQ job postings detected. This is a heavy boost in the GoGlobal scoring model.
              </span>
            </div>
          )}

          {!lead.fit_reasoning && signals.length === 0 && (
            <p className="text-muted-foreground italic">No reasoning recorded yet — the next scoring run will populate this panel.</p>
          )}
        </div>
      )}
    </div>
  );
}
