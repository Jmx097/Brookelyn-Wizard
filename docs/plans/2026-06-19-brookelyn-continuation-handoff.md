# Brookelyn Continuation Handoff

## Goal
Continue turning the exported Brookelyn repo into a fully independent, persistent, safely multi-user deployment outside Lovable Cloud.

## Current high-level state

### Already completed
- Root-vs-`src/` TanStack/Vite build mismatch fixed.
- `npm run build` passes.
- Real auth hook, auth guard, and magic-link login page implemented.
- Bright Data integration updated to match live API contract.
- `.env.example` created.
- `README.md` created for standalone bootstrap.
- dependency inventory documented.
- schema/RLS inventory documented.
- table inventory documented.

### Key audit docs
- `docs/plans/2026-06-19-brookelyn-export-gaps-and-hardening-plan.md`
- `docs/plans/2026-06-19-brookelyn-independent-persistence-clean-pass.md`
- `docs/plans/2026-06-19-brookelyn-dependency-inventory.md`
- `docs/plans/2026-06-19-brookelyn-table-inventory.md`

## Most important findings to preserve

1. The repo really can be made independent.
   - Persistence is already modeled on Supabase, not hidden Lovable storage.

2. RLS/schema state is more complete than first suspected.
   - Migrations do contain substantial schema + RLS SQL.
   - There is also a useful `seed_user_defaults()` trigger on `auth.users`.

3. The biggest remaining persistence risk is NOT missing schema.
   - It is prototype-era authorization shortcuts in app code + permissive `demo read ... USING (true)` policies.

4. Browser auth verification is still pending only because live Supabase env values were not supplied.
   - Code path exists, but environment-backed live verification remains pending.

## Code changes completed in the latest pass

### Hardened `lib/leads.functions.ts`
Changes:
- added `requireSupabaseAuth`
- migrated deprecated `.inputValidator()` to `.validator()`
- added owned-lead assertion before contact-slot writes
- updates now require both `id` and `user_id`

Result:
- manual lead contact edits are now tied to authenticated ownership

### Hardened `lib/icp.functions.ts`
Changes:
- removed `SINGLETON_ID`
- added `requireSupabaseAuth`
- migrated deprecated `.inputValidator()` to `.validator()`
- replaced singleton lookup with per-user config lookup by `user_id`
- added `getOrCreateOwnedIcpConfig(userId)` fallback
- updates now require both config `id` and `user_id`

Result:
- ICP config is now user-owned instead of prototype-singleton state

### Hardened `lib/contacts.functions.ts`
Changes:
- added `requireSupabaseAuth`
- migrated deprecated `.inputValidator()` to `.validator()`
- added ownership helper `getOwnedLead(userId, leadId)`
- all reads/writes now scope by `context.userId`
- contact lookups now require matching `lead_id` and `user_id`
- lead updates now require both `id` and `user_id`

Result:
- no more anonymous/user-unscoped contact enrichment or slot writes in this file

### Hardened `lib/linkedin-tracker.functions.ts`
Changes:
- removed `DEMO_USER_ID`
- added `requireSupabaseAuth`
- migrated `.inputValidator()` to `.validator()`
- added lead ownership assertion before outreach write
- all list/update/upsert operations now use `context.userId`

Result:
- outreach tracking is now tied to authenticated user context

### Hardened `lib/contact-status.functions.ts`
Changes:
- removed `DEMO_USER_ID`
- added `requireSupabaseAuth`
- migrated `.inputValidator()` to `.validator()`
- added owned-lead assertion before status write
- all list/upsert operations now use `context.userId`

Result:
- contact status tracking is now tied to authenticated user context

### Verification after those changes
- `npm run build` passes after all hardening edits
- Remaining build output is warnings/deprecations in other files, not blockers

## Files changed in this latest pass
- `.env.example`
- `README.md`
- `lib/contacts.functions.ts`
- `lib/linkedin-tracker.functions.ts`
- `lib/contact-status.functions.ts`
- `docs/plans/2026-06-19-brookelyn-dependency-inventory.md`
- `docs/plans/2026-06-19-brookelyn-table-inventory.md`

## Remaining top-priority work

### 1. Continue app-layer auth hardening
Next files to harden:
- review any remaining server functions opportunistically, but the major user-triggered auth/ownership paths now appear hardened

What to look for:
- any newly introduced server function that bypasses `requireSupabaseAuth`
- any `supabaseAdmin` write path without an ownership predicate
- any leftover prototype assumptions outside already-patched files

### 2. Browser auth verification
Blocked only by missing real Supabase env values.
When env is available, verify:
- `/login` renders
- signed-out protected routes redirect to `/login`
- magic link flow works
- signed-in user sees only their own data
- Sources page route management works end-to-end after migrations are applied

## Table/RLS notes worth preserving
The repo already has evidence for schema/RLS on:
- `icp_config`
- `search_queries`
- `leads`
- `articles`
- `saved_views`
- `job_postings`
- `linkedin_outreach`
- `contact_status`
- `gmail_forwarding_confirmations`
- `lead_contacts`

Migration examples already inspected:
- `supabase/migrations/20260509201119_3d433d21-9370-416d-b8c2-92e49b821bff.sql`
- `supabase/migrations/20260509220512_55d9fda1-47e4-4443-8c2b-c99b2d8113ae.sql`
- `supabase/migrations/20260509212334_d6ab65a6-e264-46c6-9971-a3b527a6a112.sql`
- `supabase/migrations/20260523151033_d83e5def-b042-4dcf-a09c-a84c3c1f9823.sql`
- `supabase/migrations/20260524152508_d51f7e04-86cc-4719-b137-175c2b1b7055.sql`
- `supabase/migrations/20260527204228_a61c1e1b-feec-484a-a01e-e066354232ea.sql`
- `supabase/migrations/20260529134127_850ca904-61f7-4f9d-9e5e-a750d1da16b5.sql`

## Recommended exact next step
1. read `lib/leads.functions.ts`
2. patch it to require auth + verify ownership before writes
3. build
4. then move to `lib/icp.functions.ts`
5. then `routes/api/public/hooks/run-daily-search.ts`

## Constraints / user preferences to preserve
- User wants active execution, not just advice.
- User prefers raw URLs as plain text, never markdown links.
- User wants this made fully independent if possible.
- User is going out soon and explicitly wants enough durable context to continue without oversight.

## Stop conditions
- If live browser auth verification is attempted again without Supabase env, it will still fail at runtime.
- Do not claim full completion yet; app-layer auth hardening and DB-policy cleanup are still outstanding.
