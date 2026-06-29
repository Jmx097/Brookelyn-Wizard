import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gauge,
  Target,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Globe2,
  TrendingUp,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/scoring")({
  component: () => (
    <AuthGuard>
      <ScoringMethodology />
    </AuthGuard>
  ),
});

function ScoringMethodology() {
  return (
    <div className="px-10 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Methodology
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Scoring Methodology</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Every Google Alert article that lands in the app gets pulled into the same four-step pipeline —
          Extract → Enrich → Score → Draft — whether it arrived from forwarding or the regular scheduled sourcing run. That produces a single 0–100 fit score using one of two rubrics: <strong>Expansion</strong>{" "}
          for companies just going international, and <strong>Consolidation</strong> for
          multi-country companies ready to unify vendors.
        </p>
      </div>

      {/* Shared pipeline */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> The scoring pipeline
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              step: "01",
              title: "Extract",
              body:
                "Pull the article into the app, parse company, HQ, industry, headcount, funding, and explicit expansion language.",
            },
            {
              step: "02",
              title: "Enrich",
              body:
                "Cross-reference public sources to fill in country footprint, revenue band, leadership, and recent press.",
            },
            {
              step: "03",
              title: "Score",
              body:
                "Compare the enriched profile against the active rubric (Expansion or Consolidation) and your ICP Profile, just like the scheduled sourcing runs do.",
            },
            {
              step: "04",
              title: "Draft",
              body:
                "For warm and hot leads, generate a first-touch email that ties the trigger event to GoGlobal's value prop.",
            },
          ].map((s) => (
            <div key={s.step} className="rounded-lg border bg-card p-4">
              <div className="text-xs font-mono text-muted-foreground tabular-nums">
                {s.step}
              </div>
              <div className="font-medium text-sm mt-1">{s.title}</div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tracks */}
      <Tabs defaultValue="expansion" className="mb-12">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="expansion" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Expansion
          </TabsTrigger>
          <TabsTrigger value="consolidation" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Consolidation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expansion" className="mt-6">
          <ExpansionTrack />
        </TabsContent>
        <TabsContent value="consolidation" className="mt-6">
          <ConsolidationTrack />
        </TabsContent>
      </Tabs>

      {/* Tuning */}
      <section className="rounded-lg border bg-gradient-to-br from-card to-card/40 p-6">
        <h2 className="text-base font-semibold mb-2">Tune the score to your book</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every input for both rubrics — industries, funding stages, regions, headcount,
          country footprint, and the natural-language scoring prompt — lives on your{" "}
          <Link to="/settings" className="underline underline-offset-2 hover:text-foreground">
            ICP Profile
          </Link>{" "}
          page. Edit the prompt and leads re-score automatically the next time articles
          come in.
        </p>
        <Link
          to="/settings"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open ICP Profile <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}

function ScoreBands({
  bands,
}: {
  bands: { band: string; range: string; color: string; desc: string }[];
}) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" /> The 0–100 scale
      </h3>
      <div className="grid sm:grid-cols-3 gap-3">
        {bands.map((b) => (
          <div key={b.band} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <Badge className={b.color}>{b.band}</Badge>
              <div className="text-xs font-mono text-muted-foreground">{b.range}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignalGrid({ lifts, drops }: { lifts: string[]; drops: string[] }) {
  return (
    <section className="grid md:grid-cols-2 gap-4 mb-8">
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-[var(--score-hot)]" /> What lifts a score
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {lifts.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="text-[var(--score-hot)] mt-0.5">+</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-[var(--score-cool)]" /> What pulls a score down
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {drops.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="text-[var(--score-cool)] mt-0.5">−</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ExpansionTrack() {
  return (
    <div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        The expansion track targets companies just starting their international journey —
        typically Series B–E with a recent funding round, a first international hire, or an
        opening office abroad.
      </p>

      <ScoreBands
        bands={[
          {
            band: "Hot",
            range: "80–100",
            color: "bg-[var(--score-hot)]/15 text-[var(--score-hot)]",
            desc:
              "Multiple unambiguous signals (recent Series B–E, named international leadership hire, opening offices in 2+ regions). Pursue today.",
          },
          {
            band: "Warm",
            range: "60–79",
            color: "bg-[var(--score-warm)]/15 text-[var(--score-warm)]",
            desc:
              "Real expansion signal but smaller round, single region, or earlier in the journey. Worth a pass but not the top of your list.",
          },
          {
            band: "Cool",
            range: "0–59",
            color: "bg-[var(--score-cool)]/15 text-[var(--score-cool)]",
            desc:
              "Weak or no fit — wrong stage, wrong industry, already global, or US-only. Auto-archived unless you ask to see them.",
          },
        ]}
      />

      {/* High-premium signal */}
      <section className="mb-8">
        <div className="rounded-lg border-2 border-[var(--score-hot)]/30 bg-gradient-to-br from-[var(--score-hot)]/5 to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-md bg-[var(--score-hot)]/15 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-[var(--score-hot)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold">
                  High-premium signal: out-of-HQ job postings
                </h3>
                <Badge className="bg-[var(--score-hot)]/15 text-[var(--score-hot)] text-[10px]">
                  + heavy boost
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                The scoring process checks global job boards — LinkedIn, Indeed, Welcome to
                the Jungle, SEEK, Glassdoor — for active roles posted in countries{" "}
                <em>outside</em> the company's headquarters jurisdiction. A US-HQ company
                with a single role open in Berlin gets a meaningful lift. Five roles across
                DACH and APAC, including a country GM or VP of International, pushes the
                lead straight into Hot territory.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Country of role ≠ HQ country",
                  "Multiple non-HQ regions",
                  "Senior / leadership roles",
                  "Recency of posting",
                ].map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalGrid
        lifts={[
          "Out-of-HQ job postings on global job boards (high premium)",
          "Recent Series B, C, D, or E funding announcement",
          "Explicit international expansion language in the article",
          "Opening a new office abroad or naming a country GM",
          "First non-home-country hires (especially engineering or sales)",
          "Cross-border M&A or partnership announcements",
          "VP / Head of International leadership additions",
          "Industries where GoGlobal historically wins (SaaS, Fintech, HealthTech, AI, Climate)",
        ]}
        drops={[
          "Pre-seed or seed stage with no revenue signal",
          "Single-country focus stated in the article",
          "Already operating in 15+ countries with mature people ops",
          "Industries outside ICP (local services, brick-and-mortar retail)",
          "PE-backed roll-ups or mature enterprises with internal HRIS teams",
          "Layoffs, restructuring, or down-round language",
          "Vague press releases without a concrete expansion event",
        ]}
      />
    </div>
  );
}

function ConsolidationTrack() {
  return (
    <div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        The consolidation track targets companies that are already multi-country and likely
        ready to consolidate fragmented entities, payroll, and EOR vendors under a single
        global provider — funded tech companies in the U.S. or Europe with an established
        5–30 country footprint.
      </p>

      <ScoreBands
        bands={[
          {
            band: "Hot",
            range: "80–100",
            color: "bg-[var(--score-hot)]/15 text-[var(--score-hot)]",
            desc:
              "Series B–F tech company, HQ in U.S. or Western Europe, 8–20 active country presences. Prime consolidation conversation — pursue today.",
          },
          {
            band: "Warm",
            range: "60–79",
            color: "bg-[var(--score-warm)]/15 text-[var(--score-warm)]",
            desc:
              "Tech company with 5–7 or 21–30 countries, or right country range but earlier stage / HQ outside core regions. Worth a tailored outreach.",
          },
          {
            band: "Cool",
            range: "0–59",
            color: "bg-[var(--score-cool)]/15 text-[var(--score-cool)]",
            desc:
              "Fewer than 5 countries (still expanding), 30+ countries (already consolidated), non-tech, or no funding signal. Auto-archived unless surfaced manually.",
          },
        ]}
      />

      {/* Country footprint premium */}
      <section className="mb-6">
        <div className="rounded-lg border-2 border-[var(--score-hot)]/30 bg-gradient-to-br from-[var(--score-hot)]/5 to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-md bg-[var(--score-hot)]/15 flex items-center justify-center shrink-0">
              <Globe2 className="h-5 w-5 text-[var(--score-hot)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold">
                  High-premium signal: 5–30 country footprint
                </h3>
                <Badge className="bg-[var(--score-hot)]/15 text-[var(--score-hot)] text-[10px]">
                  + heavy boost
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Country count is the dominant signal in the consolidation rubric. Companies
                operating in 5–30 countries hit the sweet spot: enough international
                complexity to feel the pain of multiple local vendors, but not yet locked
                into a single global EOR partner.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Country count 8–20: max premium",
                  "Country count 5–7 or 21–30: partial credit",
                  "<5 or >30 countries: penalty",
                  "Source: company site + LinkedIn",
                ].map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Out-of-HQ hiring premium */}
      <section className="mb-8">
        <div className="rounded-lg border-2 border-[var(--score-hot)]/30 bg-gradient-to-br from-[var(--score-hot)]/5 to-transparent p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-md bg-[var(--score-hot)]/15 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-[var(--score-hot)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold">
                  High-premium signal: out-of-HQ hiring velocity
                </h3>
                <Badge className="bg-[var(--score-hot)]/15 text-[var(--score-hot)] text-[10px]">
                  + heavy boost
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Active out-of-HQ hiring confirms the country footprint is real and growing,
                and that local payroll / EOR pain is landing on the People team right now.
                The score scales on both the number of open out-of-HQ roles and the number
                of distinct non-HQ countries.
              </p>
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {[
                  "1–4 roles, 1 country: small lift",
                  "5–14 roles, 2–3 countries: meaningful lift",
                  "15+ roles or 4+ countries: max premium",
                  "Senior / leadership roles weighted 2×",
                  "Recency: posts in the last 30 days only",
                  "Country-of-role ≠ HQ country (mandatory)",
                ].map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="text-[10px] font-normal justify-start"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalGrid
        lifts={[
          "Active presence in 5–30 countries (8–20 = max premium)",
          "Out-of-HQ open roles — more roles and more countries = higher score",
          "Senior / leadership hires (Country GM, VP International) outside HQ",
          "Funding round between Series A and Series F",
          "Technology / SaaS / Fintech / AI / HealthTech industry",
          "Headquarters in the U.S. or Western/Northern Europe",
          "Multiple regional leadership titles (EMEA Lead, APAC GM, etc.)",
          "Recent acquisition adding entities in new jurisdictions",
          "Public mention of operational pain across local payroll vendors",
        ]}
        drops={[
          "Operating in fewer than 5 countries (still expansion-track, not consolidation)",
          "Operating in more than 30 countries (likely already on a global EOR)",
          "Pre-seed / seed with no funded round yet",
          "Non-technology industry (manufacturing, retail, local services)",
          "HQ outside U.S. and Europe (APAC / LATAM HQ deprioritized for this track)",
          "Bootstrapped with no institutional funding",
          "Public news of an existing global EOR / PEO contract",
        ]}
      />

      {/* Weighting */}
      <section className="mb-2">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" /> How the 100 points are allocated
        </h3>
        <div className="rounded-lg border bg-card overflow-hidden">
          {[
            { label: "Country footprint (5–30 range, peak at 8–20)", weight: "30 pts" },
            { label: "Out-of-HQ hiring (roles × non-HQ countries)", weight: "25 pts" },
            { label: "Funding stage (Series A–F, peak at C/D)", weight: "20 pts" },
            { label: "Industry fit (technology / SaaS / adjacent)", weight: "15 pts" },
            { label: "HQ jurisdiction (U.S. or Europe)", weight: "5 pts" },
            {
              label: "Supporting signals (regional leadership, M&A, HR maturity)",
              weight: "5 pts",
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b last:border-b-0 px-4 py-3"
            >
              <div className="text-sm">{row.label}</div>
              <Badge variant="outline" className="font-mono text-xs">
                {row.weight}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
