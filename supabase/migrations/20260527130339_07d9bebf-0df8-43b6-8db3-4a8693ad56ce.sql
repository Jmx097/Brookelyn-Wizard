ALTER TABLE public.job_postings ALTER COLUMN is_out_of_hq DROP NOT NULL;
ALTER TABLE public.job_postings ALTER COLUMN is_out_of_hq DROP DEFAULT;
UPDATE public.job_postings SET is_out_of_hq = NULL WHERE country IS NULL;