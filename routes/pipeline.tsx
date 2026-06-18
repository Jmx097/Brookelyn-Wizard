import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  Bookmark,
  BookmarkPlus,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Flame,
  Layers,
  LayoutGrid,
  Pin,
  PinOff,
  Plane,
  Search,
  Sparkles,
  Table as TableIcon,
  Trash2,
  X,
} from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pipeline")({
  component: () => (
    <AuthGuard>
      <Pipeline />
    </AuthGuard>
  ),
});

// ------- Types & helpers -------
type Lead = {
  id: string;
  company_name: string;
  fit_score: number;
  status: "new" | "pursuing" | "contacted" | "passed";
  industry: string | null;
  funding_stage: string | null;
  hq: string | null;
  trigger_summary: string | null;
  fit_reasoning: string | null;
  expansion_signals: string[] | null;
  tier_override: "A" | "B" | "C" | null;
  updated_at: string;
  created_at: string;
};

type Tier = "A" | "B" | "C";

function deriveTier(l: Pick<Lead, "fit_score" | "tier_override">): Tier {
  if (l.tier_override) return l.tier_override;
  if (l.fit_score >= 80) return "A";
  if (l.fit_score >= 60) return "B";
  return "C";
}

function scoreColor(s: number) {
  if (s >= 80) return "text-[var(--score-hot)]";
  if (s >= 60) return "text-[var(--score-warm)]";
  return "text-[var(--score-cool)]";
}

function tierClasses(t: Tier) {
  if (t === "A") return "bg-[var(--score-hot)]/15 text-[var(--score-hot)] border-[var(--score-hot)]/30";
  if (t === "B") return "bg-[var(--score-warm)]/15 text-[var(--score-warm)] border-[var(--score-warm)]/30";
  return "bg-muted text-muted-foreground border-border";
}

