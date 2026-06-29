import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Mail, Search, ExternalLink, Copy, ClipboardPaste, Loader2, Play, Upload, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { processDigest, runDailySearchNow } from "@/lib/ingest.functions";
import { createInboundEmailRoute, deactivateInboundEmailRoute, listInboundEmailRoutes } from "@/lib/inbound-email-routes.functions";
import { ImportCompaniesDialog } from "@/components/import-companies-dialog";

export const Route = createFileRoute("/sources")({
  component: () => (
    <AuthGuard>
      <Sources />
    </AuthGuard>
  ),
});

function getAppUrl() {
  return (
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_PUBLIC_APP_URL ||
    window.location.origin
  );
}

function Sources() {
  const qc = useQueryClient();
  const [digestText, setDigestText] = useState("");
  const [routeEmail, setRouteEmail] = useState("");
  const [routeLabel, setRouteLabel] = useState("");
  const processFn = useServerFn(processDigest);
  const searchFn = useServerFn(runDailySearchNow);
  const listRoutesFn = useServerFn(listInboundEmailRoutes);
  const createRouteFn = useServerFn(createInboundEmailRoute);
  const deactivateRouteFn = useServerFn(deactivateInboundEmailRoute);

  const appUrl = useMemo(() => getAppUrl(), []);
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/public/inbound-email`;

  const processMutation = useMutation({
    mutationFn: async (text: string) => processFn({ data: { text } }),
    onSuccess: (r) => {
      toast.success(`Processed ${r.extracted} articles — ${r.created} new leads, ${r.updated} updated`);
      setDigestText("");
      qc.invalidateQueries({ queryKey: ["recent-articles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const searchMutation = useMutation({
    mutationFn: async () => searchFn({}),
    onSuccess: (r) => {
      toast.success(`Ran ${r.queries} searches — ${r.created} new leads, ${r.updated} updated`);
      qc.invalidateQueries({ queryKey: ["search-queries"] });
      qc.invalidateQueries({ queryKey: ["recent-articles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRouteMutation = useMutation({
    mutationFn: async () =>
      createRouteFn({
        data: {
          destinationAddress: routeEmail,
          sourceLabel: routeLabel || null,
        },
      }),
    onSuccess: () => {
      toast.success("Inbound route added");
      setRouteEmail("");
      setRouteLabel("");
      qc.invalidateQueries({ queryKey: ["inbound-email-routes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateRouteMutation = useMutation({
    mutationFn: async (routeId: string) => deactivateRouteFn({ data: { routeId } }),
    onSuccess: () => {
      toast.success("Inbound route removed");
      qc.invalidateQueries({ queryKey: ["inbound-email-routes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: routes } = useQuery({
    queryKey: ["inbound-email-routes"],
    queryFn: async () => listRoutesFn({}),
  });

  const { data: queries } = useQuery({
    queryKey: ["search-queries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_queries")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: articles } = useQuery({
    queryKey: ["recent-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id,title,url,source,published_at,snippet,lead_id")
        .order("published_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: gmailConfirmations } = useQuery({
    queryKey: ["gmail-forwarding-confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_forwarding_confirmations")
        .select("id,from_address,subject,code,verify_url,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="px-10 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Sources</div>
        <h2 className="text-2xl font-semibold tracking-tight">Where your leads come from</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Three pipes feed your pipeline: spreadsheet uploads, forwarded Google Alert emails, and scheduled daily web searches. Google Alert articles land here first, then move through the same scoring flow the app runs on its regular cadence.
        </p>
      </div>

      <section className="rounded-lg border bg-card p-6 mb-8">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Upload className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Import companies from a spreadsheet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload an .xlsx or .csv with company names and websites. Each company is scraped, scored against your ICP, searched across job boards for open positions, and enriched with executive LinkedIn profiles. Replaces existing leads.
            </p>
            <div className="mt-4">
              <ImportCompaniesDialog />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 mb-8">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Forward Google Alerts here</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add one or more destination inbox addresses below. When a Google Alert hits one of these routes, the app pulls the linked articles, runs them through your scoring methodology, and drops the results into the same pipeline as the rest of your scheduled sourcing.
            </p>

            <div className="mt-4 rounded-md border bg-muted/40 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_auto]">
                <Input
                  value={routeEmail}
                  onChange={(e) => setRouteEmail(e.target.value)}
                  placeholder="alerts@yourdomain.com"
                />
                <Input
                  value={routeLabel}
                  onChange={(e) => setRouteLabel(e.target.value)}
                  placeholder="Google Alerts inbox (optional)"
                />
                <Button
                  onClick={() => createRouteMutation.mutate()}
                  disabled={createRouteMutation.isPending || routeEmail.trim().length < 3}
                >
                  {createRouteMutation.isPending ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Adding…</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5 mr-1.5" /> Add route</>
                  )}
                </Button>
              </div>

              {(routes ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No inbound routes configured yet.</div>
              ) : (
                <div className="space-y-2">
                  {(routes ?? []).map((route) => (
                    <div key={route.id} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                      <code className="flex-1 font-mono text-sm">{route.destination_address ?? route.route_key}</code>
                      {route.source_label && (
                        <Badge variant="outline" className="text-[10px] font-normal">{route.source_label}</Badge>
                      )}
                      <Badge variant={route.is_active ? "secondary" : "outline"} className="text-[10px]">
                        {route.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {route.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deactivateRouteMutation.mutate(route.id)}
                          disabled={deactivateRouteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
                  Gmail forwarding confirmation codes
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                When you add one of the route addresses above as a forwarding address in Gmail, Google sends a 9-digit confirmation code here. It will appear below within a minute — copy it and paste it back into Gmail's forwarding settings to finish setup.
              </p>
              {(gmailConfirmations ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No confirmation codes received yet.</div>
              ) : (
                <div className="space-y-2">
                  {(gmailConfirmations ?? []).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                      <code className="font-mono text-base font-semibold tracking-wider flex-1">
                        {c.code ?? "(code not parsed — see raw email)"}
                      </code>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.created_at))} ago
                      </span>
                      {c.code && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            toast.success("Code copied");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      )}
                      {c.verify_url && (
                        <a
                          href={c.verify_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          Verify link
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-md border bg-muted/40 p-4 text-xs space-y-2">
              <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">Webhook endpoint (for your email service)</div>
              <code className="block break-all rounded bg-background border px-2 py-1.5 font-mono">{webhookUrl}</code>
              <p className="text-muted-foreground leading-relaxed">
                Point Postmark, SendGrid Inbound Parse, Mailgun, or a Cloudflare Email Worker at the URL above. Add header <code className="font-mono">x-inbound-secret</code> with your saved secret value. Accepts JSON with either lowercase keys (<code>to/from/subject/text/html</code>) or Postmark casing (<code>To/From/Subject/TextBody/HtmlBody</code>).
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 mb-8">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardPaste className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Paste a Google Alert digest</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Until inbound forwarding is wired up, paste the body of a Google Alert email (or any block of headlines + links) and the app will run that batch through the same extract → enrich → score flow used in the regular schedule.
            </p>
            <Textarea
              value={digestText}
              onChange={(e) => setDigestText(e.target.value)}
              placeholder="Paste the email body here…"
              className="mt-4 min-h-[160px] font-mono text-xs"
            />
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => processMutation.mutate(digestText)}
                disabled={processMutation.isPending || digestText.trim().length < 20}
              >
                {processMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Processing…</>
                ) : (
                  <>Process digest</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Daily search queries</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending}
          >
            {searchMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running…</>
            ) : (
              <><Play className="h-3.5 w-3.5 mr-1.5" /> Run search now</>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          The app runs these every morning at 7:00am ET. Google Alert articles and search results both flow into the same scoring queue, so your lead list stays current without a separate review pass.
        </p>
        <div className="rounded-lg border bg-card divide-y">
          {(queries ?? []).map((q) => (
            <div key={q.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-mono truncate">{q.query}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {q.last_run_at
                    ? `Last run ${formatDistanceToNow(new Date(q.last_run_at))} ago`
                    : "Not yet run"}
                </div>
              </div>
              <Badge variant={q.enabled ? "secondary" : "outline"} className="text-[10px]">
                {q.enabled ? "Active" : "Paused"}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Recent articles</h2>
        <div className="rounded-lg border bg-card divide-y">
          {(articles ?? []).map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.snippet}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {a.source === "alert_email" ? "Alert" : a.source === "web_search" ? "Search" : "Manual"}
                  </Badge>
                  <a href={a.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
          {(articles ?? []).length === 0 && (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">No articles yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
