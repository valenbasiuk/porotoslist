import {
  loadData, esc, ytId, thumbFor, fmtDate, diffCell, rankOrb, pointsFor,
  victorsOf, buildLeaderboard, enjoymentOf, initChrome, ICONS,
} from './common.js';

const view = document.getElementById('view');
let data;
let query = '';

initChrome();

try {
  data = await loadData();
} catch (err) {
  view.innerHTML = `<div class="empty">${esc(err.message)}.<br>
    abrí la página con el servidor (<code>npm start</code>), no con doble click.</div>`;
  throw err;
}

document.getElementById('siteTitle').textContent = data.meta.title;
document.title = data.meta.title;
renderStatus();
window.addEventListener('hashchange', route);
route();

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const page = parts[0] || 'list';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === page || (page === 'level' && a.dataset.nav === 'list'));
  });
  if (page === 'level') renderLevel(parts[1]);
  else if (page === 'leaderboard') renderLeaderboard();
  else if (page === 'novedades') renderChangelog();
  else if (page === 'info') renderInfo();
  else renderList();
  view.scrollTop = 0;
}

function renderStatus() {
  document.getElementById('status').innerHTML = `
    <span class="grow"></span>
    ${data.meta.gdps ? `<span>${esc(data.meta.gdps)}</span>` : ''}`;
}

/* ---------- List ---------------------------------------------------------- */

function renderList() {
  view.innerHTML = `
    <div class="view-head">
      <h2>niveles</h2>
      <span class="grow"></span>
      <input class="search" type="search" placeholder="buscar" value="${esc(query)}" aria-label="buscar">
    </div>
    <div class="table levels">
      <div class="thead">
        <span>#</span><span></span><span>nivel</span><span class="c-creator">creador</span><span class="c-verifier">verificador</span><span class="c-diff">dificultad</span><span class="c-people num">victors</span>
      </div>
      <div id="levelRows"></div>
    </div>`;
  const input = view.querySelector('.search');
  input.addEventListener('input', () => { query = input.value; paintRows(); });
  paintRows();
}

function paintRows() {
  const rows = document.getElementById('levelRows');
  if (!data.levels.length) {
    rows.innerHTML = '<div class="empty">la lista está vacía. agregá niveles desde <code>admin.html</code>.</div>';
    return;
  }
  const q = query.trim().toLowerCase();
  const items = data.levels
    .map((level, i) => ({ level, rank: i + 1 }))
    .filter(({ level }) => !q || [level.name, level.creator, level.verifier, level.levelId]
      .some((v) => String(v ?? '').toLowerCase().includes(q)));
  if (!items.length) {
    rows.innerHTML = `<div class="empty">ningún nivel coincide con “${esc(query)}”.</div>`;
    return;
  }
  rows.innerHTML = items.map(({ level, rank }) => {
    const thumb = thumbFor(level);
    return `
      <a class="trow" href="#/level/${encodeURIComponent(level.id)}">
        ${rankOrb(rank)}
        <div class="thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : '<span class="no-video">sin video</span>'}</div>
        <span class="cell lvl-name">${esc(level.name)}</span>
        <span class="cell soft c-creator">${esc(level.creator || '—')}</span>
        <span class="cell soft c-verifier">${esc(level.verifier || '—')}</span>
        <span class="cell">${diffCell(level.difficulty)}</span>
        <span class="cell num people c-people">${ICONS.people}${victorsOf(level).length}</span>
      </a>`;
  }).join('');
}

/* ---------- Level page ---------------------------------------------------- */

