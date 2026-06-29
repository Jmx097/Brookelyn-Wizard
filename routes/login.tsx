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
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
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
    position: { x: 72, y: 250 },
    sourcePosition: Position.Right,
    data: { label: "Inbox + signals", tone: "muted" },
    style: flowNodeStyle("muted"),
  },
  {
    id: "scoring",
    position: { x: 322, y: 170 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Scoring lane", tone: "default" },
    style: flowNodeStyle("default"),
  },
  {
    id: "research",
    position: { x: 322, y: 336 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Research notes", tone: "default" },
    style: flowNodeStyle("default"),
  },
  {
    id: "orchestration",
    position: { x: 622, y: 254 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: "Brookelyn flow", tone: "primary" },
    style: flowNodeStyle("primary"),
  },
  {
    id: "outreach",
    position: { x: 948, y: 170 },
    targetPosition: Position.Left,
    data: { label: "Outreach draft", tone: "default" },
    style: flowNodeStyle("default"),
  },
  {
    id: "pipeline",
    position: { x: 948, y: 362 },
    targetPosition: Position.Left,
    data: { label: "Pipeline state", tone: "muted" },
    style: flowNodeStyle("muted"),
  },
];

const edges: Edge[] = [
  {
    id: "e1",
    source: "inbox",
    target: "scoring",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9cff" },
    data: { label: "filter" },
  },
  {
    id: "e2",
    source: "inbox",
    target: "research",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9cff" },
    data: { label: "context" },
  },
  {
    id: "e3",
    source: "scoring",
    target: "orchestration",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9cff" },
    data: { label: "rank" },
  },
  {
    id: "e4",
    source: "research",
    target: "orchestration",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9cff" },
    data: { label: "merge" },
  },
  {
    id: "e5",
    source: "orchestration",
    target: "outreach",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9cff" },
    data: { label: "draft" },
  },
  {
    id: "e6",
    source: "orchestration",
    target: "pipeline",
    type: "flowLink",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b9cff" },
    data: { label: "sync" },
  },
];

const edgeTypes = {
  flowLink: FlowLink,
};

function flowNodeStyle(tone: FlowNodeData["tone"]) {
  const palette = {
    primary: {
      border: "1px solid rgba(129, 140, 248, 0.55)",
      background:
        "linear-gradient(180deg, rgba(67, 56, 202, 0.84), rgba(30, 41, 59, 0.96))",
      color: "#f8fafc",
      boxShadow: "0 24px 48px -24px rgba(99, 102, 241, 0.75)",
    },
    default: {
      border: "1px solid rgba(148, 163, 184, 0.26)",
      background: "rgba(15, 23, 42, 0.84)",
      color: "#e2e8f0",
      boxShadow: "0 22px 45px -28px rgba(15, 23, 42, 0.75)",
    },
    muted: {
      border: "1px solid rgba(148, 163, 184, 0.18)",
      background: "rgba(15, 23, 42, 0.58)",
      color: "#cbd5e1",
      boxShadow: "0 20px 44px -30px rgba(15, 23, 42, 0.62)",
    },
  } as const;

  return {
    width: 176,
    minHeight: 72,
    borderRadius: 22,
    padding: "20px 18px",
    fontSize: 14,
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
        style={{ stroke: "rgba(129, 140, 248, 0.55)", strokeWidth: 1.6 }}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950/90 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-300 shadow-lg"
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
      <div className="relative min-h-screen overflow-hidden bg-[#0a1020] text-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.3),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.18),_transparent_22%),linear-gradient(180deg,_rgba(8,15,30,1),_rgba(15,23,42,1))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />

        <div className="relative mx-auto grid min-h-screen w-full max-w-[1440px] items-center gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1.3fr)_440px] lg:px-8 xl:px-12">
          <section className="relative hidden min-h-[620px] overflow-hidden rounded-[32px] border border-white/10 bg-white/4 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.9)] lg:block">
            <div className="absolute inset-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.18, minZoom: 0.65 }}
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
                <Background gap={24} size={1} color="rgba(148,163,184,0.12)" />
              </ReactFlow>
            </div>

            <div className="pointer-events-none absolute left-8 top-8 max-w-md">
              <div className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-indigo-200">
                Brookelyn flow
              </div>
              <h1 className="mt-5 max-w-lg text-4xl font-semibold tracking-[-0.05em] text-white xl:text-5xl">
                Prospecting should look like a system, not a white memo.
              </h1>

              <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
                Simple sign-in on the right. Live flow context on the left. One
                clear screen instead of blocks of copy floating on white.
              </p>
            </div>

            <div className="pointer-events-none absolute bottom-8 left-8 flex gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 backdrop-blur-sm">
                Signals route into scoring, research, and outreach.
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 backdrop-blur-sm">
                Designed for one clear daily workflow.
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/72 p-6 shadow-[0_40px_90px_-36px_rgba(15,23,42,1)] backdrop-blur-xl sm:p-8">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure access
                </div>
                <div className="mt-4 text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Brookelyn
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                  Sign in to your workspace
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  One clean login card. No filler copy. No white background.
                  Just get in and work.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="email"
                  >
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
                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-white placeholder:text-slate-500 focus-visible:ring-indigo-400"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor="password"
                  >
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
                    className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-white placeholder:text-slate-500 focus-visible:ring-indigo-400"
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                <Button
                  className="h-12 w-full rounded-2xl bg-indigo-500 text-white hover:bg-indigo-400"
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

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                Single-user workspace today, but still better to keep app auth
                intact than to paper over it with nginx and break the Supabase
                token flow underneath.
              </div>
            </div>
          </section>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
