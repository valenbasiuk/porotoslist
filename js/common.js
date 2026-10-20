// Shared helpers for the public list and the admin panel.

export const DATA_URL = 'data/levels.json';

export const DIFFICULTIES = {
  easy:    { label: 'easy demon',    color: '#38b6ff' },
  medium:  { label: 'medium demon',  color: '#3fcf5e' },
  hard:    { label: 'hard demon',    color: '#ffae2b' },
  insane:  { label: 'insane demon',  color: '#ff4f8b' },
  extreme: { label: 'extreme demon', color: '#a052ff' },
};

// Points a completion of the level at `rank` (1-based) is worth.
export function pointsFor(rank) {
  return Math.round(250 * Math.pow(0.92, rank - 1) * 10) / 10;
}

export async function loadData() {
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`no se pudo cargar ${DATA_URL} (${res.status})`);
  return normalize(await res.json());
}

export function normalize(data) {
  data = data && typeof data === 'object' ? data : {};
  data.meta = Object.assign({ title: 'porotos list', info: [] }, data.meta);
  data.levels = Array.isArray(data.levels) ? data.levels : [];
  data.changelog = Array.isArray(data.changelog) ? data.changelog : [];
  for (const l of data.levels) {
    l.completions = Array.isArray(l.completions) ? l.completions : [];
  }
  return data;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function ytId(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function thumbFor(level) {
  if (level.thumbnail) return level.thumbnail;
  const id = ytId(level.video);
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return esc(iso);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

export function slugify(name, taken) {
  const base = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nivel';
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

// Everyone who beat a level, verifier first.
export function victorsOf(level) {
  const out = [];
  const seen = new Set();
  if (level.verifier) {
    out.push({ player: level.verifier, date: level.verifiedAt || level.addedAt, video: level.video, enjoyment: level.verifierEnjoyment, verifier: true });
    seen.add(level.verifier.toLowerCase());
  }
  for (const c of level.completions) {
    if (!c.player || seen.has(c.player.toLowerCase())) continue;
    seen.add(c.player.toLowerCase());
    out.push(c);
  }
  return out;
}

// Average enjoyment (0-10) over the victors who gave one, or null.
export function enjoymentOf(level) {
  const scores = victorsOf(level).map((v) => v.enjoyment).filter((n) => typeof n === 'number');
  if (!scores.length) return null;
  return { avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10, count: scores.length };
}

export function parseEnjoyment(value) {
  const n = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? Math.min(10, Math.max(0, Math.round(n * 10) / 10)) : null;
}

export function buildLeaderboard(levels) {
  const players = new Map();
  levels.forEach((level, i) => {
    const rank = i + 1;
    for (const v of victorsOf(level)) {
      const key = v.player.toLowerCase();
      if (!players.has(key)) players.set(key, { name: v.player, points: 0, entries: [] });
      const p = players.get(key);
      const pts = pointsFor(rank);
      p.points += pts;
      p.entries.push({ level, rank, pts, verifier: !!v.verifier });
    }
  });
  return [...players.values()]
    .map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function demonFace(color = '#a052ff') {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 1.5 8.6 8 4.8 10.2Z M21 1.5 15.4 8 19.2 10.2Z" fill="${color}" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="12" cy="14" r="8.3" fill="${color}" stroke="#111" stroke-width="1.4"/>
    <ellipse cx="9.5" cy="10.3" rx="3.6" ry="1.6" fill="#fff" opacity=".45"/>
    <path d="M6.8 11.6 10.8 13.4 7.6 14.8Z M17.2 11.6 13.2 13.4 16.4 14.8Z" fill="#fff" stroke="#111" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M8.4 18.6Q12 16.2 15.6 18.6" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

export function diffCell(key) {
  const d = DIFFICULTIES[key];
  if (!d) return '';
  return `<span class="diff" title="${esc(d.label)}">${demonFace(d.color)}<span>${esc(d.label)}</span></span>`;
}

export function rankOrb(rank, big = false) {
  return `<span class="rank${big ? ' big' : ''}">${rank}</span>`;
}

// Colour icons (Vista-ish) for the sidebar.
export const NAV_ICONS = {
  cube: `<svg viewBox="0 0 16 16"><defs><linearGradient id="niCube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2ff8a"/><stop offset="1" stop-color="#46b61f"/></linearGradient></defs>
    <rect x="1.5" y="1.5" width="13" height="13" rx="1" fill="url(#niCube)" stroke="#1f4d0e"/>
    <rect x="4.3" y="4.3" width="7.4" height="7.4" fill="#5fe3ff" stroke="#1f4d0e" stroke-width=".8"/>
    <rect x="5.4" y="5.6" width="1.7" height="1.7" fill="#1f4d0e"/><rect x="8.9" y="5.6" width="1.7" height="1.7" fill="#1f4d0e"/>
    <rect x="5.6" y="9" width="4.8" height="1.2" fill="#1f4d0e"/></svg>`,
  trophy: `<svg viewBox="0 0 16 16"><defs><linearGradient id="niTro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#f3c021"/><stop offset="1" stop-color="#a86d00"/></linearGradient></defs>
    <path d="M4 1.5h8v1.5h2.5v2A3 3 0 0 1 11.6 8 4 4 0 0 1 9 10.3V12h2v2.5H5V12h2v-1.7A4 4 0 0 1 4.4 8 3 3 0 0 1 1.5 5V3H4zM2.7 4.2V5a1.8 1.8 0 0 0 1.4 1.7L4 4.2zm10.6 0H12l-.1 2.5A1.8 1.8 0 0 0 13.3 5z" fill="url(#niTro)" stroke="#7a4f00" stroke-width=".7" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 16 16"><defs><linearGradient id="niStar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff59a"/><stop offset="1" stop-color="#ff9d00"/></linearGradient></defs>
    <path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5l-4.2 2.3 1-4.6L1.3 6l4.7-.5z" fill="url(#niStar)" stroke="#a65a00" stroke-width=".8" stroke-linejoin="round"/></svg>`,
  info: `<svg viewBox="0 0 16 16"><defs><radialGradient id="niInfo" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#bfe6ff"/><stop offset=".6" stop-color="#2b8be0"/><stop offset="1" stop-color="#0d4f9c"/></radialGradient></defs>
    <circle cx="8" cy="8" r="6.8" fill="url(#niInfo)" stroke="#0b3f7d" stroke-width=".8"/>
    <rect x="7" y="6.8" width="2" height="5" rx=".4" fill="#fff"/><circle cx="8" cy="4.7" r="1.15" fill="#fff"/></svg>`,
  gear: `<svg viewBox="0 0 16 16"><defs><linearGradient id="niGear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f6"/><stop offset="1" stop-color="#7f8a96"/></linearGradient></defs>
    <path d="M6.9 1h2.2l.4 1.8 1.3.6 1.6-1 1.5 1.5-1 1.6.6 1.3 1.8.4v2.2l-1.8.4-.6 1.3 1 1.6-1.5 1.5-1.6-1-1.3.6-.4 1.8H6.9l-.4-1.8-1.3-.6-1.6 1-1.5-1.5 1-1.6-.6-1.3L1 9.1V6.9l1.8-.4.6-1.3-1-1.6 1.5-1.5 1.6 1 1.3-.6z" fill="url(#niGear)" stroke="#4b5560" stroke-width=".7" stroke-linejoin="round"/>
    <circle cx="8" cy="8" r="2.3" fill="#fff" stroke="#4b5560" stroke-width=".7"/></svg>`,
  globe: `<svg viewBox="0 0 16 16"><defs><radialGradient id="niGlobe" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d6f3ff"/><stop offset=".6" stop-color="#3aa0e8"/><stop offset="1" stop-color="#11589e"/></radialGradient></defs>
    <circle cx="8" cy="8" r="6.8" fill="url(#niGlobe)" stroke="#0b3f7d" stroke-width=".8"/>
    <path d="M4 4.2c1.5.2 2 1.3 1.6 2.2-.5 1 .9 1.6.5 2.8-.3 1-1.2 1.2-1 2.6C3.4 10.6 2.5 7 4 4.2zM9 2.4c1 .6 2.5.4 3.4 1.6.8 1-.4 1.9-1.4 1.6-1.1-.3-1.9.6-1.2 1.6.8 1 2.3.6 3.2 1.6.3 2-1.3 4-3 4.6.2-1.4 1.1-2.4.2-3.5-.8-1-2.3-.6-2.4-2-.1-1.2 1.6-1.4 1.2-2.6C8.8 4.6 8 3.6 9 2.4z" fill="#5bc84a" stroke="#2c7a1f" stroke-width=".5"/></svg>`,
  sun: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.4" fill="#ffd23a" stroke="#b07a00" stroke-width=".7"/><path d="M8 .8v2.4M8 12.8v2.4M.8 8h2.4M12.8 8h2.4M2.9 2.9l1.7 1.7M11.4 11.4l1.7 1.7M2.9 13.1l1.7-1.7M11.4 4.6l1.7-1.7" stroke="#e7a400" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  moon: `<svg viewBox="0 0 16 16"><path d="M10 1.4A6.8 6.8 0 1 0 14.8 11 5.6 5.6 0 0 1 10 1.4z" fill="#e8eef8" stroke="#6f7f96" stroke-width=".8"/></svg>`,
};

// Monochrome action icons (use currentColor).
export const ICONS = {
  edit: '<svg viewBox="0 0 24 24"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 19l-7-8h4.5V5h5v6H19z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M4 3h13l3 3v15H4zm3 2v5h9V5zm5 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M11 5l-7 7 7 7v-4.5h9v-5h-9z"/></svg>',
  people: '<svg viewBox="0 0 24 24"><path d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM1 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5zm16.5 0c0-2-.7-3.8-2-5 3.6-.3 7.5 1.2 7.5 5z"/></svg>',
  grip: '<svg viewBox="0 0 10 16"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>',
};

const LOGO_SVG = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="beanG" cx="38%" cy="30%" r="75%">
      <stop offset="0" stop-color="#f4ffe8"/><stop offset=".25" stop-color="#9eea6f"/>
      <stop offset=".7" stop-color="#36b33a"/><stop offset="1" stop-color="#14661f"/>
    </radialGradient>
    <linearGradient id="beanHi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="M33 5c12 0 24 8 24 22 0 10-7 13-9 21-2 8-9 12-17 12C17 60 7 50 7 36 7 25 14 23 16 16 18 9 24 5 33 5z" fill="url(#beanG)" stroke="#0f5a1c" stroke-width="1.6"/>
  <path d="M33 8.5c8 0 17 4.5 19 13-6-5-17-6-26-2.5-4 1.5-8 1-8-1 2-6 8-9.5 15-9.5z" fill="url(#beanHi)"/>
</svg>`;

// Logo (common/logo.png if present, otherwise the built-in bean), icons and theme button.
export function initChrome() {
  const slot = document.getElementById('logoSlot');
  if (slot) {
    const img = new Image();
    img.className = 'logo';
    img.alt = '';
    img.onload = () => slot.replaceWith(img);
    img.onerror = () => { slot.outerHTML = LOGO_SVG; };
    img.src = 'common/logo.png';
  }

  document.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = NAV_ICONS[el.dataset.icon]; });

  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('porotos-theme'); } catch { /* storage unavailable */ }
  if (saved === 'night') root.dataset.theme = 'night';

  const btn = document.getElementById('themeToggle');
  if (btn) {
    const paint = () => {
      const night = root.dataset.theme === 'night';
      btn.innerHTML = night ? `${NAV_ICONS.sun}tema día` : `${NAV_ICONS.moon}tema noche`;
    };
    paint();
    btn.addEventListener('click', () => {
      if (root.dataset.theme === 'night') delete root.dataset.theme;
      else root.dataset.theme = 'night';
      try { localStorage.setItem('porotos-theme', root.dataset.theme || 'day'); } catch { /* ignore */ }
      paint();
    });
  }
}

let toastTimer;
export function toast(msg, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('err', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
