# Brookelyn Export Gaps and Hardening Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Close the gap between the working Lovable-hosted Brookelyn app and the exported GitHub repo so the repo becomes a trustworthy standalone deployment.

**Architecture:** Treat Lovable Cloud as the current source of truth for runtime wiring, but treat the repo as the desired portable artifact. First restore environment parity, then replace demo/service-role shortcuts in user-facing server functions, then verify that the exported repo's auth and data access behavior matches the hosted app.

**Tech Stack:** TanStack Start, Vite, Supabase, Lovable Cloud, server functions, Bright Data.

---

## Verdict

**Working in Lovable:** Supabase-backed app likely live with real tables/auth and hosted env injection.

**Working in export now:** local build, route generation, SSR build, Bright Data integration contract, real login/auth guard code shape.

**Still partial or risky in export:**
- Supabase runtime env parity is missing outside Lovable.
- Exported repo still contains demo/service-role shortcuts in user-facing functions.
- RLS policy presence is not verified from exported SQL.
- Several user-triggered server functions bypass RLS via `supabaseAdmin`.

---

## Requirement-to-gap map

### Lovable claim: "Supabase client wired for both browser and server use"
**Repo reality:** code exists, but standalone runtime env is missing.
- Files:
  - `integrations/supabase/client.ts`
  - `integrations/supabase/client.server.ts`
  - `integrations/supabase/auth-middleware.ts`
