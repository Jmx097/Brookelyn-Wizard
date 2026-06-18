
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ceo_linkedin TEXT,
  ADD COLUMN IF NOT EXISTS cfo_linkedin TEXT,
  ADD COLUMN IF NOT EXISTS coo_linkedin TEXT,
  ADD COLUMN IF NOT EXISTS chro_linkedin TEXT,
  ADD COLUMN IF NOT EXISTS general_counsel_linkedin TEXT;
