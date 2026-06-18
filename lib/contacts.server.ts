// Bright Data SERP-based LinkedIn contact discovery.
// Uses Google site:linkedin.com/in queries via Bright Data SERP API.
// Configure with BRIGHTDATA_API_KEY (required) and BRIGHTDATA_SERP_ZONE (optional, default "serp_api1").

export type DiscoveredContact = {
  full_name: string;
  title: string | null;
  linkedin_url: string;
  location: string | null;
  seniority: string | null;
  relevance_score: number;
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

async function brightDataSerp(query: string): Promise<Array<{ title: string; link: string; description?: string }>> {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new Error("BRIGHTDATA_API_KEY is not configured");
  const zone = process.env.BRIGHTDATA_SERP_ZONE || "serp_api1";

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&brd_json=1`;

  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone, url, format: "raw" }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bright Data SERP ${res.status}: ${txt.slice(0, 300)}`);
  }

  const text = await res.text();
  let json: { organic?: Array<{ title?: string; link?: string; description?: string }> } = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Bright Data SERP returned non-JSON. Make sure your zone supports brd_json (SERP API zone).");
  }
  return (json.organic || [])
    .filter((r) => r.link && r.title)
    .map((r) => ({ title: r.title!, link: r.link!, description: r.description }));
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
