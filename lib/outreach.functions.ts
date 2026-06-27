import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ANTHROPIC_MODELS, callAnthropicTool } from "@/lib/anthropic";

const InputSchema = z.object({
  leadId: z.string().uuid().optional().nullable(),
  companyName: z.string(),
  industry: z.string().optional().nullable(),
  hq: z.string().optional().nullable(),
  triggerSummary: z.string().optional().nullable(),
  fitReasoning: z.string().optional().nullable(),
  expansionSignals: z.array(z.string()).optional().default([]),
  outOfHqCountries: z.array(z.string()).optional().default([]),
  contactName: z.string(),
  contactRole: z.string(),
  voice: z.string().optional().nullable(),
  approach: z.number().int().min(1).max(5).optional().default(1),
  leadType: z.enum(["Expansion", "Consolidation"]).optional().default("Expansion"),
});

export const APPROACHES: Record<
  number,
  { id: number; name: string; description: string; instruction: string }
> = {
  1: {
    id: 1,
    name: "Trigger-based",
    description: "Reference the recent news / trigger and tie GoGlobal's help directly to it.",
    instruction:
      "Lead with the specific trigger event so it feels personal and timely. Tie GoGlobal's help directly to the near-term challenge that trigger creates. End with a clear CTA: ask for a 15-minute chat to share how we've helped similar companies navigate the same moment.",
  },
  2: {
    id: 2,
    name: "3 hidden obstacles",
    description:
      "Social proof + offer to walk through 3 obstacles most companies don't see coming.",
    instruction:
      "Open with brief social proof: 'We just helped a company in your space with a {{global expansion | vendor consolidation}}.' Then offer: 'I can walk you through the 3 obstacles that most companies don't see coming.' Use 'global expansion' for Expansion leads and 'vendor consolidation' for Consolidation leads. Do NOT list the obstacles — curiosity is the hook. End with an explicit CTA: 'Open to a 15-minute call this week or next?'",
  },
  3: {
    id: 3,
    name: "Contrarian insight",
    description: "Lead with a sharp, counterintuitive observation about their space.",
    instruction:
      "Open with a contrarian or counterintuitive insight specific to their industry or situation (e.g. 'Most {industry} companies treat EOR as a stopgap — the ones that win treat it as architecture.'). Brief, confident, no hedging. End with a clear CTA: ask for 15 minutes to share what we're seeing across the market.",
  },
  4: {
    id: 4,
    name: "Peer benchmark",
    description: "Curious-how-peers-are-handling-this framing — leverages FOMO and curiosity.",
    instruction:
      "Frame around what peers / comparable companies are doing. 'Curious how you're approaching {specific challenge} — we're seeing {peer-type companies} {specific pattern}.' Position yourself as someone with cross-company pattern recognition. End with an explicit CTA: offer to share a 1-page peer benchmark, OR propose a 15-minute comparison call — pick whichever fits and ask directly ('Want me to send the benchmark over?' or 'Worth 15 minutes to compare notes?').",
  },
  5: {
    id: 5,
    name: "Give-first resource",
    description:
      "Lead with a useful resource or insight tailored to them. No meeting ask — open a door.",
    instruction:
      "Give-first, no meeting ask. Open by naming a specific situation they're likely facing (a country they're entering, a vendor stack they likely run, a hiring profile). Offer to share ONE concrete resource: a 1-page country brief, a vendor comparison, a benchmark from a peer, or a short playbook — whatever fits. No pitch, no 'hope you're well.' End with the explicit CTA: 'Want me to send it over?' Max 55 words.",
  },
};

export type OutreachMessages = {
  problemStatements: string[];
  emailSubject: string;
  emailBody: string;
  linkedinMessage: string;
};

async function assertOwnedLead(userId: string, leadId: string | null | undefined) {
  if (!leadId) return;
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found");
}

export const generateOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<OutreachMessages> => {
    await assertOwnedLead(context.userId, data.leadId);

    const voice =
      data.voice ||
      "Warm, concise, consultative. Reference the trigger event and how GoGlobal helps with international hiring/expansion via EOR.";

    const approach = APPROACHES[data.approach] ?? APPROACHES[1];

    const sys = `You are an SDR at GoGlobal, a leading Employer of Record (EOR) and global expansion partner. GoGlobal helps companies hire internationally without setting up local entities, manages payroll/benefits/compliance in 100+ countries, and handles entity setup, contractor conversion, and cross-border employment law.

Voice: ${voice}

LinkedIn DM approach for this draft: "${approach.name}"
${approach.instruction}

For the given prospect contact, produce:
1. 2-3 short problem statements specific to their ROLE (e.g. CFO cares about cost predictability, entity setup costs, FX exposure; CHRO cares about hiring speed, compliance risk, employee experience; COO cares about operational scalability; CEO cares about speed to market; GC cares about employment law risk, IP, contractor misclassification).
2. A brief email (subject + body, body MAX 90 words, 3 short paragraphs, no fluff, references the trigger event).
3. A LinkedIn DM following the "${approach.name}" approach above (MAX 50 words unless the approach says shorter, single paragraph, no "Hope you're well", no emojis, and NEVER use exclamation points — keep the tone professional and measured, use periods only). The DM MUST end with one clear, specific call-to-action as a question — either a meeting ask (e.g. "Open to a 15-minute chat next week?"), a resource offer ("Want me to send the 1-page brief over?"), or a direct question inviting a reply. Never end without an explicit ask.

Tie the email to the trigger and role-specific problem. The LinkedIn DM must follow the chosen approach style — do not default back to a generic trigger-reference DM if the approach calls for something else.`;

    const user = `Company: ${data.companyName}
Lead type: ${data.leadType}
Industry: ${data.industry || "unknown"}
HQ: ${data.hq || "unknown"}
Trigger / news: ${data.triggerSummary || "n/a"}
Fit reasoning: ${data.fitReasoning || "n/a"}
Expansion signals: ${data.expansionSignals.join(", ") || "n/a"}
Out-of-HQ hiring countries: ${data.outOfHqCountries.join(", ") || "none"}

Contact: ${data.contactName}
Role: ${data.contactRole}`;

    const parsed = await callAnthropicTool<OutreachMessages>(
      sys,
      user,
      {
        type: "object",
        additionalProperties: false,
        properties: {
          problemStatements: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 3,
          },
          emailSubject: { type: "string" },
          emailBody: { type: "string" },
          linkedinMessage: { type: "string" },
        },
        required: ["problemStatements", "emailSubject", "emailBody", "linkedinMessage"],
      },
      "emit_outreach",
      {
        model: ANTHROPIC_MODELS.cheap,
        toolDescription: "Return the structured outreach package",
      },
    );
    const stripBangs = (s: string) =>
      s.replace(/!+/g, ".").replace(/\.{2,}/g, ".").replace(/\s+\./g, ".").trim();
    return { ...parsed, linkedinMessage: stripBangs(parsed.linkedinMessage) };
  });