- Gap:
  - export does not come with active `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Lovable claim: "Authentication"
**Repo reality:** code now supports real auth flow, but standalone verification blocked by env.
- Files:
  - `hooks/use-auth.ts`
  - `components/auth-guard.tsx`
  - `routes/login.tsx`
- Gap:
  - browser verification pending after env injection

### Lovable claim: "RLS policies on every table"
**Repo reality:** not verified from checked-in migrations.
- Files:
  - `supabase/migrations/*.sql`
- Gap:
  - no verified exported SQL evidence for policies yet

### Hidden app-layer gap not shown by Lovable summary
**Repo reality:** multiple user-facing functions use `supabaseAdmin` or demo singleton IDs.
- Files:
  - `lib/contacts.functions.ts`
  - `lib/linkedin-tracker.functions.ts`
  - `lib/contact-status.functions.ts`
  - `lib/leads.functions.ts`
  - `lib/icp.functions.ts`
  - `lib/ingest.functions.ts`
- Gap:
  - app-layer authorization can bypass table-level RLS intent

---

## Phase 0: Restore standalone runtime parity

### Task 0.1: Write the env contract document
**Objective:** Document exactly what Lovable injects that the export needs outside Lovable.

**Files:**
- Create: `.env.example`
- Modify: `README.md` if present

**Required envs to document:**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `BRIGHTDATA_API_KEY`
- `BRIGHTDATA_SERP_ZONE`
- `FIRECRAWL_API_KEY` if ingestion/scraping remains enabled

**Verification:**
- `read_file .env.example`
- confirm all envs referenced by app/server code are represented

### Task 0.2: Prove env references are complete
**Objective:** Search the repo for all `process.env` and `import.meta.env` usage and reconcile them with `.env.example`.

**Files:**
- Inspect only
  - `integrations/**`
  - `lib/**`
  - `routes/**`

**Verification:**
- `search_files("process\.env|import\.meta\.env", path="/root/tmp-brookelyn-inspect-public/repo", file_glob="*.ts*")`
- no undocumented runtime envs remain

### Task 0.3: Re-run browser auth verification once env is available
**Objective:** Confirm standalone login behavior matches Lovable expectation.

**Files:**
- No code change required unless bug appears

**Verification:**
- start preview/dev server with valid Supabase env
- browse `/login`
- browse a protected route like `/sources`
- confirm signed-out redirect to `/login`
- trigger magic link flow
- confirm authenticated route access

---

## Phase 1: Remove demo/singleton identity shortcuts from user-facing flows

### Task 1.1: Harden `lib/contacts.functions.ts`
**Objective:** Stop user-triggered contact actions from using unscoped `supabaseAdmin` directly.

**Files:**
- Modify: `lib/contacts.functions.ts`
- Reference: `integrations/supabase/auth-middleware.ts`

**Current risk:**
- `listLeadContacts` reads contacts by `lead_id` only
- `enrichContacts` loads a lead and writes contacts via service-role without user auth middleware
- `saveContactToLeadSlot` writes lead fields without ownership verification

**Required implementation direction:**
- add `.middleware([requireSupabaseAuth])` to every exported server function
- use `context.userId`
- verify ownership with `.eq("user_id", context.userId)` on lead/contact fetches
- continue using `supabaseAdmin` only for the privileged write after explicit ownership check, or switch to `context.supabase` where possible

**Verification:**
- build passes
- searches show every exported function in this file uses auth middleware
- all lead/contact lookups are scoped by `user_id`

### Task 1.2: Harden `lib/linkedin-tracker.functions.ts`
**Objective:** Remove `DEMO_USER_ID` from outreach tracking.

**Files:**
- Modify: `lib/linkedin-tracker.functions.ts`

**Current risk:**
- all writes/reads are pinned to `DEMO_USER_ID`

**Required implementation direction:**
- add `requireSupabaseAuth`
- replace `DEMO_USER_ID` with `context.userId`
- ensure update/list queries scope by authenticated user

**Verification:**
- `search_files("DEMO_USER_ID", path=".../lib/linkedin-tracker.functions.ts")` returns zero relevant app code uses
- build passes

### Task 1.3: Harden `lib/contact-status.functions.ts`
**Objective:** Remove `DEMO_USER_ID` from contact status tracking.

**Files:**
- Modify: `lib/contact-status.functions.ts`

**Current risk:**
- all reads/writes are pinned to singleton demo identity

**Required implementation direction:**
- add `requireSupabaseAuth`
- replace `DEMO_USER_ID` with `context.userId`
- scope queries by authenticated user

**Verification:**
- `search_files("DEMO_USER_ID", path=".../lib/contact-status.functions.ts")` returns zero relevant app code uses
- build passes

### Task 1.4: Harden `lib/leads.functions.ts`
**Objective:** Ensure manual lead-contact edits are ownership-checked.

**Files:**
- Modify: `lib/leads.functions.ts`

**Current risk:**
- `updateLeadContact` updates by `leadId` only through service-role client

**Required implementation direction:**
- add `requireSupabaseAuth`
- verify target lead belongs to `context.userId`
- only then perform update

**Verification:**
- build passes
- update query is no longer scoped solely by `id`

### Task 1.5: Harden `lib/icp.functions.ts`
**Objective:** Remove singleton config assumption for user-accessible ICP config.

**Files:**
- Modify: `lib/icp.functions.ts`

**Current risk:**
- reads and updates use `SINGLETON_ID`

**Required implementation direction:**
- add `requireSupabaseAuth`
- read/update ICP config by authenticated `user_id`
- if singleton fallback is needed for bootstrap, keep it read-only and explicit

**Verification:**
- build passes
- user-facing update no longer targets only `SINGLETON_ID`

---

## Phase 2: Review mixed privileged/user access in ingestion flows

### Task 2.1: Audit `lib/ingest.functions.ts`
**Objective:** Confirm every privileged write is justified and ownership-scoped.

**Files:**
- Modify: `lib/ingest.functions.ts` if needed

**Current state:**
- uses `requireSupabaseAuth`
- but many reads/writes still go through `supabaseAdmin`

**Audit checklist:**
- every user-owned row fetch must be scoped by `context.userId`
- every insert/update must stamp the authenticated `user_id`
- singleton ICP fallback must be deliberate, not accidental cross-tenant config leak

**Verification:**
- inspect every `supabaseAdmin.from(...)`
- no user-owned write path remains unscoped by `userId`

### Task 2.2: Review public route `routes/api/public/hooks/run-daily-search.ts`
**Objective:** Decide whether the public scheduled route is intentionally privileged and safely authenticated.

**Files:**
- Modify: `routes/api/public/hooks/run-daily-search.ts` if hardening needed

**Current risk:**
- public route uses `supabaseAdmin`
- route appears intended as a scheduler/webhook entrypoint
- needs explicit secret verification / origin auth if exposed

**Required implementation direction:**
- confirm a webhook secret or equivalent guard exists
- if absent, add one
- document invocation contract clearly

**Verification:**
- route rejects unauthenticated public POSTs without secret
- build passes

---

## Phase 3: Verify RLS reality instead of assuming it

### Task 3.1: Inventory exported migrations
**Objective:** Determine whether RLS/policy SQL actually exists in the repo.

**Files:**
- Inspect: `supabase/migrations/*.sql`

**Verification:**
- search for:
  - `enable row level security`
  - `create policy`
  - `alter table ... enable row level security`
- summarize results in a short matrix

### Task 3.2: Compare repo findings to live Supabase project
**Objective:** Prove whether Lovable’s RLS claim exists only in cloud state or in exported migration state.

**Files:**
- Inspect live system once credentials/access available

**Verification:**
- compare live policy inventory vs repo migration inventory
- classify each table as:
  - exported and verified
  - live only / missing from repo
  - unknown

---

## Phase 4: Final compliance matrix

### Task 4.1: Produce final export-gap report
**Objective:** Create a concise decision document saying what survived export, what broke, and what still needs manual recreation.

**Files:**
- Create: `docs/plans/2026-06-19-brookelyn-export-gap-report.md`

**Required sections:**
- runtime env parity
- auth parity
- build/config parity
- RLS parity
- privileged function parity
- hosted-only dependencies on Lovable Cloud

**Verification:**
- report maps each claim to specific files and verification method

---

## Immediate next implementation targets

1. `lib/contacts.functions.ts`
2. `lib/linkedin-tracker.functions.ts`
3. `lib/contact-status.functions.ts`
4. `lib/leads.functions.ts`
5. `lib/icp.functions.ts`
6. public hook auth on `routes/api/public/hooks/run-daily-search.ts`
7. `.env.example`

---

## Current known blockers

- Browser auth verification cannot complete until valid Supabase env values are supplied outside Lovable.
- Live RLS verification cannot complete until there is access to the actual Supabase project or exported policy metadata.

---

## Success criteria

This export is considered trustworthy when all are true:
- standalone build passes
- standalone browser auth flow works with supplied env
- no user-facing server function relies on demo IDs
- privileged service-role usage is narrowed to justified cases after ownership checks
- exported repo either contains verifiable RLS policies or clearly documents that policy state remains hosted-only
