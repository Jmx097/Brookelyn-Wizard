ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS controller_name text,
  ADD COLUMN IF NOT EXISTS controller_linkedin text,
  ADD COLUMN IF NOT EXISTS finance_leader_1_name text,
  ADD COLUMN IF NOT EXISTS finance_leader_1_linkedin text,
  ADD COLUMN IF NOT EXISTS finance_leader_2_name text,
  ADD COLUMN IF NOT EXISTS finance_leader_2_linkedin text;