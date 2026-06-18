import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUpRight, Layers, Search, Mail, Radar, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { listOutreach, type OutreachRow } from "@/lib/linkedin-tracker.functions";
import { APPROACHES } from "@/lib/outreach.functions";
import {
  listContactStatuses,
  upsertContactStatus,
  CONTACT_STATUSES,
  CONTACT_STATUS_LABEL,
  type ContactProgressStatus,
  type ContactStatusRow,
} from "@/lib/contact-status.functions";

export const Route = createFileRoute("/my-leads")({
  component: () => (
    <AuthGuard>
      <MyLeadsPage />
    </AuthGuard>
  ),
});

type LeadSource = "gAlerts" | "autoSearch" | "manualUpload";

type CalendarWindow = "all" | "today" | "weeks" | "months";
type Grouping = "all" | "score" | "vertical" | "status";
type ContactGrouping = "all" | "status" | "approach" | "company" | "autoSearch" | "gAlerts" | "manualUpload";
type Stage = "all" | "marinating" | "followup" | "fivedone";

type Lead = {
  id: string;
  company_name: string;
  industry: string | null;
  funding_stage: string | null;
  funding_amount: string | null;
  hq: string | null;
  fit_score: number;
  status: string;
  trigger_summary: string | null;
  fit_reasoning: string | null;
  created_at: string;
};

function scoreBand(s: number) {
  if (s >= 80) return { key: "Hot (80+)", color: "bg-[var(--score-hot)]/15 text-[var(--score-hot)]" };
  if (s >= 60) return { key: "Warm (60–79)", color: "bg-[var(--score-warm)]/15 text-[var(--score-warm)]" };
  if (s >= 40) return { key: "Cool (40–59)", color: "bg-[var(--score-cool)]/15 text-[var(--score-cool)]" };
  return { key: "Cold (<40)", color: "bg-muted text-muted-foreground" };
}

const SCORE_BAND_ORDER = ["Hot (80+)", "Warm (60–79)", "Cool (40–59)", "Cold (<40)"];

const DAY = 24 * 60 * 60 * 1000;

function withinWindow(createdAt: string, w: CalendarWindow, weekOffset = 0, monthOffset = 0) {
  const d = new Date(createdAt);
  const t = d.getTime();
  const now = Date.now();
  if (w === "today") return now - t < DAY;
  if (w === "weeks") {
    const start = now - (weekOffset + 1) * 7 * DAY;
    const end = now - weekOffset * 7 * DAY;
    return t >= start && t < end;
  }
  const ref = new Date();
  const targetYear = ref.getFullYear();
  const targetMonth = ref.getMonth() - monthOffset;
  const start = new Date(targetYear, targetMonth, 1).getTime();
  const end = new Date(targetYear, targetMonth + 1, 1).getTime();
  return t >= start && t < end;
}

