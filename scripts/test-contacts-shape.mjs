import assert from 'node:assert/strict';

function extractOrganicResults(payloadText) {
  const outer = JSON.parse(payloadText);
  const inner = JSON.parse(outer.body);
  return inner.organic || [];
}

const samplePayload = JSON.stringify({
  status_code: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    general: { search_engine: 'google' },
    organic: [
      {
        link: 'https://www.linkedin.com/in/patrickcollison',
        title: 'Patrick Collison - Stripe CEO',
        description: 'Experience · Stripe Graphic. CEO. Stripe.',
      },
      {
        link: 'https://example.com/not-linkedin',
        title: 'Not linkedin',
        description: 'ignore this',
      },
    ],
  }),
});

const organic = extractOrganicResults(samplePayload);
assert.equal(Array.isArray(organic), true);
assert.equal(organic.length, 2);
assert.equal(organic[0].link, 'https://www.linkedin.com/in/patrickcollison');
console.log('PASS test-contacts-shape');
