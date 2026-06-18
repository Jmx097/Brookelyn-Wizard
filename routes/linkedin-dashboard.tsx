import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import {
  listOutreach,
  updateOutreachStatus,
  type OutreachRow,
} from "@/lib/linkedin-tracker.functions";
import {
  listContactStatuses,
  CONTACT_STATUS_LABEL,
  type ContactProgressStatus,
  type ContactStatusRow,
} from "@/lib/contact-status.functions";
import { APPROACHES } from "@/lib/outreach.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, MessageSquare, Calendar, Target, ChevronLeft, ChevronRight, FileBarChart, Sparkles, Trophy, Flame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/linkedin-dashboard")({
  component: () => (
    <AuthGuard>
      <LinkedInDashboard />
    </AuthGuard>
  ),
});

type Period = "day" | "week" | "month";

const STATUS_LABEL: Record<OutreachRow["status"], string> = {
  queued: "Queued",
  sent: "Sent",
  replied: "Replied",
  meeting: "Meeting",
  no_response: "No reply",
  passed: "Passed",
};

const STATUS_TONE: Record<OutreachRow["status"], string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary border-primary/30",
  replied: "bg-[var(--score-warm)]/15 text-[var(--score-warm)] border-[var(--score-warm)]/40",
  meeting: "bg-[var(--score-hot)]/15 text-[var(--score-hot)] border-[var(--score-hot)]/40",
  no_response: "bg-muted text-muted-foreground",
  passed: "bg-destructive/10 text-destructive border-destructive/30",
};

function startOfPeriod(d: Date, period: Period): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  if (period === "day") return x;
  if (period === "week") {
    const day = x.getDay();
    const diff = (day + 6) % 7; // Monday start
    x.setDate(x.getDate() - diff);
    return x;
  }
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

function periodKey(d: Date, period: Period): string {
  const p = startOfPeriod(d, period);
  return p.toISOString().slice(0, 10);
}

