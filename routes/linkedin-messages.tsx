import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/integrations/supabase/client";
import { generateOutreach, APPROACHES } from "@/lib/outreach.functions";
import { markOutreachSent } from "@/lib/linkedin-tracker.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Linkedin,
  Sparkles,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/linkedin-messages")({
  component: () => (
    <AuthGuard>
      <LinkedInMessages />
    </AuthGuard>
  ),
});

const EXEC_KEYS = [
  { key: "ceo_name", role: "CEO" },
  { key: "cfo_name", role: "CFO" },
  { key: "chro_name", role: "HR Lead" },
  { key: "coo_name", role: "COO" },
  { key: "general_counsel_name", role: "General Counsel" },
] as const;

const CONSOLIDATION_COMPANIES = new Set([
  "Linear",
  "Pigment",
  "Vercel",
  "Qonto",
  "Cohere",
  "Personio",
  "Mistral AI",
  "Bolt",
]);

type LeadType = "Expansion" | "Consolidation";
const leadType = (company: string): LeadType =>
  CONSOLIDATION_COMPANIES.has(company) ? "Consolidation" : "Expansion";

type Lead = {
  id: string;
  company_name: string;
  industry: string | null;
  hq: string | null;
  fit_score: number;
  fit_reasoning: string | null;
  trigger_summary: string | null;
  expansion_signals: string[] | null;
  ceo_name: string | null;
  cfo_name: string | null;
  chro_name: string | null;
  coo_name: string | null;
  general_counsel_name: string | null;
};

type ExecRow = {
  key: string;
  leadId: string;
  company: string;
  industry: string | null;
  hq: string | null;
  score: number;
  reasoning: string | null;
  trigger: string | null;
  signals: string[];
  name: string;
  role: string;
  type: LeadType;
};

const BULK_OPTIONS = [5, 10, 25, 50];

function linkedInSearchUrl(name: string, company: string) {
  const q = encodeURIComponent(`${name} ${company}`);
  return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
}

