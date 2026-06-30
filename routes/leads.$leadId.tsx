import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  MapPin,
  MessageSquare,
  Linkedin,
  User,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Pencil,
  Globe,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLeadContact } from "@/lib/leads.functions";
import { enrichLead, rescoreLead, researchJobs } from "@/lib/lead-enrich.functions";
import { enrichContacts, saveContactToLeadSlot } from "@/lib/contacts.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, format } from "date-fns";
import { generateOutreach, APPROACHES } from "@/lib/outreach.functions";
import { markOutreachSent } from "@/lib/linkedin-tracker.functions";

import type { OutreachRow } from "@/lib/linkedin-tracker.functions";
import {
  upsertContactStatus,
  CONTACT_STATUSES,
  CONTACT_STATUS_LABEL,
  type ContactProgressStatus,
  type ContactStatusRow,
} from "@/lib/contact-status.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";


type RoleKey = "ceo" | "cfo" | "coo" | "chro" | "gc" | "controller" | "finance1" | "finance2";

type ContactSlot = {
  key: string;
  role: string;
  nameField?:
    | "ceo_name"
    | "cfo_name"
    | "chro_name"
    | "coo_name"
    | "general_counsel_name"
    | "controller_name"
    | "finance_leader_1_name"
    | "finance_leader_2_name";
  linkField?:
    | "ceo_linkedin"
    | "cfo_linkedin"
    | "chro_linkedin"
    | "coo_linkedin"
    | "general_counsel_linkedin"
    | "controller_linkedin"
    | "finance_leader_1_linkedin"
    | "finance_leader_2_linkedin";
  roleKey?: RoleKey;
};

const CONTACT_SLOTS: ContactSlot[] = [
  { key: "ceo", role: "CEO", nameField: "ceo_name", linkField: "ceo_linkedin", roleKey: "ceo" },
  { key: "cfo", role: "CFO", nameField: "cfo_name", linkField: "cfo_linkedin", roleKey: "cfo" },
  { key: "controller", role: "Controller", nameField: "controller_name", linkField: "controller_linkedin", roleKey: "controller" },
  { key: "finance1", role: "Finance Leader", nameField: "finance_leader_1_name", linkField: "finance_leader_1_linkedin", roleKey: "finance1" },
  { key: "finance2", role: "Finance Leader", nameField: "finance_leader_2_name", linkField: "finance_leader_2_linkedin", roleKey: "finance2" },
  { key: "coo", role: "COO", nameField: "coo_name", linkField: "coo_linkedin", roleKey: "coo" },
  { key: "chro", role: "CHRO / HR Leader", nameField: "chro_name", linkField: "chro_linkedin", roleKey: "chro" },
  { key: "gc", role: "General Counsel", nameField: "general_counsel_name", linkField: "general_counsel_linkedin", roleKey: "gc" },
];

