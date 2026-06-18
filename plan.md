## Problem

On `/usage`, everything below the page header is blank. The cost-driver cards (Bright Data, Lovable AI scoring, Lovable AI outreach, Firecrawl) already exist in code but never appear.

Root cause: the `useQuery` in `src/routes/usage.tsx` is gated by `enabled: !!session` using a local `useAuth()` hook. Inside `<AuthGuard>`, that local session is often still `null` on first render, so `getUsageStats` is never called (confirmed — no server-function request in the network log). Once `authLoading` and `isLoading` both flip to `false` with `data` still `undefined`, the entire `{data && data.totals && (...)}` block — which contains the per-driver breakdown — is skipped, leaving an empty page.

## Fix

Edit only `src/routes/usage.tsx`:

1. Drop the dependency on `useAuth()` for gating. `AuthGuard` already blocks unauthenticated users, and `getUsageStats` enforces auth via `requireSupabaseAuth` server-side.
2. Run the query unconditionally (remove `enabled`, remove `session?.user.id` from the query key, keep `retry: false`).
3. Keep the existing loading and error UI, but also render a fallback message if `data` resolves without `totals` so the page is never silently blank again.

No backend, schema, or business-logic changes. The existing `CostCard` cards and `getUsageStats` server function are already correct — this only unblocks rendering.

## Verification

- Reload `/usage` and confirm the four cost-driver cards (Bright Data, Lovable AI — lead scoring & enrichment, Lovable AI — outreach drafts, Firecrawl) render under the "Cost drivers" heading.
- Confirm the headline stats (Last 30 days / Next 30 days / All-in monthly) and the Activity and Auto-enrichment sections all show.
