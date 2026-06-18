import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { discoverContactsForCompany } from "./contacts.server";

export type LeadContactRow = {
  id: string;
  lead_id: string;
  full_name: string;
  title: string | null;
  linkedin_url: string | null;
  location: string | null;
  seniority: string | null;
  relevance_score: number;
  source: string;
  created_at: string;
};

export const listLeadContacts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("lead_contacts")
      .select("*")
      .eq("lead_id", data.leadId)
      .order("relevance_score", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as LeadContactRow[];
  });

export const enrichContacts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ leadId: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id, user_id, company_name, contacts_enriched_at")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead not found");

    // Cache: if already enriched and not forced, return existing
    if (!data.force && lead.contacts_enriched_at) {
      const { data: existing } = await supabaseAdmin
        .from("lead_contacts")
        .select("*")
        .eq("lead_id", lead.id);
      if (existing && existing.length > 0) {
        return { ok: true as const, count: existing.length, cached: true };
      }
    }

    const discovered = await discoverContactsForCompany(lead.company_name);

    if (discovered.length === 0) {
      await supabaseAdmin
        .from("leads")
        .update({ contacts_enriched_at: new Date().toISOString() })
        .eq("id", lead.id);
      return { ok: true as const, count: 0, cached: false };
    }

    // Upsert each (lead_id, linkedin_url) unique
    for (const c of discovered) {
      await supabaseAdmin.from("lead_contacts").upsert(
        {
          user_id: lead.user_id,
          lead_id: lead.id,
          full_name: c.full_name,
          title: c.title,
          linkedin_url: c.linkedin_url,
          location: c.location,
          seniority: c.seniority,
          relevance_score: c.relevance_score,
          source: "brightdata",
        },
        { onConflict: "lead_id,linkedin_url", ignoreDuplicates: false },
      );
    }

    await supabaseAdmin
      .from("leads")
      .update({ contacts_enriched_at: new Date().toISOString() })
      .eq("id", lead.id);

    return { ok: true as const, count: discovered.length, cached: false };
  });

const SAVE_SLOTS = z.enum([
  "ceo",
  "cfo",
  "coo",
  "chro",
  "general_counsel",
  "controller",
  "finance_leader_1",
  "finance_leader_2",
]);

export const saveContactToLeadSlot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        leadId: z.string().uuid(),
        contactId: z.string().uuid(),
        slot: SAVE_SLOTS,
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: c, error } = await supabaseAdmin
      .from("lead_contacts")
      .select("full_name, linkedin_url")
      .eq("id", data.contactId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Contact not found");

    const nameField = `${data.slot}_name`;
    const linkField = `${data.slot}_linkedin`;
    const update: Record<string, unknown> = {
      [nameField]: c.full_name,
      [linkField]: c.linkedin_url,
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabaseAdmin
      .from("leads")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("id", data.leadId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });
