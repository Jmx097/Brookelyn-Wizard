import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Compass, LayoutGrid, KanbanSquare, Inbox, Sliders, Gauge, LogOut, Linkedin, BarChart3, Target, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/linkedin-dashboard", label: "Activity Dashboard", icon: BarChart3 },
  { to: "/my-leads", label: "My Leads", icon: LayoutGrid },
  { to: "/settings", label: "ICP Profile", icon: Sliders },
  { to: "/scoring", label: "Scoring Methodology", icon: Gauge },
  { to: "/sources", label: "My Sources", icon: Inbox },
  { to: "/usage", label: "Costs & Usage", icon: DollarSign },
  { to: "/purpose", label: "Purpose", icon: Target },
];

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail?: string }) {
  const location = useLocation();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="px-6 py-6 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Compass className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Prospect Compass</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">GoGlobal</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {nav.map((item) => {
            const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t mt-auto">
          <div className="px-2 pb-2 text-xs text-muted-foreground truncate">{userEmail}</div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
