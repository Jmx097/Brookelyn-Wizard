-- Remove prototype-wide SELECT policies that allowed cross-user reads during demo mode.
-- Independent deployment should rely on the existing owner-scoped policies instead.

DROP POLICY IF EXISTS "demo read leads" ON public.leads;
DROP POLICY IF EXISTS "demo read articles" ON public.articles;
DROP POLICY IF EXISTS "demo read queries" ON public.search_queries;
DROP POLICY IF EXISTS "demo read icp" ON public.icp_config;
DROP POLICY IF EXISTS "demo read notes" ON public.notes;
DROP POLICY IF EXISTS "demo read outreach" ON public.outreach_drafts;
DROP POLICY IF EXISTS "demo read saved_views" ON public.saved_views;
DROP POLICY IF EXISTS "demo read job postings" ON public.job_postings;
DROP POLICY IF EXISTS "demo read linkedin_outreach" ON public.linkedin_outreach;
DROP POLICY IF EXISTS "demo read contact_status" ON public.contact_status;
DROP POLICY IF EXISTS "demo read gmail confirmations" ON public.gmail_forwarding_confirmations;
DROP POLICY IF EXISTS "demo read lead_contacts" ON public.lead_contacts;
