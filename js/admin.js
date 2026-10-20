import {
  loadData, normalize, esc, fmtDate, today, slugify,
  victorsOf, buildLeaderboard, initChrome, toast, ICONS,
} from './common.js';

const DRAFT_KEY = 'porotos-admin-draft';
const view = document.getElementById('view');
const status = document.getElementById('status');

let data;
let savedJson;          // what's on disk right now
let canSave = false;    // true when served by server.js
const sessionLog = new Set(); // changelog entries created since the last save
let flashId = null;

initChrome();

try {
  data = await loadData();
} catch (err) {
  view.innerHTML = `<div class="empty">${esc(err.message)}.<br>
    iniciá el servidor con <code>npm start</code> y abrí <code>http://localhost:3000/admin.html</code>.</div>`;
  throw err;
}
savedJson = serialize();

try {
  canSave = (await fetch('api/ping', { cache: 'no-store' })).ok;
} catch { canSave = false; }

restoreDraft();
render();

window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});

/* ---------- State --------------------------------------------------------- */

function serialize() {
  return JSON.stringify(data, null, 2) + '\n';
}

function isDirty() {
  return serialize() !== savedJson;
}

function changed() {
  try {
    if (isDirty()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: savedJson, data }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage unavailable: the draft just isn't kept */ }
  render();
}

function restoreDraft() {
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { draft = null; }
  if (!draft?.data) return;
  const draftJson = JSON.stringify(normalize(draft.data), null, 2) + '\n';
  if (draftJson === savedJson) return;
  const stale = draft.base !== savedJson;
  const msg = stale
    ? 'hay cambios sin guardar de una sesión anterior, pero el archivo cambió desde entonces. ¿restaurarlos igual? (pisarían el archivo actual al guardar)'
    : 'hay cambios sin guardar de una sesión anterior. ¿restaurarlos?';
  if (confirm(msg)) data = normalize(draft.data);
  else try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function allPlayers() {
  return buildLeaderboard(data.levels).map((p) => p.name);
}

/* ---------- Changelog ----------------------------------------------------- */

function logChange(type, level, from, to) {
  const mine = data.changelog.find((e) => sessionLog.has(e) && e.levelId === level.id);
  if (mine && type === 'move') {
    mine.to = to;
    if (mine.type === 'move' && mine.from === mine.to) removeLog(mine);
    return;
  }
  if (mine && type === 'remove' && mine.type === 'add') { removeLog(mine); return; }
  if (mine) removeLog(mine);
  const entry = { date: (type === 'add' && level.verifiedAt) || today(), type, level: level.name, levelId: level.id, from: mine?.type === 'move' ? mine.from : from, to };
  data.changelog.unshift(entry);
  sessionLog.add(entry);
}

function removeLog(entry) {
  data.changelog = data.changelog.filter((e) => e !== entry);
  sessionLog.delete(entry);
}

/* ---------- Mutations ----------------------------------------------------- */

function moveLevel(from, to) {
  to = Math.max(0, Math.min(data.levels.length - 1, to));
  if (from === to) return;
  const [level] = data.levels.splice(from, 1);
  data.levels.splice(to, 0, level);
  logChange('move', level, from + 1, to + 1);
  flashId = level.id;
  changed();
}

function removeLevel(index) {
  const level = data.levels[index];
  if (!confirm(`¿sacar "${level.name}" de la lista? se pierden sus completions.`)) return;
  data.levels.splice(index, 1);
  logChange('remove', level, index + 1, null);
  changed();
}

/* ---------- Saving -------------------------------------------------------- */

async function save() {
  const body = serialize();
  if (canSave) {
    try {
      const res = await fetch('api/levels', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      if (!res.ok) throw new Error(await res.text());
      savedJson = body;
      sessionLog.clear();
      changed();
      toast('guardado en data/levels.json');
      return;
    } catch (err) {
      toast(`no se pudo guardar: ${err.message}`, true);
      return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  a.download = 'levels.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('descargado: reemplazá data/levels.json con este archivo');
}

/* ---------- Render -------------------------------------------------------- */

function render() {
  const dirty = isDirty();
  document.getElementById('playerList').innerHTML = allPlayers().map((p) => `<option value="${esc(p)}">`).join('');

  view.innerHTML = `
    ${canSave ? '' : `<div class="notice">estás sin el servidor local, así que <b>guardar</b> descarga un <code>levels.json</code>
      que tenés que poner en <code>data/</code>. para guardar directo, corré <code>npm start</code>.</div>`}
    <div class="view-head">
      <h2>niveles</h2>
      <span class="grow"></span>
      <button class="btn" id="addLevel" type="button">${ICONS.plus}agregar nivel</button>
      <button class="btn green" id="saveBtn" type="button" title="ctrl+s" ${dirty ? '' : 'disabled'}>
        ${ICONS.save}${canSave ? 'guardar' : 'descargar json'}</button>
    </div>
    <div class="table admin">
      <div class="thead">
        <span></span><span>puesto</span><span>nivel</span><span class="c-creator">creador</span><span class="c-people num">victors</span><span></span>
      </div>
      <div id="adminList">
      ${data.levels.length ? data.levels.map((l, i) => `
        <div class="trow" data-i="${i}" data-id="${esc(l.id)}">
          <span class="grip" title="arrastrar">${ICONS.grip}</span>
          <input class="pos-input" type="number" min="1" max="${data.levels.length}" value="${i + 1}" aria-label="puesto de ${esc(l.name)}">
          <span class="cell lvl-name">${esc(l.name)}</span>
          <span class="cell soft c-creator">${esc(l.creator || '—')}</span>
          <span class="cell num c-people">${victorsOf(l).length}</span>
          <div class="actions">
            <button class="btn icon" data-act="up" title="subir" ${i === 0 ? 'disabled' : ''}>${ICONS.up}</button>
            <button class="btn icon" data-act="down" title="bajar" ${i === data.levels.length - 1 ? 'disabled' : ''}>${ICONS.down}</button>
            <button class="btn" data-act="comps" title="victors">${ICONS.people}victors</button>
            <button class="btn icon" data-act="edit" title="editar">${ICONS.edit}</button>
            <button class="btn icon red" data-act="del" title="sacar de la lista">${ICONS.trash}</button>
          </div>
        </div>`).join('')
      : '<div class="empty">lista vacía. tocá “agregar nivel” para arrancar.</div>'}
      </div>
    </div>`;

  status.innerHTML = `
    <span>${canSave ? 'servidor local conectado' : 'sin servidor (modo descarga)'}</span>
    <span class="grow"></span>
    <span>${dirty ? 'cambios sin guardar' : 'todo guardado'}</span>`;

  document.getElementById('addLevel').onclick = () => openLevelDialog(null);
  document.getElementById('saveBtn').onclick = save;

  const list = document.getElementById('adminList');
  list.querySelectorAll('.trow').forEach(wireRow);
  wireDrag(list);

  if (flashId) {
    const row = list.querySelector(`[data-id="${CSS.escape(flashId)}"]`);
    if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'nearest' }); }
    flashId = null;
  }
}

function wireRow(row) {
  const i = Number(row.dataset.i);
  const pos = row.querySelector('.pos-input');
  const commit = () => {
    const to = parseInt(pos.value, 10);
    if (Number.isFinite(to) && to !== i + 1) moveLevel(i, to - 1);
    else pos.value = i + 1;
  };
  pos.addEventListener('change', commit);
  pos.addEventListener('keydown', (e) => { if (e.key === 'Enter') pos.blur(); });

  row.querySelector('.actions').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'up') moveLevel(i, i - 1);
    else if (act === 'down') moveLevel(i, i + 1);
    else if (act === 'edit') openLevelDialog(i);
    else if (act === 'comps') openCompDialog(i);
    else if (act === 'del') removeLevel(i);
  });
}

