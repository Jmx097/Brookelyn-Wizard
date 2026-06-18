import { AppShell } from "./app-shell";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  return <AppShell userEmail="brookelyn@goglobal.com">{children}</AppShell>;
}