function weekRangeLabel(offset: number): string {
  const now = Date.now();
  const start = new Date(now - (offset + 1) * 7 * DAY);
  const end = new Date(now - offset * 7 * DAY);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(offset: number): { name: string; year: number } {
  const ref = new Date();
  const d = new Date(ref.getFullYear(), ref.getMonth() - offset, 1);
  return { name: MONTH_NAMES[d.getMonth()], year: d.getFullYear() };
}

const STATUS_LABEL: Record<OutreachRow["status"], string> = {
  queued: "Queued",
  sent: "Sent",
  replied: "Replied",
  meeting: "Meeting",
  no_response: "No reply",
  passed: "Passed",
};

function MyLeadsPage() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["my-leads-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id,company_name,industry,funding_stage,funding_amount,hq,fit_score,status,trigger_summary,fit_reasoning,created_at",
        )
        .order("fit_score", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  // Per-lead source bucket: Google Alerts (any forwarded alert_email article),
  // Auto Search (web_search or other article-backed leads), or Manual Upload
  // (leads with no article — e.g. created via CSV/spreadsheet import).
  const { data: leadSources } = useQuery({
    queryKey: ["lead-source-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("lead_id,source")
        .not("lead_id", "is", null)
        .limit(5000);
      if (error) throw error;
      const m = new Map<string, LeadSource>();
      for (const a of data ?? []) {
        if (!a.lead_id) continue;
        if (a.source === "alert_email") m.set(a.lead_id, "gAlerts");
        else if (!m.has(a.lead_id)) m.set(a.lead_id, "autoSearch");
      }
      return m;
    },
  });
  const sourceFor = (leadId: string): LeadSource =>
    leadSources?.get(leadId) ?? "manualUpload";

  const fetchOutreach = useServerFn(listOutreach);
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["linkedin-outreach"],
    queryFn: () => fetchOutreach(),
  });

  const { autoSearch, gAlerts, manualUpload } = useMemo(() => {
    const all = leads ?? [];
    return {
      autoSearch: all.filter((l) => sourceFor(l.id) === "autoSearch"),
      gAlerts: all.filter((l) => sourceFor(l.id) === "gAlerts"),
      manualUpload: all.filter((l) => sourceFor(l.id) === "manualUpload"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, leadSources]);

  const { contactsAutoSearch, contactsGAlerts, contactsManualUpload } = useMemo(() => {
    const all = (contacts ?? []) as OutreachRow[];
    return {
      contactsAutoSearch: all.filter((c) => sourceFor(c.lead_id) === "autoSearch"),
      contactsGAlerts: all.filter((c) => sourceFor(c.lead_id) === "gAlerts"),
      contactsManualUpload: all.filter((c) => sourceFor(c.lead_id) === "manualUpload"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, leadSources]);

  return (
    <div className="px-10 py-8 max-w-[1400px]">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Dashboard</div>
        <h1 className="text-3xl font-semibold tracking-tight">My Leads</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          All leads in one view. Toggle pipeline, filter by recency, and group by score, vertical, or status.
        </p>
      </div>

      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="leads">My Companies</TabsTrigger>
          <TabsTrigger value="contacts">My Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <LeadColumn autoSearch={autoSearch} gAlerts={gAlerts} manualUpload={manualUpload} />
          )}
        </TabsContent>

        <TabsContent value="contacts">
          {contactsLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <ContactsColumn autoSearch={contactsAutoSearch} gAlerts={contactsGAlerts} manualUpload={contactsManualUpload} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Pipeline = "all" | "autoSearch" | "gAlerts" | "manualUpload";

function LeadColumn({
  autoSearch,
  gAlerts,
  manualUpload,
}: {
  autoSearch: Lead[];
  gAlerts: Lead[];
  manualUpload: Lead[];
}) {
  const [pipeline, setPipeline] = useState<Pipeline>("all");
  const [calendar, setCalendar] = useState<CalendarWindow>("all");
  const [grouping, setGrouping] = useState<Grouping>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [search, setSearch] = useState("");

  const fetchStatuses = useServerFn(listContactStatuses);
  const { data: statusRows } = useQuery({
    queryKey: ["contact-statuses"],
    queryFn: () => fetchStatuses(),
  });
  const leadStatusMap = useMemo(() => {
    const priority: ContactProgressStatus[] = [
      "opportunity",
      "meeting",
      "engaged",
      "no_show",
      "not_responded",
    ];
    const rank = (s: ContactProgressStatus) => priority.indexOf(s);
    const m = new Map<string, ContactProgressStatus>();
    for (const r of (statusRows ?? []) as ContactStatusRow[]) {
      const cur = m.get(r.lead_id);
      if (!cur || rank(r.status) < rank(cur)) m.set(r.lead_id, r.status);
    }
    return m;
  }, [statusRows]);
  const getLeadStatus = (l: Lead): ContactProgressStatus =>
    leadStatusMap.get(l.id) ?? "not_responded";

  const leads = useMemo(() => {
    if (pipeline === "autoSearch") return autoSearch;
    if (pipeline === "gAlerts") return gAlerts;
    if (pipeline === "manualUpload") return manualUpload;
    return [...autoSearch, ...gAlerts, ...manualUpload];
  }, [pipeline, autoSearch, gAlerts, manualUpload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = leads;
    if (q) {
      result = leads.filter((l) =>
        l.company_name.toLowerCase().includes(q) ||
        (l.industry ?? "").toLowerCase().includes(q) ||
        (l.hq ?? "").toLowerCase().includes(q) ||
        (l.trigger_summary ?? "").toLowerCase().includes(q)
      );
    } else if (calendar !== "all") {
      result = leads.filter((l) => withinWindow(l.created_at, calendar, weekOffset, monthOffset));
    }
    return result;
  }, [leads, calendar, weekOffset, monthOffset, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of filtered) {
      let key: string;
      if (grouping === "all") key = "All";
      else if (grouping === "score") key = scoreBand(l.fit_score).key;
      else if (grouping === "vertical") key = l.industry || "Unspecified";
      else key = CONTACT_STATUS_LABEL[getLeadStatus(l)];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (grouping === "all") return a[0].localeCompare(b[0]);
      if (grouping === "score") {
        return SCORE_BAND_ORDER.indexOf(a[0]) - SCORE_BAND_ORDER.indexOf(b[0]);
      }
      return b[1].length - a[1].length;
    }).map(([key, items]) => {
      if (grouping === "all") {
        return [key, items.sort((a, b) => a.company_name.localeCompare(b.company_name))] as [string, Lead[]];
      }
      return [key, items] as [string, Lead[]];
    });
  }, [filtered, grouping, leadStatusMap]);

  return (
    <section className="rounded-xl border bg-card">
      <div className="px-5 pt-5 pb-4 border-b flex items-center gap-2 flex-wrap">
        <PipelineButton active={pipeline === "all"} onClick={() => setPipeline("all")} icon={<Layers className="h-4 w-4" />}>
          All ({autoSearch.length + gAlerts.length + manualUpload.length})
        </PipelineButton>
        <PipelineButton active={pipeline === "gAlerts"} onClick={() => setPipeline("gAlerts")} icon={<Mail className="h-4 w-4" />}>
          Google Alerts ({gAlerts.length})
        </PipelineButton>
        <PipelineButton active={pipeline === "autoSearch"} onClick={() => setPipeline("autoSearch")} icon={<Radar className="h-4 w-4" />}>
          Auto Search ({autoSearch.length})
        </PipelineButton>
        <PipelineButton active={pipeline === "manualUpload"} onClick={() => setPipeline("manualUpload")} icon={<Upload className="h-4 w-4" />}>
          Manual Upload ({manualUpload.length})
        </PipelineButton>
      </div>

      <div className="grid grid-cols-2 gap-5 px-5 py-4 border-b bg-muted/30">
        <FilterGroup
          label="Calendar"
          value={calendar}
          options={[
            { value: "all", label: "All" },
            { value: "today", label: "Today" },
            { value: "weeks", label: "Weeks" },
            { value: "months", label: "Months" },
          ]}
          onChange={(v) => setCalendar(v as CalendarWindow)}
        />
        <FilterGroup
          label="Category"
          value={grouping}
          options={[
            { value: "all", label: "All" },
            { value: "score", label: "Score" },
            { value: "vertical", label: "Vertical" },
            { value: "status", label: "Status" },
          ]}
          onChange={(v) => setGrouping(v as Grouping)}
        />
      </div>

      {calendar === "weeks" && (
        <WeekPicker value={weekOffset} onChange={setWeekOffset} />
      )}
      {calendar === "months" && (
        <MonthPicker value={monthOffset} onChange={setMonthOffset} />
      )}

      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, vertical, or location…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-muted-foreground">
            {filtered.length} lead{filtered.length === 1 ? "" : "s"} · grouped by {grouping}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No leads in this window.
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([key, items]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {key}
                  </div>
                  <div className="text-xs text-muted-foreground">· {items.length}</div>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {items.map((l) => (
                    <LeadRow key={l.id} lead={l} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ContactsColumn({
  autoSearch,
  gAlerts,
  manualUpload,
}: {
  autoSearch: OutreachRow[];
  gAlerts: OutreachRow[];
  manualUpload: OutreachRow[];
}) {
  const [stage, setStage] = useState<Stage>("all");
  const [calendar, setCalendar] = useState<CalendarWindow>("all");
  const [grouping, setGrouping] = useState<ContactGrouping>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [search, setSearch] = useState("");

  const fetchStatuses = useServerFn(listContactStatuses);
  const { data: statusRows } = useQuery({
    queryKey: ["contact-statuses"],
    queryFn: () => fetchStatuses(),
  });
  const statusMap = useMemo(() => {
    const m = new Map<string, ContactProgressStatus>();
    for (const r of (statusRows ?? []) as ContactStatusRow[]) {
      m.set(`${r.lead_id}::${r.contact_name}`, r.status);
    }
    return m;
  }, [statusRows]);
  const getStatus = (c: OutreachRow): ContactProgressStatus =>
    statusMap.get(`${c.lead_id}::${c.contact_name}`) ?? "not_responded";

  // Dedup to one row per contact (latest message wins). "A contact" = lead_id + contact_name.
  const allContacts = useMemo(() => {
    const merged = [...autoSearch, ...gAlerts, ...manualUpload];
    const latest = new Map<string, OutreachRow>();
    for (const c of merged) {
      const k = `${c.lead_id}::${c.contact_name}`;
      const t = new Date(c.sent_at ?? c.last_status_change_at).getTime();
      const cur = latest.get(k);
      if (!cur || t > new Date(cur.sent_at ?? cur.last_status_change_at).getTime()) {
        latest.set(k, c);
      }
    }
    return Array.from(latest.values());
  }, [autoSearch, gAlerts, manualUpload]);

  // Count distinct approaches sent per contact
  const approachCountByContact = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const c of [...autoSearch, ...gAlerts, ...manualUpload]) {
      const k = `${c.lead_id}::${c.contact_name}`;
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(c.approach);
    }
    return m;
  }, [autoSearch, gAlerts, manualUpload]);

  const hasResponded = (c: OutreachRow) =>
    c.status === "replied" || c.status === "meeting";

  const stageOf = (c: OutreachRow): Stage => {
    const k = `${c.lead_id}::${c.contact_name}`;
    const msgCount = approachCountByContact.get(k)?.size ?? 0;
    const bizDays = businessDaysSince(c.sent_at ?? c.last_status_change_at);
    if (msgCount >= 5 && !hasResponded(c)) return "fivedone";
    if (hasResponded(c)) return "fivedone"; // treat replied/meeting as "Done"
    if (bizDays >= 5) return "followup";
    return "marinating";
  };

  const stageCounts = useMemo(() => {
    const counts = { all: allContacts.length, marinating: 0, followup: 0, fivedone: 0 };
    for (const c of allContacts) {
      const s = stageOf(c);
      if (s === "marinating") counts.marinating++;
      else if (s === "followup") counts.followup++;
      else if (s === "fivedone") counts.fivedone++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContacts, approachCountByContact]);

  const contacts = useMemo(() => {
    if (stage === "all") return allContacts;
    return allContacts.filter((c) => stageOf(c) === stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, allContacts, approachCountByContact]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = contacts;
    if (q) {
      result = allContacts.filter((c) =>
        c.contact_name.toLowerCase().includes(q) ||
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_role ?? "").toLowerCase().includes(q)
      );
    } else if (calendar !== "all") {
      result = contacts.filter((c) =>
        withinWindow(c.sent_at ?? c.last_status_change_at, calendar, weekOffset, monthOffset)
      );
    }
    return result;
  }, [allContacts, contacts, calendar, weekOffset, monthOffset, search]);

  const gAlertsSet = useMemo(
    () => new Set(gAlerts.map((c) => `${c.lead_id}::${c.contact_name}`)),
    [gAlerts],
  );
  const manualUploadSet = useMemo(
    () => new Set(manualUpload.map((c) => `${c.lead_id}::${c.contact_name}`)),
    [manualUpload],
  );

  const groups = useMemo(() => {
    const map = new Map<string, OutreachRow[]>();
    for (const c of filtered) {
      const key2 = `${c.lead_id}::${c.contact_name}`;
      let key: string;
      if (grouping === "all") key = "All";
      else if (grouping === "status") key = CONTACT_STATUS_LABEL[getStatus(c)];
      else if (grouping === "approach")
        key = `A${c.approach} · ${APPROACHES[c.approach]?.name ?? "Approach"}`;
      else if (grouping === "company") key = c.company_name;
      else if (gAlertsSet.has(key2)) key = "Google Alerts";
      else if (manualUploadSet.has(key2)) key = "Manual Upload";
      else key = "Auto Search";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (grouping === "all") return a[0].localeCompare(b[0]);
      return b[1].length - a[1].length;
    }).map(([key, items]) => {
      if (grouping === "all") {
        return [key, items.sort((a, b) => a.contact_name.localeCompare(b.contact_name))] as [string, OutreachRow[]];
      }
      return [key, items] as [string, OutreachRow[]];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, grouping, gAlertsSet, manualUploadSet, statusMap]);

  return (
    <section className="rounded-xl border bg-card">
      <div className="px-5 pt-5 pb-4 border-b flex items-center gap-2 flex-wrap">
        <PipelineButton active={stage === "all"} onClick={() => setStage("all")} icon={<Layers className="h-4 w-4" />}>
          All ({stageCounts.all})
        </PipelineButton>
        <PipelineButton active={stage === "marinating"} onClick={() => setStage("marinating")} icon={<Layers className="h-4 w-4" />}>
          Marinating ({stageCounts.marinating})
        </PipelineButton>
        <PipelineButton
          active={stage === "followup"}
          onClick={() => setStage("followup")}
          icon={<Layers className="h-4 w-4" />}
          tone="green"
        >
          Follow up ({stageCounts.followup})
        </PipelineButton>
        <PipelineButton active={stage === "fivedone"} onClick={() => setStage("fivedone")} icon={<Layers className="h-4 w-4" />}>
          5 and Done ({stageCounts.fivedone})
        </PipelineButton>
      </div>

      <div className="grid grid-cols-2 gap-5 px-5 py-4 border-b bg-muted/30">
        <FilterGroup
          label="Calendar"
          value={calendar}
          options={[
            { value: "all", label: "All" },
            { value: "today", label: "Today" },
            { value: "weeks", label: "Weeks" },
            { value: "months", label: "Months" },
          ]}
          onChange={(v) => setCalendar(v as CalendarWindow)}
        />
        <FilterGroup
          label="Category"
          value={grouping}
          options={[
            { value: "all", label: "All" },
            { value: "status", label: "Status" },
            { value: "approach", label: "Approach" },
            { value: "company", label: "Company" },
            { value: "gAlerts", label: "Google Alerts" },
            { value: "autoSearch", label: "Auto Search" },
            { value: "manualUpload", label: "Manual Upload" },
          ]}
          onChange={(v) => setGrouping(v as ContactGrouping)}
        />
      </div>

      {calendar === "weeks" && (
        <WeekPicker value={weekOffset} onChange={setWeekOffset} />
      )}
      {calendar === "months" && (
        <MonthPicker value={monthOffset} onChange={setMonthOffset} />
      )}

      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact, company, or role…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-muted-foreground">
            {filtered.length} contact{filtered.length === 1 ? "" : "s"} · grouped by {grouping}
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No contacts in this window. Use “Copy & Mark Sent” on a lead to add one.
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([key, items]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {key}
                  </div>
                  <div className="text-xs text-muted-foreground">· {items.length}</div>
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {items.map((c) => (
                    <ContactRow key={c.id} contact={c} status={getStatus(c)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function WeekPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="px-5 py-4 border-b bg-muted/20">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
        Select a week
      </div>
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3].map((o) => {
          const label = o === 0 ? "This week" : o === 1 ? "Last week" : `${o} weeks ago`;
          const active = value === o;
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors text-left",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted",
              )}
            >
              <div className="font-medium">{label}</div>
              <div className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>
                {weekRangeLabel(o)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="px-5 py-4 border-b bg-muted/20">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
        Select a month
      </div>
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3, 4, 5].map((o) => {
          const { name, year } = monthLabel(o);
          const active = value === o;
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors text-left",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted",
              )}
            >
              <div className="font-medium">{name}</div>
              <div className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>
                {year}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold mb-2">{label}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={value === o.value ? "default" : "outline"}
            onClick={() => onChange(o.value)}
            className="justify-start h-8"
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PipelineButton({
  active,
  onClick,
  icon,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "green";
}) {
  const green = tone === "green";
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors border",
        green
          ? active
            ? "bg-[#00C814] text-white border-[#00C814] hover:bg-[#00b012]"
            : "bg-[#00C814]/15 text-[#008a0e] border-[#00C814]/70 hover:bg-[#00C814]/25 dark:text-[#39ff5a] dark:border-[#00C814]/70"
          : active
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-foreground border-border hover:bg-muted",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function businessDaysSince(dateIso: string): number {
  const start = new Date(dateIso);
  const end = new Date();
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  let count = 0;
  while (cur < endDay) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

function LeadRow({ lead }: { lead: Lead }) {
  const b = scoreBand(lead.fit_score);
  return (
    <Link
      to="/leads/$leadId"
      params={{ leadId: lead.id }}
      className="group flex items-center gap-3 rounded-md border bg-background px-3 py-2 hover:border-foreground/20 transition-colors"
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded text-xs font-semibold", b.color)}>
        {lead.fit_score}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="text-sm font-medium truncate">{lead.company_name}</div>
          {lead.funding_stage && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {lead.funding_stage}
            </Badge>
          )}
          {lead.industry && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {lead.industry}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {lead.trigger_summary || lead.fit_reasoning || "—"}
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function ContactRow({
  contact,
  status,
}: {
  contact: OutreachRow;
  status: ContactProgressStatus;
}) {
  const initials = contact.contact_name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertContactStatus);
  const [pending, setPending] = useState<ContactProgressStatus | null>(null);
  const current = pending ?? status;

  const onChange = async (next: string) => {
    const s = next as ContactProgressStatus;
    setPending(s);
    try {
      await upsert({
        data: {
          leadId: contact.lead_id,
          contactName: contact.contact_name,
          status: s,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["contact-statuses"] });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="group flex items-center gap-3 rounded-md border bg-background px-3 py-2 hover:border-foreground/20 transition-colors">
      <Link
        to="/leads/$leadId"
        params={{ leadId: contact.lead_id }}
        className="flex items-center gap-3 min-w-0 flex-1"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-xs font-semibold">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-sm font-medium truncate">{contact.contact_name}</div>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {contact.company_name}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              A{contact.approach}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {CONTACT_STATUS_LABEL[current]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {contact.contact_role || "—"}
            {contact.sent_at && ` · Sent ${new Date(contact.sent_at).toLocaleDateString()}`}
          </div>
        </div>
      </Link>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[148px] text-xs shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTACT_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {CONTACT_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
