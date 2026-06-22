import type { ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "./app-shell";
import { useAuth } from "@/hooks/use-auth";

function AuthLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-sm text-muted-foreground">Checking your session…</div>
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useRouterState({ select: (state) => state.location });

  if (loading) {
    return <AuthLoadingState />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