function formatPeriodLabel(key: string, period: Period): string {
  const d = new Date(key);
  if (period === "month") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function LinkedInDashboard() {
  const [period, setPeriod] = useState<Period>("week");
  const list = useServerFn(listOutreach);
  const updateStatus = useServerFn(updateOutreachStatus);
  const fetchStatuses = useServerFn(listContactStatuses);

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["linkedin-outreach"],
    queryFn: () => list(),
  });
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
  const contactStatus = (r: OutreachRow): ContactProgressStatus =>
    statusMap.get(`${r.lead_id}::${r.contact_name}`) ?? "not_responded";

  const all: OutreachRow[] = Array.isArray(rows) ? (rows as OutreachRow[]) : [];

  const onUpdate = async (id: string, status: OutreachRow["status"]) => {
    try {
      await updateStatus({ data: { id, status } });
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const metrics = useMemo(() => computeMetrics(all, period), [all, period]);

  const statusTimeline = useMemo(() => {
    const buckets = new Map<string, Record<ContactProgressStatus, number>>();
    const periods: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      if (period === "day") d.setDate(d.getDate() - i);
      else if (period === "week") d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      const k = periodKey(d, period);
      periods.push(k);
      buckets.set(k, {
        not_responded: 0,
        engaged: 0,
        meeting: 0,
        no_show: 0,
        opportunity: 0,
      });
    }
    for (const r of all) {
      if (!r.sent_at) continue;
      const k = periodKey(new Date(r.sent_at), period);
      const b = buckets.get(k);
      if (!b) continue;
      b[contactStatus(r)]++;
    }
    return periods.map((k) => ({ key: k, counts: buckets.get(k)! }));
  }, [all, period, statusMap]);

  return (
    <div className="px-10 py-8 max-w-7xl">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Outreach
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Activity Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Volume, reply rates, and which approaches are actually getting meetings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportingDialog rows={all} statusOf={contactStatus} />
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Per day</SelectItem>
              <SelectItem value="week">Per week</SelectItem>
              <SelectItem value="month">Per month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi
          icon={<MessageSquare className="h-4 w-4" />}
          label="Sent (all-time)"
          value={metrics.totalSent}
          sub={`${metrics.thisPeriodSent} this ${period}`}
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Reply rate"
          value={`${(metrics.replyRate * 100).toFixed(1)}%`}
          sub={`${metrics.totalReplied} replies`}
        />
        <Kpi
          icon={<Calendar className="h-4 w-4" />}
          label="Meeting rate"
          value={`${(metrics.meetingRate * 100).toFixed(1)}%`}
          sub={`${metrics.totalMeetings} meetings booked`}
        />
        <Kpi
          icon={<Target className="h-4 w-4" />}
          label="Best approach"
          value={metrics.bestApproach ? `A${metrics.bestApproach.id}` : "—"}
          sub={
            metrics.bestApproach
              ? `${(metrics.bestApproach.replyRate * 100).toFixed(0)}% reply · ${metrics.bestApproach.name}`
              : "Need more sends"
          }
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="tracker">Tracker</TabsTrigger>
          </TabsList>

          {all.length === 0 && (
            <div className="mt-4 rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
              No outreach logged yet. Use{" "}
              <span className="font-medium text-foreground">Open + Copy + Log</span> or{" "}
              <span className="font-medium text-foreground">Mark sent</span> on the LinkedIn
              Messages page to start tracking. The tabs below will populate as activity is logged.
            </div>
          )}

          <TabsContent value="calendar" className="mt-4">
            <CalendarView rows={all} />
          </TabsContent>



          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Volume per period */}
            <Card title={`Activity per ${period}`}>
              <StatusBars data={statusTimeline} period={period} />
            </Card>

            {/* Per-approach performance */}
            <Card title="Approach performance">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Approach</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                    <TableHead className="text-right">Reply rate</TableHead>
                    <TableHead className="text-right">Meetings</TableHead>
                    <TableHead className="text-right">Meeting rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(APPROACHES).map((a) => {
                    const m = metrics.byApproach[a.id] ?? {
                      sent: 0,
                      replied: 0,
                      meetings: 0,
                    };
                    const rr = m.sent ? m.replied / m.sent : 0;
                    const mr = m.sent ? m.meetings / m.sent : 0;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            A{a.id} · {a.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {a.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {m.sent}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {m.replied}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {(rr * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {m.meetings}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {(mr * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card title="Top companies by reply">
                {metrics.topCompanies.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No replies yet.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {metrics.topCompanies.map((c) => (
                      <li
                        key={c.company}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{c.company}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {c.replied}/{c.sent} ({((c.replied / c.sent) * 100).toFixed(0)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Needs follow-up (sent 5+ days ago, no reply)">
                {metrics.followUps.length === 0 ? (
                  <div className="text-xs text-muted-foreground">All caught up.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {metrics.followUps.slice(0, 8).map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between text-sm gap-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate">
                            {r.contact_name}{" "}
                            <span className="text-muted-foreground">· {r.company_name}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            A{r.approach} · {daysAgo(r.sent_at)}d ago
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tracker" className="mt-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Approach</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Last update</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium">
                        {r.contact_name}
                        {r.contact_role && (
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                            {r.contact_role}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.company_name}</TableCell>
                      <TableCell className="text-xs">
                        A{r.approach}
                        <span className="text-muted-foreground">
                          {" "}
                          · {APPROACHES[r.approach]?.name ?? ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {CONTACT_STATUS_LABEL[contactStatus(r)]}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[r.status]}`}>
                            {STATUS_LABEL[r.status]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.sent_at
                          ? `${daysAgo(r.sent_at)}d ago`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.last_status_change_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {r.status !== "replied" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onUpdate(r.id, "replied")}
                            >
                              Replied
                            </Button>
                          )}
                          {r.status !== "meeting" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onUpdate(r.id, "meeting")}
                            >
                              Meeting
                            </Button>
                          )}
                          {r.status !== "no_response" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onUpdate(r.id, "no_response")}
                            >
                              No reply
                            </Button>
                          )}
                          {r.status !== "passed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onUpdate(r.id, "passed")}
                            >
                              Passed
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1.5 tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}

const STATUS_ORDER: ContactProgressStatus[] = [
  "not_responded",
  "engaged",
  "meeting",
  "no_show",
  "opportunity",
];

const STATUS_BAR_CLASS: Record<ContactProgressStatus, string> = {
  not_responded: "bg-muted-foreground/40",
  engaged: "bg-[var(--score-warm)]/70",
  meeting: "bg-[var(--score-hot)]/80",
  no_show: "bg-destructive/60",
  opportunity: "bg-primary",
};

function StatusBars({
  data,
  period,
}: {
  data: { key: string; counts: Record<ContactProgressStatus, number> }[];
  period: Period;
}) {
  const totals = data.map((d) =>
    STATUS_ORDER.reduce((sum, s) => sum + d.counts[s], 0),
  );
  const max = Math.max(1, ...totals);
  if (data.length === 0) {
    return <div className="text-xs text-muted-foreground">No activity yet.</div>;
  }
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const total = totals[i];
        return (
          <div key={d.key} className="flex items-center gap-3">
            <div className="w-20 text-xs text-muted-foreground tabular-nums">
              {formatPeriodLabel(d.key, period)}
            </div>
            <div className="flex-1 h-5 bg-muted/40 rounded relative overflow-hidden flex">
              {STATUS_ORDER.map((s) =>
                d.counts[s] > 0 ? (
                  <div
                    key={s}
                    title={`${CONTACT_STATUS_LABEL[s]}: ${d.counts[s]}`}
                    className={STATUS_BAR_CLASS[s]}
                    style={{ width: `${(d.counts[s] / max) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <div className="w-12 text-[11px] text-muted-foreground tabular-nums text-right">
              {total}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-2">
        {STATUS_ORDER.map((s) => (
          <Swatch
            key={s}
            className={STATUS_BAR_CLASS[s]}
            label={CONTACT_STATUS_LABEL[s]}
          />
        ))}
      </div>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-3 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

function computeMetrics(rows: OutreachRow[], period: Period) {
  const totalSent = rows.filter((r) => r.sent_at).length;
  const totalReplied = rows.filter((r) => r.replied_at || r.status === "replied" || r.status === "meeting").length;
  const totalMeetings = rows.filter((r) => r.meeting_at || r.status === "meeting").length;
  const replyRate = totalSent ? totalReplied / totalSent : 0;
  const meetingRate = totalSent ? totalMeetings / totalSent : 0;

  const nowKey = periodKey(new Date(), period);
  const thisPeriodSent = rows.filter(
    (r) => r.sent_at && periodKey(new Date(r.sent_at), period) === nowKey,
  ).length;

  // timeline (last 8 periods)
  const buckets = new Map<string, { key: string; sent: number; replied: number; meetings: number }>();
  const periods: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    if (period === "day") d.setDate(d.getDate() - i);
    else if (period === "week") d.setDate(d.getDate() - i * 7);
    else d.setMonth(d.getMonth() - i);
    const k = periodKey(d, period);
    periods.push(k);
    buckets.set(k, { key: k, sent: 0, replied: 0, meetings: 0 });
  }
  for (const r of rows) {
    if (r.sent_at) {
      const k = periodKey(new Date(r.sent_at), period);
      const b = buckets.get(k);
      if (b) b.sent++;
    }
    if (r.replied_at) {
      const k = periodKey(new Date(r.replied_at), period);
      const b = buckets.get(k);
      if (b) b.replied++;
    }
    if (r.meeting_at) {
      const k = periodKey(new Date(r.meeting_at), period);
      const b = buckets.get(k);
      if (b) b.meetings++;
    }
  }
  const timeline = periods.map((k) => buckets.get(k)!);

  // per-approach
  const byApproach: Record<number, { sent: number; replied: number; meetings: number }> = {};
  for (const r of rows) {
    const a = (byApproach[r.approach] ??= { sent: 0, replied: 0, meetings: 0 });
    if (r.sent_at) a.sent++;
    if (r.replied_at || r.status === "replied" || r.status === "meeting") a.replied++;
    if (r.meeting_at || r.status === "meeting") a.meetings++;
  }

  // best approach by reply rate, minimum 3 sends
  let bestApproach: { id: number; name: string; replyRate: number } | null = null;
  for (const [id, m] of Object.entries(byApproach)) {
    if (m.sent < 3) continue;
    const rr = m.replied / m.sent;
    if (!bestApproach || rr > bestApproach.replyRate) {
      bestApproach = {
        id: Number(id),
        name: APPROACHES[Number(id)]?.name ?? "",
        replyRate: rr,
      };
    }
  }

  // top companies by reply count
  const companyAgg = new Map<string, { company: string; sent: number; replied: number }>();
  for (const r of rows) {
    const c = companyAgg.get(r.company_name) ?? {
      company: r.company_name,
      sent: 0,
      replied: 0,
    };
    if (r.sent_at) c.sent++;
    if (r.replied_at || r.status === "replied" || r.status === "meeting") c.replied++;
    companyAgg.set(r.company_name, c);
  }
  const topCompanies = Array.from(companyAgg.values())
    .filter((c) => c.replied > 0)
    .sort((a, b) => b.replied - a.replied || b.replied / b.sent - a.replied / a.sent)
    .slice(0, 6);

  // follow-ups: sent 5+ days ago, status sent, no reply
  const followUps = rows
    .filter(
      (r) =>
        r.status === "sent" &&
        r.sent_at &&
        (daysAgo(r.sent_at) ?? 0) >= 5,
    )
    .sort(
      (a, b) =>
        new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime(),
    );

  return {
    totalSent,
    totalReplied,
    totalMeetings,
    replyRate,
    meetingRate,
    thisPeriodSent,
    timeline,
    byApproach,
    bestApproach,
    topCompanies,
    followUps,
  };
}

type DayAgg = { sent: number; replied: number; meetings: number; items: OutreachRow[] };

function CalendarView({ rows }: { rows: OutreachRow[] }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, DayAgg>();
    const touch = (k: string) =>
      map.get(k) ?? map.set(k, { sent: 0, replied: 0, meetings: 0, items: [] }).get(k)!;
    for (const r of rows) {
      if (r.sent_at) {
        const k = periodKey(new Date(r.sent_at), "day");
        const d = touch(k);
        d.sent++;
        d.items.push(r);
      }
      if (r.replied_at) {
        const k = periodKey(new Date(r.replied_at), "day");
        touch(k).replied++;
      }
      if (r.meeting_at) {
        const k = periodKey(new Date(r.meeting_at), "day");
        touch(k).meetings++;
      }
    }
    return map;
  }, [rows]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = periodKey(new Date(), "day");

  const cells: ({ key: string; date: Date } | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ key: periodKey(date, "day"), date });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const maxSent = Math.max(1, ...Array.from(byDay.values()).map((v) => v.sent));

  // Month totals
  const monthTotals = cells.reduce(
    (acc, c) => {
      if (!c) return acc;
      const a = byDay.get(c.key);
      if (a) {
        acc.sent += a.sent;
        acc.replied += a.replied;
        acc.meetings += a.meetings;
      }
      return acc;
    },
    { sent: 0, replied: 0, meetings: 0 },
  );

  const selectedAgg = selected ? byDay.get(selected) : null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              setCursor(new Date(year, month - 1, 1));
              setSelected(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium w-40 text-center">{monthLabel}</div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              setCursor(new Date(year, month + 1, 1));
              setSelected(null);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-2 text-xs"
            onClick={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
              setSelected(periodKey(n, "day"));
            }}
          >
            Today
          </Button>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {monthTotals.sent} sent · {monthTotals.replied} replied · {monthTotals.meetings} meetings
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />;
          const agg = byDay.get(c.key);
          const intensity = agg ? agg.sent / maxSent : 0;
          const isToday = c.key === todayKey;
          const isSelected = c.key === selected;
          const hasMeeting = (agg?.meetings ?? 0) > 0;
          const hasReply = (agg?.replied ?? 0) > 0;
          return (
            <button
              key={c.key}
              onClick={() => setSelected(isSelected ? null : c.key)}
              className={[
                "aspect-square rounded border text-left p-1.5 flex flex-col justify-between transition relative",
                "hover:border-primary/60",
                isSelected ? "border-primary ring-1 ring-primary" : "border-border/60",
                isToday && !isSelected ? "border-primary/50" : "",
              ].join(" ")}
              style={{
                background: agg
                  ? `color-mix(in oklab, var(--primary) ${Math.round(intensity * 35)}%, var(--card))`
                  : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] tabular-nums ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                  {c.date.getDate()}
                </span>
                <div className="flex gap-0.5">
                  {hasMeeting && <span className="h-1.5 w-1.5 rounded-full bg-[var(--score-hot)]" />}
                  {hasReply && !hasMeeting && <span className="h-1.5 w-1.5 rounded-full bg-[var(--score-warm)]" />}
                </div>
              </div>
              {agg && agg.sent > 0 && (
                <div className="text-[10px] tabular-nums text-foreground/80">{agg.sent}</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 text-[10px] text-muted-foreground pt-3">
        <Swatch className="bg-primary/30" label="Sent (shade = volume)" />
        <Swatch className="bg-[var(--score-warm)]" label="Replied" />
        <Swatch className="bg-[var(--score-hot)]" label="Meeting" />
      </div>

      {selected && (
        <div className="mt-4 border-t pt-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm font-medium">
              {new Date(selected).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {selectedAgg
                ? `${selectedAgg.sent} sent · ${selectedAgg.replied} replied · ${selectedAgg.meetings} meetings`
                : "No activity"}
            </div>
          </div>
          {selectedAgg && selectedAgg.items.length > 0 ? (
            <ul className="space-y-1.5">
              {selectedAgg.items.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm gap-3">
                  <div className="min-w-0">
                    <div className="truncate">
                      {r.contact_name}{" "}
                      <span className="text-muted-foreground">· {r.company_name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      A{r.approach} · {APPROACHES[r.approach]?.name ?? ""}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">Nothing logged on this day.</div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Reporting dialog: activity summary by day / week / month
// =====================================================================

type ReportPeriod = "day" | "week" | "month";

function endOfPeriod(d: Date, p: ReportPeriod): Date {
  const s = startOfPeriod(d, p);
  const e = new Date(s);
  if (p === "day") e.setDate(e.getDate() + 1);
  else if (p === "week") e.setDate(e.getDate() + 7);
  else e.setMonth(e.getMonth() + 1);
  return e;
}
function periodLabel(d: Date, p: ReportPeriod): string {
  const s = startOfPeriod(d, p);
  if (p === "day")
    return s.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (p === "week") {
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    return `Week of ${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return s.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type ReportSummary = {
  sent: number;
  replied: number;
  meetings: number;
  replyRate: number;
  meetingRate: number;
  statusCounts: Record<ContactProgressStatus, number>;
  totalContacts: number;
  opportunities: number;
  approaches: { id: number; name: string; sent: number; replied: number; meetings: number; replyRate: number }[];
  bestApproach?: { id: number; name: string; sent: number; replied: number; meetings: number; replyRate: number };
  topCompanies: { company: string; sent: number; replied: number; meetings: number }[];
};

const STATUS_HEX: Record<ContactProgressStatus, string> = {
  not_responded: "#94a3b8",
  engaged: "#f59e0b",
  meeting: "#ef4444",
  no_show: "#dc2626",
  opportunity: "#10b981",
};

function exportReportPdf(
  summary: ReportSummary,
  period: ReportPeriod,
  anchor: Date,
) {
  const label = periodLabel(anchor, period);
  const generated = new Date().toLocaleString();
  const statusTotal = STATUS_ORDER.reduce(
    (n, s) => n + summary.statusCounts[s],
    0,
  );
  const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(0) + "%" : "0%");

  const pipelineBar = statusTotal
    ? STATUS_ORDER.filter((s) => summary.statusCounts[s] > 0)
        .map(
          (s) =>
            `<div style="background:${STATUS_HEX[s]};width:${(summary.statusCounts[s] / statusTotal) * 100}%"></div>`,
        )
        .join("")
    : '<div style="background:#e5e7eb;width:100%"></div>';

  const statusCards = STATUS_ORDER.map(
    (s) => `
      <div class="status-card">
        <div class="status-label"><span class="dot" style="background:${STATUS_HEX[s]}"></span>${CONTACT_STATUS_LABEL[s]}</div>
        <div class="status-value">${summary.statusCounts[s]}</div>
      </div>`,
  ).join("");

  const approachRows = summary.approaches
    .map(
      (a) => `
        <tr>
          <td><strong>A${a.id}</strong> · ${escapeHtml(a.name)}</td>
          <td class="num">${a.sent}</td>
          <td class="num">${a.replied}</td>
          <td class="num">${pct(a.replied, a.sent)}</td>
          <td class="num">${a.meetings}</td>
        </tr>`,
    )
    .join("");

  const companyRows = summary.topCompanies
    .map(
      (c) => `
        <tr>
          <td>${escapeHtml(c.company)}</td>
          <td class="num">${c.sent}</td>
          <td class="num">${c.replied}</td>
          <td class="num">${c.meetings}</td>
        </tr>`,
    )
    .join("");

  const best = summary.bestApproach
    ? `<div class="best">
        <div class="best-label">Top performing approach</div>
        <div class="best-name">A${summary.bestApproach.id} · ${escapeHtml(summary.bestApproach.name)}</div>
        <div class="best-sub">${summary.bestApproach.replied}/${summary.bestApproach.sent} replies · ${(summary.bestApproach.replyRate * 100).toFixed(0)}% reply rate · ${summary.bestApproach.meetings} meetings</div>
      </div>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Activity Summary – ${escapeHtml(label)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .kpi-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  .kpi-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
  .pipeline { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: #f1f5f9; }
  .pipeline > div { height: 100%; }
  .status-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 14px; }
  .status-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
  .status-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .status-value { font-size: 18px; font-weight: 600; margin-top: 2px; }
  .best { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(16,185,129,0.10), transparent); }
  .best-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .best-name { font-size: 15px; font-weight: 600; margin-top: 2px; }
  .best-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { margin: 18mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <h1>Activity Summary</h1>
  <div class="sub">${escapeHtml(label)} · ${period} report · generated ${escapeHtml(generated)}</div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Messages sent</div><div class="kpi-value">${summary.sent}</div><div class="kpi-sub">&nbsp;</div></div>
    <div class="kpi"><div class="kpi-label">Replies</div><div class="kpi-value">${summary.replied}</div><div class="kpi-sub">${(summary.replyRate * 100).toFixed(0)}% reply rate</div></div>
    <div class="kpi"><div class="kpi-label">Meetings</div><div class="kpi-value">${summary.meetings}</div><div class="kpi-sub">${(summary.meetingRate * 100).toFixed(0)}% meeting rate</div></div>
    <div class="kpi"><div class="kpi-label">Opportunities</div><div class="kpi-value">${summary.opportunities}</div><div class="kpi-sub">${summary.totalContacts} contacts touched</div></div>
  </div>

  <div class="section">
    <div class="section-title">Contact pipeline</div>
    <div class="pipeline">${pipelineBar}</div>
    <div class="status-grid">${statusCards}</div>
  </div>

  ${best}

  ${
    summary.approaches.length
      ? `<div class="section">
          <div class="section-title">Approach breakdown</div>
          <table>
            <thead><tr><th>Approach</th><th class="num">Sent</th><th class="num">Replies</th><th class="num">Reply rate</th><th class="num">Meetings</th></tr></thead>
            <tbody>${approachRows}</tbody>
          </table>
        </div>`
      : ""
  }

  ${
    summary.topCompanies.length
      ? `<div class="section">
          <div class="section-title">Top companies</div>
          <table>
            <thead><tr><th>Company</th><th class="num">Sent</th><th class="num">Replies</th><th class="num">Meetings</th></tr></thead>
            <tbody>${companyRows}</tbody>
          </table>
        </div>`
      : ""
  }

  <div class="footer">Activity Dashboard · ${escapeHtml(generated)}</div>
  <script>window.onload = () => { setTimeout(() => window.print(), 250); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to export the PDF report.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ReportingDialog({
  rows,
  statusOf,
}: {
  rows: OutreachRow[];
  statusOf: (r: OutreachRow) => ContactProgressStatus;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const shift = (dir: -1 | 1) => {
    const d = new Date(anchor);
    if (period === "day") d.setDate(d.getDate() + dir);
    else if (period === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const summary = useMemo(() => {
    const start = startOfPeriod(anchor, period).getTime();
    const end = endOfPeriod(anchor, period).getTime();
    const inWindow = (iso: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= start && t < end;
    };

    const sent = rows.filter((r) => inWindow(r.sent_at));
    const replied = rows.filter((r) => inWindow(r.replied_at));
    const meetings = rows.filter((r) => inWindow(r.meeting_at));

    const statusCounts: Record<ContactProgressStatus, number> = {
      not_responded: 0,
      engaged: 0,
      meeting: 0,
      no_show: 0,
      opportunity: 0,
    };
    const contactSeen = new Set<string>();
    for (const r of sent) {
      const k = `${r.lead_id}::${r.contact_name}`;
      if (contactSeen.has(k)) continue;
      contactSeen.add(k);
      statusCounts[statusOf(r)]++;
    }

    const approachAgg = new Map<number, { sent: number; replied: number; meetings: number }>();
    const bump = (id: number, key: "sent" | "replied" | "meetings") => {
      const a = approachAgg.get(id) ?? { sent: 0, replied: 0, meetings: 0 };
      a[key]++;
      approachAgg.set(id, a);
    };
    for (const r of sent) bump(r.approach, "sent");
    for (const r of replied) bump(r.approach, "replied");
    for (const r of meetings) bump(r.approach, "meetings");
    const approaches = Array.from(approachAgg.entries())
      .map(([id, m]) => ({
        id,
        name: APPROACHES[id]?.name ?? `Approach ${id}`,
        ...m,
        replyRate: m.sent ? m.replied / m.sent : 0,
      }))
      .sort((a, b) => b.sent - a.sent);

    const companyAgg = new Map<string, { sent: number; replied: number; meetings: number }>();
    const cbump = (name: string, key: "sent" | "replied" | "meetings") => {
      const c = companyAgg.get(name) ?? { sent: 0, replied: 0, meetings: 0 };
      c[key]++;
      companyAgg.set(name, c);
    };
    for (const r of sent) cbump(r.company_name, "sent");
    for (const r of replied) cbump(r.company_name, "replied");
    for (const r of meetings) cbump(r.company_name, "meetings");
    const topCompanies = Array.from(companyAgg.entries())
      .map(([company, m]) => ({ company, ...m }))
      .sort((a, b) => b.replied - a.replied || b.sent - a.sent)
      .slice(0, 5);

    const bestApproach = approaches
      .filter((a) => a.sent >= 2)
      .sort((a, b) => b.replyRate - a.replyRate || b.replied - a.replied)[0];

    return {
      sent: sent.length,
      replied: replied.length,
      meetings: meetings.length,
      replyRate: sent.length ? replied.length / sent.length : 0,
      meetingRate: sent.length ? meetings.length / sent.length : 0,
      statusCounts,
      totalContacts: contactSeen.size,
      opportunities: statusCounts.opportunity,
      approaches,
      bestApproach,
      topCompanies,
    };
  }, [rows, period, anchor, statusOf]);

  const statusTotal = STATUS_ORDER.reduce(
    (n, s) => n + summary.statusCounts[s],
    0,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <FileBarChart className="h-4 w-4" />
          Reporting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Activity Summary
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-1">
            {(["day", "week", "month"] as ReportPeriod[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "outline"}
                className="h-8 capitalize"
                onClick={() => setPeriod(p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[200px] text-center">
              {periodLabel(anchor, period)}
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 ml-1"
              onClick={() => setAnchor(new Date())}
            >
              Now
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-8 ml-1 gap-1.5"
              onClick={() => exportReportPdf(summary, period, anchor)}
            >
              <FileBarChart className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <ReportStat
            label="Messages sent"
            value={summary.sent}
            tone="bg-primary/10 text-primary"
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <ReportStat
            label="Replies"
            value={summary.replied}
            sub={`${(summary.replyRate * 100).toFixed(0)}% reply rate`}
            tone="bg-[var(--score-warm)]/15 text-[var(--score-warm)]"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <ReportStat
            label="Meetings"
            value={summary.meetings}
            sub={`${(summary.meetingRate * 100).toFixed(0)}% meeting rate`}
            tone="bg-[var(--score-hot)]/15 text-[var(--score-hot)]"
            icon={<Calendar className="h-4 w-4" />}
          />
          <ReportStat
            label="Opportunities"
            value={summary.opportunities}
            sub={`${summary.totalContacts} contacts touched`}
            tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            icon={<Flame className="h-4 w-4" />}
          />
        </div>

        <div className="rounded-lg border bg-card p-4 mb-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Contact pipeline
          </div>
          {statusTotal === 0 ? (
            <div className="text-sm text-muted-foreground">
              No contacts touched in this {period}.
            </div>
          ) : (
            <>
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
                {STATUS_ORDER.map((s) =>
                  summary.statusCounts[s] > 0 ? (
                    <div
                      key={s}
                      className={STATUS_BAR_CLASS[s]}
                      style={{
                        width: `${(summary.statusCounts[s] / statusTotal) * 100}%`,
                      }}
                      title={`${CONTACT_STATUS_LABEL[s]}: ${summary.statusCounts[s]}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                {STATUS_ORDER.map((s) => (
                  <div key={s} className="rounded-md border bg-background px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${STATUS_BAR_CLASS[s]}`} />
                      {CONTACT_STATUS_LABEL[s]}
                    </div>
                    <div className="text-lg font-semibold tabular-nums mt-0.5">
                      {summary.statusCounts[s]}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {summary.bestApproach && (
          <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-transparent p-4 mb-5 flex items-start gap-3">
            <Trophy className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Top performing approach
              </div>
              <div className="text-base font-semibold">
                A{summary.bestApproach.id} · {summary.bestApproach.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {summary.bestApproach.replied}/{summary.bestApproach.sent} replies ·{" "}
                {(summary.bestApproach.replyRate * 100).toFixed(0)}% reply rate ·{" "}
                {summary.bestApproach.meetings} meetings
              </div>
            </div>
          </div>
        )}

        {summary.approaches.length > 0 && (
          <div className="rounded-lg border bg-card p-4 mb-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Approach breakdown
            </div>
            <div className="space-y-2">
              {summary.approaches.map((a) => {
                const max = Math.max(...summary.approaches.map((x) => x.sent), 1);
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className="w-32 text-xs">
                      <div className="font-medium">A{a.id}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">
                        {a.name}
                      </div>
                    </div>
                    <div className="flex-1 h-6 bg-muted/40 rounded relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/25"
                        style={{ width: `${(a.sent / max) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-[var(--score-warm)]/70"
                        style={{ width: `${(a.replied / max) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-[var(--score-hot)]"
                        style={{ width: `${(a.meetings / max) * 100}%` }}
                      />
                    </div>
                    <div className="w-32 text-[11px] text-muted-foreground tabular-nums text-right">
                      {a.sent} sent · {a.replied} rep · {a.meetings} mtg
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {summary.topCompanies.length > 0 && (
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Top companies this {period}
            </div>
            <ul className="divide-y">
              {summary.topCompanies.map((c) => (
                <li key={c.company} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{c.company}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.replied}/{c.sent} replies · {c.meetings} mtg
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.sent === 0 && summary.replied === 0 && summary.meetings === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No activity recorded in this {period}.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportStat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={`rounded-md p-1.5 ${tone}`}>{icon}</div>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
