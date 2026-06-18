import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { getIcpConfig, updateIcpConfig } from "@/lib/icp.functions";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AuthGuard>
      <SettingsPage />
    </AuthGuard>
  ),
});

const INDUSTRY_SUGGESTIONS = [
  "SaaS", "Fintech", "HealthTech", "AI/ML", "E-commerce", "Climate Tech",
  "Marketplaces", "Cybersecurity", "DevTools", "EdTech", "Logistics", "Biotech",
];
const STAGE_SUGGESTIONS = ["Seed", "Series A", "Series B", "Series C", "Series D", "Series E", "Growth", "PE"];
const REGION_SUGGESTIONS = ["North America", "Europe", "UK", "DACH", "Nordics", "APAC", "LATAM", "MENA", "Africa", "ANZ"];

function SettingsPage() {
  const fetchConfig = useServerFn(getIcpConfig);
  const saveConfig = useServerFn(updateIcpConfig);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["icp-config"], queryFn: () => fetchConfig() });

  const [industries, setIndustries] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [sizeMin, setSizeMin] = useState<string>("");
  const [sizeMax, setSizeMax] = useState<string>("");
  const [revenueMin, setRevenueMin] = useState<string>("");
  const [revenueMax, setRevenueMax] = useState<string>("");
  const [countriesMin, setCountriesMin] = useState<string>("");
  const [countriesMax, setCountriesMax] = useState<string>("");
  const [scoringPrompt, setScoringPrompt] = useState<string>("");
  const [autoEnrichMin, setAutoEnrichMin] = useState<string>("0");


  useEffect(() => {
    if (!data) return;
    const d = data as Record<string, unknown>;
    setIndustries((d.industries as string[]) ?? []);
    setStages((d.funding_stages as string[]) ?? []);
    setRegions((d.regions as string[]) ?? []);
    setSizeMin((d.company_size_min as number | null)?.toString() ?? "");
    setSizeMax((d.company_size_max as number | null)?.toString() ?? "");
    setRevenueMin((d.revenue_min_usd as number | null)?.toString() ?? "");
    setRevenueMax((d.revenue_max_usd as number | null)?.toString() ?? "");
    setCountriesMin((d.countries_min as number | null)?.toString() ?? "");
    setCountriesMax((d.countries_max as number | null)?.toString() ?? "");
    setScoringPrompt((d.scoring_prompt as string) ?? "");
    setAutoEnrichMin(((d.auto_enrich_contacts_min_score as number | null) ?? 0).toString());
  }, [data]);


  type SavePayload = {
    industries: string[];
    funding_stages: string[];
    regions: string[];
    company_size_min: number | null;
    company_size_max: number | null;
    revenue_min_usd: number | null;
    revenue_max_usd: number | null;
    countries_min: number | null;
    countries_max: number | null;
    scoring_prompt: string;
    auto_enrich_contacts_min_score?: number;
  };
  const mutation = useMutation({
    mutationFn: (payload: SavePayload) => saveConfig({ data: payload }),
    onSuccess: () => {
      toast.success("ICP saved");
      qc.invalidateQueries({ queryKey: ["icp-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const num = (s: string) => (s ? Number(s) : null);
  const onSave = () => {
    mutation.mutate({
      industries,
      funding_stages: stages,
      regions,
      company_size_min: num(sizeMin),
      company_size_max: num(sizeMax),
      revenue_min_usd: num(revenueMin),
      revenue_max_usd: num(revenueMax),
      countries_min: num(countriesMin),
      countries_max: num(countriesMax),
      scoring_prompt: scoringPrompt,
      auto_enrich_contacts_min_score: Math.max(0, Math.min(100, Number(autoEnrichMin) || 0)),
    });
  };


  return (
    <div className="px-10 py-8 max-w-3xl">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Settings</div>
        <h1 className="text-3xl font-semibold tracking-tight">Ideal Customer Profile</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          These criteria drive the 0–100 fit score the AI assigns to every incoming article.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-8">
          <ChipField
            label="Industries"
            description="Verticals where GoGlobal has the strongest play."
            values={industries}
            onChange={setIndustries}
            suggestions={INDUSTRY_SUGGESTIONS}
            placeholder="Add an industry…"
          />
          <ChipField
            label="Funding stages"
            description="Stages that signal budget and headcount growth."
            values={stages}
            onChange={setStages}
            suggestions={STAGE_SUGGESTIONS}
            placeholder="Add a funding stage…"
          />
          <ChipField
            label="HQ locations"
            description="Where target prospects are headquartered."
            values={regions}
            onChange={setRegions}
            suggestions={REGION_SUGGESTIONS}
            placeholder="Add an HQ location…"
          />

          <div>
            <Label>Headcount range</Label>
            <p className="text-xs text-muted-foreground mt-1">Number of employees worldwide.</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input type="number" min={0} placeholder="Min" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} />
              <Input type="number" min={0} placeholder="Max" value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Annual revenue (USD)</Label>
            <p className="text-xs text-muted-foreground mt-1">Approximate ARR or revenue band, in dollars.</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input type="number" min={0} step={1000000} placeholder="Min e.g. 10000000" value={revenueMin} onChange={(e) => setRevenueMin(e.target.value)} />
              <Input type="number" min={0} step={1000000} placeholder="Max e.g. 500000000" value={revenueMax} onChange={(e) => setRevenueMax(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Existing country footprint</Label>
            <p className="text-xs text-muted-foreground mt-1">
              How many countries the company already operates in. Lower numbers usually mean more upside for GoGlobal.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Input type="number" min={0} max={250} placeholder="Min" value={countriesMin} onChange={(e) => setCountriesMin(e.target.value)} />
              <Input type="number" min={0} max={250} placeholder="Max" value={countriesMax} onChange={(e) => setCountriesMax(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="prompt">Scoring prompt</Label>
            <p className="text-xs text-muted-foreground mt-1">
              The instruction the AI uses when scoring fit. Be explicit about what to reward and penalize.
            </p>
            <Textarea
              id="prompt"
              value={scoringPrompt}
              onChange={(e) => setScoringPrompt(e.target.value)}
              rows={8}
              className="mt-2 font-mono text-xs"
            />
          </div>

          <div>
            <Label htmlFor="auto-enrich">Auto-discover decision-makers when fit score ≥</Label>
            <p className="text-xs text-muted-foreground mt-1">
              When the daily search creates a lead with a score at or above this threshold, contacts (CEO, CFO, CHRO, etc.) are fetched automatically via Bright Data. Set to <span className="font-mono">0</span> to disable auto-enrichment — you can still trigger it manually from each lead page.
            </p>
            <Input
              id="auto-enrich"
              type="number"
              min={0}
              max={100}
              value={autoEnrichMin}
              onChange={(e) => setAutoEnrichMin(e.target.value)}
              className="mt-2 max-w-[140px]"
            />
          </div>



          <div className="flex justify-end pt-2 border-t">
            <Button onClick={onSave} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save ICP"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChipField({
  label, description, values, onChange, suggestions, placeholder,
}: {
  label: string;
  description: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));
  const unused = suggestions.filter((s) => !values.includes(s));

  return (
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 min-h-[2rem]">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {v}
            <button onClick={() => remove(v)} className="rounded-sm hover:bg-foreground/10 p-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground italic">Nothing yet</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(draft); }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => add(draft)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="text-[11px] text-muted-foreground hover:text-foreground rounded-md border border-dashed px-2 py-0.5"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
