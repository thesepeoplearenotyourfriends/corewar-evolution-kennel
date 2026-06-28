import {runMatch} from './engine/corewar-vm.mjs';

const DATA_MANIFEST_URL = 'data/manifest.json';
const DATA_SNAPSHOT_URL = 'data/kennel.json';

const statusEl = document.getElementById('status');
const warriorASelect = document.getElementById('wA');
const warriorBSelect = document.getElementById('wB');
const seedEl = document.getElementById('seed');
const runButton = document.getElementById('run');
const playButton = document.getElementById('play');
const stepButton = document.getElementById('step');
const endButton = document.getElementById('end');
const exportButton = document.getElementById('export');
const chainEl = document.getElementById('chain');
const specimenEl = document.getElementById('specimen');
const arenaEl = document.getElementById('arena');
const logEl = document.getElementById('log');
const sourceAEl = document.getElementById('srcA');
const editorEl = document.getElementById('editor');
const errorEl = document.getElementById('init-error') ?? createErrorPanel();

let data;
let warriors = [];
let warriorById = new Map();
let selected = null;
let match = null;
let frame = 0;
let timer = null;
let loadedDataUrl = DATA_SNAPSHOT_URL;

try {
  data = await loadSnapshot();
  warriors = collectWarriors(data);
  warriorById = new Map(warriors.map((warrior) => [warrior.id, warrior]));
  if (!warriors.length) throw new Error('Site data contains no selectable warriors.');
  hideInitError();
  renderAll();
} catch (error) {
  showInitError('Initialization failed', error, loadedDataUrl);
}

async function loadSnapshot() {
  const manifestUrl = withCacheBust(DATA_MANIFEST_URL, Date.now());
  let manifest = null;
  try {
    const manifestResponse = await fetch(manifestUrl, {cache: 'no-store'});
    if (manifestResponse.ok) manifest = await manifestResponse.json();
  } catch (error) {
    console.warn('Could not load site-data manifest; falling back to direct snapshot.', error);
  }

  const revision = manifest?.revision ?? manifest?.snapshotRevision ?? manifest?.generation ?? Date.now();
  loadedDataUrl = withCacheBust(manifest?.snapshot ?? DATA_SNAPSHOT_URL, revision);
  const response = await fetch(loadedDataUrl, {cache: 'no-store'});
  if (!response.ok) throw new Error(`Failed to fetch ${loadedDataUrl}: HTTP ${response.status}`);
  const snapshot = await response.json();
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Snapshot is not a JSON object.');
  if (!Array.isArray(snapshot.generations)) throw new Error('Snapshot is missing generations[].');
  snapshot.revision ??= manifest?.revision ?? snapshot.latest?.generation ?? snapshot.builtAt ?? 'unversioned';
  return snapshot;
}

function withCacheBust(url, revision) {
  const absolute = new URL(url, window.location.href);
  absolute.searchParams.set('v', String(revision ?? Date.now()));
  return absolute.href;
}

function renderAll(previousSelectedId = selected?.id) {
  updateStatus();
  populateSelectors(previousSelectedId);
  renderChain();
  const fallbackId = warriorASelect.value || warriors[0].id;
  show(warriorById.has(previousSelectedId) ? previousSelectedId : fallbackId, previousSelectedId);
  runLocalSpar();
}

function updateStatus() {
  const latest = data.latest ?? latestGeneration();
  const generation = latest?.generation ?? 0;
  const epochTime = latest?.createdAt ?? data.builtAt ?? 'unknown time';
  const dormantState = data.status ?? 'Status unavailable';
  statusEl.textContent = `Latest generation ${generation}. ${dormantState} Latest epoch ${epochTime}. Snapshot ${data.revision ?? 'unversioned'}.`;
}

function populateSelectors(preferredId) {
  const options = warriors.map((warrior) => `<option value="${escAttr(warrior.id)}">${esc(label(warrior))}</option>`).join('');
  warriorASelect.innerHTML = options;
  warriorBSelect.innerHTML = options;
  warriorASelect.value = warriorById.has(preferredId) ? preferredId : warriors[0].id;
  warriorBSelect.value = warriors[1]?.id ?? warriors[0].id;
}

function renderChain() {
  chainEl.innerHTML = '';
  const generations = data.generations.length ? data.generations : [{generation: 0, createdAt: data.builtAt, warriors}];
  for (const generation of generations) {
    const card = document.createElement('div');
    card.className = 'card';
    const visibleWarriors = generationWarriors(generation);
    card.innerHTML = `<b>Generation ${esc(String(generation.generation ?? '?'))}</b><br>${esc(generation.createdAt || 'seed shelf')}`;
    if (!visibleWarriors.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No descendants recorded yet.';
      card.append(empty);
    }
    for (const warrior of visibleWarriors) {
      const button = document.createElement('button');
      button.className = warrior.displayName ? 'champ' : '';
      button.textContent = label(warrior);
      button.addEventListener('click', () => show(warrior.id));
      card.append(button);
    }
    chainEl.append(card);
  }
}

