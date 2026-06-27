import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { EnrichSchema } from "./import-companies.schema";
import { ANTHROPIC_MODELS, callAnthropicTool } from "@/lib/anthropic";

// ---------- ICP helpers ----------
async function getIcpText(userId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("icp_config").select("*").eq("user_id", userId).maybeSingle();
  const c = data;
  if (!c) return "GoGlobal ICP: companies signaling international expansion.";
  return `GoGlobal ICP:
- Industries: ${(c.industries as string[])?.join(", ") || "any"}
- Funding stages: ${(c.funding_stages as string[])?.join(", ") || "any"}
- Regions: ${(c.regions as string[])?.join(", ") || "any"}
- Company size: ${c.company_size_min || "?"}-${c.company_size_max || "?"} employees
- Scoring guidance: ${c.scoring_prompt || ""}`;
}

// ---------- Firecrawl helpers ----------
async function firecrawlScrape(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const md: string | undefined = j?.data?.markdown ?? j?.markdown;
    return md ? md.slice(0, 6000) : null;
  } catch {
    return null;
  }
}

type SearchResult = { url: string; title?: string; description?: string };
async function firecrawlSearch(query: string, limit = 6): Promise<SearchResult[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const items = (j?.data?.web ?? j?.data ?? j?.web ?? []) as SearchResult[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

// ---------- AI scoring ----------
async function callAI<T>(systemPrompt: string, userPrompt: string, schema: object, fnName: string): Promise<T> {
  return callAnthropicTool<T>(systemPrompt, userPrompt, schema as Record<string, unknown>, fnName, {
    model: ANTHROPIC_MODELS.cheap,
  });
}

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    industry: { type: "string" },
    hq: { type: "string" },
    company_size: { type: "string" },
    funding_stage: { type: "string" },
    funding_amount: { type: "string" },
    trigger_summary: { type: "string" },
    expansion_signals: { type: "array", items: { type: "string" } },
    fit_score: { type: "number" },
    fit_reasoning: { type: "string" },
  },
  required: ["trigger_summary", "fit_score", "fit_reasoning"],
};

// ---------- Job board search ----------
const BOARDS = ["lever.co", "greenhouse.io", "ashbyhq.com", "workable.com", "linkedin.com/jobs"];
const INTL_HUBS = [
  "Berlin", "London", "Singapore", "Dublin", "Amsterdam",
  "Madrid", "Toronto", "Sydney", "São Paulo", "Tokyo",
];

function normalizeJobUrl(u: string): string {
  try {
    const parsed = new URL(u);
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${path}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

function looksLikeLandingPage(r: SearchResult): boolean {
  const url = (r.url || "").toLowerCase();
  const title = (r.title || "").trim();
  // Board roots / careers index pages
  if (/^https?:\/\/(jobs\.|boards\.)?(lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com)\/?$/.test(url)) return true;
  if (/\/(jobs|careers|company)\/?$/.test(url) && !/\/jobs\/[^/]+\/?$/.test(url)) return true;
  // Generic chrome titles
  if (/^(careers|jobs|open positions|join us|we're hiring)(\s*[|·–-].*)?$/i.test(title)) return true;
  if (/^(greenhouse|workable|lever|ashby|linkedin)(\s*[|·–-].*)?$/i.test(title)) return true;
  if (/^jobs by workable$/i.test(title)) return true;
  return false;
}

async function searchJobs(companyName: string): Promise<SearchResult[]> {
  // Parallel per-board queries + one international-hub query
  const boardQueries = BOARDS.map((b) =>
    withTimeout(firecrawlSearch(`site:${b} "${companyName}"`, 6), 8_000, [] as SearchResult[]),
  );
  const intlQuery = withTimeout(
    firecrawlSearch(
      `"${companyName}" careers (${INTL_HUBS.map((c) => `"${c}"`).join(" OR ")})`,
      6,
    ),
    8_000,
    [] as SearchResult[],
  );

  const all = (await Promise.all([...boardQueries, intlQuery])).flat();
  // Dedupe by normalized URL, drop landing pages, keep board-board domains for the board queries
  const seen = new Set<string>();
  const filtered: SearchResult[] = [];
  for (const r of all) {
    if (!r?.url) continue;
    const key = normalizeJobUrl(r.url);
    if (seen.has(key)) continue;
    seen.add(key);
    if (looksLikeLandingPage(r)) continue;
    filtered.push(r);
  }
  return filtered.slice(0, 20);
}

// ---------- LLM job posting extraction ----------
type ExtractedJob = {
  url: string;
  title: string;
  board: string | null;
  location: string | null;
  country: string | null;
  seniority: string | null;
  is_out_of_hq: boolean | null;
};

const JOB_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    postings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          location: { type: ["string", "null"] },
          country: { type: ["string", "null"] },
          seniority: { type: ["string", "null"] },
          is_out_of_hq: { type: ["boolean", "null"] },
          is_real_posting: { type: "boolean" },
        },
        required: ["url", "title", "is_real_posting"],
      },
    },
  },
  required: ["postings"],
};

