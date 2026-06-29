import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import {
  Clock,
  AlertCircle,
  Zap,
  Upload,
  Target,
  Users,
  MessageSquare,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/purpose")({
  head: () => ({
    meta: [
      { title: "Purpose — Brookelyn" },
      {
        name: "description",
        content:
          "Why Brookelyn exists: reduce prospecting friction and keep research workflows focused.",
      },
    ],
  }),
  component: () => (
    <AuthGuard>
      <Purpose />
    </AuthGuard>
  ),
});

function Purpose() {
  return (
    <div className="px-10 py-8 max-w-5xl">
      <section>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Purpose
        </div>
        <h1 className="text-4xl font-semibold tracking-tight leading-tight">
          Lead outreach, <span className="text-primary">automated.</span>
        </h1>
        <p className="text-base text-muted-foreground mt-2 max-w-2xl">
          From hours of manual prospecting to under an hour a day.
        </p>

        <div className="mt-6 relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-2 -bottom-10 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider opacity-80 font-semibold">
                Must have
              </div>
              <div className="text-lg font-semibold mt-0.5">
                Cut daily prospecting to under one hour.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-5">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-md bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                The Problem
              </h2>
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                "Hours scanning Google Alerts",
                "Deciding which leads are best",
                "Hunting contacts on LinkedIn",
                "Manually drafting every message",
                "Tracking when follow-ups are due",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive/60 shrink-0" />
                  <span className="text-foreground/80">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                The Solution
              </h2>
            </div>
            <ol className="space-y-3">
              {[
                {
                  icon: Upload,
                  title: "Upload & adjust your ICP",
                  desc: "Define your ideal customer profile in seconds.",
                },
                {
                  icon: Target,
                  title: "Google Alerts flow into scoring",
                  desc: "New articles move through the app on a regular schedule and surface the hottest companies matched to your ICP.",
                },
                {
                  icon: Users,
                  title: "5 key contacts per company",
                  desc: "LinkedIn profile links delivered automatically.",
                },
                {
                  icon: MessageSquare,
                  title: "5-message sequences",
                  desc: "Tailored to each news trigger and contact's role.",
                },
                {
                  icon: BarChart3,
                  title: "Activity dashboard",
                  desc: "Track by company or contact, with full metrics.",
                },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                        {i + 1}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.desc}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
