import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleAlertScoringSystemPrompt,
  buildGoogleAlertUserPrompt,
  extractArticleUrlsFromDigest,
  extractDigestArticleCandidates,
} from '../lib/google-alerts.ts';

test('extractArticleUrlsFromDigest decodes Google redirect links and keeps destination article URLs', () => {
  const digest = `
    Google Alerts
    https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Ftechcrunch.com%2F2026%2F06%2F29%2Facme-expands-to-germany%2F&ct=ga
    https://news.example.com/acme-opens-berlin-office
  `;

  assert.deepEqual(extractArticleUrlsFromDigest(digest), [
    'https://techcrunch.com/2026/06/29/acme-expands-to-germany/',
    'https://news.example.com/acme-opens-berlin-office',
  ]);
});

test('extractArticleUrlsFromDigest removes alert-management links and duplicates', () => {
  const digest = `
    https://www.google.com/alerts/feeds/12345678901234567890/09876543210987654321
    https://www.google.com/url?url=https%3A%2F%2Fexample.com%2Fstory&ct=ga
    https://example.com/story
    https://example.com/story)
    https://example.com/unsubscribe
  `;

  assert.deepEqual(extractArticleUrlsFromDigest(digest), [
    'https://example.com/story',
  ]);
});

test('extractDigestArticleCandidates preserves surrounding digest titles and snippets', () => {
  const digest = `
    Google Alerts
    Rippling opens Berlin office and expands EMEA hiring after major funding
    https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Ftechcrunch.com%2F2026%2F06%2F29%2Frippling-berlin-office%2F&ct=ga
    The company is hiring payroll and engineering roles in Germany and Ireland.

    Personio raises Series E and adds payroll roles across Europe
    https://example.com/personio-series-e
    Hiring continues across London, Dublin, Madrid, and Amsterdam.
  `;

  assert.deepEqual(extractDigestArticleCandidates(digest), [
    {
      url: 'https://techcrunch.com/2026/06/29/rippling-berlin-office/',
      title: 'Rippling opens Berlin office and expands EMEA hiring after major funding',
      snippet: 'The company is hiring payroll and engineering roles in Germany and Ireland.',
    },
    {
      url: 'https://example.com/personio-series-e',
      title: 'Personio raises Series E and adds payroll roles across Europe',
      snippet: 'Hiring continues across London, Dublin, Madrid, and Amsterdam.',
    },
  ]);
});

test('extractDigestArticleCandidates preserves title and snippet for single-line digest entries', () => {
  const digest = `
    Rippling raises $500M Series E – TechCrunch — https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Ftechcrunch.com%2F2023%2F03%2F14%2Frippling-raises-500m-series-e%2F&ct=ga — Rippling launched a Berlin engineering hub and payroll hiring across Germany and Ireland.
  `;

  assert.deepEqual(extractDigestArticleCandidates(digest), [
    {
      url: 'https://techcrunch.com/2023/03/14/rippling-raises-500m-series-e/',
      title: 'Rippling raises $500M Series E – TechCrunch',
      snippet:
        'Rippling launched a Berlin engineering hub and payroll hiring across Germany and Ireland.',
    },
  ]);
});

test('buildGoogleAlertScoringSystemPrompt aligns digest ingestion with the scoring methodology', () => {
  const prompt = buildGoogleAlertScoringSystemPrompt('ICP GOES HERE');

  assert.match(prompt, /Extract → Enrich → Score → Draft/);
  assert.match(prompt, /Review every candidate article URL from the digest/i);
  assert.match(prompt, /Expansion/);
  assert.match(prompt, /Consolidation/);
  assert.match(prompt, /5–30 country footprint|5-30 country footprint/);
  assert.match(prompt, /out-of-HQ hiring/i);
  assert.match(prompt, /ICP GOES HERE/);
});

test('buildGoogleAlertUserPrompt includes digest candidates and article bodies fallback', () => {
  const digest = `
    Example trigger title
    https://example.com/story
    Example snippet line
  `;
  const prompt = buildGoogleAlertUserPrompt(digest, []);

  assert.match(prompt, /DIGEST EMAIL:/);
  assert.match(prompt, /CANDIDATE ARTICLES FROM DIGEST:/);
  assert.match(prompt, /URL: https:\/\/example.com\/story/);
  assert.match(prompt, /TITLE: Example trigger title/);
  assert.match(prompt, /SNIPPET: Example snippet line/);
  assert.match(prompt, /FULL ARTICLE BODIES:/);
  assert.match(prompt, /none scraped/i);
});