function renderLevel(id) {
  const index = data.levels.findIndex((l) => l.id === id);
  if (index < 0) {
    view.innerHTML = `<div class="empty">nivel no encontrado.<br><br><a class="btn" href="#/">${ICONS.back}volver</a></div>`;
    return;
  }
  const level = data.levels[index];
  const rank = index + 1;
  const vid = ytId(level.video);
  const thumb = thumbFor(level);
  const victors = victorsOf(level);
  const enjoy = enjoymentOf(level);

  const media = vid
    ? `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(level.name)}"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
    : `<div class="video-frame thumb${thumb ? '' : ' novid'}">${thumb ? `<img src="${esc(thumb)}" alt="">` : '<span class="no-video">sin video de verificación</span>'}</div>`;

  const props = [
    ['creador', esc(level.creator || '—')],
    ['verificador', esc(level.verifier || '—')],
    ['id del nivel', esc(level.levelId || '—')],
    ['dificultad', diffCell(level.difficulty) || '—'],
    ['puntos', pointsFor(rank)],
    ['agregado', fmtDate(level.addedAt)],
  ];

  const enjoyBox = `
    <div class="box">
      <div class="box-title">enjoyment</div>
      <div class="table enjoy">${enjoy
        ? `<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${enjoy.avg}"><i style="width:${enjoy.avg * 10}%"></i></div>
           <span class="enjoy-score">${enjoy.avg}<span class="soft">/10</span></span>
           <span class="soft">promedio de ${enjoy.count} ${enjoy.count === 1 ? 'jugador' : 'jugadores'}</span>`
        : '<span class="soft">nadie puntuó este nivel todavía.</span>'}
      </div>
    </div>`;

  view.innerHTML = `
    <a class="btn" href="#/">${ICONS.back}lista</a>
    <div class="detail-head">${rankOrb(rank, true)}<h2>${esc(level.name)}</h2></div>
    ${media}
    ${level.description ? `<div class="table prose" style="margin-top:12px">${esc(level.description)}</div>` : ''}
    <div class="box">
      <div class="box-title">propiedades</div>
      <div class="table kv">${props.map(([k, v]) => `
        <div class="trow"><span class="k">${k}</span><span class="cell">${v}</span></div>`).join('')}
      </div>
    </div>
    ${enjoyBox}
    <div class="box">
      <div class="box-title">victors (${victors.length})</div>
      <div class="table victors">
        <div class="thead"><span>#</span><span>jugador</span><span class="num">enjoyment</span><span class="c-date">fecha</span><span></span></div>
        ${victors.length ? victors.map((v, i) => `
          <div class="trow">
            <span class="soft">${i + 1}</span>
            <span class="cell">${esc(v.player)}${v.verifier ? '<span class="tag">verificador</span>' : ''}</span>
            <span class="cell num">${typeof v.enjoyment === 'number' ? `${v.enjoyment}<span class="soft">/10</span>` : '<span class="soft">—</span>'}</span>
            <span class="cell soft c-date">${fmtDate(v.date)}</span>
            ${v.video ? `<a href="${esc(v.video)}" target="_blank" rel="noopener">video</a>` : '<span></span>'}
          </div>`).join('')
        : '<div class="empty">nadie se lo pasó todavía.</div>'}
      </div>
    </div>`;
}

/* ---------- Leaderboard --------------------------------------------------- */

function renderLeaderboard() {
  const board = buildLeaderboard(data.levels);
  view.innerHTML = `
    <div class="view-head"><h2>leaderboard</h2></div>
    <div class="table board">
      <div class="thead">
        <span>#</span><span>jugador</span><span class="c-count num">niveles</span><span class="c-hardest">más difícil</span><span class="num">puntos</span>
      </div>
      ${board.length ? board.map((p, i) => {
        const hardest = p.entries.reduce((a, b) => (b.rank < a.rank ? b : a));
        return `
          <div class="trow clickable" data-i="${i}" tabindex="0" role="button" aria-expanded="false">
            ${rankOrb(i + 1)}
            <span class="cell">${esc(p.name)}</span>
            <span class="cell num soft c-count">${p.entries.length}</span>
            <span class="cell soft c-hardest">${esc(hardest.level.name)}</span>
            <span class="cell num pts">${p.points}</span>
          </div>
          <div class="board-detail" id="lb-${i}" hidden>
            ${p.entries.sort((a, b) => a.rank - b.rank).map((e) => `
              <div><a href="#/level/${encodeURIComponent(e.level.id)}">#${e.rank} ${esc(e.level.name)}</a>
                <span class="soft">· ${e.pts} pts</span>${e.verifier ? '<span class="tag">verificador</span>' : ''}</div>`).join('')}
          </div>`;
      }).join('')
      : '<div class="empty">todavía no hay completions.</div>'}
    </div>`;
  view.querySelectorAll('.trow.clickable').forEach((row) => {
    const toggle = () => {
      const det = document.getElementById(`lb-${row.dataset.i}`);
      det.hidden = !det.hidden;
      row.setAttribute('aria-expanded', String(!det.hidden));
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });
}

/* ---------- Changelog ----------------------------------------------------- */

function renderChangelog() {
  // Newest day first; within a day, the order set in the admin.
  const sorted = [...data.changelog].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const byDay = new Map();
  for (const entry of sorted) {
    if (!byDay.has(entry.date)) byDay.set(entry.date, []);
    byDay.get(entry.date).push(entry);
  }
  const text = (e) => {
    const current = data.levels.find((l) => l.id === e.levelId);
    const name = current
      ? `<a href="#/level/${encodeURIComponent(current.id)}"><b>${esc(current.name)}</b></a>`
      : `<b>${esc(e.level)}</b>`;
    if (e.type === 'add') return `${name} fue agregado en el top #${e.to}`;
    if (e.type === 'remove') return `${name} salió de la lista (estaba #${e.from})`;
    if (e.type === 'move') return `${name} ${e.to < e.from ? 'subió' : 'bajó'} de #${e.from} a #${e.to}`;
    return name;
  };
  view.innerHTML = `
    <div class="view-head"><h2>novedades</h2></div>
    ${byDay.size ? [...byDay].map(([date, entries]) => `
      <div class="day-head">${fmtDate(date)}</div>
      <div class="table changes">${entries.map((e) => `
        <div class="trow"><span class="dot ${esc(e.type)}"></span><span class="cell">${text(e)}</span></div>`).join('')}
      </div>`).join('')
    : '<div class="table empty">sin novedades por ahora.</div>'}`;
}

/* ---------- Info ---------------------------------------------------------- */

function renderInfo() {
  const paragraphs = (data.meta.info || []).map((p) => `<p>${esc(p)}</p>`).join('');
  view.innerHTML = `
    <div class="view-head"><h2>info</h2></div>
    <div class="table prose">
      ${paragraphs}
      <p>cada nivel da <b>${pointsFor(1)}</b> puntos en el #1 y va bajando un 8% por puesto
        (#5: ${pointsFor(5)}, #10: ${pointsFor(10)}, #25: ${pointsFor(25)}). el verificador también suma.</p>
    </div>`;
}
