# Brookelyn Independent Persistence Clean Pass

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Define everything required to make the Brookelyn app persist and operate independently of Lovable Cloud, including its own durable Supabase project, repeatable schema/auth setup, safe authorization model, and independent operational secrets.

**Architecture:** Treat Lovable as a temporary prototype host and the exported repo as the canonical product artifact. Build toward a standalone deployment where the repo fully describes runtime requirements, database schema, auth wiring, scheduled/public endpoints, and privileged integrations. Prefer explicit bootstrap docs and repo-managed policy/schema state over hidden cloud-side configuration.

**Tech Stack:** TanStack Start, Vite, Supabase Auth/Postgres/RLS, server functions, Bright Data, Firecrawl, Anthropic API.

---

## Verdict

**Can this be made fully independent?** Yes.

**What already exists:**
- app builds successfully outside Lovable
- Supabase browser/server clients exist in code
- migration directory exists
- user auth hook/login/auth-guard now exist in real code form
- enrichment/search/outreach flows are implemented at application level

**What is still missing for true independence:**
- repo-owned env contract and bootstrap docs
- verified repo-owned schema + policy state
- removal of demo IDs and singleton shortcuts in user-facing functions
- replacement or explicit retention of Lovable-only dependencies
- authenticated protection around public ingestion/scheduler endpoints
- a reproducible deployment playbook for new Supabase project + app host

---

## What “persistent independently” means in this repo

A fully independent Brookelyn deployment must satisfy all of these:

1. A new Supabase project can be created without Lovable.
2. The repo can configure that project with schema, auth redirects, and RLS behavior.
3. App runtime can boot with documented env vars only.
4. User data persists in that Supabase project, not in Lovable-only state.
5. Scheduled/public integrations remain functional with explicit secrets.
6. Authorization does not rely on demo IDs or hidden singleton records.
7. If Anthropic remains in use, it is treated as an external dependency, not a hidden platform feature.

---

## Clean-pass findings

### 1. Core persistence backend is still portable in principle
The repo is already built around Supabase as the persistence layer, not around opaque Lovable storage.

Evidence in code:
- `integrations/supabase/client.ts`
- `integrations/supabase/client.server.ts`
- `integrations/supabase/auth-middleware.ts`
- direct table access throughout route and server-function code

Implication:
- persistence can be independent, because the app is already logically using Supabase as its database/auth system
- the missing piece is reproducible setup, not a total architectural rewrite

### 2. Standalone runtime env parity is incomplete
The repo depends on external env injection for all critical persistence features.

Required envs observed in code:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `BRIGHTDATA_API_KEY`
- `BRIGHTDATA_SERP_ZONE`
- `FIRECRAWL_API_KEY`

Implication:
- independence requires a checked-in env contract and deployment instructions

### 3. Auth is portable, but not yet independently verified
Current code supports standalone Supabase auth:
- `hooks/use-auth.ts`
- `components/auth-guard.tsx`
- `routes/login.tsx`
- `integrations/supabase/auth-attacher.ts`
- `integrations/supabase/auth-middleware.ts`

But browser verification is still blocked until real Supabase env is supplied outside Lovable.

Implication:
- the auth architecture is portable
- the deployment/bootstrap path still needs to be proven on a fresh project

### 4. Repo-managed RLS state is not yet proven
A migration directory exists:
- `supabase/migrations/*.sql`

But prior inspection did not verify exported policy SQL for the claimed “RLS on every table.”

Implication:
- independence requires either:
  - repo-owned, reviewable RLS policies in migrations, or
  - a documented/manual post-bootstrap step to add policies in Supabase
- hidden live-only policy state is not acceptable for a clean independent deployment

### 5. Several user-facing server functions still break independent multi-user safety
These are the biggest blockers to a clean independent persistence model.

#### Files with demo/singleton/service-role coupling
- `lib/contacts.functions.ts`
- `lib/linkedin-tracker.functions.ts`
- `lib/contact-status.functions.ts`
- `lib/leads.functions.ts`
- `lib/icp.functions.ts`
- `lib/ingest.functions.ts`
- `routes/api/public/hooks/run-daily-search.ts`
- `routes/api/public/inbound-email.ts`

#### Specific problems
- `DEMO_USER_ID` hardcoded in:
  - `lib/linkedin-tracker.functions.ts`
  - `lib/contact-status.functions.ts`
- `SINGLETON_ID` logic in:
  - `lib/icp.functions.ts`
  - `lib/ingest.functions.ts`
- unscoped service-role access in:
  - `lib/contacts.functions.ts`
  - `lib/leads.functions.ts`
- public route + admin client pattern in:
  - `routes/api/public/hooks/run-daily-search.ts`
  - `routes/api/public/inbound-email.ts`

