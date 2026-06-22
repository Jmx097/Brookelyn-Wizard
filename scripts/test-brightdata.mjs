const key = process.env.BRIGHTDATA_API_KEY;
const zone = process.env.BRIGHTDATA_SERP_ZONE || 'linkedin_v1';

if (!key) {
  console.error('Missing BRIGHTDATA_API_KEY');
  process.exit(1);
}

const query = 'site:linkedin.com/in "Stripe" ("CEO" OR "Chief Executive Officer")';
const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

const res = await fetch('https://api.brightdata.com/request', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    zone,
    url: googleUrl,
    format: 'json',
    data_format: 'parsed',
  }),
});

const text = await res.text();
let outer = null;
let inner = null;
try { outer = JSON.parse(text); } catch {}
try { inner = outer?.body ? JSON.parse(outer.body) : null; } catch {}

console.log(JSON.stringify({
  ok: res.ok,
  status: res.status,
  zone,
  outer_keys: outer && typeof outer === 'object' ? Object.keys(outer).slice(0, 20) : null,
  inner_keys: inner && typeof inner === 'object' ? Object.keys(inner).slice(0, 20) : null,
  inner_general: inner?.general ?? null,
  organic_count: Array.isArray(inner?.organic) ? inner.organic.length : null,
  organic_preview: Array.isArray(inner?.organic) ? inner.organic.slice(0, 3) : null,
  warning: outer?.headers?.['x-brd-serp-warn'] ?? null,
}, null, 2));
