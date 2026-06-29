import { FormEvent, useMemo, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import {
  Background,
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

type FlowNodeData = {
  label: string;
  tone: "primary" | "default" | "muted";
};

const nodes: Node<FlowNodeData>[] = [
  {
    id: "inbox",
    type: "input",
    position: { x: 72, y: 126 },
    sourcePosition: Position.Right,
    data: { label: "Signals inbox", tone: "muted" },
    style: flowNodeStyle("muted"),
  },
  {
    id: "scoring",
    position: { x: 286, y: 48 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Scoring", tone: "default" },
    style: flowNodeStyle("default"),
  },
  {
    id: "research",
    position: { x: 286, y: 206 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Research", tone: "default" },
    style: flowNodeStyle("default"),
  },
  {
    id: "workspace",
    position: { x: 520, y: 126 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Brookelyn", tone: "primary" },
    style: flowNodeStyle("primary"),
  },
  {
    id: "outreach",
    position: { x: 754, y: 48 },
    targetPosition: Position.Left,
    data: { label: "Outreach draft", tone: "default" },
    style: flowNodeStyle("default"),
  },
  {
    id: "pipeline",
    position: { x: 754, y: 206 },
    targetPosition: Position.Left,
    data: { label: "Pipeline state", tone: "muted" },
    style: flowNodeStyle("muted"),
  },
];

const edges: Edge[] = [
  {
    id: "signals-scoring",
    source: "inbox",
    target: "scoring",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(129, 140, 248, 0.75)" },
    data: { label: "filter" },
  },
  {
    id: "signals-research",
    source: "inbox",
    target: "research",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(129, 140, 248, 0.75)" },
    data: { label: "context" },
  },
  {
    id: "scoring-workspace",
    source: "scoring",
    target: "workspace",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(129, 140, 248, 0.75)" },
    data: { label: "rank" },
  },
  {
    id: "research-workspace",
    source: "research",
    target: "workspace",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(129, 140, 248, 0.75)" },
    data: { label: "merge" },
  },
  {
    id: "workspace-outreach",
    source: "workspace",
    target: "outreach",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(129, 140, 248, 0.75)" },
    data: { label: "draft" },
  },
  {
    id: "workspace-pipeline",
    source: "workspace",
    target: "pipeline",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(129, 140, 248, 0.75)" },
    data: { label: "sync" },
  },
];

const edgeTypes = {
  flowLink: FlowLink,
};

function flowNodeStyle(tone: FlowNodeData["tone"]) {
  const palette = {
    primary: {
      border: "1px solid rgba(129, 140, 248, 0.48)",
      background:
        "linear-gradient(180deg, rgba(79, 70, 229, 0.9), rgba(30, 41, 59, 0.98))",
      color: "#f8fafc",
      boxShadow: "0 24px 54px -30px rgba(99, 102, 241, 0.88)",
    },
    default: {
      border: "1px solid rgba(148, 163, 184, 0.22)",
      background: "rgba(15, 23, 42, 0.84)",
      color: "#e2e8f0",
      boxShadow: "0 22px 45px -30px rgba(15, 23, 42, 0.78)",
    },
    muted: {
      border: "1px solid rgba(148, 163, 184, 0.18)",
      background: "rgba(15, 23, 42, 0.58)",
      color: "#cbd5e1",
      boxShadow: "0 20px 40px -32px rgba(15, 23, 42, 0.68)",
    },
  } as const;

  return {
    width: 160,
    minHeight: 66,
    borderRadius: 20,
    padding: "18px 16px",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    ...palette[tone],
  };
}

function FlowLink({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<Edge<{ label?: string }>>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: "rgba(129, 140, 248, 0.58)", strokeWidth: 1.5 }}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/8 bg-slate-950/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 shadow-lg"
            style={{ left: labelX, top: labelY }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function normalizeRedirect(target?: string) {
  if (!target || target === "/") return "/linkedin-dashboard";
  if (target.startsWith("/login")) return "/linkedin-dashboard";
  return target;
}

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { redirect } = Route.useSearch();
  const safeRedirect = useMemo(() => normalizeRedirect(redirect), [redirect]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to={safeRedirect} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    await navigate({ to: safeRedirect, replace: true });
  };

  return (
    <ReactFlowProvider>
      <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.24),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_22%),linear-gradient(180deg,_rgba(5,10,22,1),_rgba(8,15,30,1))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:44px_44px] opacity-35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_bottom,_rgba(79,70,229,0.16),_transparent_62%)]" />

        <div className="relative mx-auto grid min-h-screen w-full max-w-[1460px] items-center gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:px-8 xl:px-10">
          <section className="hidden lg:flex lg:flex-col lg:gap-6">
            <div className="rounded-[34px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.95)] backdrop-blur-sm xl:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/22 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-200">
                Brookelyn workspace
              </div>

              <div className="mt-6 max-w-2xl">
                <h1 className="text-5xl font-semibold tracking-[-0.06em] text-white xl:text-6xl">
                  Calm access to a focused prospecting workflow.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 xl:text-lg">
                  Sign in, review ranked leads, and keep research plus outreach in one
                  clean operating lane.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  "Lead review and scoring in one place",
                  "Research context without dashboard clutter",
                  "A daily workspace built for fast handoff",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-slate-950/38 px-4 py-4 text-sm leading-6 text-slate-300"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.95)] backdrop-blur-sm xl:p-5">
              <div className="mb-4 flex items-center justify-between px-2 pt-1">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Workflow preview
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    Static visual context only — the sign-in card stays the primary action.
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Read only
                </div>
              </div>

              <div className="relative h-[360px] overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(10,17,31,0.96))]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  edgeTypes={edgeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.24, minZoom: 0.84 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  zoomOnScroll={false}
                  panOnDrag={false}
                  panOnScroll={false}
                  zoomOnPinch={false}
                  zoomOnDoubleClick={false}
                  preventScrolling={false}
                  proOptions={{ hideAttribution: true }}
                  className="bg-transparent"
                >
                  <Background gap={26} size={1} color="rgba(148,163,184,0.11)" />
                </ReactFlow>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[32px] border border-white/10 bg-slate-950/78 p-6 shadow-[0_40px_100px_-46px_rgba(15,23,42,1)] backdrop-blur-xl sm:p-8">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure access
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Brookelyn
                </div>
                <h2 className="mt-3 text-[2.15rem] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[2.35rem]">
                  Sign in to your workspace
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
                  Use your workspace email and password to continue into the prospecting workspace.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2.5">
                  <label className="text-sm font-medium text-slate-200" htmlFor="email">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.045] px-4 text-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-medium text-slate-200" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.045] px-4 text-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                <Button
                  className="h-12 w-full rounded-2xl bg-indigo-500 text-white shadow-[0_18px_38px_-20px_rgba(99,102,241,0.95)] hover:bg-indigo-400"
                  disabled={submitting || !email.trim() || !password}
                  type="submit"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-400">
                Protected access for Brookelyn operators. The visual shell is minimal on purpose so the daily workflow stays obvious.
              </div>
            </div>
          </section>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