function wireDrag(list) {
  let from = null;
  const clear = () => list.querySelectorAll('.drop-before, .drop-after').forEach((r) => r.classList.remove('drop-before', 'drop-after'));

  list.querySelectorAll('.trow').forEach((row) => {
    const grip = row.querySelector('.grip');
    grip.addEventListener('mousedown', () => { row.draggable = true; });
    row.addEventListener('dragstart', (e) => {
      from = Number(row.dataset.i);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(from));
    });
    row.addEventListener('dragend', () => { row.draggable = false; row.classList.remove('dragging'); clear(); from = null; });
  });

  const targetOf = (e) => {
    const row = e.target.closest('.trow');
    if (!row) return null;
    const box = row.getBoundingClientRect();
    return { row, after: e.clientY > box.top + box.height / 2 };
  };
  list.addEventListener('dragover', (e) => {
    if (from === null) return;
    const t = targetOf(e);
    if (!t) return;
    e.preventDefault();
    clear();
    t.row.classList.add(t.after ? 'drop-after' : 'drop-before');
  });
  list.addEventListener('drop', (e) => {
    if (from === null) return;
    const t = targetOf(e);
    if (!t) return;
    e.preventDefault();
    let to = Number(t.row.dataset.i) + (t.after ? 1 : 0);
    if (from < to) to -= 1;
    moveLevel(from, to);
  });
}

/* ---------- Level dialog -------------------------------------------------- */

const levelDialog = document.getElementById('levelDialog');
const levelForm = document.getElementById('levelForm');
let editing = null; // index being edited, or null when adding