Implication:
- a persistent independent deployment needs real per-user ownership enforcement
- otherwise a fresh Supabase project would persist data, but not safely

### 6. Frontend persistence model assumes RLS or per-user scoping is correct
Frontend routes directly read/write Supabase tables with the browser client.

Observed tables used in routes:
- `search_queries`
- `articles`
- `gmail_forwarding_confirmations`
- `leads`
- `saved_views`
- `job_postings`
- `linkedin_outreach`

Implication:
- independence requires robust RLS on these tables, because the client directly queries them
- otherwise the frontend becomes cross-tenant by accident

### 7. Some persistence-related workflows depend on third-party services, not just Supabase
Independent persistence is not just DB survival. Some durable workflows also depend on:
- Bright Data for contact enrichment
- Firecrawl for scraping/import enrichment
- Anthropic API for classification, lead extraction, scoring, and outreach generation

Implication:
- the app can be independent of Lovable Cloud while still depending on Anthropic as an external API
- the Lovable gateway dependency is already removed; Anthropic is now the owned-provider path

---

## What is needed to make it independently persistent

## Phase 0: Establish repo-owned bootstrap and env contract

### Task 0.1: Add `.env.example`
**Objective:** Make all runtime dependencies explicit.

**Files:**
- Create: `.env.example`

**Must include:**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `BRIGHTDATA_API_KEY`
- `BRIGHTDATA_SERP_ZONE`
- `FIRECRAWL_API_KEY`
- any webhook secret introduced for public routes

### Task 0.2: Add standalone setup README
**Objective:** Explain how to bootstrap a fresh independent environment.

**Files:**
- Create: `README.md` if absent, or modify existing project README

**Must cover:**
- install
- env setup
- Supabase project creation
- schema migration application
- auth redirect URL setup
- local dev and preview commands
- deploy-time secret requirements

### Task 0.3: Add independence inventory doc
**Objective:** Distinguish “Supabase persistence” from “AI/integration dependencies.”

**Files:**
- Create: `docs/plans/2026-06-19-brookelyn-dependency-inventory.md`

**Must classify:**
- hard requirement
- optional enhancement
- replaceable dependency
- Lovable-specific dependency

---

## Phase 1: Make auth and user identity fully portable

### Task 1.1: Prove standalone auth against a fresh Supabase project
**Objective:** Verify the repo can authenticate without Lovable runtime.

**Files:**
- likely no code change first; config + verification

**Must verify:**
- `/login` renders
- magic link is sent
- redirect URL works
- protected routes redirect correctly when signed out
- authenticated user reaches app shell

### Task 1.2: Remove hardcoded demo identities
**Objective:** Replace prototype-only identity assumptions with authenticated user context.

**Files:**
- Modify: `lib/linkedin-tracker.functions.ts`
- Modify: `lib/contact-status.functions.ts`

**Required change:**
- remove `DEMO_USER_ID`
- add `requireSupabaseAuth`
- scope reads/writes by `context.userId`

### Task 1.3: Remove singleton user-config assumptions from user-facing config
**Objective:** Make ICP and user-owned config truly per-user.

**Files:**
- Modify: `lib/icp.functions.ts`
- Audit: `lib/ingest.functions.ts`

**Required change:**
- prefer `user_id`-scoped config records
- keep fallback singleton only if explicitly documented as seed/default behavior

---

## Phase 2: Rebuild safe persistence boundaries

### Task 2.1: Harden user-facing server functions
**Objective:** Ensure persistent data is written only after ownership checks.

**Files:**
- Modify: `lib/contacts.functions.ts`
- Modify: `lib/leads.functions.ts`
- Audit: `lib/ingest.functions.ts`

**Required change:**
- add auth middleware to exported server functions
- verify row ownership before service-role writes
- use `context.supabase` or user-scoped filters where possible

### Task 2.2: Review browser direct-write paths
**Objective:** Make sure client-side direct Supabase writes depend on valid RLS, not luck.

**Files:**
- Modify/Audit:
  - `routes/pipeline.tsx`
  - `routes/sources.tsx`
  - `routes/leads.$leadId.tsx`
  - `routes/my-leads.tsx`
  - `routes/consolidation.tsx`
  - `routes/linkedin-messages.tsx`

**Required change:**
- enumerate all client writes
- confirm matching RLS exists for each touched table
- move sensitive writes to server functions if RLS would be too permissive or fragile

---

## Phase 3: Make schema and RLS independently reproducible

### Task 3.1: Inventory actual tables used by the app
**Objective:** Produce the authoritative persistence surface.

**Tables already observed:**
- `leads`
- `lead_contacts`
- `linkedin_outreach`
- `contact_status`
- `icp_config`
- `search_queries`
- `articles`
- `saved_views`
- `gmail_forwarding_confirmations`
- `job_postings`

