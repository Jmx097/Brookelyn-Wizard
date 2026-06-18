
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ceo_name text,
  ADD COLUMN IF NOT EXISTS cfo_name text,
  ADD COLUMN IF NOT EXISTS chro_name text,
  ADD COLUMN IF NOT EXISTS coo_name text,
  ADD COLUMN IF NOT EXISTS general_counsel_name text;
