'use strict';
/* TeamSheet – lokale voetbal-PWA. Geen account, geen backend. */

const APP_VERSION = '1.4';
const THEME_KEY = 'teamsheet_theme';
const SAVED_KEY = 'teamsheet_saved_lineups_v1';
const POSITIONS = ['Keeper','Centrale verdediger','Linksback','Rechtsback','Middenvelder','Linksmidden','Rechtsmidden','Aanvallende middenvelder','Linksbuiten','Rechtsbuiten','Spits'];
const POS_ABBR = {'Keeper':'K','Centrale verdediger':'CV','Linksback':'LV','Rechtsback':'RV','Middenvelder':'M','Linksmidden':'LM','Rechtsmidden':'RM','Aanvallende middenvelder':'AM','Linksbuiten':'LB','Rechtsbuiten':'RB','Spits':'SP'};
const FORMATIONS = {'4-3-3':[1,4,3,3],'4-4-2':[1,4,4,2],'4-2-3-1':[1,4,2,3,1],'3-5-2':[1,3,5,2],'4-3-2-1':[1,4,3,2,1]};
const MATCH_LENGTH = 90;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const pad = (n) => String(n).padStart(2, '0');
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function matchDate(m) { return new Date((m.date || todayStr()) + 'T' + (m.time || '00:00')); }
function fmtDate(m, opts) { return matchDate(m).toLocaleDateString('nl-NL', opts || {day:'numeric', month:'long', year:'numeric'}); }
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { /* niet ondersteund */ } }
function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- iconen ---------- */
const ICONS = {
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4.5 2 4.5 4.5"/>',
  lineup: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3"/>',
  matches: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  stats: '<path d="M5 21V11M12 21V4M19 21v-8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10zM12 7V3M16 10l4-1.5M14.5 14.5l2.5 3.5M9.5 14.5L7 18M8 10L4 8.5"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/>',
  down: '<path d="M12 4v14M6 12l6 6 6-6"/>',
  up: '<path d="M12 20V6M6 12l6-6 6 6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>'
};
const ic = (n, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

/* ---------- opslag (IndexedDB, fallback localStorage) ---------- */
let dbPromise = null;
function idb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('geen IndexedDB')); return; }
    const req = indexedDB.open('teamsheet', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function newLineup(f) { return {formation: FORMATIONS[f] ? f : '4-3-3', positions: Array(11).fill(null), bench: [], coords: Array(11).fill(null), layouts: {}, captain: null}; }
function defaultState() {
  return {
    version: 1,
    team: {id: uid(), name: 'Mijn team', logo: null},
    settings: {defaultFormation: '4-3-3'},
    players: [], matches: [], events: [], minutes: {},
    lineups: {default: newLineup('4-3-3')}
  };
}
function normalize(s) {
  const d = defaultState();
  const o = Object.assign(d, s || {});
  o.team = Object.assign(defaultState().team, (s && s.team) || {});
  o.settings = Object.assign(defaultState().settings, (s && s.settings) || {});
  if (!FORMATIONS[o.settings.defaultFormation]) o.settings.defaultFormation = '4-3-3';
  ['players', 'matches', 'events'].forEach((k) => { if (!Array.isArray(o[k])) o[k] = []; });
  o.players.forEach((p) => { if (!('photo' in p) || p.photo === undefined) p.photo = null; p.stats = cleanStats(p.stats); });
  if (!o.minutes || typeof o.minutes !== 'object') o.minutes = {};
  if (!o.lineups || typeof o.lineups !== 'object') o.lineups = {};
  if (!o.lineups.default) o.lineups.default = newLineup(o.settings.defaultFormation);
  Object.keys(o.lineups).forEach((k) => {
    const l = o.lineups[k] || newLineup('4-3-3');
    if (!FORMATIONS[l.formation]) l.formation = '4-3-3';
    const pos = Array.isArray(l.positions) ? l.positions : [];
    l.positions = Array.from({length: 11}, (_, i) => pos[i] || null);
    l.bench = Array.isArray(l.bench) ? l.bench : [];
    const cs = Array.isArray(l.coords) ? l.coords : [];
    l.coords = Array.from({length: 11}, (_, i) => validXY(cs[i]));
    if (!l.layouts || typeof l.layouts !== 'object') l.layouts = {};
    if (!l.captain) l.captain = null;
    o.lineups[k] = l;
  });
  return o;
}

let state = defaultState();
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 120); }
async function persist() {
  clearTimeout(saveTimer);
  try { await idbSet('state', state); }
  catch (e) {
    try { localStorage.setItem('teamsheet_state', JSON.stringify(state)); }
    catch (e2) { toast('Opslaan mislukt – maak een backup via Instellingen'); }
  }
}
async function loadState() {
  try {
    const s = await idbGet('state');
    if (s) return normalize(s);
  } catch (e) { /* val terug op localStorage */ }
  try {
    const raw = localStorage.getItem('teamsheet_state');
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* negeer */ }
  return defaultState();
}

/* ---------- domeinlogica ---------- */
const P = (id) => state.players.find((p) => p.id === id) || null;
const fullName = (p) => p ? (p.firstName + ' ' + (p.lastName || '')).trim() : 'Onbekende speler';
const shortName = (p) => p ? (p.firstName || p.lastName) : '?';
function myScore(m) { return m.homeAway === 'uit' ? m.awayScore : m.homeScore; }
function oppScore(m) { return m.homeAway === 'uit' ? m.homeScore : m.awayScore; }
function setScores(m, my, opp) {
  my = Math.max(0, Math.min(99, my)); opp = Math.max(0, Math.min(99, opp));
  if (m.homeAway === 'uit') { m.awayScore = my; m.homeScore = opp; } else { m.homeScore = my; m.awayScore = opp; }
}
function outcome(m) {
  if (m.status !== 'afgerond') return null;
  const a = myScore(m), b = oppScore(m);
  return a > b ? 'w' : a === b ? 'd' : 'l';
}

function formationSlots(name) {
  const lines = FORMATIONS[name] || FORMATIONS['4-3-3'];
  const n = lines.length, out = [];
  lines.forEach((count, li) => {
    const y = 90 - li * (78 / Math.max(n - 1, 1));
    const step = count <= 3 ? 27 : Math.min(24, 80 / Math.max(count - 1, 1));
    const role = li === 0 ? 'K' : li === 1 ? 'VER' : li === n - 1 ? 'AAN' : 'MID';
    for (let j = 0; j < count; j++) {
      out.push({x: count === 1 ? 50 : 50 + (j - (count - 1) / 2) * step, y, role});
    }
  });
  return out;
}

function lineupRemove(l, pid) {
  l.positions = l.positions.map((x) => (x === pid ? null : x));
  l.coords = l.coords.map((c, i) => (l.positions[i] ? c : null));
  l.bench = l.bench.filter((x) => x !== pid);
  if (l.captain === pid) l.captain = null;
}
function lineupBench(l, pid) { lineupRemove(l, pid); l.bench.push(pid); }
function lineupMove(l, pid, slot) {
  if (l.positions[slot] === pid) return;
  const occ = l.positions[slot];
  let from = null;
  const si = l.positions.indexOf(pid);
  if (si >= 0) { from = {t: 'slot', i: si}; l.positions[si] = null; }
  else {
    const bi = l.bench.indexOf(pid);
    if (bi >= 0) { from = {t: 'bench', i: bi}; l.bench.splice(bi, 1); }
  }
  l.positions[slot] = pid;
  if (occ) {
    if (from && from.t === 'slot') l.positions[from.i] = occ;
    else if (from && from.t === 'bench') l.bench.splice(Math.min(from.i, l.bench.length), 0, occ);
  } else if (from && from.t === 'slot') {
    l.coords[from.i] = null;
  }
}
function getLineup(key) {
  if (!state.lineups[key]) state.lineups[key] = newLineup(state.settings.defaultFormation);
  const l = state.lineups[key];
  const ids = new Set(state.players.map((p) => p.id));
  l.positions = l.positions.map((x) => (x && ids.has(x) ? x : null));
  l.bench = l.bench.filter((x) => ids.has(x));
  l.coords = l.coords.map((c, i) => (l.positions[i] ? c : null));
  if (l.captain && !l.positions.includes(l.captain) && !l.bench.includes(l.captain)) l.captain = null;
  return l;
}
function curLineup() {
  const key = (ui.lineupKey !== 'default' && state.matches.some((m) => m.id === ui.lineupKey)) ? ui.lineupKey : 'default';
  ui.lineupKey = key;
  return getLineup(key);
}

/* vrije posities: alle coördinaten zijn percentages van het veld (0–100) */
const PITCH_RATIO = 105 / 68; // veldhoogte / veldbreedte
function validXY(c) {
  if (!c || !isFinite(c.x) || !isFinite(c.y)) return null;
  return {x: Math.max(0, Math.min(100, +c.x)), y: Math.max(0, Math.min(100, +c.y))};
}
function clampXY(x, y) {
  return {x: Math.round(Math.max(7, Math.min(93, x)) * 10) / 10, y: Math.round(Math.max(6, Math.min(94, y)) * 10) / 10};
}
function slotXY(l, i) { return l.coords[i] || formationSlots(l.formation)[i]; }
function setFormation(l, f) {
  if (!FORMATIONS[f] || f === l.formation) return;
  l.layouts = l.layouts || {};
  l.layouts[l.formation] = l.coords.slice();
  l.formation = f;
  const saved = l.layouts[f];
  l.coords = Array.from({length: 11}, (_, i) => ((saved && saved[i] && l.positions[i]) ? saved[i] : null));
}
/* plaatst een speler van de bank/beschikbaar op een vrij punt op het veld */
function placeFree(l, pid, x, y) {
  const p = clampXY(x, y);
  let hit = -1, best = 8;
  l.positions.forEach((id, i) => {
    if (!id) return;
    const c = slotXY(l, i);
    const d = Math.hypot(c.x - p.x, (c.y - p.y) * PITCH_RATIO);
    if (d < best) { best = d; hit = i; }
  });
  if (hit >= 0) { lineupMove(l, pid, hit); return true; }
  const defs = formationSlots(l.formation);
  let empty = -1, bd = 1e9;
  l.positions.forEach((id, i) => {
    if (id) return;
    const d = Math.hypot(defs[i].x - p.x, (defs[i].y - p.y) * PITCH_RATIO);
    if (d < bd) { bd = d; empty = i; }
  });
  if (empty < 0) return false;
  lineupMove(l, pid, empty);
  l.coords[empty] = bd < 6 ? null : p;
  return true;
}

/* ---------- opgeslagen opstellingen (localStorage, eigen sleutel) ---------- */
let savedLineups = [];
function validSaved(s) { return !!s && typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.players); }
function loadSaved() {
  try {
    const a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(a) ? a.filter(validSaved) : [];
  } catch (e) { return []; }
}
function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; }
  catch (e) { toast('Opslaan van opstelling mislukt'); return false; }
}
function snapshotLineup(l, name, id) {
  return {
    id: id || uid(), name, formation: l.formation, captainId: l.captain || null,
    players: l.positions.map((pid, i) => {
      if (!pid) return null;
      const c = slotXY(l, i);
      return {playerId: pid, slot: i, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10};
    }).filter(Boolean),
    bench: l.bench.slice(), layouts: clone(l.layouts || {}), savedAt: new Date().toISOString()
  };
}
function applySaved(l, sv) {
  const ids = new Set(state.players.map((p) => p.id));
  let missing = 0;
  l.formation = FORMATIONS[sv.formation] ? sv.formation : '4-3-3';
  l.positions = Array(11).fill(null);
  l.coords = Array(11).fill(null);
  (sv.players || []).forEach((e) => {
    if (!ids.has(e.playerId)) { missing++; return; }
    const i = +e.slot;
    if (i >= 0 && i < 11 && !l.positions[i]) { l.positions[i] = e.playerId; l.coords[i] = validXY(e); }
  });
  l.bench = (sv.bench || []).filter((id) => ids.has(id) && !l.positions.includes(id));
  l.captain = (sv.captainId && (l.positions.includes(sv.captainId) || l.bench.includes(sv.captainId))) ? sv.captainId : null;
  l.layouts = clone(sv.layouts || {});
  return missing;
}

function removePlayer(id) {
  savedLineups.forEach((sv) => {
    sv.players = (sv.players || []).filter((e) => e.playerId !== id);
    sv.bench = (sv.bench || []).filter((x) => x !== id);
    if (sv.captainId === id) sv.captainId = null;
  });
  writeSaved(savedLineups);
  state.players = state.players.filter((p) => p.id !== id);
  Object.values(state.lineups).forEach((l) => lineupRemove(l, id));
  state.events = state.events.filter((e) => e.playerId !== id && e.outPlayerId !== id);
  state.events.forEach((e) => { if (e.assistPlayerId === id) e.assistPlayerId = null; });
  Object.values(state.minutes).forEach((m) => { delete m[id]; });
}
function removeMatch(id) {
  state.matches = state.matches.filter((m) => m.id !== id);
  delete state.lineups[id]; delete state.minutes[id];
  state.events = state.events.filter((e) => e.matchId !== id);
  if (ui.lineupKey === id) ui.lineupKey = 'default';
}

function participants(matchId) {
  const l = getLineup(matchId);
  const ids = l.positions.filter(Boolean).concat(l.bench);
  const list = ids.map(P).filter(Boolean);
  return (list.length ? list : state.players.slice()).sort((a, b) => a.number - b.number);
}
function autoMinutes(m, overwrite) {
  const l = getLineup(m.id);
  const evs = state.events.filter((e) => e.matchId === m.id);
  const mins = state.minutes[m.id] || (state.minutes[m.id] = {});
  const starters = new Set(l.positions.filter(Boolean));
  const all = new Set(l.positions.filter(Boolean).concat(l.bench));
  all.forEach((pid) => {
    let start = 0;
    if (!starters.has(pid)) {
      const ins = evs.filter((e) => e.type === 'substitution' && e.playerId === pid).map((e) => e.minute);
      if (!ins.length) return;
      start = Math.min.apply(null, ins);
    }
    let end = MATCH_LENGTH;
    const outs = evs.filter((e) => e.type === 'substitution' && e.outPlayerId === pid && e.minute >= start).map((e) => e.minute);
    const reds = evs.filter((e) => e.type === 'redCard' && e.playerId === pid && e.minute >= start).map((e) => e.minute);
    outs.concat(reds).forEach((v) => { end = Math.min(end, v); });
    if (overwrite || !mins[pid]) mins[pid] = Math.max(0, end - start);
  });
}

