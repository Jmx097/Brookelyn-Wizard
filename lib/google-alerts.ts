type ScrapedArticle = {
  url: string;
  title?: string;
  markdown?: string;
};

export type DigestArticleCandidate = {
  url: string;
  title?: string;
  snippet?: string;
};

function cleanUrlCandidate(value: string): string {
  return value.trim().replace(/[.,;:)\]]+$/, '');
}

function isBlockedGoogleAlertUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const full = `${host}${url.pathname}${url.search}`.toLowerCase();
  return (
    /google\.com\/(alerts|alerts\/feeds)/i.test(full) ||
    /googleadservices/i.test(full) ||
    /unsubscribe/i.test(full)
  );
}

function decodeGoogleRedirect(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('google.')) return null;
    if (parsed.pathname !== '/url') return null;
    const nested = parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (!nested) return null;
    return cleanUrlCandidate(decodeURIComponent(nested));
  } catch {
    return null;
  }
}

function shouldKeepUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    return !isBlockedGoogleAlertUrl(parsed);
  } catch {
    return false;
  }
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function lineLooksLikeOnlyUrl(line: string): boolean {
  const normalized = normalizeLine(line);
  if (!normalized) return false;
  const cleaned = cleanUrlCandidate(normalized);
  return /^https?:\/\//i.test(cleaned) && cleaned === normalized;
}

function isGenericDigestLine(line: string): boolean {
  const normalized = normalizeLine(line).toLowerCase();
  if (!normalized) return true;
  return [
    'google alerts',
    'manage this alert',
    'create another alert',
    'view this alert',
    'edit this alert',
    'unsubscribe',
    'forwarded message',
  ].includes(normalized);
}

function cleanContextLine(line: string): string | undefined {
  const normalized = normalizeLine(line);
  if (!normalized) return undefined;
  if (lineLooksLikeOnlyUrl(normalized)) return undefined;
  if (isGenericDigestLine(normalized)) return undefined;
  return normalized;
}

function titleFromNearbyLines(lines: string[], urlLineIndex: number): string | undefined {
  for (let i = urlLineIndex - 1; i >= 0 && i >= urlLineIndex - 3; i -= 1) {
    const candidate = cleanContextLine(lines[i]);
    if (candidate) return candidate;
  }
  return undefined;
}

function snippetFromNearbyLines(lines: string[], urlLineIndex: number): string | undefined {
  const snippets: string[] = [];
  for (let i = urlLineIndex + 1; i < lines.length && i <= urlLineIndex + 3; i += 1) {
    const candidate = cleanContextLine(lines[i]);
    if (!candidate) continue;

    const nextLine = i + 1 < lines.length ? normalizeLine(lines[i + 1]) : '';
    const looksLikeNextArticleTitle =
      snippets.length > 0 &&
      !/[.!?]$/.test(candidate) &&
      /^https?:\/\//i.test(cleanUrlCandidate(nextLine));

    if (looksLikeNextArticleTitle) break;

    snippets.push(candidate);
    if (snippets.length >= 2) break;
  }
  return snippets.length ? snippets.join(' ') : undefined;
}

function titleAndSnippetFromSameLine(
  line: string,
  rawUrlMatch: string,
): { title?: string; snippet?: string } {
  const parts = line.split(rawUrlMatch);
  if (parts.length < 2) return {};

  const title = cleanContextLine(parts[0].replace(/[—–:\s\-]+$/, ''));
  const snippet = cleanContextLine(parts.slice(1).join(rawUrlMatch).replace(/^[—–:\s\-]+/, ''));

  return { title, snippet };
}

export function extractDigestArticleCandidates(text: string): DigestArticleCandidate[] {
  const lines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const articles: DigestArticleCandidate[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const matches = lines[lineIndex].match(/https?:\/\/[^\s<>"']+/g) ?? [];
    for (const match of matches) {
      const cleaned = cleanUrlCandidate(match);
      const decoded = decodeGoogleRedirect(cleaned);
      const candidateUrl = decoded ?? cleaned;
      if (!shouldKeepUrl(candidateUrl)) continue;
      if (seen.has(candidateUrl)) continue;
      seen.add(candidateUrl);
      const inlineContext = titleAndSnippetFromSameLine(lines[lineIndex], match);
      articles.push({
        url: candidateUrl,
        title: inlineContext.title ?? titleFromNearbyLines(lines, lineIndex),
        snippet: inlineContext.snippet ?? snippetFromNearbyLines(lines, lineIndex),
      });
    }
  }

  return articles;
}

export function extractArticleUrlsFromDigest(text: string): string[] {
  return extractDigestArticleCandidates(text).map((candidate) => candidate.url);
}

export function buildGoogleAlertScoringSystemPrompt(icp: string): string {
  return `You are a B2B prospect-research analyst for GoGlobal (an Employer of Record / global expansion company).

${icp}

Every Google Alert article must be evaluated through this pipeline: Extract → Enrich → Score → Draft.

SCORING TRACKS
- Expansion: companies just starting international expansion. Reward fresh funding, opening offices abroad, first hires outside HQ, named international leadership hires, and explicit cross-border growth language.
- Consolidation: companies already operating across multiple countries and likely to rationalize vendors. Reward a 5-30 country footprint, multi-country hiring, and clear evidence of operational complexity across regions.

RULES
- Prefer full scraped article bodies over digest snippets when both are available.
- Review every candidate article URL from the digest. If the body scrape fails, still use the digest title/snippet so plausible triggers are not dropped.
- Determine which scoring track is the best fit for each company before assigning a score.
- Reward out-of-HQ hiring, multi-country signals, fresh trigger events, and concrete evidence over vague commentary.
- Penalize generic market commentary, stale coverage, purely consumer news, and mega-cap companies with no credible GoGlobal fit.
- In fit_reasoning, explicitly state whether the company is a better Expansion or Consolidation lead and why.

For each distinct article that mentions a company that could be a GoGlobal prospect:
- Extract the canonical company name.
- Extract source url + title.
- Summarize the trigger in 1 sentence.
- Extract concrete expansion signals as short phrases.
- Estimate funding stage/amount, HQ, industry, and company size if mentioned.
- Score 0-100 fit against the ICP and the best-fit track.
- Write 1-2 sentences of fit reasoning.

Return up to 50 leads.`;
}

export function buildGoogleAlertUserPrompt(
  digestText: string,
  scrapedArticles: ScrapedArticle[],
): string {
  const digestCandidates = extractDigestArticleCandidates(digestText);
  const candidateBlock = digestCandidates
    .map(
      (candidate, i) =>
        `--- CANDIDATE ${i + 1} ---\nURL: ${candidate.url}\nTITLE: ${candidate.title ?? ''}\nSNIPPET: ${candidate.snippet ?? ''}`,
    )
    .join('\n\n');

  const articleBlock = scrapedArticles
    .map(
      (s, i) =>
        `--- ARTICLE ${i + 1} ---\nURL: ${s.url}\nTITLE: ${s.title ?? ''}\n\n${s.markdown ?? ''}`,
    )
    .join('\n\n');

  return `DIGEST EMAIL:\n${digestText}\n\nCANDIDATE ARTICLES FROM DIGEST:\n${candidateBlock || '(none found)'}\n\nFULL ARTICLE BODIES:\n${articleBlock || '(none scraped)'}`;
}
