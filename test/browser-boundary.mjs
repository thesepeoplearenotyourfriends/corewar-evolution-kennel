import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden = /^(node:|fs$|path$|crypto$|node:fs|node:path|node:crypto)/;
const seen = new Set();
const visited = [];

function importsOf(file) {
  const source = fs.readFileSync(file, 'utf8');
  const imports = [];
  for (const match of source.matchAll(/import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) imports.push(match[1]);
  for (const match of source.matchAll(/import\(['"]([^'"]+)['"]\)/g)) imports.push(match[1]);
  return imports;
}

function walk(file) {
  const real = path.normalize(file);
  if (seen.has(real)) return;
  seen.add(real);
  visited.push(path.relative(root, real));
  for (const specifier of importsOf(real)) {
    assert.ok(!forbidden.test(specifier), `${path.relative(root, real)} imports Node-only module ${specifier}`);
    if (!specifier.startsWith('.')) continue;
    const next = path.resolve(path.dirname(real), specifier);
    assert.ok(next.startsWith(path.resolve(root, 'docs')), `${path.relative(root, real)} imports outside docs/: ${specifier}`);
    walk(next);
  }
}

walk(path.resolve(root, 'docs/app.js'));
const snapshot = JSON.parse(fs.readFileSync('docs/data/kennel.json', 'utf8'));
const published = [...(snapshot.warriors || []), ...((snapshot.latest?.warriors) || [])].filter(w => w?.source);
assert.ok(published.length > 0, 'published snapshot contains warriors');
assert.ok(published.some(w => w.warriorFacts?.genomeHash || w.genomeHash), 'published snapshot includes precomputed warrior semantic facts or hashes');
assert.ok(!fs.existsSync('docs/engine/describe-warrior.mjs'), 'Node semantic warrior describer is not published into docs/engine');
assert.ok(!fs.existsSync('docs/engine/describe-bout.mjs'), 'Node semantic bout describer is not published into docs/engine');
assert.ok(!fs.existsSync('docs/engine/describe-generation.mjs'), 'Node semantic generation describer is not published into docs/engine');
console.log(`browser boundary ok: ${visited.join(', ')}`);