function computeStats() {
  const per = {};
  state.players.forEach((p) => { per[p.id] = {id: p.id, matches: 0, starts: 0, subs: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0}; });
  const team = {played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0};
  state.matches.filter((m) => m.status === 'afgerond').forEach((m) => {
    const l = state.lineups[m.id];
    const mins = state.minutes[m.id] || {};
    const evs = state.events.filter((e) => e.matchId === m.id);
    const subIn = new Set(evs.filter((e) => e.type === 'substitution').map((e) => e.playerId));
    if (l) {
      l.positions.filter(Boolean).forEach((pid) => {
        const s = per[pid]; if (!s) return;
        s.matches++; s.starts++; s.minutes += mins[pid] || 0;
      });
      l.bench.forEach((pid) => {
        const s = per[pid]; if (!s) return;
        if (subIn.has(pid) || (mins[pid] || 0) > 0) { s.matches++; s.subs++; s.minutes += mins[pid] || 0; }
      });
    }
    evs.forEach((e) => {
      const s = per[e.playerId];
      if (e.type === 'goal') {
        if (s) s.goals++;
        const a = e.assistPlayerId && per[e.assistPlayerId];
        if (a) a.assists++;
      } else if (e.type === 'yellowCard' && s) s.yellow++;
      else if (e.type === 'redCard' && s) s.red++;
    });
    team.played++; team.gf += myScore(m); team.ga += oppScore(m);
    const o = outcome(m);
    if (o === 'w') team.won++; else if (o === 'd') team.drawn++; else team.lost++;
  });
  return {per, team};
}

/* ---------- statistieken (v1.4) ----------
 * Elke speler heeft p.stats (standaard 0 = handmatige bijstelling). De getoonde waarde is altijd
 *   totaal = automatisch uit afgeronde wedstrijden + p.stats
 * Met + / − of typen wijzig je het totaal; de app past p.stats zo aan dat het totaal klopt.
 * Zo gaat er niets verloren en blijven wedstrijdregistraties gewoon meetellen. */
const STAT_KEYS = ['matches', 'starts', 'subs', 'minutes', 'goals', 'assists', 'yellow', 'red', 'cleanSheets', 'goalsAgainst', 'saves'];
const STAT_LABEL = {matches: 'Wedstrijden', starts: 'Basisplaatsen', subs: 'Wisselbeurten', minutes: 'Minuten', goals: 'Goals', assists: 'Assists', yellow: 'Gele kaarten', red: 'Rode kaarten', cleanSheets: 'Clean sheets', goalsAgainst: 'Tegendoelpunten', saves: 'Reddingen'};
const STAT_STEP = {minutes: 5};
function cleanStats(st) {
  const o = {};
  STAT_KEYS.forEach((k) => {
    const n = Math.round(Number(st && st[k]));
    o[k] = Number.isFinite(n) ? Math.max(-99999, Math.min(99999, n)) : 0;
  });
  return o;
}
function totalsFor(p, per) {
  const a = (per && per[p.id]) || {};
  const m = p.stats || {};
  const o = {};
  STAT_KEYS.forEach((k) => { o[k] = Math.max(0, (a[k] || 0) + (m[k] || 0)); });
  return o;
}
function setStatTotal(p, key, target, per) {
  const auto = ((per || computeStats().per)[p.id] || {})[key] || 0;
  if (!p.stats) p.stats = cleanStats({});
  p.stats[key] = Math.max(0, Math.min(99999, Math.round(target))) - auto;
}
function isKeeper(p) { return p.position === 'Keeper'; }
function relevantStatKeys(p, t) {
  if (isKeeper(p)) {
    const k = ['matches', 'starts', 'subs', 'minutes', 'cleanSheets', 'goalsAgainst', 'saves'];
    if (t.goals) k.push('goals');
    if (t.assists) k.push('assists');
    return k.concat(['yellow', 'red']);
  }
  return ['matches', 'starts', 'subs', 'minutes', 'goals', 'assists', 'yellow', 'red'];
}
function allTotals() {
  const {per, team} = computeStats();
  return {per, team, rows: state.players.map((p) => ({p, t: totalsFor(p, per)}))};
}
function teamTotals(rows, team) {
  const sum = (k) => rows.reduce((a, r) => a + r.t[k], 0);
  const maxM = rows.reduce((a, r) => Math.max(a, r.t.matches), 0);
  return {matches: Math.max(team.played, maxM), goals: sum('goals'), assists: sum('assists'), yellow: sum('yellow'), red: sum('red'), cleanSheets: sum('cleanSheets')};
}
function statSortedRows(rows) {
  const key = ui.statSort;
  return rows.slice().sort((a, b) => (b.t[key] - a.t[key]) || (b.t.goals - a.t.goals) || (a.p.number - b.p.number));
}
function topRows(rows, key, n) {
  return rows.filter((r) => r.t[key] > 0).sort((a, b) => (b.t[key] - a.t[key]) || (b.t.goals - a.t.goals) || (a.p.number - b.p.number)).slice(0, n);
}
function seasonLabel(d) {
  const dt = d || new Date(); const y = dt.getFullYear();
  const st = dt.getMonth() >= 6 ? y : y - 1;
  return st + '/' + String(st + 1).slice(2);
}

/* ---------- afbeeldingen ---------- */
function resizeImage(file, size, mode, type) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const g = c.getContext('2d');
        const w = img.naturalWidth, h = img.naturalHeight;
        if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); }
        const k = mode === 'cover' ? Math.max(size / w, size / h) : Math.min(size / w, size / h);
        const dw = w * k, dh = h * k;
        g.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        resolve(c.toDataURL(type, 0.82));
      } catch (e) { reject(e); }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Afbeelding niet leesbaar')); };
    img.src = url;
  });
}

/* ---------- UI-state ---------- */
const ui = {tab: 'team', sub: null, modal: null, sel: null, lineupKey: 'default', openedSaved: null, sort: 'nummer', q: '', statSort: 'goals', statOrder: null};
let resetScroll = false;
let formTmp = {};
let confirmResolve = null;

function render() {
  const main = $('#main');
  const st = resetScroll ? 0 : main.scrollTop;
  const strips = $$('.strip').map((s) => s.scrollLeft);
  $('#header').innerHTML = headerHTML();
  main.innerHTML = viewHTML();
  $('#nav').innerHTML = navHTML();
  main.scrollTop = st;
  $$('.strip').forEach((s, i) => { if (strips[i]) s.scrollLeft = strips[i]; });
  resetScroll = false;
}
function goTab(t) { ui.tab = t; ui.sub = null; ui.sel = null; resetScroll = true; render(); }
function goSub(type, id) { ui.sub = {type, id}; resetScroll = true; render(); }
function back() { ui.sub = null; resetScroll = true; render(); }

function headerHTML() {
  if (ui.sub) {
    const t = ui.sub.type === 'settings' ? 'Instellingen' : ui.sub.type === 'player' ? 'Spelerprofiel' : ui.sub.type === 'pstats' ? 'Spelerstatistieken' : 'Wedstrijd';
    return '<button class="hbtn" data-act="back" aria-label="Terug">' + ic('back') + '</button><div class="htitle">' + t + '</div><span class="hbtn ph"></span>';
  }
  const logo = state.team.logo ? '<img src="' + state.team.logo + '" alt="">' : '<span class="logo-ball">' + ic('ball', 'sm') + '</span>';
  return '<div class="brand">' + logo + '<div><b>TeamSheet</b><small>' + esc(state.team.name) + '</small></div></div>' +
    '<button class="hbtn" data-act="settings" aria-label="Instellingen">' + ic('gear') + '</button>';
}
function navHTML() {
  const items = [['team', 'Team', 'team'], ['lineup', 'Opstelling', 'lineup'], ['matches', 'Wedstrijden', 'matches'], ['stats', 'Statistieken', 'stats']];
  return items.map((i) => '<button data-tab="' + i[0] + '" class="' + (!ui.sub && ui.tab === i[0] ? 'on' : (ui.sub && ui.tab === i[0] && ui.sub.type !== 'settings' ? 'on' : '')) + '" aria-label="' + i[1] + '">' + ic(i[2]) + '<span>' + i[1] + '</span></button>').join('');
}
function viewHTML() {
  if (ui.sub) {
    if (ui.sub.type === 'player') return playerDetailHTML(ui.sub.id);
    if (ui.sub.type === 'match') return matchDetailHTML(ui.sub.id);
    if (ui.sub.type === 'pstats') return pstatsHTML(ui.sub.id);
    return settingsHTML();
  }
  if (ui.tab === 'lineup') return lineupHTML();
  if (ui.tab === 'matches') return matchesHTML();
  if (ui.tab === 'stats') return statsHTML();
  return teamHTML();
}

/* ---------- onderdelen ---------- */
function avatar(p, size) {
  const s = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px';
  if (p && p.photo) return '<img class="avatar" style="' + s + '" src="' + p.photo + '" alt="">';
  const ini = p ? ((p.firstName || '?')[0] + ((p.lastName || '')[0] || '')).toUpperCase() : '?';
  return '<div class="avatar" style="' + s + '">' + esc(ini) + '</div>';
}
function isCaptain(id) { const l0 = state.lineups[ui.lineupKey] || state.lineups.default; return !!l0 && l0.captain === id; }
function chipHTML(p, selected, drag) {
  const cap = isCaptain(p.id) ? '<i class="cap">C</i>' : '';
  const face = p.photo
    ? '<div class="num ph"><img src="' + p.photo + '" alt="" draggable="false"><b class="nb">' + esc(p.number) + '</b>' + cap + '</div>'
    : '<div class="num">' + esc(p.number) + cap + '</div>';
  const st = STATUS_LABEL[p.status] ? '<div class="st">● ' + STATUS_LABEL[p.status] + '</div>' : '';
  return '<div class="chip' + (selected ? ' sel' : '') + '" data-chip="' + p.id + '"' + (drag ? ' data-drag="' + p.id + '"' : '') + '>' + face + '<div class="nm">' + esc(shortName(p)) + '</div>' + st + '</div>';
}
function statTiles(s, hl, four) {
  const t = [['matches', 'Wedstrijden', s.matches], ['starts', 'Basis', s.starts], ['subs', 'Ingevallen', s.subs], ['goals', 'Doelpunten', s.goals], ['assists', 'Assists', s.assists], ['yellow', 'Gele kaarten', s.yellow], ['red', 'Rode kaarten', s.red], ['minutes', 'Minuten', s.minutes]];
  return '<div class="tiles four">' + t.map((x) => '<div class="tile' + (hl === x[0] ? ' hl' : '') + '"><b>' + x[2] + '</b><span>' + x[1] + '</span></div>').join('') + '</div>';
}
const STATUS_LABEL = {blessure: 'Geblesseerd', afwezig: 'Afwezig'};
function statusTag(p) { return STATUS_LABEL[p.status] ? ' · <span style="color:var(--red);font-weight:700">● ' + STATUS_LABEL[p.status] + '</span>' : ''; }
function emptyState(icon, text, btn, act) {
  return '<div class="card empty"><div class="big">' + icon + '</div><p>' + text + '</p><button class="btn" data-act="' + act + '">' + btn + '</button></div>';
}

