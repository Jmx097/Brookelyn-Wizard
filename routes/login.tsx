import { FormEvent, useMemo, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleCheck,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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

const highlights = [
  "Lead review, scoring, and workflow state in one place",
  "Private research and outbound ops without dashboard clutter",
  "Simple sign-in surface for fast daily use",
];

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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(94,106,210,0.18),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,246,251,1))] px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_480px] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium tracking-wide text-slate-600 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Brookelyn workspace access
              </div>

              <h1 className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-slate-950">
                Clean, centered access to the prospecting workspace.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                The login screen should feel calm and obvious. No clutter, no
                awkward spacing, just a clean handoff into the daily workflow.
              </p>

              <div className="mt-8 space-y-3">
                {highlights.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur"
                  >
                    <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-[28px] border border-white/80 bg-white/88 p-6 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium tracking-wide text-slate-50">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Secure sign in
                  </div>
                  <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                    Brookelyn
                  </div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                    Welcome back
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Sign in with your workspace email and password to continue.
                  </p>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
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
                    className="h-12 rounded-xl border-slate-200 bg-white/90 shadow-none placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
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
                    className="h-12 rounded-xl border-slate-200 bg-white/90 shadow-none placeholder:text-slate-400"
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <Button
                  className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800"
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

              <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
                Optimized for quick daily access: centered layout, readable
                spacing, and minimal visual noise.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
