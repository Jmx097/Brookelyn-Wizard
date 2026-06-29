import { FormEvent, useMemo, useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-6 py-10 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_34%),linear-gradient(180deg,_rgba(5,10,22,1),_rgba(8,15,30,1))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />

      <section className="relative w-full max-w-md rounded-[32px] border border-white/10 bg-slate-950/78 p-6 text-center shadow-[0_40px_100px_-46px_rgba(15,23,42,1)] backdrop-blur-xl sm:p-8">
        <div className="space-y-2">
          <h1 className="text-[2.2rem] font-semibold tracking-[-0.05em] text-white sm:text-[2.35rem]">
            Sign in
          </h1>
        </div>

        <form className="mt-7 space-y-5 text-center" onSubmit={handleSubmit}>
          <div className="space-y-2.5 text-center">
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
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
              className="h-12 rounded-2xl border-white/10 bg-white/[0.045] px-4 text-center text-white placeholder:text-center placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            />
          </div>

          <div className="space-y-2.5 text-center">
            <label className="block text-sm font-medium text-slate-200" htmlFor="password">
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
              className="h-12 rounded-2xl border-white/10 bg-white/[0.045] px-4 text-center text-white placeholder:text-center placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-400/70"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <Button
            className="h-12 w-full rounded-2xl bg-indigo-500 text-base text-white shadow-[0_18px_38px_-20px_rgba(99,102,241,0.95)] hover:bg-indigo-400"
            disabled={submitting || !email.trim() || !password}
            type="submit"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </section>
    </div>
  );
}