/* ---------- TEAM ---------- */
function filteredPlayers() {
  const q = ui.q.trim().toLowerCase();
  let list = state.players.filter((p) => !q || (fullName(p).toLowerCase().includes(q) || String(p.number) === q || p.position.toLowerCase().includes(q)));
  const cmp = {
    nummer: (a, b) => a.number - b.number,
    naam: (a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName, 'nl'),
    positie: (a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || a.number - b.number
  }[ui.sort];
  return list.sort(cmp);
}
function playerListHTML() {
  const list = filteredPlayers();
  if (!list.length) return '<p class="muted" style="text-align:center;padding:24px 0">Geen spelers gevonden.</p>';
  return '<div class="list">' + list.map((p) =>
    '<button class="card rowcard" data-act="player" data-id="' + p.id + '">' + avatar(p, 50) +
    '<div class="mid"><div class="nm">' + esc(fullName(p)) + '</div><div class="ps">' + esc(p.position) + statusTag(p) + '</div></div>' +
    '<div class="bignum">' + esc(p.number) + '</div></button>').join('') + '</div>';
}
function teamHTML() {
  const head = '<h1>Mijn team</h1><p class="sub">' + esc(state.team.name) + ' · ' + state.players.length + ' speler' + (state.players.length === 1 ? '' : 's') + '</p>';
  if (!state.players.length) {
    return '<div class="page">' + head + '<div style="margin-top:16px">' + emptyState('👟', 'Je hebt nog geen spelers toegevoegd.', '+ Eerste speler toevoegen', 'addPlayer') + '</div></div>';
  }
  const sorts = [['nummer', 'Rugnummer'], ['naam', 'Naam'], ['positie', 'Positie']];
  return '<div class="page">' + head +
    '<button class="btn" style="margin-top:16px" data-act="addPlayer">+ Speler toevoegen</button>' +
    '<button class="btn sec" style="margin-top:10px" data-act="openStats">📊 Statistieken</button>' +
    '<input class="search" id="q" type="search" placeholder="Zoek speler…" value="' + esc(ui.q) + '" autocomplete="off">' +
    '<div class="pills">' + sorts.map((s) => '<button class="pill' + (ui.sort === s[0] ? ' on' : '') + '" data-act="sort" data-v="' + s[0] + '">' + s[1] + '</button>').join('') + '</div>' +
    '<div id="playerList" style="margin-top:6px">' + playerListHTML() + '</div></div>';
}
function playerDetailHTML(id) {
  const p = P(id);
  if (!p) return '<div class="page"><p class="muted">Speler niet gevonden.</p></div>';
  const s = totalsFor(p, computeStats().per);
  return '<div class="page stack"><div class="card" style="text-align:center">' + avatar(p, 108) +
    '<h2 style="margin-top:10px;font-size:24px">' + esc(fullName(p)) + '</h2>' +
    '<p class="sub" style="font-size:16px">#' + esc(p.number) + ' · ' + esc(p.position) + statusTag(p) + '</p></div>' +
    '<div class="card"><h3 style="margin-bottom:10px">Statistieken</h3>' + statTiles(s) +
    '<p class="muted" style="font-size:12px;margin-top:8px">Alleen afgeronde wedstrijden tellen mee.</p></div>' +
    '<button class="btn sec" data-act="pstats" data-id="' + p.id + '">📊 Statistieken aanpassen</button>' +
    '<button class="btn" data-act="editPlayer" data-id="' + p.id + '">Speler bewerken</button></div>';
}

/* ---------- OPSTELLING ---------- */
function pitchHTML(l) {
  const slots = formationSlots(l.formation);
  const lines = '<svg class="pitch-lines" viewBox="0 0 68 105" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,.85)" stroke-width=".5">' +
    '<rect x="2" y="2" width="64" height="101"/><path d="M2 52.5h64"/><circle cx="34" cy="52.5" r="9.15"/><circle cx="34" cy="52.5" r=".7" fill="#fff"/>' +
    '<rect x="13.85" y="2" width="40.3" height="16.5"/><rect x="13.85" y="86.5" width="40.3" height="16.5"/>' +
    '<rect x="24.85" y="2" width="18.3" height="5.5"/><rect x="24.85" y="97.5" width="18.3" height="5.5"/>' +
    '<circle cx="34" cy="13" r=".7" fill="#fff"/><circle cx="34" cy="92" r=".7" fill="#fff"/>' +
    '<path d="M26.7 18.5a9.15 9.15 0 0 0 14.6 0M26.7 86.5a9.15 9.15 0 0 1 14.6 0"/></svg>';
  return '<div class="pitch" data-drop="pitch">' + lines + slots.map((s, i) => {
    const p = P(l.positions[i]);
    const c = p ? slotXY(l, i) : s;
    const inner = p ? chipHTML(p, ui.sel === p.id, true) : '<div class="ghostchip">+</div><span class="role">' + s.role + '</span>';
    return '<div class="slot' + (p && ui.sel === p.id ? ' sel' : '') + '" data-slot="' + i + '" style="left:' + c.x + '%;top:' + c.y + '%">' + inner + '</div>';
  }).join('') + '</div>';
}
function lineupHTML() {
  const l = curLineup();
  const starters = l.positions.filter(Boolean).length;
  const used = new Set(l.positions.filter(Boolean).concat(l.bench));
  const pool = state.players.filter((p) => !used.has(p.id)).sort((a, b) => a.number - b.number);
  const bench = l.bench.map(P).filter(Boolean);
  const keyOpts = '<option value="default"' + (ui.lineupKey === 'default' ? ' selected' : '') + '>Standaardopstelling</option>' +
    state.matches.slice().sort((a, b) => matchDate(b) - matchDate(a)).map((m) => '<option value="' + m.id + '"' + (ui.lineupKey === m.id ? ' selected' : '') + '>vs ' + esc(m.opponent) + ' · ' + fmtDate(m, {day: 'numeric', month: 'short'}) + '</option>').join('');
  const fOpts = Object.keys(FORMATIONS).map((f) => '<option' + (l.formation === f ? ' selected' : '') + '>' + f + '</option>').join('');
  const strip = (arr, drop, hint) => '<div class="strip" data-drop="' + drop + '">' + (arr.length ? arr.map((p) => chipHTML(p, ui.sel === p.id, true)).join('') : '<span class="hint">' + hint + '</span>') + '</div>';
  const opened = (ui.openedSaved && ui.openedSaved.key === ui.lineupKey) ? savedLineups.find((x) => x.id === ui.openedSaved.id) : null;
  let selbar = '';
  if (ui.sel && P(ui.sel)) {
    const inL = used.has(ui.sel);
    selbar = '<div class="selbar"><b>Geselecteerd: ' + esc(P(ui.sel).number) + ' ' + esc(fullName(P(ui.sel))) + ' — tik op een positie</b>' +
      '<button data-act="selBench">Naar bank</button>' +
      (inL ? '<button data-act="selRemove">Uit opstelling</button><button data-act="selCaptain">' + (l.captain === ui.sel ? 'Geen aanvoerder' : 'Aanvoerder') + '</button>' : '') +
      '<button class="x" data-act="selClear">Annuleer</button></div>';
  }
  return '<div class="page"><h1>Opstelling</h1>' +
    (opened ? '<p class="sub">Geopend: <b>' + esc(opened.name) + '</b> · ' + esc(opened.formation) + '</p>' : '') +
    '<label class="field"><span>Opstelling voor</span><select data-change="lineupKey">' + keyOpts + '</select></label>' +
    '<label class="field" style="margin-bottom:14px"><span>Formatie</span><select data-change="formation">' + fOpts + '</select></label>' +
    pitchHTML(l) +
    '<p class="sub" style="text-align:center;margin-top:10px"><b>' + starters + '/11</b> basis · <b>' + bench.length + '</b> op de bank · sleep spelers vrij over het veld</p>' +
    '<div class="list" style="margin-top:14px">' +
    (opened ? '<button class="btn" data-act="updateLineup">Opstelling bijwerken</button>' : '') +
    '<button class="btn' + (opened ? ' sec' : '') + '" data-act="saveLineup">Opstelling opslaan</button>' +
    '<button class="btn sec" data-act="shareLineup">📤 Opstelling delen</button>' +
    '<button class="btn sec" data-act="openStats">📊 Statistieken</button>' +
    '<button class="btn sec" data-act="myLineups">Mijn opstellingen' + (savedLineups.length ? ' (' + savedLineups.length + ')' : '') + '</button>' +
    '<button class="btn ghost" data-act="newLineup">+ Nieuwe opstelling</button></div>' +
    '<section class="blk"><div class="between"><h3>Wisselspelers<span class="count">' + bench.length + '</span></h3><button class="btn small ghost" data-act="pickBenchOpen">' + ic('plus', 'sm') + ' Toevoegen</button></div>' +
    strip(bench, 'bench', 'Tik of sleep hier spelers naartoe') + '</section>' +
    '<section class="blk"><div class="between"><h3>Beschikbaar<span class="count">' + pool.length + '</span></h3></div>' +
    strip(pool, 'pool', state.players.length ? 'Alle spelers staan in de opstelling' : 'Voeg eerst spelers toe in Team') + '</section>' +
    '<p class="sub" style="text-align:center;margin-top:16px">Houd een speler vast en sleep hem naar elke gewenste plek op het veld. Of tik op een speler en daarna op een positie. Sleep je een speler op een andere speler, dan wisselen ze.</p>' +
    selbar + '</div>';
}
function onSlot(i) {
  const l = curLineup(); const occ = l.positions[i];
  if (ui.sel) {
    if (occ === ui.sel) ui.sel = null;
    else { lineupMove(l, ui.sel, i); ui.sel = null; buzz(); save(); }
    render(); return;
  }
  if (occ) { ui.sel = occ; render(); }
  else openModal('pick', {slot: i});
}
function onChip(id) { ui.sel = ui.sel === id ? null : id; render(); }

/* ---------- WEDSTRIJDEN ---------- */
function matchesHTML() {
  const head = '<h1>Wedstrijden</h1>';
  if (!state.matches.length) return '<div class="page">' + head + '<div style="margin-top:16px">' + emptyState('📅', 'Nog geen wedstrijden.', '+ Nieuwe wedstrijd', 'addMatch') + '</div></div>';
  const up = state.matches.filter((m) => m.status !== 'afgerond').sort((a, b) => matchDate(a) - matchDate(b));
  const done = state.matches.filter((m) => m.status === 'afgerond').sort((a, b) => matchDate(b) - matchDate(a));
  const row = (m) => {
    const o = outcome(m);
    const right = o ? '<span class="badge ' + o + '">' + myScore(m) + ' – ' + oppScore(m) + '</span>' : '<span class="muted" style="font-weight:700">' + esc(m.time || '') + '</span>';
    return '<button class="card rowcard" data-act="match" data-id="' + m.id + '"><div class="dateblk"><b>' + matchDate(m).getDate() + '</b><span>' + matchDate(m).toLocaleDateString('nl-NL', {month: 'short'}).replace('.', '') + '</span></div>' +
      '<div class="mid"><div class="nm">vs ' + esc(m.opponent) + '</div><div class="ps">' + (m.homeAway === 'uit' ? 'Uit' : 'Thuis') + (m.competition ? ' · ' + esc(m.competition) : '') + '</div></div>' + right + '</button>';
  };
  return '<div class="page">' + head + '<button class="btn" style="margin-top:14px" data-act="addMatch">+ Nieuwe wedstrijd</button>' +
    (up.length ? '<section class="blk"><h3 style="margin-bottom:10px">Aankomend</h3><div class="list">' + up.map(row).join('') + '</div></section>' : '') +
    (done.length ? '<section class="blk"><h3 style="margin-bottom:10px">Gespeeld</h3><div class="list">' + done.map(row).join('') + '</div></section>' : '') + '</div>';
}
function evMinute(e) { return '<div class="min">' + e.minute + '\u2019</div>'; }
function matchDetailHTML(id) {
  const m = state.matches.find((x) => x.id === id);
  if (!m) return '<div class="page"><p class="muted">Wedstrijd niet gevonden.</p></div>';
  const l = getLineup(m.id);
  const evs = state.events.filter((e) => e.matchId === m.id).sort((a, b) => a.minute - b.minute);
  const goals = evs.filter((e) => e.type === 'goal');
  const cards = evs.filter((e) => e.type === 'yellowCard' || e.type === 'redCard');
  const subs = evs.filter((e) => e.type === 'substitution');
  const mins = state.minutes[m.id] || {};
  const starters = l.positions.filter(Boolean).map(P).filter(Boolean);
  const bench = l.bench.map(P).filter(Boolean);
  const del = (e) => '<button class="iconbtn dang" data-act="delEvent" data-id="' + e.id + '" aria-label="Verwijder">' + ic('x', 'sm') + '</button>';
  const score = m.status === 'afgerond' || myScore(m) + oppScore(m) > 0;
  const kv = (icon, txt) => '<div class="kv">' + ic(icon) + '<span>' + txt + '</span></div>';
  const parts = participants(m.id);
  const minRows = parts.map((p) => {
    const st = l.positions.includes(p.id) ? 'Basis' : (mins[p.id] > 0 || subs.some((s) => s.playerId === p.id) ? 'Ingevallen' : 'Bank');
    return '<div class="minrow">' + avatar(p, 36) + '<div class="mid">' + esc(p.number) + ' · ' + esc(fullName(p)) + '<small>' + st + '</small></div>' +
      '<div class="stepper dark"><button data-act="min" data-id="' + p.id + '" data-d="-5" aria-label="Min 5">−</button><b>' + (mins[p.id] || 0) + '</b><button data-act="min" data-id="' + p.id + '" data-d="5" aria-label="Plus 5">+</button></div></div>';
  }).join('');
  return '<div class="page stack">' +
    '<div class="scorecard">' + (m.competition ? '<small>' + esc(m.competition) + '</small>' : '') +
    '<div class="teams" style="margin-top:8px"><div class="tn">' + esc(state.team.name) + '</div><div class="sc">' + (score ? myScore(m) + ' — ' + oppScore(m) : 'vs') + '</div><div class="tn">' + esc(m.opponent) + '</div></div>' +
    '<div class="between" style="margin-top:14px"><div class="stepper"><button data-act="score" data-who="my" data-d="-1">−</button><b>' + myScore(m) + '</b><button data-act="score" data-who="my" data-d="1">+</button></div>' +
    '<small>Uitslag invoeren</small>' +
    '<div class="stepper"><button data-act="score" data-who="opp" data-d="-1">−</button><b>' + oppScore(m) + '</b><button data-act="score" data-who="opp" data-d="1">+</button></div></div>' +
    (goals.length !== myScore(m) && goals.length ? '<button class="btn small" style="margin-top:12px;background:rgba(255,255,255,.18);box-shadow:none" data-act="takeGoals">Neem ' + goals.length + ' geregistreerde doelpunten over</button>' : '') + '</div>' +
    '<div class="card"><div class="seg" style="margin-bottom:6px"><label><input type="radio" name="st" ' + (m.status !== 'afgerond' ? 'checked' : '') + ' data-change="status" value="gepland"><span>Gepland</span></label><label><input type="radio" name="st" ' + (m.status === 'afgerond' ? 'checked' : '') + ' data-change="status" value="afgerond"><span>Afgerond</span></label></div>' +
    kv('cal', esc(fmtDate(m, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}))) + kv('clock', esc(m.time || '–')) +
    kv(m.homeAway === 'uit' ? 'trophy' : 'home', m.homeAway === 'uit' ? 'Uitwedstrijd' : 'Thuiswedstrijd') +
    (m.location ? kv('pin', esc(m.location)) : '') + '</div>' +
    '<div class="card"><div class="between"><h3>Opstelling · ' + l.formation + '</h3></div>' +
    '<p class="sub" style="margin:6px 0 10px">Basiself: ' + (starters.length ? starters.map((p) => esc(p.number + ' ' + shortName(p))).join(', ') : 'nog niet gekozen') + '</p>' +
    (bench.length ? '<p class="sub" style="margin-bottom:10px">Wissels: ' + bench.map((p) => esc(p.number + ' ' + shortName(p))).join(', ') + '</p>' : '') +
    '<button class="btn sec" data-act="openLineup" data-id="' + m.id + '">Opstelling openen</button></div>' +
    '<div class="card"><div class="between"><h3>Doelpunten<span class="count">' + goals.length + '</span></h3><button class="btn small ghost" data-act="addGoal">' + ic('plus', 'sm') + ' Doelpunt</button></div>' +
    goals.map((e) => '<div class="ev">' + evMinute(e) + '<div class="tx">⚽ ' + esc(fullName(P(e.playerId))) + (e.assistPlayerId ? '<small>Assist: ' + esc(fullName(P(e.assistPlayerId))) + '</small>' : '') + '</div>' + del(e) + '</div>').join('') + '</div>' +
    '<div class="card"><div class="between"><h3>Kaarten<span class="count">' + cards.length + '</span></h3><button class="btn small ghost" data-act="addCard">' + ic('plus', 'sm') + ' Kaart</button></div>' +
    cards.map((e) => '<div class="ev">' + evMinute(e) + '<div class="tx" style="display:flex;align-items:center;gap:8px"><span class="cardico" style="background:' + (e.type === 'redCard' ? 'var(--red)' : 'var(--yellow)') + '"></span>' + esc(fullName(P(e.playerId))) + '</div>' + del(e) + '</div>').join('') + '</div>' +
    '<div class="card"><div class="between"><h3>Wissels<span class="count">' + subs.length + '</span></h3><button class="btn small ghost" data-act="addSub">' + ic('plus', 'sm') + ' Wissel</button></div>' +
    subs.map((e) => '<div class="ev">' + evMinute(e) + '<div class="tx">▲ ' + esc(fullName(P(e.playerId))) + '<small>▼ ' + esc(fullName(P(e.outPlayerId))) + '</small></div>' + del(e) + '</div>').join('') + '</div>' +
    '<div class="card"><div class="between"><h3>Minuten gespeeld</h3></div>' +
    (parts.length ? minRows + '<button class="btn sec" style="margin-top:12px" data-act="autoMinutes">Minuten automatisch invullen</button>' : '<p class="sub">Voeg eerst spelers toe.</p>') + '</div>' +
    (m.notes ? '<div class="card"><h3 style="margin-bottom:6px">Notitie</h3><p style="white-space:pre-wrap">' + esc(m.notes) + '</p></div>' : '') +
    '<button class="btn sec" data-act="editMatch" data-id="' + m.id + '">Wedstrijd bewerken</button>' +
    '<button class="btn danger" data-act="deleteMatch" data-id="' + m.id + '">Wedstrijd verwijderen</button></div>';
}

