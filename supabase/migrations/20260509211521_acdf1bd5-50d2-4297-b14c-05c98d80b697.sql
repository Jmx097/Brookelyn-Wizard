CREATE POLICY "demo read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "demo read articles" ON public.articles FOR SELECT USING (true);
CREATE POLICY "demo read queries" ON public.search_queries FOR SELECT USING (true);
CREATE POLICY "demo read icp" ON public.icp_config FOR SELECT USING (true);
CREATE POLICY "demo read notes" ON public.notes FOR SELECT USING (true);
CREATE POLICY "demo read outreach" ON public.outreach_drafts FOR SELECT USING (true);