function show(id, requestedId = id) {
  selected = warriorById.get(id) ?? warriors[0];
  const unavailable = requestedId && requestedId !== selected.id && !warriorById.has(requestedId);
  specimenEl.innerHTML = `${unavailable ? `<p class="notice">Previously selected specimen ${esc(requestedId)} is unavailable in this snapshot; showing ${esc(label(selected))}.</p>` : ''}<h3>${esc(label(selected))}</h3><p><b>ARCHIVED WARRIOR</b></p><p>ID ${esc(selected.id)}; gen ${esc(String(selected.generation ?? 'sentinel'))}; parents ${esc((selected.parentIds || []).join(', ') || 'none')}; score ${esc(String(selected.score ?? 'n/a'))}; record ${esc(JSON.stringify(selected.record || {}))}; tags ${esc((selected.tags || []).join(', '))}</p><button type="button" id="copy-local">Edit local copy</button><pre>${esc((selected.source || '').slice(0, 1600))}</pre>`;
  document.getElementById('copy-local')?.addEventListener('click', () => { editorEl.value = selected.source || ''; });
  sourceAEl.textContent = selected.source || '';
  if (!editorEl.value.trim()) editorEl.value = selected.source || '';
}

function runLocalSpar() {
  const warriorA = warriorById.get(warriorASelect.value) ?? warriors[0];
  const fallbackB = warriorById.get(warriorBSelect.value) ?? warriors[1] ?? warriors[0];
  const challengerSource = editorEl.value.trim() ? editorEl.value : fallbackB.source;
  match = runMatch({profileId: data.config?.profileId ?? data.latest?.profileId ?? 'kennel94', warriors: [{id: warriorA.id, source: warriorA.source}, {id: 'local-challenger', source: challengerSource}], seed: seedEl.value});
  frame = 0;
  logEl.textContent = `LOCAL SPAR\n${match.result} in ${match.cycles} cycles\nBrowser-only. Not submitted, not ranked, not retained.`;
  draw();
}

function draw() {
  const profile = data.profiles?.[data.config?.profileId ?? data.latest?.profileId ?? 'kennel94'];
  if (!profile) throw new Error('Snapshot does not include the selected VM profile.');
  arenaEl.innerHTML = Array.from({length: profile.coreSize}, (_, i) => `<div class="cell" id="c${i}"></div>`).join('');
  for (const event of (match ? match.events.slice(0, frame) : [])) {
    for (const write of event.write || []) document.getElementById(`c${write.at}`)?.classList.add(`o${write.owner}`);
    document.getElementById(`c${event.pc}`)?.classList.add(`ip${event.warrior}`);
  }
}

function collectWarriors(snapshot) {
  const byId = new Map();
  const add = (warrior) => { if (warrior?.id && !byId.has(warrior.id)) byId.set(warrior.id, warrior); };
  (snapshot.warriors || []).forEach(add);
  (snapshot.latest?.warriors || []).forEach(add);
  (snapshot.generations || []).flatMap((generation) => generation.warriors || []).forEach(add);
  return [...byId.values()].filter((warrior) => warrior.source);
}
function generationWarriors(generation) { return (generation.warriors || generation.top || []).map((warrior) => typeof warrior === 'string' ? warriorById.get(warrior) : warrior).filter(Boolean); }
function latestGeneration() { return data.generations.at(-1) ?? null; }
function label(warrior) { return warrior.displayName || warrior.name || warrior.id; }
function esc(value) { return String(value).replace(/[&<>]/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[char])); }
function escAttr(value) { return esc(value).replace(/"/g, '&quot;'); }
function createErrorPanel() { const panel = document.createElement('section'); panel.id = 'init-error'; panel.className = 'error-panel'; panel.hidden = true; document.querySelector('main')?.prepend(panel); return panel; }
function hideInitError() { errorEl.hidden = true; errorEl.textContent = ''; }
function showInitError(title, error, attemptedUrl) { statusEl.textContent = 'Unable to initialize Core War Evolution Kennel.'; errorEl.hidden = false; errorEl.innerHTML = `<h2>${esc(title)}</h2><p>Attempted data URL: <code>${esc(attemptedUrl)}</code></p><pre>${esc(error?.stack || error?.message || error)}</pre>`; }

runButton.addEventListener('click', runLocalSpar);
stepButton.addEventListener('click', () => { if (!match) runLocalSpar(); frame = Math.min(frame + 1, match.events.length); draw(); });
endButton.addEventListener('click', () => { if (!match) runLocalSpar(); frame = match.events.length; draw(); });
playButton.addEventListener('click', () => { if (timer) { clearInterval(timer); timer = null; return; } if (!match) runLocalSpar(); timer = setInterval(() => { frame += 5; if (frame >= match.events.length) { frame = match.events.length; clearInterval(timer); timer = null; } draw(); }, 80); });
exportButton.addEventListener('click', () => { const blob = new Blob([editorEl.value], {type: 'text/plain'}); const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = 'local-challenger.red'; anchor.click(); URL.revokeObjectURL(anchor.href); });
warriorASelect.addEventListener('change', () => show(warriorASelect.value));
warriorBSelect.addEventListener('change', () => { if (!editorEl.value.trim()) editorEl.value = warriorById.get(warriorBSelect.value)?.source || ''; });
