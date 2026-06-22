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
  const redirect = useRouterState({
    select: (state) => {
      const { pathname, searchStr, hash } = state.location;
      return `${pathname}${searchStr}${hash}`;
    },
  });

  if (loading) {
    return <AuthLoadingState />;
  }

  if (!user) {
    return <Navigate to="/login" search={{ redirect }} />;
  }

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