function detectBoard(url: string): string | null {
  return BOARDS.find((b) => url.includes(b)) || null;
}

async function extractJobPostings(
  companyName: string,
  hq: string | null,
  candidates: SearchResult[],
): Promise<ExtractedJob[]> {
  if (candidates.length === 0) return [];
  const sys = `You parse search results for company job postings.
For each result decide:
- is_real_posting: true only if this looks like a single job posting (not a careers index, brand page, or unrelated result for a different company).
- title: cleaned role title (strip board names, "| LinkedIn", "Jobs By Workable", etc).
- location: city / region as written if visible in the title or snippet, else null.
- country: full country name if you can infer it from the location, else null. Don't guess from the company HQ.
- seniority: one of "Intern","Junior","Mid","Senior","Lead","Manager","Director","VP","C-level" if visible, else null.
- is_out_of_hq: true if country is set AND differs from the company HQ country. false if country is set AND matches HQ country. null if country is unknown.
Be strict. If a row is not clearly a single posting for ${companyName}, set is_real_posting=false.`;

  const userPrompt = `COMPANY: ${companyName}
HQ: ${hq || "(unknown)"}

RESULTS (${candidates.length}):
${candidates
  .map(
    (c, i) =>
      `[${i}] URL: ${c.url}\n    TITLE: ${c.title || ""}\n    SNIPPET: ${(c.description || "").slice(0, 240)}`,
  )
  .join("\n")}`;

  let parsed: { postings: Array<ExtractedJob & { is_real_posting: boolean }> };
  try {
    parsed = await withTimeout(
      callAI<{ postings: Array<ExtractedJob & { is_real_posting: boolean }> }>(
        sys,
        userPrompt,
        JOB_EXTRACT_SCHEMA,
        "extract_postings",
      ),
      20_000,
      { postings: [] },
    );
  } catch {
    return [];
  }

  // Map back to URLs we actually searched, attach board.
  const byUrl = new Map(candidates.map((c) => [c.url, c]));
  const out: ExtractedJob[] = [];
  for (const p of parsed.postings || []) {
    if (!p.is_real_posting) continue;
    const src = byUrl.get(p.url);
    if (!src) continue;
    out.push({
      url: p.url,
      title: (p.title || src.title || "Open role").slice(0, 300),
      board: detectBoard(p.url),
      location: p.location ?? null,
      country: p.country ?? null,
      seniority: p.seniority ?? null,
      is_out_of_hq: p.is_out_of_hq ?? null,
    });
  }
  return out.slice(0, 20);
}

export type JobResearchCounts = {
  total: number;
  out_of_hq: number;
  same_country: number;
  unknown: number;
};

function summarizePostings(rows: ExtractedJob[]): JobResearchCounts {
  return {
    total: rows.length,
    out_of_hq: rows.filter((r) => r.is_out_of_hq === true).length,
    same_country: rows.filter((r) => r.is_out_of_hq === false).length,
    unknown: rows.filter((r) => r.is_out_of_hq === null).length,
  };
}

/**
 * Re-run job research for a single existing lead. Wipes previous job_postings and replaces them.
 */
export async function researchJobsForLead(userId: string, leadId: string): Promise<JobResearchCounts> {
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, user_id, company_name, hq")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead not found");

  const candidates = await searchJobs(lead.company_name as string);
  const extracted = await extractJobPostings(
    lead.company_name as string,
    (lead.hq as string | null) ?? null,
    candidates,
  );

  await supabaseAdmin.from("job_postings").delete().eq("lead_id", leadId).eq("user_id", userId);
  if (extracted.length) {
    await supabaseAdmin.from("job_postings").insert(
      extracted.map((j) => ({
        user_id: userId,
        lead_id: leadId,
        title: j.title,
        url: j.url,
        board: j.board,
        location: j.location,
        country: j.country,
        seniority: j.seniority,
        is_out_of_hq: j.is_out_of_hq,
      })),
    );
  }
  return summarizePostings(extracted);
}

// ---------- Timeout helper ----------
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then((v) => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(v);
      }
    }).catch(() => {
      if (!done) {
        done = true;
        clearTimeout(t);
        resolve(fallback);
      }
    });
  });
}


