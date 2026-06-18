
CREATE TABLE public.gmail_forwarding_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_address TEXT,
  subject TEXT,
  code TEXT,
  verify_url TEXT,
  raw_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gmail_forwarding_confirmations TO authenticated;
GRANT ALL ON public.gmail_forwarding_confirmations TO service_role;
ALTER TABLE public.gmail_forwarding_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gmail confirmations" ON public.gmail_forwarding_confirmations FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "demo read gmail confirmations" ON public.gmail_forwarding_confirmations FOR SELECT TO public USING (true);
CREATE INDEX gmail_forwarding_confirmations_user_created_idx ON public.gmail_forwarding_confirmations (user_id, created_at DESC);