/* ---------- STATISTIEKEN ---------- */
function miniLine(p, t) {
  const parts = [t.matches + ' wed.'];
  if (isKeeper(p)) parts.push(t.cleanSheets + ' clean sheets');
  else { parts.push(t.goals + ' goals'); parts.push(t.assists + ' assists'); }
  if (t.yellow) parts.push(t.yellow + ' geel');
  if (t.red) parts.push(t.red + ' rood');
  return parts.join(' · ');
}
function topListHTML(title, rows, key, unit) {
  const top = topRows(rows, key, 3);
  if (!top.length) return '';
  const medals = ['🥇', '🥈', '🥉'];
  return '<div class="card"><h3 style="margin-bottom:4px">' + title + '</h3>' + top.map((r, i) =>
    '<button class="topli" data-act="pstats" data-id="' + r.p.id + '"><span class="medal">' + medals[i] + '</span>' + avatar(r.p, 38) +
    '<b>' + esc(fullName(r.p)) + '</b><span class="val">' + r.t[key] + ' ' + unit + '</span></button>').join('') + '</div>';
}
function statsHTML() {
  const {rows, team} = allTotals();
  const tt = teamTotals(rows, team);
  const sorts = [['goals', 'Goals'], ['assists', 'Assists'], ['matches', 'Wedstrijden'], ['minutes', 'Minuten'], ['yellow', 'Geel'], ['red', 'Rood']];
  const unit = {goals: 'goals', assists: 'assists', matches: 'wedstr.', minutes: 'min.', yellow: 'geel', red: 'rood'};
  const key = ui.statSort;
  const sorted = statSortedRows(rows);
  const diff = team.gf - team.ga;
  const tile = (v, l) => '<div class="tile"><b>' + v + '</b><span>' + l + '</span></div>';
  return '<div class="page stack"><h1>Statistieken</h1>' +
    '<button class="btn sec" data-act="shareStats">📤 Statistieken delen</button>' +
    '<div class="card"><h3 style="margin-bottom:10px">Teamstatistieken · ' + esc(state.team.name) + '</h3><div class="tiles">' +
    tile(tt.matches, 'Wedstrijden') + tile(tt.goals, 'Goals') + tile(tt.assists, 'Assists') + tile(tt.yellow, 'Gele kaarten') + tile(tt.red, 'Rode kaarten') + tile(tt.cleanSheets, 'Clean sheets') + '</div>' +
    (team.played ? '<div class="tiles" style="margin-top:8px">' + tile(team.won, 'Gewonnen') + tile(team.drawn, 'Gelijk') + tile(team.lost, 'Verloren') + '</div>' +
      '<div class="tiles" style="margin-top:8px">' + tile(team.gf, 'Doelpunten voor') + tile(team.ga, 'Doelpunten tegen') + tile((diff > 0 ? '+' : '') + diff, 'Doelsaldo') + '</div>' : '') +
    '</div>' +
    topListHTML('Topscorers', rows, 'goals', 'goals') +
    topListHTML('Top assists', rows, 'assists', 'assists') +
    '<div><h2>Spelers</h2><p class="sub">Tik op een speler om statistieken direct aan te passen.</p><div class="pills">' +
    sorts.map((x) => '<button class="pill' + (key === x[0] ? ' on' : '') + '" data-act="statSort" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></div>' +
    (sorted.length ? '<div class="list">' + sorted.map((r) =>
      '<button class="card statrow" data-act="pstats" data-id="' + r.p.id + '">' + avatar(r.p, 50) +
      '<div class="mid"><div class="nm">' + esc(fullName(r.p)) + '</div><div class="ps">#' + esc(r.p.number) + ' · ' + esc(r.p.position) + statusTag(r.p) + '</div><div class="mini">' + miniLine(r.p, r.t) + '</div></div>' +
      '<div class="big">' + r.t[key] + '<small>' + unit[key] + '</small></div></button>').join('') + '</div>'
      : emptyState('📊', 'Voeg eerst spelers toe om statistieken bij te houden.', '+ Eerste speler toevoegen', 'addPlayer')) +
    '<p class="muted" style="font-size:12px;text-align:center">Totalen = afgeronde wedstrijden + jouw eigen aanpassingen. Alles wordt direct opgeslagen.</p></div>';
}
function pstatsHTML(id) {
  const p = P(id);
  if (!p) return '<div class="page"><p class="muted">Speler niet gevonden.</p></div>';
  const {per} = computeStats();
  const t = totalsFor(p, per);
  const order = (ui.statOrder && ui.statOrder.length ? ui.statOrder.filter((x) => P(x)) : state.players.slice().sort((a, b) => a.number - b.number).map((x) => x.id));
  const i = Math.max(0, order.indexOf(id));
  const prev = order[(i - 1 + order.length) % order.length], next = order[(i + 1) % order.length];
  const multi = order.length > 1;
  const auto = per[p.id] || {};
  const rowsHTML = relevantStatKeys(p, t).map((k) => {
    const hints = [];
    if (auto[k]) hints.push(auto[k] + ' uit wedstrijden');
    if (STAT_STEP[k]) hints.push('stappen van ' + STAT_STEP[k]);
    return '<div class="srow"><div class="lb">' + STAT_LABEL[k] + (hints.length ? '<small>' + hints.join(' · ') + '</small>' : '') + '</div><div class="ctl">' +
      '<button class="step" data-act="statStep" data-id="' + p.id + '" data-k="' + k + '" data-d="-1" aria-label="Eén minder">−</button>' +
      '<input class="sval" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="' + t[k] + '" data-change="statValue" data-id="' + p.id + '" data-k="' + k + '" aria-label="' + STAT_LABEL[k] + '">' +
      '<button class="step" data-act="statStep" data-id="' + p.id + '" data-k="' + k + '" data-d="1" aria-label="Eén meer">+</button></div></div>';
  }).join('');
  return '<div class="page stack">' +
    '<div class="card"><div class="pnav">' +
    (multi ? '<button class="nav" data-act="pstats" data-nav="1" data-id="' + prev + '" aria-label="Vorige speler">‹</button>' : '<span class="nav ph"></span>') +
    '<div class="mid">' + avatar(p, 104) + '<h2 style="margin-top:8px;font-size:23px">' + esc(fullName(p)) + '</h2>' +
    '<p class="sub">#' + esc(p.number) + ' · ' + esc(p.position) + statusTag(p) + '</p></div>' +
    (multi ? '<button class="nav" data-act="pstats" data-nav="1" data-id="' + next + '" aria-label="Volgende speler">›</button>' : '<span class="nav ph"></span>') +
    '</div></div>' +
    '<div class="card">' + rowsHTML + '<p class="sub" style="margin-top:10px">✓ Wijzigingen worden direct opgeslagen. Tik op een getal om het te typen.</p></div>' +
    '<button class="btn sec" data-act="player" data-id="' + p.id + '">Spelerprofiel openen</button></div>';
}

/* ---------- INSTELLINGEN ---------- */
function installSteps() {
  return '<ol><li>Open TeamSheet in <b>Safari</b>.</li><li>Tik op <b>Deel</b> (vierkantje met pijl omhoog).</li><li>Kies <b>‘Zet op beginscherm’</b>.</li><li>Tik op <b>Voeg toe</b>.</li></ol>';
}
function settingsHTML() {
  const fOpts = Object.keys(FORMATIONS).map((f) => '<option' + (state.settings.defaultFormation === f ? ' selected' : '') + '>' + f + '</option>').join('');
  const logo = state.team.logo ? '<img class="logo-prev" src="' + state.team.logo + '" alt="">' : '<div class="logo-prev">Geen logo</div>';
  const th = getThemePref();
  const themeOpt = (v, label) => '<label><input type="radio" name="theme" value="' + v + '" data-change="theme"' + (th === v ? ' checked' : '') + '><span>' + label + '</span></label>';
  return '<div class="page stack">' +
    '<div class="card"><h3>Weergave</h3><p class="sub" style="margin:4px 0 12px">Kies het thema van TeamSheet.</p><div class="seg">' +
    themeOpt('light', '☀️ Licht') + themeOpt('dark', '🌙 Donker') + themeOpt('auto', '⚙️ Automatisch') + '</div></div>' +
    '<div class="card"><h3>Team</h3><label class="field"><span>Teamnaam</span><input id="teamName" data-change="teamName" value="' + esc(state.team.name) + '" maxlength="40" autocomplete="off"></label>' +
    '<div class="photo-row" style="margin-top:14px">' + logo + '<div style="flex:1;display:grid;gap:8px"><label class="btn small sec" style="width:100%">' + ic('camera', 'sm') + ' Logo kiezen<input type="file" accept="image/*" data-change="logo" hidden></label>' +
    (state.team.logo ? '<button class="btn small danger" style="width:100%" data-act="removeLogo">Logo verwijderen</button>' : '') + '</div></div>' +
    '<label class="field"><span>Standaardformatie</span><select data-change="defaultFormation">' + fOpts + '</select></label></div>' +
    '<div class="card"><h3>Gegevens</h3><p class="sub" style="margin:4px 0 12px">Alles staat alleen op dit toestel. Maak regelmatig een backup.</p>' +
    '<div class="list"><button class="btn sec" data-act="export">' + ic('download', 'sm') + ' Exporteer gegevens</button>' +
    '<label class="btn sec">' + ic('upload', 'sm') + ' Importeer gegevens<input type="file" accept=".json,application/json" data-change="import" hidden></label>' +
    '<button class="btn danger" data-act="wipe">Alle gegevens verwijderen</button></div></div>' +
    '<div class="card"><h3>Updates</h3>' +
    '<div class="kv"><span>Geladen versie</span><b id="dgApp" style="margin-left:auto">v' + APP_VERSION + '</b></div>' +
    '<div class="kv"><span>Nieuwste op server</span><b id="dgServer" style="margin-left:auto">…</b></div>' +
    '<div class="kv"><span>Service worker</span><b id="dgSw" style="margin-left:auto">…</b></div>' +
    '<div class="kv"><span>Cache</span><b id="dgCache" style="margin-left:auto;font-size:13px">…</b></div>' +
    '<p class="sub" style="margin:8px 0 12px">TeamSheet controleert zelf op updates en laadt nieuwe versies automatisch. Je gegevens blijven altijd bewaard.</p>' +
    '<div class="list"><button class="btn sec" data-act="checkUpdate">Controleer op updates</button><button class="btn danger" data-act="forceUpdate">Update forceren</button></div></div>' +
    '<div class="card inst"><h3>Installeren op je beginscherm</h3>' + installSteps() + '<p class="sub">Daarna opent TeamSheet als een gewone app, ook zonder internet.</p>' +
    '<p class="sub" style="margin-top:6px">Status: ' + (isStandalone() ? '✅ geïnstalleerd' : 'draait in de browser') + '</p></div>' +
    '<p class="sub" style="text-align:center">TeamSheet versie ' + APP_VERSION + '</p></div>';
}

/* ---------- MODALS ---------- */
function openModal(type, data) { ui.modal = Object.assign({type}, data || {}); renderModal(); }
function closeModal() {
  ui.modal = null; renderModal();
  if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(false); }
}
function askConfirm(title, text, ok) {
  return new Promise((resolve) => { confirmResolve = resolve; openModal('confirm', {title, text, ok}); });
}
function renderModal() {
  const el = $('#modal');
  if (!ui.modal) { el.className = ''; el.innerHTML = ''; return; }
  el.className = 'open';
  el.innerHTML = '<div class="backdrop" data-backdrop></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + modalHTML(ui.modal) + '</div>';
}
const playerOpts = (list, sel, blank) => (blank ? '<option value="">' + blank + '</option>' : '') + list.map((p) => '<option value="' + p.id + '"' + (sel === p.id ? ' selected' : '') + '>' + esc(p.number + ' · ' + fullName(p)) + '</option>').join('');
function minuteField(v) { return '<label class="field"><span>Minuut</span><input name="minute" type="number" inputmode="numeric" min="1" max="130" value="' + v + '" required></label>'; }
function formActions(label) { return '<div class="actions"><button type="button" class="btn sec" data-act="closeModal">Annuleren</button><button type="submit" class="btn">' + (label || 'Opslaan') + '</button></div>'; }

