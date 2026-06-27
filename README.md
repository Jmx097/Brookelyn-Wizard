# Brookelyn Prospecting Engine

Standalone deployment notes for the exported Brookelyn app.

## Status

This repo can run independently of Lovable Cloud, but it is not yet a fully self-describing production artifact without additional hardening.

Already repaired:
- root-vs-`src/` build mismatch
- standalone client + SSR build
- real auth hook / auth guard / login page structure
- Bright Data integration contract updated to match live API behavior

Still required for full independence:
- supply real runtime secrets
- harden user-facing server functions that still rely on `supabaseAdmin` or demo IDs
- verify / recreate RLS policies in repo-managed SQL
- secure public scheduler/inbound-email endpoints

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create local env file

```bash
cp .env.example .env.local
```

Fill in at minimum:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `APP_REDIRECT_URLS`

Notes:
- Current Supabase projects typically provide `sb_publishable_*` and `sb_secret_*` keys. Those are the preferred values for this repo.
- Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` / JWT anon keys are not the primary contract for this codebase.
- Keep `SUPABASE_URL` and `VITE_SUPABASE_URL` identical.
- Keep `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` identical.

Feature-specific extras:
- `ANTHROPIC_API_KEY` — AI extraction, enrichment, outreach generation
- `ANTHROPIC_MODEL_CHEAP` — optional low-cost/default model override (defaults to `claude-3-5-haiku-latest`)
- `ANTHROPIC_MODEL_COMPLEX` — optional heavier-reasoning model override (defaults to `claude-3-7-sonnet-latest`)
- `BRIGHTDATA_API_KEY` and `BRIGHTDATA_SERP_ZONE` — LinkedIn contact discovery
- `FIRECRAWL_API_KEY` — scrape/import enrichment
- `INBOUND_EMAIL_SECRET` — protect `/api/public/inbound-email`
- `RUN_DAILY_SEARCH_SECRET` — protect `/api/public/hooks/run-daily-search`
- `INBOUND_EMAIL_WEBHOOK_URL` and `INBOUND_FORWARDING_ADDRESS` — docs/UI defaults for Sources page

### 3. Run locally

```bash
npm run dev
```

Production-style preview after build:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## Supabase bootstrap checklist

This app expects its own Supabase project for persistence.

### Required Supabase capabilities
- Postgres database
- Email auth / magic links
- Browser anon/publishable key
- Service-role key for trusted backend operations
- RLS policies on user-owned tables

### Required auth config
In Supabase Auth settings:
- set Site URL to your deployed app origin
- add Redirect URLs for local + deployed environments
- ensure magic-link email auth is enabled

For this repo specifically, the app origin in `APP_URL` and every value in
`APP_REDIRECT_URLS` should be mirrored in Supabase Auth settings.

Suggested local URLs:
- http://127.0.0.1:4173
- http://localhost:4173

### Required schema state
This repo includes a `supabase/migrations/` directory, but RLS policy completeness is still under audit.

Before calling the setup complete, verify for every table touched by the app:
- table exists
- constraints/indexes exist
- ownership columns exist where expected (typically `user_id`)
- RLS is enabled where browser client reads/writes directly
- policies match app behavior

Tables already observed in app code:
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

## Public endpoints

### `/api/public/inbound-email`
Purpose:
- receives inbound parse payloads from email services

Protection:
- requires shared secret via header `x-inbound-secret` or `?secret=` query param
- set `INBOUND_EMAIL_SECRET`

### `/api/public/hooks/run-daily-search`
Purpose:
- scheduled search ingestion / enrichment

Protection:
- treated as a privileged webhook endpoint
- requires a shared secret via header `x-run-daily-search-secret`, `x-webhook-secret`, `Authorization: Bearer <secret>`, or `?secret=` query param
- set `RUN_DAILY_SEARCH_SECRET`

## Integration dependencies

### Required for core persistence/auth
- Supabase

### Required for current enrichment features
- Bright Data
- Firecrawl (optional for some flows, but required for best import/scrape behavior)
- Anthropic API

### Important distinction
This repo can be independent of **Lovable Cloud** while still depending on **Anthropic API**.

If you want a fully Lovable-free stack, the following files need provider replacement work:
- none of the current AI call sites — they now use Anthropic directly

## Known hardening work still in progress

Highest-priority files:
- `lib/contacts.functions.ts`
- `lib/linkedin-tracker.functions.ts`
- `lib/contact-status.functions.ts`
- `lib/leads.functions.ts`
- `lib/icp.functions.ts`
- `lib/ingest.functions.ts`
- `routes/api/public/hooks/run-daily-search.ts`
- `routes/api/public/inbound-email.ts`

Known issues to remove:
- `DEMO_USER_ID`
- `SINGLETON_ID` assumptions in user-facing config flows
- unscoped `supabaseAdmin` access in user-triggered paths
- hardcoded hosted webhook/source values in UI

## Verification checklist

Minimum independent verification:
1. create a fresh Supabase project
2. set all required env vars
3. run `npm run build`
4. run local app
5. verify `/login` renders
6. verify magic-link auth works
7. verify signed-out protected routes redirect to `/login`
8. verify signed-in user can create/read/update their own records
9. verify second user cannot see first user’s data
10. verify public endpoints reject missing/invalid secrets

## Production env example

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
APP_URL=https://your-production-domain.example
APP_REDIRECT_URLS=https://your-production-domain.example,http://127.0.0.1:4173,http://localhost:4173
```

## Related audit docs
- `docs/plans/2026-06-19-brookelyn-export-gaps-and-hardening-plan.md`
- `docs/plans/2026-06-19-brookelyn-independent-persistence-clean-pass.md`
