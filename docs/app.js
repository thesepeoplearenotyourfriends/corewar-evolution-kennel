import {runMatch} from './engine/corewar-vm.mjs';

const DATA_MANIFEST_URL = 'data/manifest.json';
const DATA_SNAPSHOT_URL = 'data/kennel.json';
const FOSSIL_BATCH_SIZE = 5;

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
const chainToggle = document.getElementById('chain-toggle');
const chainMore = document.getElementById('chain-more');
const specimenEl = document.getElementById('specimen');
const generationRecordEl = document.getElementById('generation-record');
const arenaEl = document.getElementById('arena');
const sourceAEl = document.getElementById('srcA');
const sourceBEl = document.getElementById('srcB');
const sourceATitle = document.getElementById('srcA-title');
const sourceBTitle = document.getElementById('srcB-title');
const sourceAKind = document.getElementById('srcA-kind');
const sourceBKind = document.getElementById('srcB-kind');
const editorEl = document.getElementById('editor');
const reloadLocalButton = document.getElementById('reload-local');
const matchStatusEl = document.getElementById('match-status');
const matchInfoEl = document.getElementById('match-info');
const matchModeEl = document.getElementById('match-mode');
const errorEl = document.getElementById('init-error') ?? createErrorPanel();

let data;
let warriors = [];
let warriorById = new Map();
let selected = null;
let selectedGeneration = null;
let match = null;
let frame = 0;
let timer = null;
let loadedDataUrl = DATA_SNAPSHOT_URL;
let fossilExpanded = true;
let fossilVisibleCount = FOSSIL_BATCH_SIZE;
let localDirty = false;
let localLoadedFromId = null;
let matchStaleMessage = null;

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

function withCacheBust(url, revision) { const absolute = new URL(url, window.location.href); absolute.searchParams.set('v', String(revision ?? Date.now())); return absolute.href; }

function renderAll(previousSelectedId = selected?.id) {
  updateStatus();
  populateSelectors(previousSelectedId);
  renderChain();
  renderGenerationPanel(selectedGeneration ?? latestGeneration());
  const fallbackId = warriorASelect.value || warriors[0].id;
  show(warriorById.has(previousSelectedId) ? previousSelectedId : fallbackId, previousSelectedId);
  loadLocalFrom(warriorById.get(warriorBSelect.value) ?? warriors[1] ?? warriors[0], false);
  renderPublishedSources();
  drawEmptyArena();
  updateMatchControls();
}

function updateStatus() {
  const latest = data.latest ?? latestGeneration();
  statusEl.textContent = `Latest generation ${latest?.generation ?? 0}. ${data.status ?? 'Status unavailable'} Latest epoch ${latest?.createdAt ?? data.builtAt ?? 'unknown time'}. Snapshot ${data.revision ?? 'unversioned'}.`;
}

function populateSelectors(preferredId) {
  const previousLeft = warriorASelect.value || preferredId;
  const previousRight = warriorBSelect.value;
  warriors = sortedWarriors(warriors);
  warriorById = new Map(warriors.map((warrior) => [warrior.id, warrior]));
  const options = warriors.map((warrior) => `<option value="${escAttr(warrior.id)}">${esc(label(warrior))}</option>`).join('');
  warriorASelect.innerHTML = options;
  warriorBSelect.innerHTML = options;
  warriorASelect.value = warriorById.has(previousLeft) ? previousLeft : warriors[0].id;
  warriorBSelect.value = warriorById.has(previousRight) ? previousRight : (warriors[1]?.id ?? warriors[0].id);
}