function openLevelDialog(index) {
  editing = index;
  const level = index === null ? null : data.levels[index];
  levelForm.reset();
  document.getElementById('levelDialogTitle').textContent = level ? `editar · ${level.name}` : 'nuevo nivel';
  document.getElementById('levelSubmit').textContent = level ? 'guardar cambios' : 'agregar';
  document.getElementById('positionField').hidden = !!level;
  const f = levelForm.elements;
  if (level) {
    for (const k of ['name', 'creator', 'verifier', 'levelId', 'difficulty', 'video', 'verifiedAt', 'thumbnail', 'description']) {
      f[k].value = level[k] ?? '';
    }
  } else {
    f.position.value = data.levels.length + 1;
    f.position.max = data.levels.length + 1;
    f.verifiedAt.value = today();
  }
  levelDialog.showModal();
  f.name.focus();
}

levelForm.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'ok') return;
  const f = levelForm.elements;
  const fields = {};
  for (const k of ['name', 'creator', 'verifier', 'levelId', 'difficulty', 'video', 'verifiedAt', 'thumbnail', 'description']) {
    const v = f[k].value.trim();
    if (v) fields[k] = v;
  }
  if (editing === null) {
    const level = {
      id: slugify(fields.name, new Set(data.levels.map((l) => l.id))),
      ...fields,
      addedAt: today(),
      completions: [],
    };
    const pos = Math.max(1, Math.min(data.levels.length + 1, parseInt(f.position.value, 10) || data.levels.length + 1));
    data.levels.splice(pos - 1, 0, level);
    logChange('add', level, null, pos);
    flashId = level.id;
    toast(`"${level.name}" agregado en #${pos}`);
  } else {
    const level = data.levels[editing];
    for (const k of ['name', 'creator', 'verifier', 'levelId', 'difficulty', 'video', 'verifiedAt', 'thumbnail', 'description']) {
      if (fields[k]) level[k] = fields[k];
      else delete level[k];
    }
    flashId = level.id;
  }
  changed();
});

/* ---------- Completions dialog ------------------------------------------- */

const compDialog = document.getElementById('compDialog');
const compForm = document.getElementById('compForm');
let compIndex = null;

document.getElementById('compClose').onclick = () => compDialog.close();

function openCompDialog(index) {
  compIndex = index;
  compForm.reset();
  compForm.elements.date.value = today();
  paintComps();
  compDialog.showModal();
  compForm.elements.player.focus();
}

function paintComps() {
  const level = data.levels[compIndex];
  document.getElementById('compTitle').textContent = `victors · #${compIndex + 1} ${level.name}`;
  const victors = victorsOf(level);
  document.getElementById('compRows').innerHTML = `
    <div class="thead"><span>#</span><span>jugador</span><span class="c-date">fecha</span><span></span></div>
    ${victors.length ? victors.map((v, i) => `
    <div class="trow">
      <span class="soft">${i + 1}</span>
      <span class="cell">${esc(v.player)}${v.verifier ? '<span class="tag">verificador</span>' : ''}${v.video ? ` · <a href="${esc(v.video)}" target="_blank" rel="noopener">video</a>` : ''}</span>
      <span class="cell soft c-date">${fmtDate(v.date)}</span>
      ${v.verifier ? '<span></span>' : `<button class="btn icon red" data-player="${esc(v.player)}" title="borrar">${ICONS.trash}</button>`}
    </div>`).join('')
    : '<div class="empty">sin completions todavía.</div>'}`;
  document.querySelectorAll('#compRows [data-player]').forEach((btn) => {
    btn.onclick = () => {
      if (!confirm(`¿borrar la completion de ${btn.dataset.player}?`)) return;
      level.completions = level.completions.filter((c) => c.player !== btn.dataset.player);
      changed();
      paintComps();
    };
  });
}

compForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const level = data.levels[compIndex];
  const f = compForm.elements;
  const player = f.player.value.trim();
  if (!player) return;
  if (victorsOf(level).some((v) => v.player.toLowerCase() === player.toLowerCase())) {
    toast(`${player} ya figura en este nivel`, true);
    return;
  }
  const entry = { player, date: f.date.value || today() };
  if (f.video.value.trim()) entry.video = f.video.value.trim();
  level.completions.push(entry);
  level.completions.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  changed();
  paintComps();
  toast(`completion de ${player} agregada`);
  f.player.value = '';
  f.video.value = '';
  f.player.focus();
});

/* ---------- Settings dialog ---------------------------------------------- */

const settingsDialog = document.getElementById('settingsDialog');
const settingsForm = document.getElementById('settingsForm');

document.getElementById('openSettings').addEventListener('click', (e) => {
  e.preventDefault();
  const f = settingsForm.elements;
  f.title.value = data.meta.title || '';
  f.gdps.value = data.meta.gdps || '';
  f.info.value = (data.meta.info || []).join('\n\n');
  settingsDialog.showModal();
});

settingsForm.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'ok') return;
  const f = settingsForm.elements;
  data.meta.title = f.title.value.trim() || 'porotos list';
  data.meta.gdps = f.gdps.value.trim();
  delete data.meta.motto;
  data.meta.info = f.info.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  changed();
});
