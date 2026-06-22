// Bright Data SERP-based LinkedIn contact discovery.
// Uses Google site:linkedin.com/in queries via Bright Data Web Access API.
// Configure with BRIGHTDATA_API_KEY (required) and BRIGHTDATA_SERP_ZONE (required for production, e.g. "linkedin_v1").

export type DiscoveredContact = {
  full_name: string;
  title: string | null;
  linkedin_url: string;
  location: string | null;
  seniority: string | null;
  relevance_score: number;
};

type BrightDataOrganicResult = {
  title?: string;
  link?: string;
  description?: string;
};

type BrightDataOuterResponse = {
  status_code?: number;
  headers?: Record<string, string>;
  body?: string;
};

type BrightDataParsedBody = {
  organic?: BrightDataOrganicResult[];
};

const ROLE_QUERIES: { label: string; q: string; seniority: string; boost: number }[] = [
  { label: "CEO", q: '"CEO" OR "Chief Executive Officer"', seniority: "C-Suite", boost: 100 },
  { label: "CFO", q: '"CFO" OR "Chief Financial Officer"', seniority: "C-Suite", boost: 100 },
  { label: "CHRO / People", q: '"CHRO" OR "Chief People Officer" OR "VP People" OR "Head of People"', seniority: "C-Suite", boost: 95 },
  { label: "COO", q: '"COO" OR "Chief Operating Officer"', seniority: "C-Suite", boost: 90 },
  { label: "International / Expansion", q: '"Head of International" OR "VP International" OR "Global Expansion" OR "International Expansion"', seniority: "VP", boost: 95 },
  { label: "Talent / Recruiting", q: '"Head of Talent" OR "VP Talent" OR "Global Talent"', seniority: "VP", boost: 80 },
];

function parseLinkedinTitle(raw: string): { name: string; title: string | null } {
  // Common LinkedIn result format: "Jane Doe - CFO - Acme Inc | LinkedIn"
  // Or: "Jane Doe – CFO at Acme Inc - LinkedIn"
  const cleaned = raw.replace(/\s*[|–-]\s*LinkedIn.*$/i, "").trim();
  const parts = cleaned.split(/\s+[-–]\s+/);
  const name = parts[0]?.trim() || raw;
  const titlePart = parts.slice(1).join(" - ").trim();
  return { name, title: titlePart || null };
}

function parseBrightDataOrganicPayload(text: string): BrightDataOrganicResult[] {
  let outer: BrightDataOuterResponse;
  try {
    outer = JSON.parse(text) as BrightDataOuterResponse;
  } catch {
    throw new Error("Bright Data returned a non-JSON outer response");
  }

  if (!outer.body) {
    throw new Error("Bright Data response was missing body payload");
  }

  let inner: BrightDataParsedBody;
  try {
    inner = JSON.parse(outer.body) as BrightDataParsedBody;
  } catch {
    throw new Error("Bright Data response body was not valid parsed JSON");
  }

  return (inner.organic || [])
    .filter((r) => r.link && r.title)
    .map((r) => ({ title: r.title!, link: r.link!, description: r.description }));
}

async function brightDataSerp(query: string): Promise<Array<{ title: string; link: string; description?: string }>> {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new Error("BRIGHTDATA_API_KEY is not configured");

  const zone = process.env.BRIGHTDATA_SERP_ZONE;
  if (!zone) throw new Error("BRIGHTDATA_SERP_ZONE is not configured");

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone,
      url,
      format: "json",
      data_format: "parsed",
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Bright Data SERP ${res.status}: ${text.slice(0, 300)}`);
  }

  return parseBrightDataOrganicPayload(text);
}

export async function discoverContactsForCompany(companyName: string): Promise<DiscoveredContact[]> {
  const safeCompany = companyName.replace(/"/g, "");
  const out = new Map<string, DiscoveredContact>();

  for (const role of ROLE_QUERIES) {
    const q = `site:linkedin.com/in "${safeCompany}" (${role.q})`;
    try {
      const results = await brightDataSerp(q);
      for (const r of results) {
        const url = r.link;
        // Only keep canonical /in/ profiles
        if (!/linkedin\.com\/in\//i.test(url)) continue;
        // De-dupe on profile slug
        const slug = url.replace(/[?#].*$/, "").toLowerCase();
        if (out.has(slug)) {
          // Keep higher boost
          if ((out.get(slug)!.relevance_score ?? 0) < role.boost) {
            out.get(slug)!.relevance_score = role.boost;
          }
          continue;
        }
        const { name, title } = parseLinkedinTitle(r.title);
        // Skip if name has placeholders
        if (!name || /^linkedin/i.test(name) || name.length > 80) continue;
        // Require company name appearance in title or description for relevance
        const hay = `${r.title} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(safeCompany.toLowerCase())) continue;

        out.set(slug, {
          full_name: name,
          title,
          linkedin_url: slug,
          location: null,
          seniority: role.seniority,
          relevance_score: role.boost,
        });
      }
    } catch (e) {
      // Per-query failure shouldn't kill the whole enrichment
      console.error(`SERP failed for role ${role.label}:`, (e as Error).message);
    }
  }

  return Array.from(out.values())
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 10);
}