function modalHTML(m) {
  if (m.type === 'confirm') {
    return '<h2>' + esc(m.title) + '</h2><p class="sub" style="margin-top:6px">' + esc(m.text || '') + '</p>' +
      '<div class="actions"><button class="btn sec" data-act="closeModal">Annuleren</button><button class="btn solid-danger" data-act="confirmYes">' + esc(m.ok || 'Ja') + '</button></div>';
  }
  if (m.type === 'install') {
    return '<div class="inst"><h2>TeamSheet aan je beginscherm toevoegen?</h2>' + installSteps() +
      '<p class="sub">Dan opent TeamSheet als echte app, ook zonder internet.</p></div>' +
      '<div class="actions"><button class="btn sec" data-act="installNever">Niet meer tonen</button><button class="btn" data-act="closeModal">Begrepen</button></div>';
  }
  if (m.type === 'pick') {
    const l = curLineup();
    const players = state.players.slice().sort((a, b) => a.number - b.number);
    return '<h2>Kies speler</h2><p class="sub">Voor deze positie</p><div class="picklist" style="margin-top:8px">' + (players.length ? players.map((p) => {
      const tag = l.positions.includes(p.id) ? 'Basis' : l.bench.includes(p.id) ? 'Bank' : '';
      return '<button data-act="pickPlayer" data-id="' + p.id + '" data-slot="' + m.slot + '">' + avatar(p, 40) + '<div><b>' + esc(p.number + ' · ' + fullName(p)) + '</b><div class="muted" style="font-size:13px">' + esc(p.position) + '</div></div>' + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</button>';
    }).join('') : '<p class="sub" style="padding:16px 0">Voeg eerst spelers toe in het tabblad Team.</p>') + '</div><div class="actions"><button class="btn sec" data-act="closeModal">Sluiten</button></div>';
  }
  if (m.type === 'pickBench') {
    const l = curLineup();
    const used = new Set(l.positions.filter(Boolean).concat(l.bench));
    const players = state.players.filter((p) => !used.has(p.id)).sort((a, b) => a.number - b.number);
    return '<h2>Wisselspeler toevoegen</h2><div class="picklist" style="margin-top:8px">' + (players.length ? players.map((p) =>
      '<button data-act="pickBench" data-id="' + p.id + '">' + avatar(p, 40) + '<div><b>' + esc(p.number + ' · ' + fullName(p)) + '</b><div class="muted" style="font-size:13px">' + esc(p.position) + '</div></div></button>').join('') : '<p class="sub" style="padding:16px 0">Geen beschikbare spelers.</p>') + '</div><div class="actions"><button class="btn sec" data-act="closeModal">Sluiten</button></div>';
  }
  if (m.type === 'sharePreview') {
    const canShareNow = !!(lastShare && navigator.canShare && navigator.canShare({files: [lastShare.file]}));
    return '<h2>Share Card</h2><p class="sub">Je browser kan de afbeelding niet direct delen. Sla hem op en deel hem daarna zelf, of houd de afbeelding ingedrukt.</p>' +
      '<img class="preview" src="' + m.url + '" alt="Share Card" style="width:100%;border-radius:14px;margin-top:12px;border:1px solid var(--line)">' +
      '<div class="list" style="margin-top:14px">' + (canShareNow ? '<button class="btn" data-act="shareAgain">📤 Delen</button>' : '') +
      '<a class="btn' + (canShareNow ? ' sec' : '') + '" href="' + m.url + '" download="' + esc(lastShare.file.name) + '" style="text-decoration:none">Share Card opslaan</a>' +
      '<button class="btn sec" data-act="closeModal">Sluiten</button></div>';
  }
  if (m.type === 'saveLineup') {
    return '<form data-form="saveLineup" autocomplete="off"><h2>Opstelling opslaan</h2><p class="sub">' + esc(curLineup().formation) + ' · ' + curLineup().positions.filter(Boolean).length + ' spelers op het veld</p>' +
      '<label class="field"><span>Naam van de opstelling</span><input name="name" placeholder="Bijv. Competitie – zondag" maxlength="40" required autocapitalize="sentences"></label>' + formActions() + '</form>';
  }
  if (m.type === 'newLineup') {
    return '<form data-form="newLineup"><h2>Nieuwe opstelling</h2><p class="sub">Kies een formatie. Je opgeslagen opstellingen blijven bewaard.</p>' +
      '<label class="field"><span>Formatie</span><select name="formation">' + Object.keys(FORMATIONS).map((f) => '<option' + (state.settings.defaultFormation === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select></label>' + formActions('Maken') + '</form>';
  }
  if (m.type === 'myLineups') {
    const sorted = savedLineups.slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    return '<h2>Mijn opstellingen</h2>' + (sorted.length ? '<div class="list" style="margin-top:12px">' + sorted.map((sv) =>
      '<div class="card"><div class="between"><div style="min-width:0"><b style="font-size:17px">' + esc(sv.name) + '</b><div class="muted" style="font-size:13px;margin-top:2px">' + esc(sv.formation) + ' · ' + sv.players.length + ' spelers · ' +
      new Date(sv.savedAt).toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: 'numeric'}) + '</div></div></div>' +
      '<div class="actions" style="margin-top:12px"><button class="btn small" style="flex:1" data-act="openSaved" data-id="' + sv.id + '">Openen</button>' +
      '<button class="btn small danger" style="flex:1" data-act="deleteSaved" data-id="' + sv.id + '">Verwijderen</button></div></div>').join('') + '</div>'
      : '<p class="sub" style="padding:18px 0">Je hebt nog geen opgeslagen opstellingen. Maak een opstelling en tik op “Opstelling opslaan”.</p>') +
      '<div class="actions"><button class="btn sec" data-act="closeModal">Sluiten</button></div>';
  }
  if (m.type === 'player') {
    const p = m.id ? P(m.id) : null;
    formTmp = {photo: p ? p.photo : null};
    return '<form data-form="player" autocomplete="off"><h2>' + (p ? 'Speler bewerken' : 'Speler toevoegen') + '</h2>' +
      '<div class="photo-row"><div id="photoPrev">' + avatar(p ? Object.assign({}, p, {photo: formTmp.photo}) : null, 72) + '</div><div style="flex:1;display:grid;gap:8px">' +
      '<div class="grid2"><label class="btn small sec" style="width:100%">' + ic('camera', 'sm') + ' Kies foto<input type="file" accept="image/*" data-change="photo" hidden></label>' +
      '<label class="btn small sec" style="width:100%">' + ic('camera', 'sm') + ' Maak foto<input type="file" accept="image/*" capture="environment" data-change="photo" hidden></label></div>' +
      '<button type="button" class="btn small danger" style="width:100%" data-act="clearPhoto">Foto verwijderen</button></div></div>' +
      '<div class="grid2"><label class="field"><span>Voornaam</span><input name="firstName" value="' + esc(p ? p.firstName : '') + '" required autocapitalize="words"></label>' +
      '<label class="field"><span>Achternaam</span><input name="lastName" value="' + esc(p ? p.lastName : '') + '" autocapitalize="words"></label></div>' +
      '<label class="field"><span>Rugnummer</span><input name="number" type="number" inputmode="numeric" min="0" max="999" value="' + (p ? p.number : '') + '" required></label>' +
      '<label class="field"><span>Positie</span><select name="position">' + POSITIONS.map((x) => '<option' + ((p ? p.position : 'Middenvelder') === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Status</span><select name="pstatus"><option value="fit"' + (!p || !STATUS_LABEL[p.status] ? ' selected' : '') + '>Beschikbaar</option><option value="blessure"' + (p && p.status === 'blessure' ? ' selected' : '') + '>Geblesseerd</option><option value="afwezig"' + (p && p.status === 'afwezig' ? ' selected' : '') + '>Afwezig</option></select></label>' +
      formActions() + (p ? '<button type="button" class="btn danger" style="margin-top:10px" data-act="deletePlayer" data-id="' + p.id + '">Speler verwijderen</button>' : '') + '</form>';
  }
  if (m.type === 'match') {
    const x = m.id ? state.matches.find((q) => q.id === m.id) : null;
    return '<form data-form="match" autocomplete="off"><h2>' + (x ? 'Wedstrijd bewerken' : 'Nieuwe wedstrijd') + '</h2>' +
      '<label class="field"><span>Tegenstander</span><input name="opponent" value="' + esc(x ? x.opponent : '') + '" required autocapitalize="words"></label>' +
      '<div class="grid2"><label class="field"><span>Datum</span><input name="date" type="date" value="' + (x ? x.date : todayStr()) + '" required></label>' +
      '<label class="field"><span>Tijd</span><input name="time" type="time" value="' + (x ? x.time : '14:00') + '"></label></div>' +
      '<div class="field"><span>Thuis / Uit</span><div class="seg"><label><input type="radio" name="homeAway" value="thuis" ' + (!x || x.homeAway !== 'uit' ? 'checked' : '') + '><span>Thuis</span></label><label><input type="radio" name="homeAway" value="uit" ' + (x && x.homeAway === 'uit' ? 'checked' : '') + '><span>Uit</span></label></div></div>' +
      '<label class="field"><span>Locatie</span><input name="location" value="' + esc(x ? x.location : '') + '"></label>' +
      '<label class="field"><span>Competitie</span><input name="competition" value="' + esc(x ? x.competition : '') + '"></label>' +
      '<label class="field"><span>Notitie</span><textarea name="notes">' + esc(x ? x.notes : '') + '</textarea></label>' + formActions() + '</form>';
  }
  const parts = participants(m.matchId);
  if (m.type === 'goal') {
    return '<form data-form="goal"><h2>Doelpunt</h2>' + minuteField(1) +
      '<label class="field"><span>Doelpuntenmaker</span><select name="scorer" required>' + playerOpts(parts, '', 'Kies speler') + '</select></label>' +
      '<label class="field"><span>Assist (optioneel)</span><select name="assist">' + playerOpts(parts, '', 'Geen assist') + '</select></label>' + formActions() + '</form>';
  }
  if (m.type === 'card') {
    return '<form data-form="card"><h2>Kaart</h2><div class="field"><span>Soort kaart</span><div class="seg"><label><input type="radio" name="kind" value="yellowCard" checked><span>🟨 Geel</span></label><label><input type="radio" name="kind" value="redCard"><span>🟥 Rood</span></label></div></div>' +
      minuteField(1) + '<label class="field"><span>Speler</span><select name="player" required>' + playerOpts(parts, '', 'Kies speler') + '</select></label>' + formActions() + '</form>';
  }
  if (m.type === 'sub') {
    return '<form data-form="sub"><h2>Wissel</h2>' + minuteField(60) +
      '<label class="field"><span>Eruit</span><select name="out" required>' + playerOpts(parts, '', 'Kies speler') + '</select></label>' +
      '<label class="field"><span>Erin</span><select name="in" required>' + playerOpts(parts, '', 'Kies speler') + '</select></label>' + formActions() + '</form>';
  }
  return '';
}

/* formulieren */
const forms = {
  saveLineup(fd) {
    const name = String(fd.get('name') || '').trim();
    if (!name) { toast('Geef de opstelling een naam'); return; }
    const l = curLineup();
    const existing = savedLineups.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const doSave = () => {
      const snap = snapshotLineup(l, existing ? existing.name : name, existing ? existing.id : null);
      if (existing) savedLineups[savedLineups.indexOf(existing)] = snap; else savedLineups.push(snap);
      if (!writeSaved(savedLineups)) return;
      ui.openedSaved = {id: snap.id, key: ui.lineupKey};
      ui.modal = null; renderModal(); render(); buzz();
      toast(existing ? 'Opstelling overschreven' : 'Opstelling opgeslagen');
    };
    if (existing) {
      askConfirm('Naam bestaat al', 'Wil je de opstelling “' + existing.name + '” overschrijven?', 'Overschrijven').then((ok) => { if (ok) doSave(); else openModal('saveLineup'); });
    } else doSave();
  },
  newLineup(fd) {
    const l = curLineup();
    const f = fd.get('formation');
    l.formation = FORMATIONS[f] ? f : '4-3-3';
    l.positions = Array(11).fill(null); l.coords = Array(11).fill(null);
    l.bench = []; l.captain = null; l.layouts = {};
    ui.openedSaved = null; ui.sel = null;
    save(); ui.modal = null; renderModal(); render(); toast('Nieuwe opstelling gemaakt');
  },
  player(fd) {
    const first = String(fd.get('firstName') || '').trim();
    const last = String(fd.get('lastName') || '').trim();
    const num = parseInt(fd.get('number'), 10);
    if (!first) { toast('Vul een voornaam in'); return; }
    if (!(num >= 0 && num <= 999)) { toast('Vul een geldig rugnummer in'); return; }
    const pos = POSITIONS.includes(fd.get('position')) ? fd.get('position') : 'Middenvelder';
    const pst = (fd.get('pstatus') === 'blessure' || fd.get('pstatus') === 'afwezig') ? fd.get('pstatus') : 'fit';
    const id = ui.modal.id;
    const dup = state.players.some((p) => p.number === num && p.id !== id);
    if (id && P(id)) {
      Object.assign(P(id), {firstName: first, lastName: last, number: num, position: pos, photo: formTmp.photo || null, status: pst});
    } else {
      state.players.push({id: uid(), firstName: first, lastName: last, number: num, position: pos, photo: formTmp.photo || null, status: pst});
    }
    save(); ui.modal = null; renderModal(); render(); buzz();
    toast(dup ? 'Opgeslagen – let op: rugnummer is dubbel' : 'Speler opgeslagen');
  },
  match(fd) {
    const opp = String(fd.get('opponent') || '').trim();
    if (!opp) { toast('Vul de tegenstander in'); return; }
    const data = {opponent: opp, date: fd.get('date') || todayStr(), time: fd.get('time') || '', homeAway: fd.get('homeAway') === 'uit' ? 'uit' : 'thuis',
      location: String(fd.get('location') || '').trim(), competition: String(fd.get('competition') || '').trim(), notes: String(fd.get('notes') || '').trim()};
    let m = ui.modal.id ? state.matches.find((x) => x.id === ui.modal.id) : null;
    if (m) {
      const my = myScore(m), op = oppScore(m);
      Object.assign(m, data); setScores(m, my, op);
    } else {
      m = Object.assign({id: uid(), homeScore: 0, awayScore: 0, status: 'gepland'}, data);
      state.matches.push(m);
      state.lineups[m.id] = clone(getLineup('default'));
    }
    save(); const id = m.id; ui.modal = null; renderModal();
    if (ui.sub && ui.sub.type === 'match') render(); else goSub('match', id);
    toast('Wedstrijd opgeslagen');
  },
  goal(fd) {
    const scorer = fd.get('scorer'); if (!scorer) { toast('Kies een doelpuntenmaker'); return; }
    const assist = fd.get('assist') || null;
    state.events.push({id: uid(), matchId: ui.modal.matchId, type: 'goal', playerId: scorer, assistPlayerId: assist && assist !== scorer ? assist : null, minute: clampMin(fd.get('minute'))});
    finishEvent();
  },
  card(fd) {
    const p = fd.get('player'); if (!p) { toast('Kies een speler'); return; }
    state.events.push({id: uid(), matchId: ui.modal.matchId, type: fd.get('kind') === 'redCard' ? 'redCard' : 'yellowCard', playerId: p, minute: clampMin(fd.get('minute'))});
    finishEvent();
  },
  sub(fd) {
    const out = fd.get('out'), inn = fd.get('in');
    if (!out || !inn) { toast('Kies beide spelers'); return; }
    if (out === inn) { toast('Kies twee verschillende spelers'); return; }
    state.events.push({id: uid(), matchId: ui.modal.matchId, type: 'substitution', playerId: inn, outPlayerId: out, minute: clampMin(fd.get('minute'))});
    finishEvent();
  }
};
function clampMin(v) { const n = parseInt(v, 10); return isNaN(n) ? 1 : Math.max(1, Math.min(130, n)); }
function finishEvent() {
  const m = state.matches.find((x) => x.id === ui.modal.matchId);
  if (m) autoMinutes(m, false);
  save(); ui.modal = null; renderModal(); render(); buzz();
}

/* ---------- acties ---------- */
function curMatch() { return ui.sub && ui.sub.type === 'match' ? state.matches.find((m) => m.id === ui.sub.id) : null; }

async function exportData() {
  const payload = JSON.stringify({app: 'TeamSheet', version: 1, exportedAt: new Date().toISOString(), data: state, savedLineups: savedLineups}, null, 1);
  const name = 'teamsheet-backup-' + todayStr() + '.json';
  try {
    const file = new File([payload], name, {type: 'application/json'});
    if (navigator.canShare && navigator.canShare({files: [file]})) {
      await navigator.share({files: [file], title: 'TeamSheet backup'});
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(new Blob([payload], {type: 'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup gemaakt');
}
async function importData(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !Array.isArray(data.players) || !Array.isArray(data.matches)) throw new Error('ongeldig');
    const ok = await askConfirm('Gegevens importeren?', 'Je huidige gegevens worden vervangen door de backup (' + data.players.length + ' spelers, ' + data.matches.length + ' wedstrijden).', 'Importeren');
    if (!ok) return;
    state = normalize(data); ui.lineupKey = 'default'; ui.sel = null; ui.openedSaved = null;
    if (Array.isArray(parsed.savedLineups)) { savedLineups = parsed.savedLineups.filter(validSaved); writeSaved(savedLineups); }
    await persist(); render(); toast('Backup teruggezet');
  } catch (e) { toast('Dit bestand is geen geldige TeamSheet-backup'); }
}

function act(name, d) {
  const m = curMatch();
  switch (name) {
    case 'settings': goSub('settings'); refreshDiag(); break;
    case 'applyUpdate': applyUpdate(); break;
    case 'checkUpdate': checkForUpdate(true).then(refreshDiag); break;
    case 'forceUpdate':
      askConfirm('Update forceren?', 'De app wordt volledig ververst met de nieuwste bestanden. Je spelers, wedstrijden en opstellingen blijven bewaard.', 'Nu vernieuwen').then((ok) => { if (ok) forceUpdate(); });
      break;
    case 'back': back(); break;
    case 'addPlayer': openModal('player'); break;
    case 'editPlayer': openModal('player', {id: d.id}); break;
    case 'player': goSub('player', d.id); break;
    case 'sort': ui.sort = d.v; render(); break;
    case 'statSort': ui.statSort = d.v; render(); break;
    case 'openStats': goTab('stats'); break;
    case 'pstats': {
      if (!d.nav) ui.statOrder = statSortedRows(allTotals().rows).map((r) => r.p.id);
      ui.tab = 'stats'; ui.sub = {type: 'pstats', id: d.id}; resetScroll = true; render(); break;
    }
    case 'statStep': {
      const p = P(d.id); if (!p || !STAT_KEYS.includes(d.k)) break;
      const per = computeStats().per;
      const cur = totalsFor(p, per)[d.k];
      setStatTotal(p, d.k, Math.max(0, cur + (STAT_STEP[d.k] || 1) * (+d.d)), per);
      save(); buzz(6); render(); break;
    }
    case 'shareStats': shareStats(); break;
    case 'clearPhoto': formTmp.photo = null; $('#photoPrev').innerHTML = avatar(null, 72); break;
    case 'deletePlayer': {
      const p = P(d.id); if (!p) break;
      askConfirm('Speler verwijderen?', fullName(p) + ' wordt ook uit opstellingen en statistieken verwijderd.', 'Ja, verwijderen').then((ok) => {
        if (!ok) return;
        removePlayer(d.id); save(); ui.modal = null; renderModal();
        if (ui.sub && ui.sub.type === 'player') ui.sub = null;
        ui.sel = null; resetScroll = true; render(); toast('Speler verwijderd');
      });
      break;
    }
    case 'addMatch': openModal('match'); break;
    case 'editMatch': openModal('match', {id: d.id}); break;
    case 'match': goSub('match', d.id); break;
    case 'deleteMatch': {
      askConfirm('Wedstrijd verwijderen?', 'Alle gegevens van deze wedstrijd worden verwijderd.', 'Ja, verwijderen').then((ok) => {
        if (!ok) return;
        removeMatch(d.id); save(); ui.modal = null; renderModal(); ui.sub = null; resetScroll = true; render(); toast('Wedstrijd verwijderd');
      });
      break;
    }
    case 'score': if (m) { const w = d.who === 'my'; setScores(m, myScore(m) + (w ? +d.d : 0), oppScore(m) + (w ? 0 : +d.d)); save(); render(); } break;
    case 'takeGoals': if (m) { setScores(m, state.events.filter((e) => e.matchId === m.id && e.type === 'goal').length, oppScore(m)); save(); render(); } break;
    case 'openLineup': ui.lineupKey = d.id; ui.tab = 'lineup'; ui.sub = null; ui.sel = null; resetScroll = true; render(); break;
    case 'addGoal': if (m) openModal('goal', {matchId: m.id}); break;
    case 'addCard': if (m) openModal('card', {matchId: m.id}); break;
    case 'addSub': if (m) openModal('sub', {matchId: m.id}); break;
    case 'delEvent': state.events = state.events.filter((e) => e.id !== d.id); save(); render(); break;
    case 'min': if (m) { const mm = state.minutes[m.id] || (state.minutes[m.id] = {}); mm[d.id] = Math.max(0, Math.min(130, (mm[d.id] || 0) + (+d.d))); save(); render(); } break;
    case 'autoMinutes': if (m) { autoMinutes(m, true); save(); render(); toast('Minuten ingevuld'); } break;
    case 'selClear': ui.sel = null; render(); break;
    case 'selBench': if (ui.sel) { lineupBench(curLineup(), ui.sel); ui.sel = null; save(); render(); } break;
    case 'selRemove': if (ui.sel) { lineupRemove(curLineup(), ui.sel); ui.sel = null; save(); render(); } break;
    case 'pickPlayer': lineupMove(curLineup(), d.id, +d.slot); save(); ui.modal = null; renderModal(); render(); buzz(); break;
    case 'pickBenchOpen': openModal('pickBench'); break;
    case 'pickBench': lineupBench(curLineup(), d.id); save(); ui.modal = null; renderModal(); render(); break;
    case 'saveLineup': openModal('saveLineup'); break;
    case 'myLineups': openModal('myLineups'); break;
    case 'newLineup': {
      const l = curLineup();
      if (l.positions.some(Boolean) || l.bench.length) {
        askConfirm('Nieuwe opstelling maken?', 'De huidige opstelling op het veld wordt leeggemaakt. Opgeslagen opstellingen blijven bewaard.', 'Ja, nieuwe opstelling').then((ok) => { if (ok) openModal('newLineup'); });
      } else openModal('newLineup');
      break;
    }
    case 'updateLineup': {
      const o = ui.openedSaved;
      const sv = o && savedLineups.find((x) => x.id === o.id);
      if (!sv || o.key !== ui.lineupKey) { toast('Er is geen opgeslagen opstelling geopend'); break; }
      savedLineups[savedLineups.indexOf(sv)] = snapshotLineup(curLineup(), sv.name, sv.id);
      if (writeSaved(savedLineups)) { buzz(); toast('Opstelling bijgewerkt'); }
      break;
    }
    case 'openSaved': {
      const sv = savedLineups.find((x) => x.id === d.id); if (!sv) break;
      const l = curLineup();
      const go = () => {
        const missing = applySaved(l, sv);
        ui.openedSaved = {id: sv.id, key: ui.lineupKey}; ui.sel = null;
        save(); ui.modal = null; renderModal(); render(); buzz();
        toast(missing ? 'Geopend – ' + missing + ' speler(s) bestaan niet meer' : 'Opstelling geopend');
      };
      const sameOpen = ui.openedSaved && ui.openedSaved.id === sv.id && ui.openedSaved.key === ui.lineupKey;
      if ((l.positions.some(Boolean) || l.bench.length) && !sameOpen) {
        askConfirm('Opstelling openen?', 'De huidige opstelling op het veld wordt vervangen. Niet-opgeslagen wijzigingen gaan verloren.', 'Openen').then((ok) => { if (ok) go(); else openModal('myLineups'); });
      } else go();
      break;
    }
    case 'deleteSaved': {
      const sv = savedLineups.find((x) => x.id === d.id); if (!sv) break;
      askConfirm('Opstelling verwijderen?', 'Weet je zeker dat je deze opstelling wilt verwijderen?', 'Ja, verwijderen').then((ok) => {
        if (ok) {
          savedLineups = savedLineups.filter((x) => x.id !== sv.id);
          writeSaved(savedLineups);
          if (ui.openedSaved && ui.openedSaved.id === sv.id) ui.openedSaved = null;
          render(); toast('Opstelling verwijderd');
        }
        openModal('myLineups');
      });
      break;
    }
    case 'selCaptain': if (ui.sel) { const l = curLineup(); l.captain = l.captain === ui.sel ? null : ui.sel; ui.sel = null; save(); render(); } break;
    case 'shareLineup': shareLineup(); break;
    case 'shareAgain':
      if (lastShare) {
        navigator.share({files: [lastShare.file], title: lastShare.title}).catch(() => {});
      }
      break;
    case 'closeModal': closeModal(); break;
    case 'confirmYes': { const r = confirmResolve; confirmResolve = null; ui.modal = null; renderModal(); if (r) r(true); break; }
    case 'installNever': try { localStorage.setItem('ts_install_never', '1'); } catch (e) { /* negeer */ } closeModal(); break;
    case 'removeLogo': state.team.logo = null; save(); render(); break;
    case 'export': exportData(); break;
    case 'wipe':
      askConfirm('Alle gegevens verwijderen?', 'Spelers, wedstrijden, opstellingen en statistieken worden definitief gewist. Maak eerst een backup.', 'Alles verwijderen').then(async (ok) => {
        if (!ok) return;
        state = defaultState(); ui.lineupKey = 'default'; ui.sel = null; ui.sub = null; ui.tab = 'team'; ui.openedSaved = null; savedLineups = [];
        try { localStorage.removeItem(SAVED_KEY); } catch (e) { /* negeer */ }
        try { localStorage.removeItem('teamsheet_state'); } catch (e) { /* negeer */ }
        await persist(); resetScroll = true; render(); toast('Alle gegevens verwijderd');
      });
      break;
    default: break;
  }
}

/* ---------- events (delegatie) ---------- */
let suppressClick = false;
document.addEventListener('click', (e) => {
  if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
  const t = e.target;
  if (t.matches && t.matches('[data-backdrop]')) { closeModal(); return; }
  const tab = t.closest('[data-tab]');
  if (tab) { goTab(tab.dataset.tab); return; }
  const a = t.closest('[data-act]');
  if (a) { act(a.dataset.act, a.dataset); return; }
  const main = $('#main');
  const slot = t.closest('[data-slot]');
  if (slot && main.contains(slot)) { onSlot(+slot.dataset.slot); return; }
  const chip = t.closest('[data-chip]');
  if (chip && main.contains(chip)) { onChip(chip.dataset.chip); return; }
  const drop = t.closest('[data-drop="bench"],[data-drop="pool"]');
  if (drop && ui.sel && main.contains(drop)) {
    const l = curLineup();
    if (drop.dataset.drop === 'bench') lineupBench(l, ui.sel); else lineupRemove(l, ui.sel);
    ui.sel = null; save(); render();
  }
});

document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el && el.classList && el.classList.contains('sval')) setTimeout(() => { try { el.setSelectionRange(0, 99); } catch (err) { /* negeer */ } }, 0);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { ui.q = e.target.value; const el = $('#playerList'); if (el) el.innerHTML = playerListHTML(); }
});

document.addEventListener('change', async (e) => {
  const t = e.target; const k = t.dataset && t.dataset.change; if (!k) return;
  const m = curMatch();
  if (k === 'theme') { try { localStorage.setItem(THEME_KEY, t.value); } catch (err) { /* negeer */ } applyTheme(); render(); }
  else if (k === 'lineupKey') { ui.lineupKey = t.value; ui.sel = null; render(); }
  else if (k === 'formation') { setFormation(curLineup(), t.value); save(); render(); }
  else if (k === 'status' && m) { m.status = t.value === 'afgerond' ? 'afgerond' : 'gepland'; if (m.status === 'afgerond') autoMinutes(m, false); save(); render(); }
  else if (k === 'statValue') {
    const p = P(t.dataset.id), key = t.dataset.k;
    if (p && STAT_KEYS.includes(key)) {
      const digits = String(t.value).replace(/[^0-9]/g, '');
      if (digits !== '') { setStatTotal(p, key, Math.min(99999, parseInt(digits, 10))); save(); }
      render();
    }
  }
  else if (k === 'teamName') { state.team.name = t.value.trim() || 'Mijn team'; save(); }
  else if (k === 'defaultFormation') { state.settings.defaultFormation = t.value; setFormation(getLineup('default'), t.value); save(); toast('Standaardformatie ingesteld'); }
  else if (k === 'logo' && t.files && t.files[0]) {
    try { state.team.logo = await resizeImage(t.files[0], 256, 'contain', 'image/png'); save(); render(); } catch (err) { toast('Logo kon niet worden geladen'); }
    t.value = '';
  } else if (k === 'photo' && t.files && t.files[0]) {
    try { formTmp.photo = await resizeImage(t.files[0], 400, 'cover', 'image/jpeg'); $('#photoPrev').innerHTML = avatar({firstName: 'x', photo: formTmp.photo}, 72); } catch (err) { toast('Foto kon niet worden geladen'); }
    t.value = '';
  } else if (k === 'import' && t.files && t.files[0]) {
    const f = t.files[0]; t.value = ''; importData(f);
  }
});

document.addEventListener('submit', (e) => {
  const f = e.target.dataset && e.target.dataset.form; if (!f) return;
  e.preventDefault();
  if (forms[f]) forms[f](new FormData(e.target));
});

/* ---------- touch/pointer slepen ---------- */
/* Speler op het veld: beweegt vrij (percentages). Speler van bank/beschikbaar: spookbeeld, loslaten op veld/bank/beschikbaar. */
let drag = null;
document.addEventListener('pointerdown', (e) => {
  if (ui.tab !== 'lineup' || ui.sub || ui.modal) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const el = e.target.closest('[data-drag]');
  if (!el) return;
  const slotEl = el.closest('.slot');
  const d = {pid: el.dataset.drag, sx: e.clientX, sy: e.clientY, started: false, ghost: null, el, id: e.pointerId, over: null, slotEl, pitch: null, offX: 0, offY: 0, pos: null};
  if (slotEl) {
    d.pitch = slotEl.parentElement;
    const r = d.pitch.getBoundingClientRect();
    d.offX = e.clientX - (r.left + parseFloat(slotEl.style.left) / 100 * r.width);
    d.offY = e.clientY - (r.top + parseFloat(slotEl.style.top) / 100 * r.height);
  }
  drag = d;
});
document.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  if (!d.started) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < (d.slotEl ? 5 : 10)) return;
    d.started = true; buzz(8);
    if (d.slotEl) d.slotEl.classList.add('moving');
    else {
      const g = document.createElement('div');
      g.className = 'dragghost'; g.innerHTML = chipHTML(P(d.pid), false, false);
      document.body.appendChild(g); d.ghost = g; d.el.classList.add('dragging');
    }
  }
  e.preventDefault();
  if (d.slotEl) {
    const r = d.pitch.getBoundingClientRect();
    const p = clampXY((e.clientX - d.offX - r.left) / r.width * 100, (e.clientY - d.offY - r.top) / r.height * 100);
    d.pos = p; d.slotEl.style.left = p.x + '%'; d.slotEl.style.top = p.y + '%';
    return;
  }
  d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px';
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const over = t ? t.closest('[data-drop="pitch"],[data-drop="bench"],[data-drop="pool"]') : null;
  if (over !== d.over) {
    if (d.over) d.over.classList.remove('droptarget');
    if (over) over.classList.add('droptarget');
    d.over = over;
  }
}, {passive: false});
function endDrag(drop, e) {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.ghost) d.ghost.remove();
  if (d.over) d.over.classList.remove('droptarget');
  d.el.classList.remove('dragging');
  if (d.slotEl) d.slotEl.classList.remove('moving');
  if (!d.started) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 80);
  const l = curLineup();
  if (d.slotEl) {
    const i = +d.slotEl.dataset.slot;
    if (drop && d.pos && l.positions[i] === d.pid) { l.coords[i] = d.pos; save(); buzz(); }
    render(); return;
  }
  if (drop && d.over) {
    const kind = d.over.dataset.drop;
    if (kind === 'pitch') {
      const r = d.over.getBoundingClientRect();
      if (!placeFree(l, d.pid, (e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100)) toast('Het veld is vol – sleep op een speler om te wisselen');
    } else if (kind === 'bench') lineupBench(l, d.pid);
    else lineupRemove(l, d.pid);
    ui.sel = null; save(); buzz();
  }
  render();
}
document.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) endDrag(true, e); });
document.addEventListener('pointercancel', () => endDrag(false, null));
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-drag]')) e.preventDefault(); });