// ---------- Executive LinkedIn lookup (Google snippet, free) ----------
const EXEC_ROLES: Array<{
  role: string;
  queries: string[];
  nameKey: "ceo_name" | "cfo_name" | "coo_name" | "chro_name" | "general_counsel_name";
  linkKey: "ceo_linkedin" | "cfo_linkedin" | "coo_linkedin" | "chro_linkedin" | "general_counsel_linkedin";
}> = [
  { role: "CEO", queries: ["CEO", "Chief Executive Officer"], nameKey: "ceo_name", linkKey: "ceo_linkedin" },
  { role: "CFO", queries: ["CFO", "Chief Financial Officer"], nameKey: "cfo_name", linkKey: "cfo_linkedin" },
  { role: "COO", queries: ["COO", "Chief Operating Officer"], nameKey: "coo_name", linkKey: "coo_linkedin" },
  { role: "CHRO", queries: ["CHRO", "Chief People Officer", "Head of People"], nameKey: "chro_name", linkKey: "chro_linkedin" },
  { role: "General Counsel", queries: ["General Counsel", "Chief Legal Officer"], nameKey: "general_counsel_name", linkKey: "general_counsel_linkedin" },
];

function extractNameFromTitle(title: string): string | null {
  // LinkedIn titles look like: "Jane Doe - CEO - Acme | LinkedIn"
  const cleaned = title.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  const first = cleaned.split(/\s+-\s+|\s+–\s+/)[0]?.trim();
  if (!first) return null;
  // basic sanity: 2-4 words, capitalized
  const parts = first.split(/\s+/);
  if (parts.length < 2 || parts.length > 5) return null;
  return first;
}

async function findExecutive(
  companyName: string,
  roleQueries: string[],
): Promise<{ name: string | null; url: string | null }> {
  for (const q of roleQueries) {
    const results = await firecrawlSearch(`site:linkedin.com/in "${companyName}" ${q}`, 3);
    for (const r of results) {
      if (!r.url?.includes("linkedin.com/in/")) continue;
      const name = extractNameFromTitle(r.title || "");
      if (name) return { name, url: r.url };
    }
  }
  return { name: null, url: null };
}

// ---------- Per-row enrichment ----------
type ScoreResult = {
  industry?: string;
  hq?: string;
  company_size?: string;
  funding_stage?: string;
  funding_amount?: string;
  trigger_summary: string;
  expansion_signals?: string[];
  fit_score: number;
  fit_reasoning: string;
};