function linkedInSearchUrl(query: string) {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

export const Route = createFileRoute("/leads/$leadId")({
  component: () => (
    <AuthGuard>
      <LeadDetail />
    </AuthGuard>
  ),
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const queryClient = useQueryClient();
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [researching, setResearching] = useState(false);
  const [enrichingContacts, setEnrichingContacts] = useState(false);
  const rescoreFn = useServerFn(rescoreLead);
  const researchFn = useServerFn(researchJobs);
  const enrichContactsFn = useServerFn(enrichContacts);
  const saveContactFn = useServerFn(saveContactToLeadSlot);


  const { data: lead } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs } = useQuery({
    queryKey: ["lead-jobs", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("lead_id", leadId)
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: discoveredContacts } = useQuery({
    queryKey: ["lead-contacts", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_contacts")
        .select("*")
        .eq("lead_id", leadId)
        .order("relevance_score", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


  const allJobs = jobs ?? [];
  const outOfHq = allJobs.filter((j) => j.is_out_of_hq === true);
  const sameCountry = allJobs.filter((j) => j.is_out_of_hq === false);
  const unknown = allJobs.filter((j) => j.is_out_of_hq === null);
  const countries = Array.from(new Set(outOfHq.map((j) => j.country).filter(Boolean)));

  const handleRescore = async () => {
    setRescoring(true);
    try {
      const r = await rescoreFn({ data: { leadId } });
      await queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      await queryClient.invalidateQueries({ queryKey: ["linkedin-leads"] });
      toast.success(`Rescored: ${r.fit_score}/100`);
    } catch (e) {
      toast.error((e as Error).message || "Rescore failed");
    } finally {
      setRescoring(false);
    }
  };

  const handleResearchJobs = async () => {
    setResearching(true);
    try {
      const r = await researchFn({ data: { leadId } });
      await queryClient.invalidateQueries({ queryKey: ["lead-jobs", leadId] });
      toast.success(
        `Found ${r.total} posting${r.total === 1 ? "" : "s"} — ${r.out_of_hq} out-of-HQ, ${r.same_country} in-HQ, ${r.unknown} unknown.`,
      );
    } catch (e) {
      toast.error((e as Error).message || "Job search failed");
    } finally {
      setResearching(false);
    }
  };

  const handleEnrichContacts = async (force = false) => {
    setEnrichingContacts(true);
    try {
      const r = await enrichContactsFn({ data: { leadId, force } });
      await queryClient.invalidateQueries({ queryKey: ["lead-contacts", leadId] });
      if (r.count === 0) {
        toast.warning("No decision-makers found. Try a more specific company name or check Bright Data zone config.");
      } else {
        toast.success(`Found ${r.count} contact${r.count === 1 ? "" : "s"}${r.cached ? " (cached)" : ""}.`);
      }
    } catch (e) {
      toast.error((e as Error).message || "Contact discovery failed");
    } finally {
      setEnrichingContacts(false);
    }
  };

  const handleSaveContactToSlot = async (
    contactId: string,
    slot:
      | "ceo"
      | "cfo"
      | "coo"
      | "chro"
      | "general_counsel"
      | "controller"
      | "finance_leader_1"
      | "finance_leader_2",
  ) => {
    try {
      await saveContactFn({ data: { leadId, contactId, slot } });
      await queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      toast.success(`Saved as ${slot.replace(/_/g, " ")}`);
    } catch (e) {
      toast.error((e as Error).message || "Save failed");
    }
  };





  return (
    <div className="px-10 py-8 max-w-4xl">
      <Link
        to="/my-leads"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Leads
      </Link>
      {!lead ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">{lead.company_name}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{lead.trigger_summary}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEnrichOpen(true)}>
              <Globe className="h-3.5 w-3.5" />
              Add company info
            </Button>
            <Button size="sm" variant="outline" onClick={handleRescore} disabled={rescoring}>
              {rescoring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Rescore against ICP
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResearchJobs}
              disabled={researching}
            >
              {researching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Briefcase className="h-3.5 w-3.5" />
              )}
              Re-search job postings
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEnrichContacts(false)}
              disabled={enrichingContacts}
            >
              {enrichingContacts ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
              Find decision-makers
            </Button>
            <div className="ml-auto text-xs text-muted-foreground self-center">
              Fit score:{" "}
              <span className="font-semibold text-foreground">{lead.fit_score ?? 0}</span>/100
            </div>
          </div>

          <div className="mt-4 rounded-lg border bg-card p-5 text-sm">
            <div className="font-medium mb-1">Fit reasoning</div>
            <div className="text-muted-foreground">{lead.fit_reasoning || "—"}</div>
          </div>

          {/* Discovered decision-makers (Bright Data) */}
          <section className="mt-6 rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Linkedin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Discovered decision-makers</h2>
                  {discoveredContacts && discoveredContacts.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {discoveredContacts.length} found
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  LinkedIn profiles matched to this company via Bright Data SERP. Use "Save as…" to populate the primary-contact slots below.
                  {lead.contacts_enriched_at && (
                    <>
                      {" "}Last searched{" "}
                      {formatDistanceToNow(new Date(lead.contacts_enriched_at), { addSuffix: true })}.
                    </>
                  )}
                </p>
              </div>
              {discoveredContacts && discoveredContacts.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEnrichContacts(true)}
                  disabled={enrichingContacts}
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              )}
            </div>

            {!discoveredContacts || discoveredContacts.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                {lead.contacts_enriched_at
                  ? "No contacts found. Try refreshing or check the company name."
                  : "No decision-makers searched yet. Click \"Find decision-makers\" above."}
              </div>
            ) : (
              <ul className="divide-y">
                {discoveredContacts.map((c) => (
                  <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.full_name}</span>
                        {c.seniority && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {c.seniority}
                          </Badge>
                        )}
                      </div>
                      {c.title && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{c.title}</div>
                      )}
                      {c.linkedin_url && (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {c.linkedin_url.replace(/^https?:\/\//, "").slice(0, 60)}
                        </a>
                      )}
                    </div>
                    <Select
                      onValueChange={(slot) =>
                        handleSaveContactToSlot(
                          c.id,
                          slot as
                            | "ceo"
                            | "cfo"
                            | "coo"
                            | "chro"
                            | "general_counsel"
                            | "controller"
                            | "finance_leader_1"
                            | "finance_leader_2",
                        )
                      }
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Save as…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ceo">CEO</SelectItem>
                        <SelectItem value="cfo">CFO</SelectItem>
                        <SelectItem value="coo">COO</SelectItem>
                        <SelectItem value="chro">CHRO / HR</SelectItem>
                        <SelectItem value="controller">Controller</SelectItem>
                        <SelectItem value="finance_leader_1">Finance Leader 1</SelectItem>
                        <SelectItem value="finance_leader_2">Finance Leader 2</SelectItem>
                        <SelectItem value="general_counsel">General Counsel</SelectItem>
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
            )}
          </section>




          {/* Out-of-HQ job postings */}
          <section className="mt-6 rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b bg-[var(--score-hot)]/5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-md bg-[var(--score-hot)]/15 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-[var(--score-hot)]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Out-of-HQ job postings</h2>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal border-[var(--score-hot)]/40 text-[var(--score-hot)]"
                    >
                      High-premium signal
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Evidence used to award the score boost. HQ on file:{" "}
                    <span className="text-foreground/80">{lead.hq || "unknown"}</span>.
                    {allJobs.length > 0 && (
                      <>
                        {" "}
                        <span className="text-foreground/80">{outOfHq.length} out-of-HQ</span> ·{" "}
                        <span className="text-foreground/80">{sameCountry.length} in-HQ</span> ·{" "}
                        <span className="text-foreground/80">{unknown.length} unknown</span>
                        {countries.length > 0 && (
                          <>
                            {" "}
                            ({countries.join(", ")})
                          </>
                        )}
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {outOfHq.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                {allJobs.length === 0
                  ? "No job postings on file. Use Re-search job postings to look for current openings."
                  : `No confirmed out-of-HQ roles. ${sameCountry.length} in-HQ and ${unknown.length} with unknown location.`}
              </div>
            ) : (
              <ul className="divide-y">
                {outOfHq.map((j) => (
                  <li key={j.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={j.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                          >
                            {j.title}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                          {j.seniority && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {j.seniority}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {j.location}
                            {j.country && j.location !== j.country ? `, ${j.country}` : ""}
                          </span>
                          {j.board && <span>· {j.board}</span>}
                          <span className="text-muted-foreground/70 truncate max-w-xs">
                            · {j.url.replace(/^https?:\/\//, "")}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right">
                        {j.posted_at && (
                          <>
                            <div>
                              {new Date(j.posted_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-muted-foreground/70">
                              {formatDistanceToNow(new Date(j.posted_at), { addSuffix: true })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* LinkedIn contacts + message generator */}
          <section className="mt-6 rounded-lg border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Linkedin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold">LinkedIn contacts</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Key decision-makers for international expansion. Click a contact to draft any
                  of the 5 LinkedIn message approaches.
                </p>
              </div>
            </div>
            <LinkedInContacts
              leadId={leadId}
              companyName={lead.company_name}
              industry={lead.industry}
              hq={lead.hq}
              triggerSummary={lead.trigger_summary}
              fitReasoning={lead.fit_reasoning}
              expansionSignals={lead.expansion_signals ?? []}
              lead={lead as unknown as Record<string, string | null>}
            />
          </section>

          {/* Reference: legacy email/DM composer hint */}
          <div className="mt-6 text-xs text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Need an email draft too? Use the Outreach messages on each contact tab.
          </div>

          <EnrichLeadDialog
            open={enrichOpen}
            onOpenChange={setEnrichOpen}
            leadId={leadId}
            currentWebsite={(lead.website as string | null) ?? ""}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
              queryClient.invalidateQueries({ queryKey: ["linkedin-leads"] });
            }}
          />
        </>
      )}
    </div>
  );

}

type GenProps = {
  leadId: string;
  companyName: string;
  industry: string | null;
  hq: string | null;
  triggerSummary: string | null;
  fitReasoning: string | null;
  expansionSignals: string[];
  lead: Record<string, string | null>;
};

function LinkedInContacts(props: GenProps) {
  const [active, setActive] = useState<string>(CONTACT_SLOTS[0].key);
  // drafts[slotKey][approachId] = message
  const [drafts, setDrafts] = useState<Record<string, Record<number, string>>>({});
  const [approach, setApproach] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ContactSlot | null>(null);
  const generate = useServerFn(generateOutreach);
  const markSent = useServerFn(markOutreachSent);
  const queryClient = useQueryClient();

  const { data: outreachRows } = useQuery({
    queryKey: ["linkedin-outreach", props.leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_outreach")
        .select("*")
        .eq("lead_id", props.leadId)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachRow[];
    },
  });

  const upsertStatus = useServerFn(upsertContactStatus);
  const { data: statusRows } = useQuery({
    queryKey: ["contact-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_status")
        .select("*")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ContactStatusRow[];
    },
  });
  const statusFor = (name: string): ContactProgressStatus => {
    const k = name.toLowerCase();
    const found = (statusRows ?? []).find(
      (r: ContactStatusRow) =>
        r.lead_id === props.leadId && r.contact_name.toLowerCase() === k,
    );
    return (found?.status as ContactProgressStatus) ?? "not_responded";
  };
  const onStatusChange = async (name: string, next: string) => {
    if (!name) return;
    try {
      await upsertStatus({
        data: {
          leadId: props.leadId,
          contactName: name,
          status: next as ContactProgressStatus,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["contact-statuses"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const activeSlot = CONTACT_SLOTS.find((s) => s.key === active)!;
  const activeName =
    (activeSlot.nameField && props.lead[activeSlot.nameField]) || "";
  const activeApproach = approach[active] ?? 1;
  const activeDraft = drafts[active]?.[activeApproach];
  const isGenerating = generating.has(`${active}::${activeApproach}`);

  const matchKey = (activeName || activeSlot.role).toLowerCase();
  const sentForActive = (outreachRows ?? [])
    .filter(
      (r) =>
        r.contact_name.toLowerCase() === matchKey ||
        (r.contact_role ?? "").toLowerCase() === matchKey,
    )
    .sort((a, b) => {
      const at = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const bt = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return bt - at;
    });
  const sentCountByContact = new Map<string, number>();
  for (const r of outreachRows ?? []) {
    const k = r.contact_name.toLowerCase();
    sentCountByContact.set(k, (sentCountByContact.get(k) ?? 0) + 1);
  }


  const setActiveApproach = (id: number) =>
    setApproach((p) => ({ ...p, [active]: id }));

  const handleGenerate = async () => {
    if (!activeName) {
      toast.error(`No ${activeSlot.role} on file. Find them on LinkedIn first.`);
      return;
    }
    const gKey = `${active}::${activeApproach}`;
    setGenerating((p) => {
      const n = new Set(p);
      n.add(gKey);
      return n;
    });
    try {
      const result = await generate({
        data: {
          companyName: props.companyName,
          industry: props.industry,
          hq: props.hq,
          triggerSummary: props.triggerSummary,
          fitReasoning: props.fitReasoning,
          expansionSignals: props.expansionSignals,
          outOfHqCountries: [],
          contactName: activeName,
          contactRole: activeSlot.role,
          approach: activeApproach,
        },
      });
      setDrafts((p) => ({
        ...p,
        [active]: { ...(p[active] ?? {}), [activeApproach]: result.linkedinMessage },
      }));
    } catch (e) {
      toast.error((e as Error).message || "Failed to generate.");
    } finally {
      setGenerating((p) => {
        const n = new Set(p);
        n.delete(gKey);
        return n;
      });
    }
  };

  const copy = async () => {
    if (!activeDraft) return;
    await navigator.clipboard.writeText(activeDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
    try {
      await markSent({
        data: {
          leadId: props.leadId,
          companyName: props.companyName,
          contactName: activeName || activeSlot.role,
          contactRole: activeSlot.role,
          approach: activeApproach,
          messageText: activeDraft,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["linkedin-outreach"] });
      queryClient.invalidateQueries({ queryKey: ["linkedin-leads"] });
      toast.success(
        `Copied & logged as sent to ${activeName || activeSlot.role} (Approach ${activeApproach}).`,
      );
    } catch (e) {
      toast.error(
        `Copied, but failed to log: ${(e as Error).message || "unknown error"}`,
      );
    }
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] divide-y md:divide-y-0 md:divide-x">
      {/* contact list */}
      <ul className="py-2">
        {CONTACT_SLOTS.map((slot) => {
          const name = (slot.nameField && props.lead[slot.nameField]) || "";
          const profileUrl = (slot.linkField && props.lead[slot.linkField]) || "";
          const hasDraft = !!drafts[slot.key] && Object.keys(drafts[slot.key]).length > 0;
          const isActive = slot.key === active;
          const search = name
            ? `${name} ${props.companyName}`
            : `${slot.role} ${props.companyName}`;
          const linkHref = profileUrl || linkedInSearchUrl(search);
          const linkTitle = profileUrl
            ? `Open ${name || slot.role} on LinkedIn`
            : `Find ${slot.role} on LinkedIn`;
          return (
            <li key={slot.key} className="flex items-stretch">
              <button
                onClick={() => setActive(slot.key)}
                className={`flex-1 text-left px-4 py-2.5 text-xs hover:bg-muted/40 transition-colors flex items-start gap-2.5 ${
                  isActive ? "bg-muted/60" : ""
                }`}
              >
                <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {name || (
                      <span className="text-muted-foreground italic">Not on file</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide mt-0.5">
                    {slot.role}
                  </div>
                </div>
                {hasDraft && (
                  <Check className="h-3 w-3 text-[var(--score-hot)] shrink-0 mt-1" />
                )}
              </button>
              {slot.roleKey && (
                <button
                  type="button"
                  onClick={() => setEditingSlot(slot)}
                  className="px-2 flex items-center text-muted-foreground hover:text-primary border-l"
                  title={`Edit ${slot.role} contact`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 flex items-center text-muted-foreground hover:text-primary border-l"
                title={linkTitle}
              >
                <Linkedin className="h-3.5 w-3.5" />
              </a>
            </li>
          );
        })}
      </ul>

      {/* generator */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {activeName || (
                <span className="text-muted-foreground italic font-normal">
                  No {activeSlot.role} on file
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {activeSlot.role} · {props.companyName}
            </div>
          </div>
          <a
            href={
              (activeSlot.linkField && props.lead[activeSlot.linkField]) ||
              linkedInSearchUrl(
                activeName
                  ? `${activeName} ${props.companyName}`
                  : `${activeSlot.role} ${props.companyName}`,
              )
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            <Linkedin className="h-3.5 w-3.5" />
            Open in LinkedIn
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* sent history for active contact */}
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Sent history
              {sentForActive.length > 0 && (
                <span className="text-muted-foreground/70 normal-case tracking-normal font-normal">
                  · {sentForActive.length} message{sentForActive.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Status
              </span>
              <Select
                value={statusFor(activeName || activeSlot.role)}
                onValueChange={(v) => onStatusChange(activeName || activeSlot.role, v)}
                disabled={!activeName && !activeSlot.role}
              >
                <SelectTrigger className="h-7 w-[140px] text-[11px]">
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
            </div>
          </div>
          {sentForActive.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">
              No messages sent to this contact yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {sentForActive.map((r) => {
                const when = r.sent_at ?? r.last_status_change_at;
                return (
                  <li key={r.id} className="text-[11px]">
                    <details className="group">
                      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none hover:bg-muted/40 -mx-1 px-1 py-0.5 rounded">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-muted-foreground/60 text-[9px] group-open:rotate-90 transition-transform inline-block w-2">▶</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium px-1.5 py-0 shrink-0"
                          >
                            A{r.approach}
                          </Badge>
                          <span className="text-muted-foreground truncate">
                            {APPROACHES[r.approach]?.name ?? `Approach ${r.approach}`}
                          </span>
                          {r.status !== "sent" && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal px-1.5 py-0 shrink-0 capitalize"
                            >
                              {r.status.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        <div
                          className="text-muted-foreground/80 tabular-nums shrink-0"
                          title={when ? format(new Date(when), "PPpp") : ""}
                        >
                          {when
                            ? `${format(new Date(when), "MMM d, yyyy")} · ${formatDistanceToNow(new Date(when), { addSuffix: true })}`
                            : "—"}
                        </div>
                      </summary>
                      <div className="mt-1.5 ml-4 rounded border bg-card p-2 text-[11px] whitespace-pre-wrap text-foreground/85">
                        {r.message_text?.trim()
                          ? r.message_text
                          : <span className="italic text-muted-foreground">No message text was saved for this send.</span>}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* approach selector */}
        <div className="flex flex-wrap gap-1.5">
          {Object.values(APPROACHES).map((a) => {
            const isA = a.id === activeApproach;
            const hasDraft = !!drafts[active]?.[a.id];
            const isGen = generating.has(`${active}::${a.id}`);
            return (
              <button
                key={a.id}
                onClick={() => setActiveApproach(a.id)}
                title={a.description}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                  isA
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted border-border"
                }`}
              >
                <span className="font-medium">A{a.id}</span>
                <span className="opacity-80">{a.name}</span>
                {isGen && <Loader2 className="h-3 w-3 animate-spin" />}
                {hasDraft && !isGen && (
                  <Check
                    className={`h-3 w-3 ${isA ? "" : "text-[var(--score-hot)]"}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] text-muted-foreground italic">
          {APPROACHES[activeApproach].description}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <Linkedin className="h-3.5 w-3.5" /> LinkedIn DM · Approach {activeApproach}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating || !activeName}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {activeDraft ? "Regenerate" : "Generate message"}
            </Button>
            {activeDraft && (
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy & Mark Sent
              </Button>
            )}
          </div>
        </div>

        {activeDraft ? (
          <Textarea
            value={activeDraft}
            onChange={(e) =>
              setDrafts((p) => ({
                ...p,
                [active]: { ...(p[active] ?? {}), [activeApproach]: e.target.value },
              }))
            }
            rows={5}
            className="text-xs"
          />
        ) : isGenerating ? (
          <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
          </div>
        ) : (
          <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
            {activeName ? (
              <>
                Click <span className="font-medium">Generate message</span> to draft an
                Approach {activeApproach} ({APPROACHES[activeApproach].name}) DM for{" "}
                {activeName}.
              </>
            ) : (
              <>
                No {activeSlot.role} on file for {props.companyName}. Use the LinkedIn link
                above to find them, then add their name to enable generation.
              </>
            )}
          </div>
        )}
      </div>

      <EditContactDialog
        slot={editingSlot}
        leadId={props.leadId}
        currentName={(editingSlot?.nameField && props.lead[editingSlot.nameField]) || ""}
        currentUrl={(editingSlot?.linkField && props.lead[editingSlot.linkField]) || ""}
        onClose={() => setEditingSlot(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["lead", props.leadId] });
          queryClient.invalidateQueries({ queryKey: ["linkedin-leads"] });
        }}
      />
    </div>
  );
}

function EditContactDialog({
  slot,
  leadId,
  currentName,
  currentUrl,
  onClose,
  onSaved,
}: {
  slot: ContactSlot | null;
  leadId: string;
  currentName: string;
  currentUrl: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updateLeadContact);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset fields when slot opens
  const openKey = slot?.key ?? null;
  const lastKey = useRef<string | null>(null);
  if (openKey !== lastKey.current) {
    lastKey.current = openKey;
    if (openKey) {
      setName(currentName);
      setUrl(currentUrl);
    }
  }

  const open = !!slot && !!slot.roleKey;

  const save = async (clear = false) => {
    if (!slot?.roleKey) return;
    const finalName = clear ? "" : name.trim();
    const finalUrl = clear ? "" : url.trim();
    if (finalUrl) {
      const valid = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+\/?$/i.test(finalUrl);
      if (!valid) {
        toast.error("Enter a valid linkedin.com/in/... profile URL");
        return;
      }
    }
    setSaving(true);
    try {
      await updateFn({
        data: { leadId, role: slot.roleKey, name: finalName, linkedinUrl: finalUrl },
      });
      toast.success(clear ? `Cleared ${slot.role}` : `Saved ${slot.role}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {slot?.role} contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name" className="text-xs">
              Name
            </Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-url" className="text-xs">
              LinkedIn URL
            </Label>
            <Input
              id="contact-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/jane-doe"
              maxLength={500}
              disabled={saving}
            />
            <p className="text-[11px] text-muted-foreground">
              Must be a linkedin.com/in/... profile URL.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => save(true)}
            disabled={saving || (!currentName && !currentUrl)}
            className="mr-auto text-destructive hover:text-destructive"
          >
            Clear
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnrichLeadDialog({
  open,
  onOpenChange,
  leadId,
  currentWebsite,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: string;
  currentWebsite: string;
  onSaved: () => void;
}) {
  const enrichFn = useServerFn(enrichLead);
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset when opened
  const lastOpen = useRef(false);
  if (open && !lastOpen.current) {
    lastOpen.current = true;
    setWebsite(currentWebsite || "");
    setNotes("");
  } else if (!open && lastOpen.current) {
    lastOpen.current = false;
  }

  const submit = async () => {
    setBusy(true);
    try {
      const r = await enrichFn({
        data: {
          leadId,
          websiteOverride: website.trim(),
          extraContext: notes.trim(),
        },
      });
      if (!r.ok) {
        toast.error(r.message || "Nothing to enrich with.");
        return;
      }
      toast.success(
        `Enriched ${r.updatedFields.length} field${r.updatedFields.length === 1 ? "" : "s"}` +
          (r.scrapedUrls.length ? ` from ${r.scrapedUrls.length} source(s).` : "."),
      );
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Enrichment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add company information</DialogTitle>
          <DialogDescription>
            Provide a website URL to scrape and/or paste extra context. The AI will refine
            the company profile (HQ, industry, size, funding, expansion signals).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="enrich-website" className="text-xs">
              Company website
            </Label>
            <Input
              id="enrich-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              maxLength={500}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enrich-notes" className="text-xs">
              Notes / additional context
            </Label>
            <Textarea
              id="enrich-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste an about page, a press release, an investor update, or your own notes…"
              rows={8}
              maxLength={20000}
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || (!website.trim() && !notes.trim())}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enrich"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

