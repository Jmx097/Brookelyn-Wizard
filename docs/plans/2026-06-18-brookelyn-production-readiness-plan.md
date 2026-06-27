# Brookelyn Production Readiness & Proposal Compliance Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Brookelyn-Wizard production-ready and compliant with the June 18, 2026 Brookelyn Sproviero proposal by replacing demo auth/access patterns, hardening data security, operationalizing ingestion/deployment, and closing scope gaps around cleanup, enrichment, and domain launch.

**Architecture:** Convert the current demo/singleton Lovable-style app into a real single-tenant or tenant-scoped production deployment with authenticated frontend access, server-enforced authorization, locked-down Supabase RLS, environment-driven configuration, and explicit operational workflows for Google Alerts ingestion, Bright Data enrichment, stale-data cleanup, and custom-domain deployment. Preserve the existing TanStack Start + Supabase + Cloudflare/Lovable stack, but remove demo shortcuts and make every external integration observable and configurable.

**Tech Stack:** TypeScript, React 19, TanStack Start, TanStack Router, React Query, Supabase, Cloudflare/Wrangler, Firecrawl, Bright Data, Anthropic API, Zod.

---

## Phase 0 — Baseline and safety rails

### Task 1: Snapshot the current production-risk surface

**Objective:** Create a written baseline of the current security and production gaps before editing behavior.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-production-readiness-audit.md`
- Reference: `components/auth-guard.tsx`
- Reference: `routes/login.tsx`
- Reference: `routes/sources.tsx`
- Reference: `integrations/supabase/client.server.ts`
- Reference: `integrations/supabase/auth-middleware.ts`
- Reference: `supabase/migrations/*.sql`

**Step 1: Write the audit note**

Create a concise markdown audit with sections:
- frontend auth gaps
- open/demo RLS policies
- hardcoded domain/inbox/email values
- public endpoint concerns
- deployment/config inconsistencies
- missing operational controls

Use exact file references and quote the risky lines.

**Step 2: Save the audit note**

Run:
`git add docs/plans/2026-06-18-brookelyn-production-readiness-audit.md`

Expected: file staged.

**Step 3: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-production-readiness-audit.md
git commit -m "docs: add brookelyn production readiness audit"
```

---

### Task 2: Add environment/config inventory documentation

**Objective:** Define all required production environment variables and which features depend on each one.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-env-matrix.md`
- Reference: `integrations/supabase/client.ts`
- Reference: `integrations/supabase/client.server.ts`
- Reference: `routes/api/public/inbound-email.ts`
- Reference: `lib/ingest.functions.ts`
- Reference: `lib/contacts.server.ts`
- Reference: `lib/outreach.functions.ts`
- Reference: `routes/api/public/hooks/run-daily-search.ts`

**Step 1: Write the env matrix**

Document at minimum:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `FIRECRAWL_API_KEY`
- `BRIGHTDATA_API_KEY`
- `BRIGHTDATA_SERP_ZONE`
- `INBOUND_EMAIL_SECRET`
- production app origin/domain variables you will introduce later
- forwarding inbox / webhook URL variables you will introduce later

For each, include:
- purpose
- required for local/dev/staging/prod
- failure mode when missing

**Step 2: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-env-matrix.md
git commit -m "docs: add brookelyn environment matrix"
```

---

## Phase 1 — Replace demo auth with real auth

### Task 3: Add a real auth state hook contract

**Objective:** Introduce a single source of truth for frontend auth/session state instead of the current fake guard.

**Files:**
- Modify: `hooks/use-auth.ts`
- Test/verify: `components/auth-guard.tsx`
- Test/verify: `routes/login.tsx`

**Step 1: Inspect the existing hook**

Read `hooks/use-auth.ts` and determine whether it already exposes:
- session
- user
- loading state
- sign-in/sign-out helpers

If not, rewrite it so it provides those values via Supabase auth state listeners.

**Step 2: Implement a stable auth hook**

The hook should:
- call `supabase.auth.getSession()` on load
- subscribe to `supabase.auth.onAuthStateChange`
- expose `{ session, user, loading }`
- clean up the subscription on unmount

**Step 3: Verify with a minimal console render**

Temporarily render session state somewhere local or write a focused smoke assertion.

Run:
`npm run build`

Expected: successful build.

**Step 4: Commit**

```bash
git add hooks/use-auth.ts
git commit -m "feat: add real frontend auth session hook"
```

---

### Task 4: Replace the fake AuthGuard with a real route gate

**Objective:** Stop rendering protected pages for anonymous users and stop hardcoding Brookelyn’s email.

**Files:**
- Modify: `components/auth-guard.tsx`
- Modify: `components/app-shell.tsx`
- Reference: `hooks/use-auth.ts`
- Reference: `routes/login.tsx`

**Step 1: Write the guard behavior**

`AuthGuard` should:
- show a loading state while auth is resolving
- redirect unauthenticated users to `/login`
- pass the real signed-in user email to `AppShell`
- render children only when authenticated

**Step 2: Remove the hardcoded email**

Delete:
- `brookelyn@goglobal.com`

Use `user?.email` instead.

**Step 3: Verify**

Run:
`npm run build`

Expected: successful build, no type errors.

**Step 4: Commit**

```bash
git add components/auth-guard.tsx components/app-shell.tsx
git commit -m "feat: replace fake auth guard with real session gate"
```

---

### Task 5: Build a real login page

**Objective:** Provide an actual login screen rather than redirecting `/login` to `/`.

**Files:**
- Modify: `routes/login.tsx`
- Create if needed: `components/login-form.tsx`
- Reference: `integrations/supabase/client.ts`
- Reference: `hooks/use-auth.ts`

**Step 1: Replace the redirect-only route**

Implement a real login page that supports the intended auth method. If Brookelyn is single-user and should use passwordless magic links, prefer:
- email input
- “send magic link” action
- success message after request

If the project instead already uses email/password, implement that only if existing infrastructure proves it.

**Step 2: Redirect authenticated users away from login**

If already signed in, navigate to `/linkedin-dashboard`.

**Step 3: Verify**

Run:
`npm run build`

Expected: successful build.

**Step 4: Commit**

```bash
git add routes/login.tsx components/login-form.tsx
git commit -m "feat: add real login page"
```

---

### Task 6: Validate auth propagation into server functions

**Objective:** Confirm authenticated browser sessions actually reach server functions with bearer auth headers.

**Files:**
- Reference: `integrations/supabase/auth-attacher.ts`
- Reference: `integrations/supabase/auth-middleware.ts`
- Reference: `start.ts`

**Step 1: Confirm middleware behavior**

Verify that `attachSupabaseAuth` injects the bearer token into TanStack Start function calls.

**Step 2: Add a focused smoke path if missing**

If there is no easy verification route, add a tiny internal dev-only test path or a temporary function to confirm:
- browser session exists
- token is attached
- `requireSupabaseAuth` can read claims

**Step 3: Verify**

Run a local smoke test:
- start the app
- sign in
- hit a protected server-function-backed page like `/usage`
- confirm no 401s in server logs

**Step 4: Commit**

```bash
git add integrations/supabase/auth-attacher.ts integrations/supabase/auth-middleware.ts start.ts
# only include changed files if needed
 git commit -m "test: verify auth propagation to server functions"
```

---

## Phase 2 — Lock down Supabase access

### Task 7: Inventory and remove every demo read policy

**Objective:** Eliminate public/demo data exposure from Supabase.

**Files:**
- Modify: `supabase/migrations/20260509211521_acdf1bd5-50d2-4297-b14c-05c98d80b697.sql`
- Modify: `supabase/migrations/20260509220512_55d9fda1-47e4-4443-8c2b-c99b2d8113ae.sql`
- Modify: `supabase/migrations/20260509212334_d6ab65a6-e264-46c6-9971-a3b527a6a112.sql`
- Modify: `supabase/migrations/20260523151033_d83e5def-b042-4dcf-a09c-a84c3c1f9823.sql`
- Modify: `supabase/migrations/20260524152508_d51f7e04-86cc-4719-b137-175c2b1b7055.sql`
- Modify: `supabase/migrations/20260527204228_a61c1e1b-feec-484a-a01e-e066354232ea.sql`
- Modify: `supabase/migrations/20260529134127_850ca904-61f7-4f9d-9e5e-a750d1da16b5.sql`
- Create: a new migration that drops risky policies safely in forward-only form

**Step 1: Write a new migration instead of mutating history blindly**

Create a new migration like:
`supabase/migrations/20260618_remove_demo_read_policies.sql`

It should explicitly drop:
- demo read leads
- demo read articles
- demo read queries
- demo read icp
- demo read notes
- demo read outreach
- demo read saved_views
- demo read job postings
- demo read contact_status
- demo read gmail confirmations
- demo read linkedin_outreach
- demo read lead_contacts

**Step 2: Remove anon grant exposure**

Add SQL to revoke:
- `GRANT SELECT ON public.lead_contacts TO anon`

Also audit any other anon/public grants and remove those not strictly required.

**Step 3: Verify migration syntax**

Run the project’s Supabase migration validation command if available, or at minimum ensure the SQL is syntactically valid.

**Step 4: Commit**

```bash
git add supabase/migrations/20260618_remove_demo_read_policies.sql
git commit -m "security: remove demo read policies and anon data exposure"
```

---

### Task 8: Add an RLS verification checklist document

**Objective:** Make production rollout of Supabase policy changes explicit and reviewable.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-rls-verification.md`

**Step 1: Write the checklist**

Include explicit checks for each table:
- `icp_config`
- `search_queries`
- `leads`
- `articles`
- `outreach_drafts`
- `saved_views`
- `job_postings`
- `lead_contacts`
- `gmail_forwarding_confirmations`
- `linkedin_outreach`
- `contact_status`
- `notes`

For each table verify:
- anonymous read denied
- authenticated cross-user read denied
- owner read allowed
- owner write allowed where needed
- service role path still works only through trusted server handlers

**Step 2: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-rls-verification.md
git commit -m "docs: add brookelyn rls verification checklist"
```

---

## Phase 3 — Remove singleton and hardcoded Brookelyn/demo assumptions

### Task 9: Replace hardcoded source configuration with environment-driven config

**Objective:** Stop shipping hardcoded inbox and webhook values inside route code.

**Files:**
- Modify: `routes/sources.tsx`
- Create if needed: `lib/runtime-config.ts`
- Create if needed: `lib/public-config.ts`

**Step 1: Introduce config helpers**

Read values from env-backed config such as:
- `VITE_FORWARD_INBOX`
- `VITE_INBOUND_WEBHOOK_URL`
- `VITE_APP_NAME`
- `VITE_APP_BRAND_SUBTITLE`

Do not leave:
- `compass+brookelyn@brookelynaiwizard.com`
- `https://brookelynaiwizard-com.lovable.app/...`

hardcoded in the component.

**Step 2: Add clear fallback behavior**

If a config value is missing, show a warning UI to admins instead of crashing.

**Step 3: Verify**

Run:
`npm run build`

Expected: successful build.

**Step 4: Commit**

```bash
git add routes/sources.tsx lib/runtime-config.ts lib/public-config.ts
git commit -m "refactor: move source and webhook settings to environment config"
```

---

### Task 10: Remove template/demo product identifiers

**Objective:** Replace leftover scaffold names so production artifacts match Brookelyn’s deployment.

**Files:**
- Modify: `package.json`
- Modify: `wrangler.jsonc`
- Modify: `project.json`
- Modify: any branding/constants files discovered during search

**Step 1: Rename template identifiers**

Replace values like:
- `tanstack_start_ts`
- `tanstack-start-app`
- obvious template markers

with real deployment-safe names.

**Step 2: Verify**

Run:
`npm run build`

Expected: successful build.

**Step 3: Commit**

```bash
git add package.json wrangler.jsonc project.json
git commit -m "chore: replace template identifiers with production names"
```

---

### Task 11: Decide and document tenant model

**Objective:** Resolve whether this app is truly single-tenant single-user or multi-user with tenant isolation, because several current patterns assume both at once.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-tenant-model.md`
- Reference: `lib/icp.functions.ts`
- Reference: `lib/ingest.functions.ts`
- Reference: `lib/lead-enrich.functions.ts`
- Reference: `lib/import-companies.server.ts`

**Step 1: Write the decision doc**

Explicitly answer:
- is this Brookelyn-only and single-user?
- is it one organization with potentially multiple seats?
- do singleton fallback records remain valid in production?

**Step 2: Use that decision to mark follow-up code changes**

List every file still using:
- singleton IDs
- cross-user assumptions
- global fallback rows

**Step 3: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-tenant-model.md
git commit -m "docs: define brookelyn tenant model"
```

---

## Phase 4 — Harden server authorization and public endpoints

### Task 12: Add auth middleware to privileged server functions that currently bypass it

**Objective:** Ensure non-public server actions execute in the context of the authenticated user, not only via service role lookups.

**Files:**
- Modify: `lib/icp.functions.ts`
- Modify: `lib/lead-enrich.functions.ts`
- Modify: `lib/import-companies.functions.ts`
- Modify any other `createServerFn` discovered without auth middleware but touching user data
- Reference: `integrations/supabase/auth-middleware.ts`

**Step 1: Enumerate all createServerFn handlers**

Search for `createServerFn(` and classify each as:
- public/unauthenticated by design
- protected and should use `requireSupabaseAuth`

**Step 2: Add middleware where required**

For each protected handler:
- add `.middleware([requireSupabaseAuth])`
- use `context.userId` instead of trusting client-provided IDs or singleton fallbacks

**Step 3: Verify**

Run:
`npm run build`

Then perform smoke tests on:
- settings save
- import companies
- enrich/rescore
- usage page

Expected: authenticated flows pass; anonymous use fails.

**Step 4: Commit**

```bash
git add lib/icp.functions.ts lib/lead-enrich.functions.ts lib/import-companies.functions.ts
git commit -m "security: require auth on privileged server functions"
```

---

### Task 13: Harden the public inbound email webhook

**Objective:** Make the inbound email endpoint production-safe and observable.

**Files:**
- Modify: `routes/api/public/inbound-email.ts`
- Create if needed: `lib/webhook-security.ts`
- Create if needed: `lib/audit-log.ts`

**Step 1: Normalize and centralize secret validation**

Extract secret checking logic so it is not duplicated or ad hoc.

**Step 2: Add safe structured logging**

Log:
- request accepted/rejected
- reason for rejection
- source/provider hints
- processing result counts

Do not log full sensitive email bodies by default.

**Step 3: Add abuse controls**

At minimum implement:
- request size limits
- payload validation failures with explicit 4xx responses
- optional basic rate limiting if feasible in current stack

**Step 4: Verify**

Test with:
- missing secret → 401
- invalid JSON → 400
- valid payload → 200

**Step 5: Commit**

```bash
git add routes/api/public/inbound-email.ts lib/webhook-security.ts lib/audit-log.ts
git commit -m "security: harden inbound email webhook"
```

---

### Task 14: Harden the public daily-search hook

**Objective:** Ensure scheduled search execution cannot be invoked or abused accidentally in production.

**Files:**
- Modify: `routes/api/public/hooks/run-daily-search.ts`

**Step 1: Add explicit caller protection**

Do not leave this endpoint open just because it is under `/api/public/hooks/`.

Add one of:
- shared secret header validation, or
- Cloudflare cron-only guard if using Workers Cron triggers, or
- both

**Step 2: Add execution logging**

Record:
- who/what invoked it
- queries run count
- created leads count
- errors count

**Step 3: Verify**

Test:
- unauthorized request rejected
- authorized request accepted

**Step 4: Commit**

```bash
git add routes/api/public/hooks/run-daily-search.ts
git commit -m "security: protect scheduled daily search hook"
```

---

## Phase 5 — Proposal scope gap: stale data cleanup

### Task 15: Define stale-data cleanup policy

**Objective:** Translate “clear out stale data” from the proposal into explicit app behavior.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-stale-data-policy.md`
- Reference: `leads`
- Reference: `articles`
- Reference: `job_postings`
- Reference: `lead_contacts`

**Step 1: Write the policy**

Decide and document:
- what counts as stale
- when to archive vs delete
- whether “passed” leads are retained
- whether missing-source leads are pruned
- how dedupe/replace should work on imports

**Step 2: Define data freshness fields if needed**

If current schema lacks fields like:
- `archived_at`
- `last_seen_at`
- `last_source_at`
- `is_stale`

note them for the next migration task.

**Step 3: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-stale-data-policy.md
git commit -m "docs: define stale data cleanup policy"
```

---

### Task 16: Add schema support for stale/archived records

**Objective:** Add the minimum schema needed to manage stale data safely instead of destructive ad hoc deletion.

**Files:**
- Create: new Supabase migration for freshness/archive fields
- Modify: any TypeScript database types generated from schema if checked in

**Step 1: Write the migration**

Add the smallest useful fields, for example on `leads`:
- `archived_at timestamptz null`
- `last_source_at timestamptz null`
- `last_reviewed_at timestamptz null`

Optionally add freshness metadata to related tables if required.

**Step 2: Backfill sanely**

Populate `last_source_at` from existing article timestamps where possible.

**Step 3: Verify**

Run migration validation and ensure type generation remains valid.

**Step 4: Commit**

```bash
git add supabase/migrations/<new-stale-data-migration>.sql
git commit -m "feat: add stale data lifecycle fields"
```

---

### Task 17: Implement cleanup workflow

**Objective:** Provide an actual stale-data cleanup mechanism that satisfies the proposal.

**Files:**
- Create or modify: server function for cleanup, e.g. `lib/cleanup.functions.ts`
- Modify: a relevant route or admin/settings page to trigger/view cleanup
- Optionally create: scheduled cleanup hook if needed

**Step 1: Implement a dry-run cleanup summary**

Build a server function that returns counts of:
- stale leads
- archived leads
- duplicates
- orphaned related records

**Step 2: Implement a confirmed cleanup action**

Support archive-first behavior before deletion.

**Step 3: Verify**

Test with seeded/staged data and ensure no cross-user impact.

**Step 4: Commit**

```bash
git add lib/cleanup.functions.ts routes/settings.tsx
# include actual touched route files
 git commit -m "feat: add stale data cleanup workflow"
```

---

## Phase 6 — Proposal scope gap: Google Alerts as reliable source of truth

### Task 18: Add ingestion health visibility to the UI

**Objective:** Make Google Alerts ingestion trustworthy and supportable in production.

**Files:**
- Modify: `routes/sources.tsx`
- Optionally create: `lib/source-health.functions.ts`

**Step 1: Surface health signals**

Add visible status for:
- last inbound alert received
- last alert processed successfully
- last processing error
- total articles processed in last 24h / 7d

**Step 2: Add clear empty/failure states**

The user should know whether forwarding is simply idle or broken.

**Step 3: Verify**

Run the app and confirm the Sources page can distinguish:
- no alerts yet
- alerts arriving and processing
- alerts failing to process

**Step 4: Commit**

```bash
git add routes/sources.tsx lib/source-health.functions.ts
git commit -m "feat: add google alerts ingestion health visibility"
```

---

### Task 19: Make the forwarding inbox and webhook truly production-domain aligned

**Objective:** Ensure the Google Alerts workflow reflects Brookelyn’s final live domain setup, not a temporary lovable.app setup.

**Files:**
- Modify: config files and runtime config introduced earlier
- Create: deployment doc under `docs/plans/`

**Step 1: Define the final production values**

Document:
- production domain
- forwarding address
- inbound webhook URL
- provider used for inbound email
- secret rotation method

**Step 2: Remove lovable-hosted assumptions from user-facing copy**

`routes/sources.tsx` should display the final production-ready values.

**Step 3: Commit**

```bash
git add routes/sources.tsx docs/plans/2026-06-18-brookelyn-ingestion-deploy.md
git commit -m "docs: align google alerts ingestion with production domain"
```

---

## Phase 7 — Proposal scope gap: Bright Data + scoring + HQ/regional quality

### Task 20: Verify Bright Data enrichment sequencing against scoring logic

**Objective:** Ensure enrichment is actually routed through the scoring methodology as promised.

**Files:**
- Reference: `lib/contacts.server.ts`
- Reference: `lib/ingest.functions.ts`
- Reference: `lib/lead-enrich.functions.ts`
- Reference: `routes/settings.tsx`
- Create if needed: `docs/plans/2026-06-18-brookelyn-brightdata-flow.md`

**Step 1: Trace the current order of operations**

Document for each lead source:
- ingest
- AI score
- threshold check
- Bright Data contact discovery
- contact persistence

**Step 2: Correct any mismatch**

If any path enriches before scoring or bypasses the threshold in unintended ways, fix it.

**Step 3: Verify**

Run a controlled test lead through the path and confirm:
- score is computed
- threshold is checked
- Bright Data is called only when intended

**Step 4: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-brightdata-flow.md lib/ingest.functions.ts lib/lead-enrich.functions.ts
# include only changed files
 git commit -m "fix: align bright data enrichment with scoring workflow"
```

---

### Task 21: Improve HQ normalization and regional search controls

**Objective:** Deliver the proposal’s “improve HQ pulling and ICP parameters search tool” with a concrete implementation.

**Files:**
- Modify: `lib/lead-enrich.functions.ts`
- Modify: `lib/import-companies.server.ts`
- Modify: `routes/settings.tsx`
- Optionally create: `lib/location-normalization.ts`

**Step 1: Normalize HQ extraction**

Introduce a normalization helper for HQ values, such as:
- city, region, country formatting
- extracted country derivation when possible
- consistent storage convention

**Step 2: Tighten ICP regional controls**

Upgrade settings UX and backend handling to support more granular regional pools, for example:
- country-level regions
- subregion lists
- explicit target hiring markets
- HQ countries vs expansion target countries

**Step 3: Verify**

Use representative examples and confirm stored HQ/region values are normalized and usable for filtering/scoring.

**Step 4: Commit**

```bash
git add lib/location-normalization.ts lib/lead-enrich.functions.ts lib/import-companies.server.ts routes/settings.tsx
git commit -m "feat: improve hq normalization and regional icp controls"
```

---

## Phase 8 — Proposal scope gap: personalization waterfall + draft quality

### Task 22: Document the current outreach drafting waterfall

**Objective:** Determine whether the proposal’s promised “personalization waterfall” already exists or needs implementation.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-outreach-waterfall.md`
- Reference: `lib/outreach.functions.ts`
- Reference: `components/outreach-composer.tsx`
- Reference: `routes/linkedin-messages.tsx`

**Step 1: Trace prompt inputs**

Document what draft generation currently uses:
- company context
- trigger summary
- fit reasoning
- article snippets
- contact title
- ICP/outreach voice
- any manual notes

**Step 2: Compare to intended waterfall**

List missing layers clearly.

**Step 3: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-outreach-waterfall.md
git commit -m "docs: audit outreach personalization waterfall"
```

---

### Task 23: Implement missing personalization layers in draft generation

**Objective:** Ensure direct message drafts are genuinely built “on top of the personalization waterfall.”

**Files:**
- Modify: `lib/outreach.functions.ts`
- Modify: `components/outreach-composer.tsx`
- Modify any relevant lead/contact detail route that triggers draft generation

**Step 1: Add missing prompt context fields**

Use only fields that materially improve message quality and already exist or can be derived safely.

**Step 2: Preserve human review**

Do not auto-send; keep editable drafts and explicit approval before use.

**Step 3: Verify**

Generate drafts for 2–3 realistic leads and compare outputs for specificity.

**Step 4: Commit**

```bash
git add lib/outreach.functions.ts components/outreach-composer.tsx
git commit -m "feat: strengthen outreach personalization waterfall"
```

---

## Phase 9 — Deployment hardening and go-live

### Task 24: Make the deployment path internally consistent

**Objective:** Resolve mismatches between Vite, TanStack Start, and Wrangler so the app has one canonical production build path.

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `vite.config.ts`
- Modify: `server.ts`
- Modify: `start.ts`
- Create: `docs/plans/2026-06-18-brookelyn-deploy-runbook.md`

**Step 1: Decide the real deployment target**

Pick one production path and document it:
- Cloudflare Workers deployment, or
- Lovable-hosted with custom domain, or
- another concrete target

Do not leave mixed assumptions.

**Step 2: Align entrypoints**

Fix any mismatch like `src/server.ts` vs root `server.ts`.

**Step 3: Document exact deploy commands**

Include:
- build command
- deploy command
- env secret setup steps
- rollback steps

**Step 4: Verify**

Run:
- `npm run build`
- actual deploy preview/staging command

Expected: artifact builds successfully with the documented path.

**Step 5: Commit**

```bash
git add wrangler.jsonc vite.config.ts server.ts start.ts docs/plans/2026-06-18-brookelyn-deploy-runbook.md
git commit -m "build: unify deployment path for production"
```

---

### Task 25: Add production observability

**Objective:** Make failures diagnosable after launch.

**Files:**
- Modify: `lib/error-capture.ts`
- Modify: `server.ts`
- Modify: public webhook/hooks files
- Create if needed: `lib/monitoring.ts`

**Step 1: Choose the minimum observability implementation**

At minimum capture:
- SSR crashes
- webhook failures
- search run failures
- enrichment failures
- auth failures where useful

If using Sentry or similar, wire it here.

**Step 2: Avoid secret/data leakage in logs**

Never emit raw tokens or full sensitive payloads.

**Step 3: Verify**

Trigger a controlled failure and ensure it appears in logs/monitoring.

**Step 4: Commit**

```bash
git add lib/error-capture.ts server.ts lib/monitoring.ts routes/api/public/inbound-email.ts routes/api/public/hooks/run-daily-search.ts
git commit -m "feat: add production observability"
```

---

### Task 26: Add production smoke test checklist

**Objective:** Define the final manual verification needed before Brookelyn go-live.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-go-live-checklist.md`

**Step 1: Write the checklist**

Include at minimum:
- login works on custom domain
- anonymous user blocked from app routes
- authorized user can access dashboard
- Google Alerts forwarding confirmation flow works
- inbound email webhook processes a real sample
- daily search runs successfully
- Bright Data enrichment works for a qualifying lead
- outreach draft generation works
- usage page loads
- no demo/lovable domain copy remains in user-facing production UI
- no cross-user data exposure via direct API calls

**Step 2: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-go-live-checklist.md
git commit -m "docs: add brookelyn go-live checklist"
```

---

## Phase 10 — Final proposal compliance review

### Task 27: Write the proposal compliance matrix

**Objective:** Produce the final line-by-line acceptance document tying the repo state to the signed proposal.

**Files:**
- Create: `docs/plans/2026-06-18-brookelyn-proposal-compliance-matrix.md`

**Step 1: Build the matrix**

For each proposal item, mark:
- implemented
- partially implemented
- not implemented

And include:
- exact files
- exact verification method
- any remaining follow-up

Rows must include:
- Google Alerts as core source of truth
- stale data cleanup
- Bright Data enrichment through scoring methodology
- live on her own domain with hosting and access layer
- direct message drafts built on personalization waterfall
- improved HQ pulling and granular ICP regional search

**Step 2: Commit**

```bash
git add docs/plans/2026-06-18-brookelyn-proposal-compliance-matrix.md
git commit -m "docs: add brookelyn proposal compliance matrix"
```

---

## Recommended execution order

1. Tasks 1–2: baseline docs and env inventory
2. Tasks 3–6: real auth and auth propagation
3. Tasks 7–8: RLS/data lock-down
4. Tasks 9–11: remove hardcoded/demo/singleton assumptions
5. Tasks 12–14: secure server functions and public endpoints
6. Tasks 15–17: stale-data cleanup deliverable
7. Tasks 18–21: source-of-truth ingestion and HQ/regional improvements
8. Tasks 22–23: personalization waterfall strengthening
9. Tasks 24–26: deployment hardening, observability, go-live checks
10. Task 27: final proposal compliance matrix

## Verification commands summary

Use these after each relevant task:

```bash
npm run build
npm run lint
```

If local preview is part of the stack:

```bash
npm run preview
```

For Supabase rollout verification, additionally run the project’s migration/deploy workflow and manually validate:
- anonymous access denied to protected data
- authenticated owner access works
- public webhook routes still function with secret validation

## Notes on implementation style

- Prefer new forward-only Supabase migrations over rewriting old migration history unless the repo is guaranteed unpublished.
- Preserve the existing TanStack Start architecture; do not add unnecessary frameworks.
- Use environment-driven config for all deployment-specific values.
- Any public endpoint must be intentionally public, narrowly scoped, authenticated via secret where appropriate, and observable.
- Archive-first cleanup is safer than destructive deletion for Brookelyn’s production data.
- Keep user-facing delivery aligned to the proposal language so acceptance is obvious.