async function enrichOne(userId: string, icpText: string, input: z.infer<typeof EnrichSchema>) {
  const companyName = input.company_name;
  const website = input.website || null;
  const domain = website ? website.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase() : null;

  // 0. Check cache by domain
  let cached: {
    site_markdown: string | null;
    job_results: SearchResult[];
    execs: Record<string, string | null>;
    scored: ScoreResult | null;
  } | null = null;
  if (domain) {
    const { data: c } = await supabaseAdmin
      .from("enrichment_cache")
      .select("site_markdown, job_results, execs, scored")
      .eq("user_id", userId)
      .eq("domain", domain)
      .maybeSingle();
    if (c) {
      cached = {
        site_markdown: c.site_markdown as string | null,
        job_results: (c.job_results as SearchResult[]) || [],
        execs: (c.execs as Record<string, string | null>) || {},
        scored: c.scored as ScoreResult | null,
      };
    }
  }

  // 1-2-4. Run scrape, job search, exec lookups in parallel (with timeouts)
  const url = website ? (website.startsWith("http") ? website : `https://${website}`) : null;

  const sitePromise: Promise<string | null> =
    cached?.site_markdown !== undefined && cached !== null
      ? Promise.resolve(cached.site_markdown)
      : url
        ? withTimeout(firecrawlScrape(url), 20_000, null)
        : Promise.resolve(null);

  const jobsPromise: Promise<SearchResult[]> = cached
    ? Promise.resolve(cached.job_results)
    : searchJobs(companyName);

  const execsPromise: Promise<Record<string, string | null>> =
    cached && Object.keys(cached.execs).length > 0
      ? Promise.resolve(cached.execs)
      : (async () => {
          const results = await Promise.all(
            EXEC_ROLES.map((exec) =>
              withTimeout(findExecutive(companyName, exec.queries), 15_000, {
                name: null,
                url: null,
              }),
            ),
          );
          const out: Record<string, string | null> = {};
          EXEC_ROLES.forEach((exec, i) => {
            out[exec.nameKey] = results[i].name;
            out[exec.linkKey] = results[i].url;
          });
          return out;
        })();

  const [siteContent, jobResults, execs] = await Promise.all([
    sitePromise,
    jobsPromise,
    execsPromise,
  ]);

  // 3. AI scoring (cached)
  const jobSummary = jobResults
    .slice(0, 12)
    .map((j, i) => `J${i + 1}. ${j.title || ""} — ${j.url}`)
    .join("\n");

  const sys = `You are a B2B consolidation/expansion analyst for GoGlobal (Employer of Record).

${icpText}

Given a company's website content and a list of their currently open job postings, return:
- industry, hq, company_size, funding_stage, funding_amount (if discoverable)
- trigger_summary: 1 sentence on why they're a consolidation/expansion candidate NOW
- expansion_signals: short phrases (international hiring, new office, funding, etc.)
- fit_score: 0-100 against the ICP. REWARD: open roles outside HQ country, multi-country job postings, recent funding, explicit expansion language
- fit_reasoning: 1-2 sentences`;
  const userPrompt = `COMPANY: ${companyName}
WEBSITE: ${website || "(unknown)"}

--- WEBSITE CONTENT ---
${siteContent || "(could not scrape)"}

--- OPEN JOB POSTINGS (${jobResults.length}) ---
${jobSummary || "(none found)"}`;

  let scored: ScoreResult;
  if (cached?.scored) {
    scored = cached.scored;
  } else {
    try {
      scored = await withTimeout(
        callAI<ScoreResult>(sys, userPrompt, SCORE_SCHEMA, "score_company"),
        30_000,
        {
          trigger_summary: `Imported from spreadsheet.`,
          fit_score: 0,
          fit_reasoning: `Scoring timed out`,
        },
      );
    } catch (e) {
      scored = {
        trigger_summary: `Imported from spreadsheet.`,
        fit_score: 0,
        fit_reasoning: `Scoring failed: ${(e as Error).message}`,
      };
    }
  }

  // 4b. Persist cache for future re-imports
  if (domain) {
    await supabaseAdmin
      .from("enrichment_cache")
      .upsert(
        {
          user_id: userId,
          domain,
          site_markdown: siteContent,
          job_results: JSON.parse(JSON.stringify(jobResults)),
          execs: JSON.parse(JSON.stringify(execs)),
          scored: JSON.parse(JSON.stringify(scored)),
        },

        { onConflict: "user_id,domain" },
      );
  }

  // 5. Insert lead
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .insert({
      user_id: userId,
      company_name: companyName,
      website,
      domain,
      hq: scored.hq ?? null,
      industry: scored.industry ?? null,
      company_size: scored.company_size ?? null,
      funding_stage: scored.funding_stage ?? null,

      funding_amount: scored.funding_amount ?? null,
      trigger_summary: scored.trigger_summary,
      fit_score: Math.round(scored.fit_score ?? 0),
      fit_reasoning: scored.fit_reasoning,
      expansion_signals: scored.expansion_signals ?? [],
      status: "new",
      ceo_name: execs.ceo_name,
      cfo_name: execs.cfo_name,
      coo_name: execs.coo_name,
      chro_name: execs.chro_name,
      general_counsel_name: execs.general_counsel_name,
      ceo_linkedin: execs.ceo_linkedin,
      cfo_linkedin: execs.cfo_linkedin,
      coo_linkedin: execs.coo_linkedin,
      chro_linkedin: execs.chro_linkedin,
      general_counsel_linkedin: execs.general_counsel_linkedin,
    })
    .select("id")
    .single();

  if (error || !lead) throw new Error(error?.message || "insert failed");

  // 6. Save job postings (LLM-enriched: location, country, is_out_of_hq)
  const extracted = await extractJobPostings(
    companyName,
    scored.hq ?? null,
    jobResults.slice(0, 20),
  );
  if (extracted.length) {
    await supabaseAdmin.from("job_postings").insert(
      extracted.map((j) => ({
        user_id: userId,
        lead_id: lead.id,
        title: j.title,
        url: j.url,
        board: j.board,
        location: j.location,
        country: j.country,
        seniority: j.seniority,
        is_out_of_hq: j.is_out_of_hq,
      })),
    );
  }
  const counts = summarizePostings(extracted);

  return {
    lead_id: lead.id,
    company: companyName,
    fit_score: Math.round(scored.fit_score ?? 0),
    jobs_found: counts.total,
    jobs_out_of_hq: counts.out_of_hq,
    execs_found: Object.entries(execs).filter(([k, v]) => k.endsWith("_name") && v).length,
  };
}

// ---------- Server-only exports used by thin server-function wrappers ----------

export function getImportErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error instanceof Response) return `${error.status} ${error.statusText || "Request failed"}`.trim();
  return "Import failed. Please try again.";
}


export async function enrichImportedCompanyForUser(userId: string, data: z.infer<typeof EnrichSchema>) {
  const icpText = await getIcpText(userId);
  return enrichOne(userId, icpText, data);
}