function renderChain() {
  const generations = data.generations.length ? [...data.generations] : [{generation: 0, createdAt: data.builtAt, warriors}];
  const newestFirst = generations.sort((a, b) => Number(b.generation ?? 0) - Number(a.generation ?? 0));
  chainToggle.textContent = fossilExpanded ? '▾' : '>';
  chainToggle.setAttribute('aria-expanded', String(fossilExpanded));
  chainEl.hidden = !fossilExpanded;
  chainMore.hidden = !fossilExpanded || fossilVisibleCount >= newestFirst.length;
  chainEl.innerHTML = '';
  if (!fossilExpanded) return;
  for (const generation of newestFirst.slice(0, fossilVisibleCount)) {
    const card = document.createElement('div');
    card.className = 'card';
    const visibleWarriors = generationWarriors(generation);
    card.innerHTML = `<b>Generation ${esc(String(generation.generation ?? '?'))}</b><br><span class="muted">${esc(generation.createdAt || 'seed shelf')}</span>`;
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.textContent = 'Inspect generation record';
    inspect.addEventListener('click', () => renderGenerationPanel(generation));
    card.append(inspect);
    if (!visibleWarriors.length) card.append(Object.assign(document.createElement('p'), {textContent: 'No descendants recorded yet.'}));
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
  specimenEl.innerHTML = `${unavailable ? `<p class="notice">Previously selected specimen ${esc(requestedId)} is unavailable in this snapshot; showing ${esc(label(selected))}.</p>` : ''}<h3>${esc(label(selected))}</h3><p><b>Published read-only specimen</b></p><p>ID ${esc(selected.id)}; status ${esc(selected.status || (selected.protected ? 'fixed sentinel' : 'published specimen'))}; gen ${esc(String(selected.generation ?? 'sentinel'))}; parents ${esc((selected.parentIds || []).join(', ') || 'none')}; score ${esc(String(selected.score ?? 'n/a'))}; current league ${esc(recordText(selected.record))}; benchmark ${esc(recordText(selected.benchmarkRecord))}; genome ${esc(selected.genomeHash || selected.warriorFacts?.genomeHash || 'legacy')}</p>${retentionDetails(selected)}${careerDetails(selected)}<button type="button" id="copy-local">Edit local copy</button><pre>${esc((selected.source || '').slice(0, 1600))}</pre>`;
  document.getElementById('copy-local')?.addEventListener('click', () => loadLocalFrom(selected, true));
}

function renderPublishedSources(activePcs = []) {
  const left = warriorById.get(warriorASelect.value) ?? warriors[0];
  const right = warriorById.get(warriorBSelect.value) ?? warriors[1] ?? warriors[0];
  const rightSource = currentRightSource();
  const rightName = hasLocalChallenger() ? 'LOCAL CHALLENGER' : label(right).toUpperCase();
  sourceATitle.textContent = `LEFT WARRIOR · ${label(left).toUpperCase()}`;
  sourceBTitle.textContent = `RIGHT WARRIOR · ${rightName}`;
  sourceAKind.textContent = 'published specimen';
  sourceBKind.textContent = hasLocalChallenger() ? 'local challenger' : 'published specimen';
  sourceAEl.innerHTML = renderSource(left.source || '', activeLineFor(0, activePcs[0]));
  sourceBEl.innerHTML = renderSource(rightSource || '', activeLineFor(1, activePcs[1]));
  updateMatchMode();
}

function activeLineFor(index, pc) {
  if (!match || pc == null) return null;
  const source = index === 0 ? (warriorById.get(warriorASelect.value)?.source || '') : currentRightSource();
  const offset = modulo(pc - match.placements[index], coreSize());
  const map = instructionLineMap(source);
  if (offset < 0 || offset >= map.length) return null;
  return map[offset] ?? null;
}

function runBout() {
  stopTimer();
  const warriorA = warriorById.get(warriorASelect.value) ?? warriors[0];
  const warriorB = warriorById.get(warriorBSelect.value) ?? warriors[1] ?? warriors[0];
  const useLocal = hasLocalChallenger();
  const rightSource = useLocal ? editorEl.value : warriorB.source;
  match = runMatch({profileId: profileId(), warriors: [{id: warriorA.id, source: warriorA.source}, {id: useLocal ? 'local-challenger' : warriorB.id, source: rightSource}], seed: seedEl.value});
  match.names = [label(warriorA), useLocal ? 'Local challenger' : label(warriorB)];
  match.mode = useLocal ? 'published left warrior vs local challenger' : 'published left warrior vs published right warrior';
  matchStaleMessage = null;
  frame = 0;
  draw();
  updateMatchControls();
}

function drawEmptyArena(message = null) { match = null; matchStaleMessage = message; frame = 0; draw(); }

function draw() {
  const size = coreSize();
  const cellsPerTile = Math.ceil(size / 16);
  const activeEvent = match?.events[Math.max(0, frame - 1)];
  const classByCell = new Map();
  if (match) {
    match.placements.forEach((at, owner) => classByCell.set(at, `${classByCell.get(at) || ''} o${owner}`));
    for (const event of match.events.slice(0, frame)) {
      for (const write of event.write || []) classByCell.set(write.at, `${classByCell.get(write.at) || ''} o${write.owner}`);
    }
    if (activeEvent) classByCell.set(activeEvent.pc, `${classByCell.get(activeEvent.pc) || ''} ip${activeEvent.warrior}`);
  }
  arenaEl.innerHTML = Array.from({length: 16}, (_, tile) => {
    const start = tile * cellsPerTile;
    const end = Math.min(start + cellsPerTile, size);
    const cells = Array.from({length: end - start}, (_, offset) => {
      const index = start + offset;
      return `<span class="cell${classByCell.get(index) || ''}" title="cell ${index}"></span>`;
    }).join('');
    return `<section class="tile" aria-label="tile ${tile}, cells ${start}-${end - 1}"><span class="tile-label">${tile}</span><div class="tile-cells">${cells}</div></section>`;
  }).join('');
  renderPublishedSources(activeEvent ? [activeEvent.warrior === 0 ? activeEvent.pc : null, activeEvent.warrior === 1 ? activeEvent.pc : null] : []);
  updateMatchControls();
}

function updateMatchControls() {
  const exists = Boolean(match);
  playButton.disabled = !exists;
  stepButton.disabled = !exists;
  endButton.disabled = !exists;
  matchStatusEl.classList.toggle('left-win', exists && match.winner === 0);
  matchStatusEl.classList.toggle('right-win', exists && match.winner === 1);
  matchStatusEl.textContent = exists ? resultLine(match) : (matchStaleMessage || 'no match');
  matchInfoEl.innerHTML = exists ? whatHappened(match) : esc(matchStaleMessage || 'Create a bout to inspect current match details.');
}


function resultLine(bout) {
  if (bout.winner === 0 || bout.winner === 1) return `${bout.names[bout.winner].toUpperCase()} WINS · ${bout.cycles} cycles`;
  return `TIE · ${cycleLimit()}-cycle limit`;
}
function whatHappened(bout) {
  const desc = summarizeBout(bout);
  const lines = [esc(resultLine(bout)), ...desc.facts.map(esc)];
  lines.push(`Writes: ${esc(String(desc.writesBySide[0]))} — ${esc(String(desc.writesBySide[1]))}; births: ${esc(String(desc.processBirths[0]))} — ${esc(String(desc.processBirths[1]))}`);
  lines.push(`Replay: ${esc(String(frame))} / ${esc(String(bout.events.length))}`);
  lines.push(`<span class="muted">${esc(bout.mode)} · Seed ${esc(bout.seed)}</span>`);
  return lines.join('<br>');
}


function summarizeBout(bout) {
  const peak = [0, 0], births = [0, 0], writes = [0, 0];
  for (const ev of bout.events || []) {
    const q = ev.queues || [];
    for (let i = 0; i < 2; i++) peak[i] = Math.max(peak[i], (q[i] || 0) + (ev.warrior === i ? 1 : 0));
    if (ev.spawn !== null && ev.spawn !== undefined) births[ev.warrior]++;
    for (const write of ev.write || []) writes[write.owner]++;
  }
  for (let i = 0; i < 2; i++) peak[i] = Math.max(peak[i], bout.finalProcessCounts?.[i] || 0);
  return {
    writesBySide: writes,
    processBirths: births,
    facts: [
      bout.winner === null ? `Neither side eliminated the other before cycle ${bout.cycles}.` : `Warrior ${bout.winner} won at cycle ${bout.cycles}.`,
      `Final processes: ${bout.finalProcessCounts?.[0] ?? 0} and ${bout.finalProcessCounts?.[1] ?? 0}.`,
      `Peak processes: ${peak[0]} and ${peak[1]}.`
    ]
  };
}

function recordText(record) { return record ? `${record.wins || 0}W / ${record.ties || 0}D / ${record.losses || 0}L` : 'n/a'; }
function retentionDetails(warrior) {
  const reason = warrior.retentionReason || (warrior.protected ? 'status: fixed sentinel' : 'legacy specimen: no retention reason recorded');
  const ev = warrior.selectionEvidence;
  const facts = warrior.warriorFacts?.facts || warrior.semantic?.facts || [];
  return `<details><summary>Why retained</summary><p>${esc(reason)}</p>${ev?.summary ? `<p>${esc(ev.summary)}</p>` : ''}${counterEvidence(ev)}<ul>${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></details>`;
}
function counterEvidence(evidence) {
  const against = evidence?.against;
  if (!against) return '';
  const bouts = against.boutsDetail || [];
  return `<p><b>Direct counter series:</b> vs ${esc(against.opponentName || against.opponentId)} · ${esc(recordText(against.record))} across ${esc(String(against.bouts || bouts.length))} balanced bouts</p><details><summary>Counter-series bouts</summary><ul>${bouts.map(b => `<li>${esc(b.order || 'bout')} · seed ${esc(b.seed || '?')} · ${esc(b.result || (b.winner === null ? 'tie' : `w${b.winner}`))} · ${esc(String(b.cycles || '?'))} cycles</li>`).join('')}</ul></details>`;
}
function careerDetails(warrior) {
  const entries = (data.generations || []).flatMap(g => generationWarriors(g).filter(w => w.id === warrior.id).map(w => ({generation: g.generation, rank: (g.top || []).indexOf(w.id) + 1, reason: w.retentionReason || 'legacy generation', status: w.status || 'active'})));
  if (!entries.length) return '';
  return `<details><summary>Career</summary><ul>${entries.map(e => `<li>Gen ${esc(String(e.generation))} ${e.rank > 0 ? `#${e.rank}` : ''} · ${esc(e.status)} · ${esc(e.reason)}</li>`).join('')}</ul></details>`;
}
function renderGenerationPanel(generation) {
  selectedGeneration = generation;
  if (!generationRecordEl || !generation) return;
  generationRecordEl.innerHTML = generationRecord(generation);
}
function generationRecord(generation) {
  const selected = generation.selectionLedger?.selected || generationWarriors(generation);
  const retired = generation.selectionLedger?.retired || [];
  const legacy = !generation.schemaVersion || !generation.selectionLedger;
  return `<h3>Generation ${esc(String(generation.generation ?? '?'))} record</h3>${legacy ? '<p class="muted">Legacy generation: no selection ledger.</p>' : ''}<p>${esc(String(generation.candidateCount || 0))} candidates · ${summaryList('parents', generation.parentPool || [])} · ${summaryList('current league', generation.evaluation?.currentLeague || [])} · ${summaryList('stable benchmark', generation.evaluation?.stableBenchmark || [])}</p><details><summary>Raw corpus IDs</summary><p>Parents: ${esc((generation.parentPool || []).join(', ') || 'none')}</p><p>Current league: ${esc((generation.evaluation?.currentLeague || []).join(', ') || 'none')}</p><p>Stable benchmark: ${esc((generation.evaluation?.stableBenchmark || []).join(', ') || 'none')}</p></details><details open><summary>Retained</summary><ul>${selected.map(w => `<li>${esc(label(w))}: ${esc(w.retentionReason || 'active')} · league ${esc(recordText(w.record))} · benchmark ${esc(recordText(w.benchmarkRecord))}</li>`).join('') || '<li>none recorded</li>'}</ul></details><details><summary>Retired (${esc(String(retired.length))})</summary><ul>${retired.map(r => `<li>${esc(displayNameForId(r.id))}: ${esc(r.retirementReason || 'legacy retirement cause unavailable')}</li>`).join('') || '<li>none recorded</li>'}</ul></details>`;
}
function summaryList(name, ids) {
  const labels = ids.map(displayNameForId);
  const preview = labels.slice(0, 3).join(', ');
  return `${ids.length} ${name}${ids.length ? ` (${esc(preview)}${ids.length > 3 ? ', …' : ''})` : ''}`;
}
function displayNameForId(id) { return label(warriorById.get(id) || {id}); }

function cycleLimit() { return data.profiles?.[profileId()]?.maxCycles ?? data.config?.maxCycles ?? 'configured'; }
function invalidateMatch() { stopTimer(); drawEmptyArena('Selections changed · Run bout to create a new replay'); }

function updateMatchMode() { matchModeEl.textContent = hasLocalChallenger() ? `Run bout uses published left warrior vs local challenger${localLoadedFromId ? ` copied from ${label(warriorById.get(localLoadedFromId) ?? {id: localLoadedFromId})}` : ''}.` : 'Run bout uses published left warrior vs published right warrior.'; }
function hasLocalChallenger() { return localDirty && editorEl.value.trim().length > 0; }
function currentRightSource() { return hasLocalChallenger() ? editorEl.value : (warriorById.get(warriorBSelect.value)?.source || ''); }
function loadLocalFrom(warrior, dirty = true) { editorEl.value = warrior?.source || ''; localLoadedFromId = warrior?.id ?? null; localDirty = dirty; updateMatchMode(); }
function stopTimer() { if (timer) clearInterval(timer); timer = null; }
function profileId() { return data.config?.profileId ?? data.latest?.profileId ?? 'kennel94'; }
function coreSize() { const profile = data.profiles?.[profileId()]; if (!profile) throw new Error('Snapshot does not include the selected VM profile.'); return profile.coreSize; }
function modulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }
function instructionLineMap(source) { const map = []; source.split('\n').forEach((line, index) => { const trimmed = line.trim(); if (trimmed && !trimmed.startsWith(';') && !trimmed.toUpperCase().startsWith('ORG ')) map.push(index); }); return map; }
function renderSource(source, activeLine) { return source.split('\n').map((line, index) => `<span class="src-line${index === activeLine ? ' active' : ''}">${esc(line) || ' '}</span>`).join('\n'); }
function collectWarriors(snapshot) { const byId = new Map(); const add = (warrior) => { if (warrior?.id && !byId.has(warrior.id)) byId.set(warrior.id, warrior); }; (snapshot.warriors || []).forEach(add); (snapshot.latest?.warriors || []).forEach(add); (snapshot.generations || []).flatMap((generation) => generation.warriors || []).forEach(add); return sortedWarriors([...byId.values()].filter((warrior) => warrior.source)); }
function sortedWarriors(list) { return [...list].sort((a, b) => label(a).localeCompare(label(b), undefined, {sensitivity: 'base'}) || String(a.name || '').localeCompare(String(b.name || ''), undefined, {sensitivity: 'base'}) || String(a.id).localeCompare(String(b.id))); }
function generationWarriors(generation) { return (generation.warriors || generation.top || []).map((warrior) => typeof warrior === 'string' ? warriorById.get(warrior) : warrior).filter(Boolean); }
function latestGeneration() { return data.generations.at(-1) ?? null; }
function label(warrior) { return warrior?.displayName || warrior?.name || warrior?.id || 'unknown'; }
function esc(value) { return String(value).replace(/[&<>]/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[char])); }
function escAttr(value) { return esc(value).replace(/"/g, '&quot;'); }
function createErrorPanel() { const panel = document.createElement('section'); panel.id = 'init-error'; panel.className = 'error-panel'; panel.hidden = true; document.querySelector('main')?.prepend(panel); return panel; }
function hideInitError() { errorEl.hidden = true; errorEl.textContent = ''; }
function showInitError(title, error, attemptedUrl) { statusEl.textContent = 'Unable to initialize Core War Evolution Kennel.'; errorEl.hidden = false; errorEl.innerHTML = `<h2>${esc(title)}</h2><p>Attempted data URL: <code>${esc(attemptedUrl)}</code></p><pre>${esc(error?.stack || error?.message || error)}</pre>`; }

runButton.addEventListener('click', runBout);
stepButton.addEventListener('click', () => { if (!match) return; frame = Math.min(frame + 1, match.events.length); draw(); });
endButton.addEventListener('click', () => { if (!match) return; frame = match.events.length; draw(); });
playButton.addEventListener('click', () => { if (!match) return; if (timer) { stopTimer(); return; } timer = setInterval(() => { frame = Math.min(frame + 5, match.events.length); if (frame >= match.events.length) stopTimer(); draw(); }, 80); });
exportButton.addEventListener('click', () => { const blob = new Blob([editorEl.value], {type: 'text/plain'}); const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = 'local-challenger.red'; anchor.click(); URL.revokeObjectURL(anchor.href); });
warriorASelect.addEventListener('change', () => { show(warriorASelect.value); renderPublishedSources(); invalidateMatch(); });
warriorBSelect.addEventListener('change', () => { renderPublishedSources(); invalidateMatch(); });
editorEl.addEventListener('input', () => { localDirty = editorEl.value.trim().length > 0; renderPublishedSources(); invalidateMatch(); });
reloadLocalButton.addEventListener('click', () => loadLocalFrom(warriorById.get(warriorBSelect.value) ?? warriors[1] ?? warriors[0], true));
chainToggle.addEventListener('click', () => { fossilExpanded = !fossilExpanded; renderChain(); });
chainMore.addEventListener('click', () => { fossilVisibleCount += FOSSIL_BATCH_SIZE; renderChain(); });
