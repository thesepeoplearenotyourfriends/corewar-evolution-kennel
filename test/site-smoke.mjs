import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('docs/index.html', 'utf8');
const app = fs.readFileSync('docs/app.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('docs/data/manifest.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('docs/data/kennel.json', 'utf8'));

const warriorsById = new Map();
const add = (warrior) => { if (warrior?.id && warrior.source && !warriorsById.has(warrior.id)) warriorsById.set(warrior.id, warrior); };
(data.warriors || []).forEach(add);
(data.latest?.warriors || []).forEach(add);
(data.generations || []).flatMap((generation) => generation.warriors || []).forEach(add);

assert.match(html, /<script type=module src=app\.js><\/script>/, 'page loads the browser module');
assert.match(app, /fetch\(loadedDataUrl, \{cache: 'no-store'\}\)/, 'app fetches kennel.json through cache-resistant URL');
assert.equal(manifest.snapshot, 'data/kennel.json', 'manifest points at kennel.json');
assert.equal(data.revision, manifest.revision, 'snapshot and manifest revisions match');
assert.ok(warriorsById.size >= 1, 'at least one warrior is available for both selectors');
assert.notEqual(`Latest generation ${data.latest?.generation ?? 0}. ${data.status} Latest epoch ${data.latest?.createdAt ?? data.builtAt}. Snapshot ${data.revision ?? 'unversioned'}.`, 'Dormant static terrarium.', 'status line changes from HTML fallback');
assert.ok((data.generations || []).some((generation) => (generation.warriors || generation.top || []).length > 0), 'fossil chain has visible entries');
assert.match(app, /document\.getElementById\('status'\)/, 'status uses explicit DOM binding');
assert.doesNotMatch(app, /\bstatus\.textContent\b/, 'app does not use bare status global');
console.log('site smoke ok');