**Files:**
- Create: `docs/plans/2026-06-19-brookelyn-table-inventory.md`

### Task 3.2: Verify migration completeness for each table
**Objective:** Confirm the repo can recreate schema from scratch.

**Files:**
- Inspect: `supabase/migrations/*.sql`

**Required output:**
- table-by-table matrix:
  - creation present
  - constraints present
  - indexes present
  - policy SQL present / missing

### Task 3.3: Add missing policy migrations if needed
**Objective:** Ensure RLS is encoded in repo state, not only hidden live state.

**Files:**
- Modify/Create: `supabase/migrations/*.sql`

**Required policy coverage:**
- authenticated users can only read/write their own rows
- public routes only access the minimal tables they need
- service-role usage remains possible for trusted backend operations only

### Task 3.4: Add seed/bootstrap strategy for required defaults
**Objective:** Replace hidden Lovable-side setup with explicit bootstrap.

**Files:**
- Create: `supabase/seed.sql` or bootstrap doc if seed file is not preferred

**Possible defaults:**
- default ICP row model if needed
- any required app settings rows
- any non-user-owned reference data

---

## Phase 4: Secure public persistence ingress

### Task 4.1: Harden scheduler endpoint
**Objective:** Ensure `run-daily-search` is safe outside Lovable.

**Files:**
- Modify: `routes/api/public/hooks/run-daily-search.ts`

**Required change:**
- add explicit webhook secret verification
- document expected scheduler caller
- ensure it is not an anonymous open write surface

### Task 4.2: Harden inbound email endpoint
**Objective:** Ensure email-derived persistence flow can survive independently.

**Files:**
- Modify: `routes/api/public/inbound-email.ts`

**Required change:**
- confirm authentication/verification of sender/integration
- document mailbox forwarding setup outside Lovable
- confirm inserts/updates are constrained to intended user targets

---

## Phase 5: Decide how independent you want AI/vendor persistence dependencies to be

### Option A: Independent of Lovable Cloud, using Anthropic API
This is the fastest route.

Still depends on:
- `ANTHROPIC_API_KEY`

But persistence is independent because:
- DB/auth live in your own Supabase
- app host is your own
- only AI inference remains external

### Option B: Fully Lovable-free stack
This app is already off the hosted builder AI gateway; the remaining step is just operating under your own Anthropic account.

**Files to audit/replace:**
- `routes/api/public/hooks/run-daily-search.ts`
- `lib/ingest.functions.ts`
- `lib/import-companies.server.ts`
- `lib/lead-enrich.functions.ts`
- `lib/outreach.functions.ts`

**Required change:**
- maintain the direct Anthropic integration or swap again later if you want another owned provider
- keep the env contract aligned with the active provider

---

## Phase 6: Deployment and persistence verification

### Task 6.1: Add deployment checklist
**Objective:** Make independent rollout repeatable.

**Files:**
- Create: `docs/plans/2026-06-19-brookelyn-independent-deployment-checklist.md`

**Must include:**
- create Supabase project
- set redirect URLs
- apply migrations
- add secrets
- deploy app
- configure webhook endpoints
- verify login
- verify CRUD per user
- verify scheduled ingestion

### Task 6.2: Add persistence smoke tests
**Objective:** Prove data survives independently of Lovable.

**Manual verification matrix:**
- create user
- sign in
- save search query
- create/update lead data
- save view
- mark outreach sent
- set contact status
- sign out/sign in again
- verify data still exists
- verify second user cannot read first user’s data

---

## Minimum viable independence definition

Brookelyn is “independently persistent” once all are true:
- fresh Supabase project can be provisioned from repo docs/state
- app runs with documented env only
- auth works outside Lovable
- schema exists in repo-managed form
- user-owned data is scoped correctly
- public ingress routes are authenticated
- no demo IDs remain in user-facing logic

---

## Recommended implementation order

1. `.env.example`
2. standalone `README.md`
3. harden `lib/contacts.functions.ts`
4. harden `lib/linkedin-tracker.functions.ts`
5. harden `lib/contact-status.functions.ts`
6. harden `lib/leads.functions.ts`
7. harden `lib/icp.functions.ts`
8. audit `lib/ingest.functions.ts`
9. harden public routes
10. inventory/repair RLS + migration completeness
11. fresh Supabase bootstrap verification
12. decide whether to keep Anthropic as the long-term provider or swap again later

---

## Bottom line

Yes — this can be made persist independently.

The key insight from the clean pass is that the app already uses Supabase as its real persistence layer, so the path is not “rebuild the whole product.” The real work is:
- making the setup reproducible,
- making authorization safe,
- making policy/schema state explicit,
- and replacing hidden Lovable-hosted assumptions with repo-owned instructions and secrets.