/* ---------- thema (licht / donker / automatisch) ---------- */
function getThemePref() {
  try { const v = localStorage.getItem(THEME_KEY); return (v === 'dark' || v === 'auto' || v === 'light') ? v : 'light'; }
  catch (e) { return 'light'; }
}
function isDarkNow() {
  const pref = getThemePref();
  const sys = !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  return pref === 'dark' || (pref === 'auto' && sys);
}
function applyTheme() {
  const dark = isDarkNow();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a2a1a' : '#0b3d24');
}

/* ---------- Share Card (PNG) ---------- */
let lastShare = null;
let shareUrl = null;
function loadImg(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function fitFont(g, text, maxW, start, min, weight, family) {
  let px = start;
  g.font = weight + ' ' + px + 'px ' + family;
  while (px > min && g.measureText(text).width > maxW) { px -= 2; g.font = weight + ' ' + px + 'px ' + family; }
  return px;
}
function clipText(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
/* tekent de huidige opstelling met dezelfde slotXY()-posities als het formatiescherm */
function drawPhoto(g, img, cx, cy, r) {
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  const k = Math.max(2 * r / img.width, 2 * r / img.height);
  g.drawImage(img, cx - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
  g.restore();
}
async function buildShareCanvas() {
  const l = curLineup();
  const dark = isDarkNow();
  const C = dark
    ? {bg: '#0e1512', card: '#18221d', text: '#eaf1ed', muted: '#9aaba2', line: '#2b3832', grassA: '#25773f', grassB: '#1f6a37', frame: '#0a2a1a'}
    : {bg: '#f1f4f2', card: '#ffffff', text: '#15211b', muted: '#66736c', line: '#dfe6e2', grassA: '#2d8a47', grassB: '#257a3d', frame: '#0b3d24'};
  const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  const W = 1080, M = 60;
  const logo = await loadImg(state.team.logo);
  const match = ui.lineupKey !== 'default' ? state.matches.find((m) => m.id === ui.lineupKey) : null;
  const bench = l.bench.map(P).filter(Boolean);
  const out = state.players.filter((p) => STATUS_LABEL[p.status]).sort((a, b) => a.number - b.number);
  const cap = l.captain ? P(l.captain) : null;
  /* dezelfde foto als in het spelersprofiel (p.photo) */
  const imgs = {};
  const need = new Set(l.positions.filter(Boolean).concat(l.bench, out.map((q) => q.id)));
  await Promise.all(Array.from(need).map(async (id) => { const q = P(id); if (q && q.photo) imgs[id] = await loadImg(q.photo); }));

  const HEAD = cap ? 310 : 260;
  const PW = 760, PH = Math.round(PW * 105 / 68);
  const ROW = 64, TITLE = 72;
  const both = bench.length && out.length;
  const colW = both ? (W - 2 * M - 40) / 2 : W - 2 * M;
  const benchCols = both ? 1 : 2;
  const outCols = both ? 1 : 1;
  const benchH = bench.length ? TITLE + Math.ceil(bench.length / benchCols) * ROW : 0;
  const outH = out.length ? TITLE + out.length * ROW : 0;
  const lowerH = Math.max(benchH, outH);
  const H = Math.max(1920, HEAD + 30 + PH + (lowerH ? 40 + lowerH : 0) + 130);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

  /* header */
  const grd = g.createLinearGradient(0, 0, 0, HEAD);
  grd.addColorStop(0, dark ? '#0a2a1a' : '#0b3d24'); grd.addColorStop(1, '#14583a');
  g.fillStyle = grd; g.fillRect(0, 0, W, HEAD);
  let tx = M;
  if (logo) {
    g.save(); rrect(g, M, 56, 130, 130, 28); g.clip();
    const k = Math.min(130 / logo.width, 130 / logo.height);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(M, 56, 130, 130);
    g.drawImage(logo, M + (130 - logo.width * k) / 2, 56 + (130 - logo.height * k) / 2, logo.width * k, logo.height * k);
    g.restore(); tx = M + 160;
  }
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const pillW = 210;
  g.fillStyle = '#ffffff';
  fitFont(g, state.team.name.toUpperCase(), W - tx - M - pillW - 20, 70, 36, '900', FONT);
  g.fillText(state.team.name.toUpperCase(), tx, 125);
  if (match) {
    const line = 'vs ' + match.opponent + ' · ' + fmtDate(match, {day: 'numeric', month: 'long', year: 'numeric'}) + (match.time ? ' · ' + match.time : '') + ' · ' + (match.homeAway === 'uit' ? 'Uit' : 'Thuis');
    g.fillStyle = 'rgba(255,255,255,.88)';
    fitFont(g, line, W - tx - M, 38, 24, '600', FONT);
    g.fillText(line, tx, 182);
  }
  // formatie-label
  rrect(g, W - M - pillW, 70, pillW, 90, 45); g.fillStyle = '#ffffff'; g.fill();
  g.fillStyle = '#0b3d24'; g.font = '900 52px ' + FONT; g.textAlign = 'center';
  g.fillText(l.formation, W - M - pillW / 2, 133); g.textAlign = 'left';
  if (cap) {
    g.fillStyle = '#f5c518'; g.font = '800 40px ' + FONT;
    g.fillText('★ AANVOERDER', M, 262);
    const lw = g.measureText('★ AANVOERDER  ').width;
    g.fillStyle = '#ffffff'; g.font = '700 40px ' + FONT;
    g.fillText(clipText(g, fullName(cap), W - 2 * M - lw), M + lw, 262);
  }

  /* veld */
  const px = (W - PW) / 2, py = HEAD + 30;
  const s = PW / 68;
  g.save(); rrect(g, px, py, PW, PH, 30); g.clip();
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 === 0 ? C.grassA : C.grassB; g.fillRect(px, py + i * PH / 10, PW, PH / 10 + 1); }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 4; g.fillStyle = 'rgba(255,255,255,.85)';
  const X = (v) => px + v * s, Y = (v) => py + v * s;
  g.strokeRect(X(2), Y(2), 64 * s, 101 * s);
  g.beginPath(); g.moveTo(X(2), Y(52.5)); g.lineTo(X(66), Y(52.5)); g.stroke();
  g.beginPath(); g.arc(X(34), Y(52.5), 9.15 * s, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(X(34), Y(52.5), 6, 0, Math.PI * 2); g.fill();
  g.strokeRect(X(13.85), Y(2), 40.3 * s, 16.5 * s); g.strokeRect(X(13.85), Y(86.5), 40.3 * s, 16.5 * s);
  g.strokeRect(X(24.85), Y(2), 18.3 * s, 5.5 * s); g.strokeRect(X(24.85), Y(97.5), 18.3 * s, 5.5 * s);
  g.beginPath(); g.arc(X(34), Y(13), 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(X(34), Y(92), 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(X(34), Y(13), 9.15 * s, 0.93, Math.PI - 0.93); g.stroke();
  g.beginPath(); g.arc(X(34), Y(92), 9.15 * s, Math.PI + 0.93, 2 * Math.PI - 0.93); g.stroke();
  g.restore();
  rrect(g, px, py, PW, PH, 30); g.lineWidth = 8; g.strokeStyle = C.frame; g.stroke();

  /* spelers – exact dezelfde posities (percentages) als in de app */
  const R = 46;
  g.textAlign = 'center';
  l.positions.forEach((pid, i) => {
    const p = P(pid); if (!p) return;
    const c = slotXY(l, i);
    const cx = px + c.x / 100 * PW, cy = py + c.y / 100 * PH;
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = '#0b3d24'; g.fill(); g.restore();
    if (imgs[pid]) drawPhoto(g, imgs[pid], cx, cy, R - 3);
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
    g.textBaseline = 'middle';
    if (imgs[pid]) {
      const ns = String(p.number);
      g.font = '900 24px ' + FONT;
      const bw = Math.max(44, g.measureText(ns).width + 22), bx = cx - R * 0.78, by = cy + R * 0.78;
      rrect(g, bx - bw / 2, by - 20, bw, 40, 20); g.fillStyle = '#0b3d24'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = '#ffffff'; g.fillText(ns, bx, by + 1);
    } else {
      g.fillStyle = '#ffffff'; g.font = '900 ' + (String(p.number).length > 2 ? 34 : 44) + 'px ' + FONT;
      g.fillText(String(p.number), cx, cy + 2);
    }
    g.font = '800 31px ' + FONT;
    const nm = clipText(g, shortName(p), 190);
    const nw = g.measureText(nm).width + 30;
    rrect(g, cx - nw / 2, cy + R + 8, nw, 46, 23); g.fillStyle = '#ffffff'; g.fill();
    g.fillStyle = '#15211b'; g.fillText(nm, cx, cy + R + 32);
    if (STATUS_LABEL[p.status]) {
      const tl = STATUS_LABEL[p.status];
      g.font = '800 24px ' + FONT;
      const tw = g.measureText(tl).width + 46, ty = cy + R + 60;
      rrect(g, cx - tw / 2, ty, tw, 34, 17); g.fillStyle = '#d33a3a'; g.fill();
      g.beginPath(); g.arc(cx - tw / 2 + 18, ty + 17, 5, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
      g.textAlign = 'left'; g.fillText(tl, cx - tw / 2 + 31, ty + 18); g.textAlign = 'center';
    }
    if (l.captain === pid) {
      g.beginPath(); g.arc(cx + R * 0.78, cy - R * 0.78, 20, 0, Math.PI * 2); g.fillStyle = '#f5c518'; g.fill();
      g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke();
      g.fillStyle = '#3a2a00'; g.font = '900 24px ' + FONT; g.fillText('C', cx + R * 0.78, cy - R * 0.78 + 1);
    }
  });
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';

  /* wissels + blessures / afwezig */
  const ly = py + PH + 40;
  const drawTitle = (txt, x, y) => {
    g.fillStyle = C.text; g.font = '900 38px ' + FONT; g.fillText(txt, x, y + 40);
    g.fillStyle = '#1fa35b'; g.fillRect(x, y + 52, 70, 6);
  };
  let colX = both ? M : M;
  if (bench.length) {
    drawTitle('WISSELSPELERS', colX, ly);
    bench.forEach((p, i) => {
      const col = i % benchCols, row = Math.floor(i / benchCols);
      const x = colX + col * (colW / benchCols), y = ly + TITLE + row * ROW;
      g.beginPath(); g.arc(x + 26, y + 26, 26, 0, Math.PI * 2); g.fillStyle = '#14583a'; g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (imgs[p.id]) {
        drawPhoto(g, imgs[p.id], x + 26, y + 26, 26);
        g.beginPath(); g.arc(x + 26, y + 26, 26, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = '#14583a'; g.stroke();
        g.beginPath(); g.arc(x + 6, y + 46, 15, 0, Math.PI * 2); g.fillStyle = '#14583a'; g.fill(); g.lineWidth = 3; g.strokeStyle = C.card; g.stroke();
        g.fillStyle = '#ffffff'; g.font = '900 17px ' + FONT; g.fillText(String(p.number), x + 6, y + 47);
      } else {
        g.fillStyle = '#ffffff'; g.font = '900 26px ' + FONT;
        g.fillText(String(p.number), x + 26, y + 28);
      }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = C.text;
      fitFont(g, fullName(p), colW / benchCols - 80, 34, 24, '700', FONT);
      g.fillText(clipText(g, fullName(p), colW / benchCols - 80), x + 66, y + 38);
    });
    if (both) colX = M + colW + 40;
  }
  if (out.length) {
    drawTitle('BLESSURES / AFWEZIG', colX, ly);
    out.forEach((p, i) => {
      const y = ly + TITLE + i * ROW;
      g.beginPath(); g.arc(colX + 14, y + 24, 12, 0, Math.PI * 2); g.fillStyle = '#d33a3a'; g.fill();
      const off = imgs[p.id] ? 54 : 0;
      if (imgs[p.id]) {
        drawPhoto(g, imgs[p.id], colX + 42 + 24, y + 24, 24);
        g.beginPath(); g.arc(colX + 42 + 24, y + 24, 24, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = '#d33a3a'; g.stroke();
      }
      g.fillStyle = C.text;
      const label = fullName(p) + ' — ' + STATUS_LABEL[p.status];
      fitFont(g, label, colW - 50 - off, 32, 22, '700', FONT);
      g.fillText(clipText(g, label, colW - 50 - off), colX + 42 + off, y + 36);
    });
  }

  /* footer */
  g.textAlign = 'center'; g.fillStyle = C.muted; g.font = '700 30px ' + FONT;
  g.fillText('TeamSheet · v' + APP_VERSION, W / 2, H - 56);
  g.textAlign = 'left';
  return canvas;
}
function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
async function buildStatsCanvas() {
  const dark = isDarkNow();
  const C = dark
    ? {bg: '#0e1512', card: '#18221d', text: '#eaf1ed', muted: '#9aaba2', line: '#2b3832', brand: '#4fd08a'}
    : {bg: '#f1f4f2', card: '#ffffff', text: '#15211b', muted: '#66736c', line: '#dfe6e2', brand: '#14583a'};
  const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  const W = 1080, M = 60;
  const {rows, team} = allTotals();
  const tt = teamTotals(rows, team);
  const sections = [];
  const sc = topRows(rows, 'goals', 5), as = topRows(rows, 'assists', 5), cs = topRows(rows, 'cleanSheets', 3);
  if (sc.length) sections.push({title: 'TOPSCORERS', rows: sc, key: 'goals', unit: 'Goals'});
  if (as.length) sections.push({title: 'TOP ASSISTS', rows: as, key: 'assists', unit: 'Assists'});
  if (cs.length) sections.push({title: 'CLEAN SHEETS', rows: cs, key: 'cleanSheets', unit: 'Clean sheets'});
  const logo = await loadImg(state.team.logo);
  const imgs = {};
  const ids = new Set();
  sections.forEach((sec) => sec.rows.forEach((r) => ids.add(r.p.id)));
  await Promise.all(Array.from(ids).map(async (id) => { const q = P(id); if (q && q.photo) imgs[id] = await loadImg(q.photo); }));

  const HEAD = 290, TITLE = 84, ROW = 124, TILE_H = 150, GAP = 36;
  const hasAny = sections.length > 0;
  const teamH = TITLE + TILE_H + 30;
  let H = HEAD + 40 + teamH;
  sections.forEach((sec) => { H += GAP + TITLE + sec.rows.length * ROW + 20; });
  if (!hasAny) H += GAP + 200;
  H = Math.max(1350, H + 150);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);

  const grd = g.createLinearGradient(0, 0, 0, HEAD);
  grd.addColorStop(0, dark ? '#0a2a1a' : '#0b3d24'); grd.addColorStop(1, '#14583a');
  g.fillStyle = grd; g.fillRect(0, 0, W, HEAD);
  let tx = M;
  if (logo) {
    g.save(); rrect(g, M, 56, 130, 130, 28); g.clip();
    const k = Math.min(130 / logo.width, 130 / logo.height);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(M, 56, 130, 130);
    g.drawImage(logo, M + (130 - logo.width * k) / 2, 56 + (130 - logo.height * k) / 2, logo.width * k, logo.height * k);
    g.restore(); tx = M + 160;
  }
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const pillW = 230;
  g.fillStyle = '#ffffff';
  fitFont(g, state.team.name.toUpperCase(), W - tx - M - pillW - 20, 70, 36, '900', FONT);
  g.fillText(state.team.name.toUpperCase(), tx, 125);
  g.fillStyle = 'rgba(255,255,255,.88)'; g.font = '700 42px ' + FONT;
  g.fillText('SEIZOEN ' + seasonLabel(), tx, 185);
  rrect(g, W - M - pillW, 70, pillW, 90, 45); g.fillStyle = '#ffffff'; g.fill();
  g.fillStyle = '#0b3d24'; g.font = '900 44px ' + FONT; g.textAlign = 'center';
  g.fillText('STATS', W - M - pillW / 2, 130); g.textAlign = 'left';
  g.fillStyle = '#f5c518'; g.font = '800 40px ' + FONT;
  g.fillText('STATISTIEKEN', M, 262);

  const panel = (y, h) => { rrect(g, M, y, W - 2 * M, h, 32); g.fillStyle = C.card; g.fill(); g.lineWidth = 2; g.strokeStyle = C.line; g.stroke(); };
  const title = (t, y) => { g.fillStyle = C.muted; g.font = '800 34px ' + FONT; g.textAlign = 'left'; g.fillText(t, M + 36, y + 56); };

  let y = HEAD + 40;
  panel(y, teamH);
  title('TEAMSTATISTIEKEN', y);
  const tiles = [['Wedstrijden', tt.matches], ['Goals', tt.goals], ['Assists', tt.assists], ['Gele kaarten', tt.yellow], ['Rode kaarten', tt.red]];
  const tw = (W - 2 * M - 72) / tiles.length;
  tiles.forEach((tl, i) => {
    const cx = M + 36 + tw * i + tw / 2;
    g.textAlign = 'center';
    g.fillStyle = C.text; g.font = '900 64px ' + FONT; g.fillText(String(tl[1]), cx, y + TITLE + 66);
    g.fillStyle = C.muted; fitFont(g, tl[0], tw - 12, 25, 18, '700', FONT); g.fillText(tl[0], cx, y + TITLE + 108);
  });
  g.textAlign = 'left';
  y += teamH + GAP;

  const rankCol = ['#d4a017', '#9aa3a8', '#b8733f'];
  sections.forEach((sec) => {
    const h = TITLE + sec.rows.length * ROW + 20;
    panel(y, h);
    title(sec.title, y);
    sec.rows.forEach((r, i) => {
      const ry = y + TITLE + i * ROW, cy = ry + ROW / 2 - 4;
      if (i > 0) { g.fillStyle = C.line; g.fillRect(M + 36, ry - 2, W - 2 * M - 72, 2); }
      const rcx = M + 36 + 30;
      g.beginPath(); g.arc(rcx, cy, 30, 0, Math.PI * 2); g.fillStyle = rankCol[i] || '#6b7a72'; g.fill();
      g.fillStyle = '#ffffff'; g.font = '900 32px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), rcx, cy + 2);
      const pcx = rcx + 30 + 20 + 48;
      g.beginPath(); g.arc(pcx, cy, 48, 0, Math.PI * 2); g.fillStyle = '#14583a'; g.fill();
      if (imgs[r.p.id]) {
        drawPhoto(g, imgs[r.p.id], pcx, cy, 48);
        g.beginPath(); g.arc(pcx, cy, 48, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = C.card; g.stroke();
      } else {
        g.fillStyle = '#ffffff'; g.font = '900 38px ' + FONT; g.fillText(String(r.p.number), pcx, cy + 2);
      }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const nx = pcx + 48 + 28, nmax = W - M - 36 - nx;
      g.fillStyle = C.text; fitFont(g, fullName(r.p), nmax, 44, 26, '800', FONT);
      g.fillText(clipText(g, fullName(r.p), nmax), nx, cy - 6);
      g.fillStyle = C.brand; g.font = '800 38px ' + FONT;
      g.fillText(r.t[sec.key] + ' ' + sec.unit, nx, cy + 44);
    });
    y += h + GAP;
  });
  if (!hasAny) {
    panel(y, 200);
    g.fillStyle = C.muted; g.font = '700 36px ' + FONT; g.textAlign = 'center';
    g.fillText('Nog geen goals of assists geregistreerd', W / 2, y + 112); g.textAlign = 'left';
  }
  g.textAlign = 'center'; g.fillStyle = C.muted; g.font = '700 30px ' + FONT;
  g.fillText('TeamSheet · v' + APP_VERSION, W / 2, H - 56);
  g.textAlign = 'left';
  return canvas;
}
async function shareStats() {
  toast('Statistiekenkaart maken…');
  let blob;
  try { blob = await canvasToBlob(await buildStatsCanvas()); }
  catch (e) { toast('Statistiekenkaart maken mislukt'); return; }
  const file = new File([blob], 'teamsheet-statistieken-' + todayStr() + '.png', {type: 'image/png'});
  lastShare = {blob, file, title: 'Statistieken ' + state.team.name};
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: lastShare.title}); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (shareUrl) URL.revokeObjectURL(shareUrl);
  shareUrl = URL.createObjectURL(blob);
  openModal('sharePreview', {url: shareUrl});
}
async function shareLineup() {
  toast('Share Card maken…');
  let blob;
  try { blob = await canvasToBlob(await buildShareCanvas()); }
  catch (e) { toast('Share Card maken mislukt'); return; }
  const l = curLineup();
  const file = new File([blob], 'teamsheet-opstelling-' + l.formation + '-' + todayStr() + '.png', {type: 'image/png'});
  lastShare = {blob, file, title: 'Opstelling ' + state.team.name + ' (' + l.formation + ')'};
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: lastShare.title}); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (shareUrl) URL.revokeObjectURL(shareUrl);
  shareUrl = URL.createObjectURL(blob);
  openModal('sharePreview', {url: shareUrl});
}

/* ---------- opstarten ---------- */
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });

/* ---------- automatische updates ---------- */
/* Werking: de app leest bij start, bij terugkeren in de app en elk half uur de VERSION uit sw.js op de server
 * (altijd vers, cache wordt omzeild). Is die nieuwer dan APP_VERSION, dan worden eerst je gegevens bewaard en
 * herlaadt de app zichzelf. Gegevens (IndexedDB/localStorage) worden nooit verwijderd. */
let swReg = null, hadController = false, checking = false, reloadingForUpdate = false, lastUpdateCheck = 0;
function cmpVersion(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
async function fetchServerVersion() {
  const r = await fetch('sw.js?nocache=' + Date.now(), {cache: 'no-store'});
  if (!r.ok) throw new Error('http ' + r.status);
  const m = (await r.text()).match(/const VERSION = '([0-9.]+)'/);
  return m ? m[1] : null;
}
function updateBusy() { return !!ui.modal || !!drag; }
function showUpdateBar(sv) {
  let b = $('#updatebar');
  if (!b) { b = document.createElement('div'); b.id = 'updatebar'; document.body.appendChild(b); }
  b.innerHTML = '<span>' + (sv ? 'Nieuwe versie v' + esc(sv) + ' beschikbaar' : 'Nieuwe versie beschikbaar') + '</span><button data-act="applyUpdate">Nu bijwerken</button>';
  b.classList.add('show');
}
function hideUpdateBar() { const b = $('#updatebar'); if (b) b.classList.remove('show'); }
async function applyUpdate() {
  if (reloadingForUpdate) return;
  reloadingForUpdate = true;
  toast('Nieuwe versie wordt geladen…');
  await persist();
  try {
    const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
    if (reg) await Promise.race([reg.update(), new Promise((r) => setTimeout(r, 4000))]);
  } catch (e) { /* offline of geen service worker: alsnog herladen */ }
  location.reload();
}
async function checkForUpdate(manual) {
  if (checking || reloadingForUpdate) return;
  checking = true;
  try {
    let sv = null;
    try { sv = await fetchServerVersion(); }
    catch (e) { if (manual) toast('Geen verbinding – controleren niet mogelijk'); return; }
    try { if (swReg) swReg.update(); } catch (e) { /* negeer */ }
    if (!sv) { if (manual) toast('Serverversie kon niet worden gelezen'); return; }
    if (cmpVersion(sv, APP_VERSION) <= 0) {
      hideUpdateBar();
      if (manual) toast('Je gebruikt de nieuwste versie (v' + APP_VERSION + ')');
      return;
    }
    let tried = null;
    try { tried = sessionStorage.getItem('ts_update_try'); } catch (e) { /* negeer */ }
    /* beveiliging tegen een herlaad-lus: automatisch maar één poging per versie per sessie */
    if (!manual && (updateBusy() || tried === sv)) { showUpdateBar(sv); return; }
    try { sessionStorage.setItem('ts_update_try', sv); } catch (e) { /* negeer */ }
    await applyUpdate();
  } finally { checking = false; }
}
async function forceUpdate() {
  reloadingForUpdate = true;
  await persist();
  /* verwijdert ALLEEN service workers en caches; IndexedDB en localStorage (spelers, opstellingen) blijven staan */
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } catch (e) { /* negeer */ }
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (e) { /* negeer */ }
  location.reload();
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadingForUpdate) return;   // eerste installatie: niets doen
    if (updateBusy()) { showUpdateBar(''); return; }
    reloadingForUpdate = true;
    persist().then(() => location.reload());
  });
  try { swReg = await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}); }
  catch (e) { /* geblokkeerd of offline */ }
}
function setupUpdateChecks() {
  const run = (manual) => { lastUpdateCheck = Date.now(); return checkForUpdate(manual); };
  setTimeout(() => run(false), 1200);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastUpdateCheck > 20000) run(false);
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) run(false); });
  setInterval(() => { if (document.visibilityState === 'visible') run(false); }, 30 * 60 * 1000);
}
async function refreshDiag() {
  const set = (id, t) => { const el = $('#' + id); if (el) el.textContent = t; };
  set('dgApp', 'v' + APP_VERSION);
  try { set('dgCache', ((await caches.keys()).join(', ')) || 'geen'); } catch (e) { set('dgCache', 'n.v.t.'); }
  try { const reg = await navigator.serviceWorker.getRegistration(); set('dgSw', reg && reg.active ? 'actief' : 'niet actief'); } catch (e) { set('dgSw', 'niet beschikbaar'); }
  try { const v = await fetchServerVersion(); set('dgServer', v ? 'v' + v : 'onbekend'); } catch (e) { set('dgServer', 'offline'); }
}

(async function init() {
  applyTheme();
  try {
    const mq = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
    if (mq) { const onChange = () => { if (getThemePref() === 'auto') applyTheme(); }; if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange); }
  } catch (e) { /* negeer */ }
  state = await loadState();
  savedLineups = loadSaved();
  render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* negeer */ }
  registerServiceWorker();
  setupUpdateChecks();
  let never = false;
  try { never = localStorage.getItem('ts_install_never') === '1'; } catch (e) { /* negeer */ }
  if (!isStandalone() && !never) setTimeout(() => { if (!ui.modal) openModal('install'); }, 700);
})();