function LinkedInMessages() {
  const generate = useServerFn(generateOutreach);
  // drafts[rowKey][approachId] = message
  const [drafts, setDrafts] = useState<Record<string, Record<number, string>>>({});
  const [activeApproach, setActiveApproach] = useState<Record<string, number>>({});
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  // generating set keyed as `${rowKey}::${approachId}`
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [bulkN, setBulkN] = useState<number>(10);
  const [bulkApproach, setBulkApproach] = useState<number>(1);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["linkedin-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id,company_name,industry,hq,fit_score,fit_reasoning,trigger_summary,expansion_signals,ceo_name,cfo_name,chro_name,coo_name,general_counsel_name",
        )
        .order("fit_score", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const rows: ExecRow[] = (leads ?? []).flatMap((l) =>
    EXEC_KEYS.flatMap(({ key, role }) => {
      const name = (l as unknown as Record<string, string | null>)[key];
      if (!name) return [];
      return [
        {
          key: `${l.id}-${key}`,
          leadId: l.id,
          company: l.company_name,
          industry: l.industry,
          hq: l.hq,
          score: l.fit_score,
          reasoning: l.fit_reasoning,
          trigger: l.trigger_summary,
          signals: l.expansion_signals ?? [],
          name,
          role,
          type: leadType(l.company_name),
        },
      ];
    }),
  );

  const generateForRow = async (row: ExecRow, approachId: number) => {
    const gKey = `${row.key}::${approachId}`;
    setGenerating((prev) => {
      const n = new Set(prev);
      n.add(gKey);
      return n;
    });
    try {
      const result = await generate({
        data: {
          companyName: row.company,
          industry: row.industry,
          hq: row.hq,
          triggerSummary: row.trigger,
          fitReasoning: row.reasoning,
          expansionSignals: row.signals,
          outOfHqCountries: [],
          contactName: row.name,
          contactRole: row.role,
          approach: approachId,
          leadType: row.type,
        },
      });
      setDrafts((prev) => ({
        ...prev,
        [row.key]: { ...(prev[row.key] ?? {}), [approachId]: result.linkedinMessage },
      }));
      setActiveApproach((prev) => ({ ...prev, [row.key]: approachId }));
      return result.linkedinMessage;
    } finally {
      setGenerating((prev) => {
        const n = new Set(prev);
        n.delete(gKey);
        return n;
      });
    }
  };

  const runBulk = async () => {
    const targets = rows.slice(0, bulkN);
    if (targets.length === 0) return;
    setBulkRunning(true);
    setOpenRows((prev) => {
      const n = { ...prev };
      for (const r of targets) n[r.key] = true;
      return n;
    });
    const settled = await Promise.allSettled(
      targets.map((r) => generateForRow(r, bulkApproach)),
    );
    const ok = settled.filter((s) => s.status === "fulfilled").length;
    const failed = settled.length - ok;
    setBulkRunning(false);
    toast.success(
      `Generated ${ok} message${ok === 1 ? "" : "s"} (Approach ${bulkApproach})${failed ? ` · ${failed} failed` : ""}`,
    );
  };

  const getActiveDraft = (rowKey: string): { id: number; text: string } | null => {
    const map = drafts[rowKey];
    if (!map) return null;
    const id = activeApproach[rowKey];
    if (id && map[id]) return { id, text: map[id] };
    // fall back to first available
    const firstId = Number(Object.keys(map)[0]);
    return firstId ? { id: firstId, text: map[firstId] } : null;
  };

  const copyAll = async () => {
    const targets = rows.slice(0, bulkN).filter((r) => getActiveDraft(r.key));
    if (targets.length === 0) {
      toast.error("No drafts to copy yet. Generate first.");
      return;
    }
    const text = targets
      .map((r) => {
        const d = getActiveDraft(r.key)!;
        return `— ${r.name} · ${r.role} · ${r.company} · Approach ${d.id} (${APPROACHES[d.id].name})\nLinkedIn: ${linkedInSearchUrl(r.name, r.company)}\n\n${d.text}\n`;
      })
      .join("\n———\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1600);
    toast.success(`Copied ${targets.length} message${targets.length === 1 ? "" : "s"}`);
  };


  const exportCsv = () => {
    const targets = rows.slice(0, bulkN);
    if (targets.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = [
      "name",
      "role",
      "company",
      "type",
      "score",
      "hq",
      "industry",
      "linkedin_search_url",
      "approach",
      "message",
    ].join(",");
    const lines = targets.map((r) => {
      const d = getActiveDraft(r.key);
      return [
        r.name,
        r.role,
        r.company,
        r.type,
        r.score,
        r.hq,
        r.industry,
        linkedInSearchUrl(r.name, r.company),
        d ? `${d.id}. ${APPROACHES[d.id].name}` : "",
        d?.text ?? "",
      ]
        .map(esc)
        .join(",");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkedin-messages-top-${targets.length}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${targets.length} row${targets.length === 1 ? "" : "s"} to CSV`);
  };

  const generatedCount = rows
    .slice(0, bulkN)
    .filter((r) => drafts[r.key] && Object.keys(drafts[r.key]).length > 0).length;

  return (
    <div className="px-10 py-8 max-w-7xl">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Outreach
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">LinkedIn Messages</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Executives at the highest-scoring expansion and consolidation targets, ranked by
          company fit. Generate a tailored LinkedIn DM for each contact.
        </p>
      </div>

      {/* Bulk action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
        <span className="text-xs text-muted-foreground">Bulk generate top</span>
        <Select value={String(bulkN)} onValueChange={(v) => setBulkN(Number(v))}>
          <SelectTrigger className="h-8 w-[80px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BULK_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">using</span>
        <Select
          value={String(bulkApproach)}
          onValueChange={(v) => setBulkApproach(Number(v))}
        >
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(APPROACHES).map((a) => (
              <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                Approach {a.id}: {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={runBulk} disabled={bulkRunning || rows.length === 0}>
          {bulkRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate {Math.min(bulkN, rows.length)} messages
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={copyAll}
          disabled={generatedCount === 0}
        >
          {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copy all ({generatedCount})
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {generatedCount} of {Math.min(bulkN, rows.length)} ready
        </span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No executives on file for the current top leads.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Executive</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>LinkedIn</TableHead>
                <TableHead>Why this score</TableHead>
                <TableHead className="w-16 text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const rowDrafts = drafts[r.key] ?? {};
                const active = activeApproach[r.key] ?? 1;
                return (
                  <ExecRowItem
                    key={r.key}
                    row={r}
                    drafts={rowDrafts}
                    activeApproach={active}
                    onSelectApproach={(id) =>
                      setActiveApproach((prev) => ({ ...prev, [r.key]: id }))
                    }
                    open={!!openRows[r.key]}
                    generatingApproaches={
                      new Set(
                        Object.values(APPROACHES)
                          .map((a) => a.id)
                          .filter((id) => generating.has(`${r.key}::${id}`)),
                      )
                    }
                    onToggle={() =>
                      setOpenRows((prev) => ({ ...prev, [r.key]: !prev[r.key] }))
                    }
                    onGenerate={(id) =>
                      generateForRow(r, id).catch(() => undefined)
                    }
                    onChangeDraft={(id, text) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [r.key]: { ...(prev[r.key] ?? {}), [id]: text },
                      }))
                    }
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ExecRowItem({
  row,
  drafts,
  activeApproach,
  onSelectApproach,
  open,
  generatingApproaches,
  onToggle,
  onGenerate,
  onChangeDraft,
}: {
  row: ExecRow;
  drafts: Record<number, string>;
  activeApproach: number;
  onSelectApproach: (id: number) => void;
  open: boolean;
  generatingApproaches: Set<number>;
  onToggle: () => void;
  onGenerate: (approachId: number) => void;
  onChangeDraft: (approachId: number, text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const markSent = useServerFn(markOutreachSent);
  const draft = drafts[activeApproach];
  const isGenerating = generatingApproaches.has(activeApproach);
  const hasAnyDraft = Object.keys(drafts).length > 0;

  const trackSent = async () => {
    try {
      await markSent({
        data: {
          leadId: row.leadId,
          companyName: row.company,
          contactName: row.name,
          contactRole: row.role,
          approach: activeApproach,
          messageText: draft ?? null,
        },
      });
      toast.success(`Logged: ${row.name} · A${activeApproach}`);
    } catch (e) {
      toast.error(`Could not log send: ${(e as Error).message}`);
    }
  };

  const copy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <TableRow className="align-top">
        <TableCell className="py-3">
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Toggle"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell className="py-3 font-medium text-sm">
          <div className="flex items-center gap-1.5">
            {row.name}
            {hasAnyDraft && <Check className="h-3 w-3 text-[var(--score-hot)]" />}
          </div>
        </TableCell>
        <TableCell className="py-3 text-sm">
          <div>{row.company}</div>
          {row.hq && <div className="text-[11px] text-muted-foreground">{row.hq}</div>}
        </TableCell>
        <TableCell className="py-3">
          <Badge
            variant="outline"
            className={
              row.type === "Consolidation"
                ? "text-[10px] border-[var(--score-warm)]/40 text-[var(--score-warm)] bg-[var(--score-warm)]/10"
                : "text-[10px] border-primary/40 text-primary bg-primary/10"
            }
          >
            {row.type}
          </Badge>
        </TableCell>
        <TableCell className="py-3 text-xs text-muted-foreground uppercase tracking-wide">
          {row.role}
        </TableCell>
        <TableCell className="py-3">
          <a
            href={linkedInSearchUrl(row.name, row.company)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Linkedin className="h-3.5 w-3.5" />
            Search
            <ExternalLink className="h-3 w-3" />
          </a>
        </TableCell>
        <TableCell className="py-3 text-xs text-muted-foreground max-w-md">
          <div className="line-clamp-3">{row.reasoning || "—"}</div>
        </TableCell>
        <TableCell className="py-3 text-right text-sm tabular-nums font-medium">
          {row.score}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/20">
            <div className="p-4 space-y-3">
              {row.trigger && (
                <div className="text-xs">
                  <span className="font-medium">Trigger: </span>
                  <span className="text-muted-foreground">{row.trigger}</span>
                </div>
              )}
              {row.signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {row.signals.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Approach selector */}
              <div className="flex flex-wrap gap-1.5">
                {Object.values(APPROACHES).map((a) => {
                  const isActive = a.id === activeApproach;
                  const hasDraft = !!drafts[a.id];
                  const isGen = generatingApproaches.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelectApproach(a.id)}
                      title={a.description}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted border-border"
                      }`}
                    >
                      <span className="font-medium">A{a.id}</span>
                      <span className="opacity-80">{a.name}</span>
                      {isGen && <Loader2 className="h-3 w-3 animate-spin" />}
                      {hasDraft && !isGen && (
                        <Check
                          className={`h-3 w-3 ${isActive ? "" : "text-[var(--score-hot)]"}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-muted-foreground italic">
                {APPROACHES[activeApproach].description}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn DM ·{" "}
                  <span className="text-muted-foreground">
                    Approach {activeApproach}: {APPROACHES[activeApproach].name}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onGenerate(activeApproach)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {draft ? "Regenerate" : "Generate message"}
                  </Button>
                  {draft && (
                    <>
                      <Button size="sm" variant="ghost" onClick={copy}>
                        {copied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await navigator.clipboard.writeText(draft);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1400);
                          window.open(
                            linkedInSearchUrl(row.name, row.company),
                            "_blank",
                            "noopener,noreferrer",
                          );
                          await trackSent();
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open + Copy + Log
                      </Button>
                      <Button size="sm" variant="ghost" onClick={trackSent}>
                        <Check className="h-3.5 w-3.5" />
                        Mark sent
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {draft ? (
                <Textarea
                  value={draft}
                  onChange={(e) => onChangeDraft(activeApproach, e.target.value)}
                  rows={4}
                  className="text-xs"
                />
              ) : isGenerating ? (
                <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
                </div>
              ) : (
                <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
                  Click <span className="font-medium">Generate message</span> to draft an
                  Approach {activeApproach} ({APPROACHES[activeApproach].name}) DM for{" "}
                  {row.name} at {row.company}.
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
