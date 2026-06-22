import { FormEvent, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2, Mail } from "lucide-react";
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

function LoginPage() {
  const { user, loading } = useAuth();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const emailRedirectTo = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}${redirect || "/linkedin-dashboard"}`;
  }, [redirect]);

  if (!loading && user) {
    return <Navigate to={redirect || "/linkedin-dashboard"} />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: false,
      },
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setSuccess(`Magic link sent to ${email}. Open the email on this device to finish signing in.`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Brookelyn</div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We’ll email you a secure magic link. Use the same inbox that should have access to this app.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          {success ? <div className="text-sm text-emerald-600">{success}</div> : null}

          <Button className="w-full" disabled={submitting || !email.trim()} type="submit">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending magic link…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send magic link
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