function hasOutOfHqSignal(l: Lead): boolean {
  return (l.expansion_signals ?? []).some((s) =>
    /out[- ]?of[- ]?hq|non[- ]?hq|abroad|international hire/i.test(s),
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(ms / 3600000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(ms / 60000);
  return `${Math.max(1, m)}m ago`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

const STATUSES: Lead["status"][] = ["new", "contacted", "passed"];
const TIERS: Tier[] = ["A", "B", "C"];

const CONSOLIDATION_COMPANIES = new Set([
  "Linear", "Pigment", "Vercel", "Qonto", "Cohere", "Personio", "Mistral AI", "Bolt",
]);
function leadType(l: Pick<Lead, "company_name">): "Consolidation" | "Expansion" {
  return CONSOLIDATION_COMPANIES.has(l.company_name) ? "Consolidation" : "Expansion";
}

const COLUMNS = [
  { key: "new", label: "New" },
  { key: "pursuing", label: "Pursuing" },
  { key: "contacted", label: "Contacted" },
  { key: "passed", label: "Passed" },
] as const;

type LeadType = "Consolidation" | "Expansion";
const LEAD_TYPES: LeadType[] = ["Consolidation", "Expansion"];

type FilterState = {
  q: string;
  statuses: Lead["status"][];
  tiers: Tier[];
  types: LeadType[];
  industries: string[];
  stages: string[];
  scoreMin: number;
  outOfHqOnly: boolean;
  sinceDays: number; // 0 = no date filter
  alertOnly: boolean; // only leads sourced from Google Alerts
};

const DEFAULT_FILTERS: FilterState = {
  q: "",
  statuses: [],
  tiers: [],
  types: [],
  industries: [],
  stages: [],
  scoreMin: 0,
  outOfHqOnly: false,
  sinceDays: 0,
  alertOnly: false,
};

type SortKey = "fit_score" | "company_name" | "updated_at" | "tier";
type SortState = { key: SortKey; dir: "asc" | "desc" };

// Built-in views
type BuiltinView = {
  id: string;
  name: string;
  filters: Partial<FilterState>;
  sort?: SortState;
  icon: typeof Flame;
  description: string;
  accent: string; // tailwind classes for icon chip
  ring: string; // tailwind classes for active border
};

const BUILTIN_VIEWS: BuiltinView[] = [
  {
    id: "last-7",
    name: "Last 7 Days",
    filters: { sinceDays: 7, alertOnly: true },
    icon: Flame,
    description: "Google Alerts from the last 7 days",
    accent: "bg-[oklch(0.96_0.05_30)] text-[oklch(0.55_0.18_30)]",
    ring: "ring-[oklch(0.55_0.18_30)]/40",
  },
  {
    id: "last-30",
    name: "Last 30 Days",
    filters: { sinceDays: 30, alertOnly: true },
    icon: Activity,
    description: "Google Alerts from the last 30 days",
    accent: "bg-[oklch(0.95_0.04_256)] text-[oklch(0.45_0.14_256)]",
    ring: "ring-[oklch(0.55_0.16_256)]/40",
  },
  {
    id: "all",
    name: "All Leads",
    filters: {},
    icon: Layers,
    description: "Everything captured",
    accent: "bg-muted text-muted-foreground",
    ring: "ring-foreground/20",
  },
];


function countForView(leads: Lead[], f: Partial<FilterState>, alertLeadIds?: Set<string>): number {
  const now = Date.now();
  return leads.filter((l) => {
    if (f.statuses?.length && !f.statuses.includes(l.status)) return false;
    if (f.tiers?.length && !f.tiers.includes(deriveTier(l))) return false;
    if (f.outOfHqOnly && !hasOutOfHqSignal(l)) return false;
    if (f.sinceDays && f.sinceDays > 0) {
      const ageDays = (now - new Date(l.created_at).getTime()) / 86400000;
      if (ageDays > f.sinceDays) return false;
    }
    if (f.alertOnly && alertLeadIds && !alertLeadIds.has(l.id)) return false;
    return true;
  }).length;
}

// ------- Component -------
function Pipeline() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: "fit_score", dir: "desc" });
  const [view, setView] = useState<"table" | "kanban">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [activeViewId, setActiveViewId] = useState<string>("all");
  const [saveOpen, setSaveOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const PAGE_SIZE = 50;

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, fit_score, status, industry, funding_stage, hq, trigger_summary, fit_reasoning, expansion_signals, tier_override, updated_at, created_at",
        )
        .order("fit_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const { data: alertLeadIds } = useQuery({
    queryKey: ["alert-lead-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("lead_id")
        .eq("source", "alert_email")
        .not("lead_id", "is", null);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.lead_id as string));
    },
  });

  const { data: savedViews } = useQuery({
    queryKey: ["saved_views"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_views")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Derived option lists
  const allIndustries = useMemo(
    () => Array.from(new Set((leads ?? []).map((l) => l.industry).filter(Boolean) as string[])).sort(),
    [leads],
  );
  const allStages = useMemo(
    () =>
      Array.from(new Set((leads ?? []).map((l) => l.funding_stage).filter(Boolean) as string[])).sort(),
    [leads],
  );

  // Apply filters + sort
  const filtered = useMemo(() => {
    const now = Date.now();
    const list = (leads ?? []).filter((l) => {
      if (filters.q && !l.company_name.toLowerCase().includes(filters.q.toLowerCase())) return false;
      if (filters.statuses.length && !filters.statuses.includes(l.status)) return false;
      if (filters.scoreMin > 0 && l.fit_score < filters.scoreMin) return false;
      if (filters.tiers.length && !filters.tiers.includes(deriveTier(l))) return false;
      if (filters.types.length && !filters.types.includes(leadType(l))) return false;
      if (filters.industries.length && (!l.industry || !filters.industries.includes(l.industry)))
        return false;
      if (filters.stages.length && (!l.funding_stage || !filters.stages.includes(l.funding_stage)))
        return false;
      if (filters.outOfHqOnly && !hasOutOfHqSignal(l)) return false;
      if (filters.sinceDays > 0) {
        const ageDays = (now - new Date(l.created_at).getTime()) / 86400000;
        if (ageDays > filters.sinceDays) return false;
      }
      if (filters.alertOnly && alertLeadIds && !alertLeadIds.has(l.id)) return false;
      return true;
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === "company_name") return a.company_name.localeCompare(b.company_name) * dir;
      if (sort.key === "updated_at")
        return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * dir;
      if (sort.key === "tier") return deriveTier(a).localeCompare(deriveTier(b)) * dir;
      return (a.fit_score - b.fit_score) * dir;
    });
    return list;
  }, [leads, filters, sort, alertLeadIds]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // ---- Actions ----
  function applyView(id: string, base: Partial<FilterState>, baseSort?: SortState) {
    setActiveViewId(id);
    setFilters({ ...DEFAULT_FILTERS, ...base });
    if (baseSort) setSort(baseSort);
    setPage(0);
    setSelected(new Set());
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  function toggleArrItem<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  async function updateLeadStatus(id: string, status: Lead["status"]) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Status → ${status}`);
    qc.invalidateQueries({ queryKey: ["leads-all"] });
    qc.invalidateQueries({ queryKey: ["leads-digest"] });
  }

  async function bulkUpdateStatus(status: Lead["status"]) {
    const ids = Array.from(selected);
    const { error } = await supabase.from("leads").update({ status }).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Moved ${ids.length} lead${ids.length === 1 ? "" : "s"} → ${status}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["leads-all"] });
    qc.invalidateQueries({ queryKey: ["leads-digest"] });
  }

  async function bulkSetTier(tier: Tier | null) {
    const ids = Array.from(selected);
    const { error } = await supabase.from("leads").update({ tier_override: tier }).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Tier updated for ${ids.length} lead${ids.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["leads-all"] });
  }

  async function saveCurrentView() {
    if (!newViewName.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sign in to save views");
      return;
    }
    const { error } = await supabase.from("saved_views").insert({
      user_id: u.user.id,
      name: newViewName.trim(),
      filters: filters as never,
      sort: sort as never,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("View saved");
    setNewViewName("");
    setSaveOpen(false);
    qc.invalidateQueries({ queryKey: ["saved_views"] });
  }

  async function deleteView(id: string) {
    const { error } = await supabase.from("saved_views").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["saved_views"] });
  }

  async function togglePin(id: string, current: boolean) {
    const { error } = await supabase.from("saved_views").update({ is_pinned: !current }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["saved_views"] });
  }

  const allOnPageSelected = paged.length > 0 && paged.every((l) => selected.has(l.id));
  const activeFilterChips: { label: string; clear: () => void }[] = [];
  if (filters.q) activeFilterChips.push({ label: `"${filters.q}"`, clear: () => setFilters({ ...filters, q: "" }) });
  if (filters.scoreMin > 0)
    activeFilterChips.push({ label: `Score ≥ ${filters.scoreMin}`, clear: () => setFilters({ ...filters, scoreMin: 0 }) });
  filters.statuses.forEach((s) =>
    activeFilterChips.push({
      label: `Status: ${s}`,
      clear: () => setFilters({ ...filters, statuses: filters.statuses.filter((x) => x !== s) }),
    }),
  );
  filters.tiers.forEach((t) =>
    activeFilterChips.push({
      label: `Tier ${t}`,
      clear: () => setFilters({ ...filters, tiers: filters.tiers.filter((x) => x !== t) }),
    }),
  );
  filters.types.forEach((t) =>
    activeFilterChips.push({
      label: `Type: ${t}`,
      clear: () => setFilters({ ...filters, types: filters.types.filter((x) => x !== t) }),
    }),
  );
  filters.industries.forEach((i) =>
    activeFilterChips.push({
      label: i,
      clear: () => setFilters({ ...filters, industries: filters.industries.filter((x) => x !== i) }),
    }),
  );
  filters.stages.forEach((s) =>
    activeFilterChips.push({
      label: s,
      clear: () => setFilters({ ...filters, stages: filters.stages.filter((x) => x !== s) }),
    }),
  );
  if (filters.outOfHqOnly)
    activeFilterChips.push({
      label: "Out-of-HQ hiring",
      clear: () => setFilters({ ...filters, outOfHqOnly: false }),
    });

  // ------- Render -------
  return (
    <div className="px-6 lg:px-10 py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pipeline</div>
        <h1 className="text-3xl font-semibold tracking-tight">Your prospect board</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {isLoading ? "Loading…" : `${filtered.length} of ${(leads ?? []).length} leads`}
        </p>
      </div>

      <div className="mb-6">
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Quick views
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">
              Tap a card to filter the board
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {BUILTIN_VIEWS.map((v) => {
            const Icon = v.icon;
            const count = countForView(leads ?? [], v.filters, alertLeadIds);
            const isActive = activeViewId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => applyView(v.id, v.filters, v.sort)}
                className={cn(
                  "group relative text-left rounded-xl border bg-card p-4 transition-all",
                  "hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5",
                  isActive
                    ? cn("ring-2 shadow-[var(--shadow-elevated)] border-transparent", v.ring)
                    : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      v.accent,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </div>
                  <div
                    className={cn(
                      "text-2xl font-semibold tabular-nums tracking-tight font-display leading-none mt-1",
                      isActive ? "text-foreground" : "text-foreground/85",
                    )}
                  >
                    {isLoading ? "–" : count}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-semibold text-foreground leading-tight">
                    {v.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {v.description}
                  </div>
                </div>
                {isActive && (
                  <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* My views — horizontal bar */}
      <div className="mb-4 rounded-lg border bg-card/50 px-3 py-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r">
          <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            My views
          </span>
        </div>
        {(savedViews ?? []).length === 0 && (
          <span className="text-xs text-muted-foreground">No saved views yet</span>
        )}
        {(savedViews ?? []).map((v) => (
          <div
            key={v.id}
            className={cn(
              "group flex items-center gap-1 pl-2 pr-1 py-1 rounded-md border bg-background hover:bg-muted/60",
              activeViewId === v.id && "bg-muted border-primary/40",
            )}
          >
            <button
              onClick={() =>
                applyView(
                  v.id,
                  (v.filters as unknown as Partial<FilterState>) ?? {},
                  (v.sort as unknown as SortState) ?? undefined,
                )
              }
              className="text-sm flex items-center gap-1.5 min-w-0"
            >
              {v.is_pinned && <Bookmark className="h-3 w-3 shrink-0 text-primary" />}
              <span className="truncate max-w-[180px]">{v.name}</span>
            </button>
            <button
              onClick={() => togglePin(v.id, v.is_pinned)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5"
              title={v.is_pinned ? "Unpin" : "Pin"}
            >
              {v.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
            <button
              onClick={() => deleteView(v.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
              title="Delete view"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 ml-auto gap-1.5">
              <BookmarkPlus className="h-3.5 w-3.5" />
              <span className="text-xs">Save current view</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save current view</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="vname">View name</Label>
              <Input
                id="vname"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g. Q2 Series C targets"
              />
              <p className="text-xs text-muted-foreground">
                {activeFilterChips.length} filter{activeFilterChips.length === 1 ? "" : "s"} will be saved.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveCurrentView}>Save view</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        {/* Main column */}
        <div className="min-w-0 space-y-3">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search company…"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="pl-8 h-9"
              />
            </div>

            <Select
              value={filters.scoreMin === 0 ? "any" : String(filters.scoreMin)}
              onValueChange={(v) => setFilters({ ...filters, scoreMin: v === "any" ? 0 : Number(v) })}
            >
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Min score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any score</SelectItem>
                <SelectItem value="80">≥ 80 (Hot)</SelectItem>
                <SelectItem value="60">≥ 60 (Warm)</SelectItem>
                <SelectItem value="40">≥ 40</SelectItem>
              </SelectContent>
            </Select>

            <MultiPopover
              label="Tier"
              options={TIERS}
              selected={filters.tiers}
              onToggle={(t) => setFilters({ ...filters, tiers: toggleArrItem(filters.tiers, t) })}
            />
            <MultiPopover
              label="Type"
              options={LEAD_TYPES}
              selected={filters.types}
              onToggle={(t) => setFilters({ ...filters, types: toggleArrItem(filters.types, t) })}
            />
            <MultiPopover
              label="Status"
              options={STATUSES}
              selected={filters.statuses}
              onToggle={(s) => setFilters({ ...filters, statuses: toggleArrItem(filters.statuses, s) })}
            />
            <MultiPopover
              label="Industry"
              options={allIndustries}
              selected={filters.industries}
              onToggle={(i) =>
                setFilters({ ...filters, industries: toggleArrItem(filters.industries, i) })
              }
            />
            <MultiPopover
              label="Stage"
              options={allStages}
              selected={filters.stages}
              onToggle={(s) => setFilters({ ...filters, stages: toggleArrItem(filters.stages, s) })}
            />

            <Button
              variant={filters.outOfHqOnly ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setFilters({ ...filters, outOfHqOnly: !filters.outOfHqOnly })}
            >
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Out-of-HQ
            </Button>

            <div className="ml-auto flex items-center gap-1 border rounded-md p-0.5">
              <Button
                size="sm"
                variant={view === "table" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setView("table")}
              >
                <TableIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={view === "kanban" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setView("kanban")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilterChips.map((c, i) => (
                <Badge key={i} variant="secondary" className="gap-1 font-normal">
                  {c.label}
                  <button onClick={c.clear} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <div className="h-4 w-px bg-border mx-1" />
              <span className="text-xs text-muted-foreground">Move to:</span>
              {STATUSES.map((s) => (
                <Button key={s} size="sm" variant="ghost" className="h-7" onClick={() => bulkUpdateStatus(s)}>
                  {s}
                </Button>
              ))}
              <div className="h-4 w-px bg-border mx-1" />
              <span className="text-xs text-muted-foreground">Tier:</span>
              {TIERS.map((t) => (
                <Button key={t} size="sm" variant="ghost" className="h-7 px-2" onClick={() => bulkSetTier(t)}>
                  {t}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="h-7" onClick={() => bulkSetTier(null)}>
                Reset
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 ml-auto"
                onClick={() => setSelected(new Set())}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Body */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Loading leads…</div>
          ) : view === "table" ? (
            <>
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          checked={allOnPageSelected}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) paged.forEach((l) => next.add(l.id));
                            else paged.forEach((l) => next.delete(l.id));
                            setSelected(next);
                          }}
                        />
                      </TableHead>
                      <SortableHead label="Tier" k="tier" sort={sort} onSort={toggleSort} className="w-14" />
                      <SortableHead
                        label="Company"
                        k="company_name"
                        sort={sort}
                        onSort={toggleSort}
                      />
                      <TableHead className="w-28">Type</TableHead>
                      <TableHead className="w-28">Date</TableHead>
                      <SortableHead
                        label="Score"
                        k="fit_score"
                        sort={sort}
                        onSort={toggleSort}
                        className="w-16 text-right"
                      />
                      <TableHead>Status</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>HQ</TableHead>
                      <TableHead className="min-w-[260px]">Trigger</TableHead>
                      <SortableHead
                        label="Updated"
                        k="updated_at"
                        sort={sort}
                        onSort={toggleSort}
                        className="w-24"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                          No leads match these filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {paged.map((l) => {
                      const tier = deriveTier(l);
                      const isSel = selected.has(l.id);
                      return (
                        <TableRow
                          key={l.id}
                          data-state={isSel ? "selected" : undefined}
                          className="text-xs"
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={(v) => {
                                const next = new Set(selected);
                                if (v) next.add(l.id);
                                else next.delete(l.id);
                                setSelected(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-6 h-6 rounded-md border text-[11px] font-bold",
                                tierClasses(tier),
                              )}
                            >
                              {tier}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            <Link
                              to="/leads/$leadId"
                              params={{ leadId: l.id }}
                              className="hover:underline"
                            >
                              {l.company_name}
                            </Link>
                            {hasOutOfHqSignal(l) && (
                              <Briefcase className="inline h-3 w-3 ml-1.5 text-[var(--score-hot)]" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-normal",
                                leadType(l) === "Consolidation"
                                  ? "border-[var(--score-warm)]/40 text-[var(--score-warm)]"
                                  : "border-[var(--score-hot)]/40 text-[var(--score-hot)]",
                              )}
                            >
                              {leadType(l)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {formatDate(l.created_at)}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums font-semibold", scoreColor(l.fit_score))}>
                            {l.fit_score}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={l.status}
                              onValueChange={(v) => updateLeadStatus(l.id, v as Lead["status"])}
                            >
                              <SelectTrigger className="h-7 w-[110px] text-[11px] capitalize">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs capitalize">
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{l.industry ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{l.funding_stage ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{l.hq ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[360px]">
                            <div className="line-clamp-1">{l.trigger_summary || l.fit_reasoning || "—"}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {timeAgo(l.updated_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Kanban — uses filtered set so it scales with the active view
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {COLUMNS.map((col) => {
                const items = filtered.filter((l) => l.status === col.key);
                return (
                  <div key={col.key} className="rounded-lg border bg-card/40">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                      <div className="text-sm font-semibold">{col.label}</div>
                      <Badge variant="secondary" className="text-[10px]">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="p-2 space-y-2 min-h-[160px] max-h-[70vh] overflow-y-auto">
                      {items.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-6">No leads</div>
                      )}
                      {items.map((l) => {
                        const tier = deriveTier(l);
                        return (
                          <Link
                            key={l.id}
                            to="/leads/$leadId"
                            params={{ leadId: l.id }}
                            className="block rounded-md border bg-card p-3 hover:border-foreground/20 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm leading-tight">{l.company_name}</div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold border",
                                    tierClasses(tier),
                                  )}
                                >
                                  {tier}
                                </span>
                                <span className={cn("text-xs font-semibold tabular-nums", scoreColor(l.fit_score))}>
                                  {l.fit_score}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {l.funding_stage && (
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {l.funding_stage}
                                </Badge>
                              )}
                              {l.industry && (
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {l.industry}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">
                              {l.trigger_summary || l.fit_reasoning}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------- Subcomponents -------
function SortableHead({
  label,
  k,
  sort,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
      >
        {label}
        {active && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}

function MultiPopover<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
              {selected.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Filter by {label.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {options.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">No options available.</div>
          )}
          {options.map((o) => {
            const isSel = selected.includes(o);
            return (
              <label
                key={o}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer text-sm"
              >
                <Checkbox checked={isSel} onCheckedChange={() => onToggle(o)} />
                <span className="capitalize">{o}</span>
              </label>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
