/*
 * Pen Ink: mark up notes in reading view with an Apple Pencil (or a mouse/pen on desktop).
 *
 * - No dependencies, no network calls, no telemetry.
 * - Never modifies note text. Ink lives in  Annotations/<note path without .md>.json
 * - Your tool/color/size choices live in this plugin's data.json (saved by Obsidian).
 */
(function () {
'use strict';
const obsidian = require('obsidian');
const { Plugin, MarkdownView, MarkdownRenderChild, Notice, normalizePath, Platform, addIcon, PluginSettingTab, Setting, TFile } = obsidian;

// ---------------------------------------------------------------------------
// Settings you might want to tweak
// ---------------------------------------------------------------------------
const FOLDER = 'Annotations';   // default ink folder (changeable in settings)
const SWATCHES = ['#ffd400', '#40c057', '#f06595', '#e03131', '#1c7ed6', '#000000'];
const KNOB_GAP = 30;   // px from the bottom of the selection box to the center of its rotate knob
const SIZES = { pen: [1.5, 2.5, 4, 7], hl: [10, 16, 24, 32], shape: [1.5, 2.5, 4, 7], eraser: [6, 12, 20, 30] };   // px: stroke widths; eraser radius
const HL_OPACITY = 0.4;     // highlighter translucency
const MAX_RECENT = 6;       // custom colors remembered from the color wheel
const MAX_FAVORITES = 6;
const SAVE_DELAY = 600;     // ms to wait after the last change before writing the ink file
const HOLD_MS = 500;        // hold the Pencil still this long at the end of a stroke to straighten it
const SNAP_DEG = 8;         // straight lines within this many degrees of flat/upright snap to it
const SHAPES = ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'line', 'arrow'];
const CORNERED = ['rect', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'];   // closed polygons: round edges apply
const FILLABLE = [...CORNERED, 'ellipse'];
const SQUARE_SNAP = 0.2;    // rectangles/ellipses within 20% of square snap to a perfect square/circle
const LASER_TRAIL_MS = 600;  // how long the laser pointer's trail lingers
const ZOOM_MAX = 4;         // pinch zoom goes from 1x to this
const LIVE_CHUNK = 120;      // while drawing, freeze the line every this many points (keeps long strokes fast)

const DEFAULT_PREFS = {
  tool: 'hl',                            // 'pen' | 'hl' (highlighter) | 'shape' | 'eraser' | 'lasso' (the Select tool) | 'laser'
  lastDrawTool: 'hl',                    // where the eraser goes back to (auto-return)
  pen: { color: '#e03131', size: 2.5, type: 'ball', dash: 'solid', opacity: 1 },   // type: 'ball' | 'fountain'; dash: 'solid' | 'dash' | 'dot'
  hl:  { color: '#ffd400', size: 16, straight: false },   // straight: every highlight is a straight line
  shape: { kind: 'rect', color: '#1c7ed6', size: 2.5, dash: 'solid', fill: null, rough: 1, edges: 'sharp', opacity: 1 },
  // shape.kind: one of SHAPES; fill: null or a color; rough: 0 clean, 1 sketchy, 2 rough; edges: 'sharp' | 'round'
  eraser: { mode: 'stroke', size: 12, only: 'all', autoReturn: false },
  // mode: 'stroke' (whole strokes) | 'partial' (just what it touches); only: 'all' | 'pen' | 'hl'
  favorites: [],                         // [{tool: 'pen'|'hl', color, size, type?}]
  recent: [],
  barPos: null,                          // toolbar position as {x, y} fractions of the note area; null = top-right
  barVertical: true,                     // toolbar as a column along the left side (or a row at the top)
  fingerDraws: null,                     // one finger draws, two scroll; null = on for phones only
  holdToStraighten: true,
  smoothing: 30,                         // 0 (raw) .. 80 (very smooth)
  syncTipShown: false,                   // one-time note about Obsidian Sync and .json files
  folder: FOLDER,                        // where ink files are saved
};

const SVGNS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// djb2 hash of a section's markdown source; this is the section "key" ink is stored under.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Split a long note once per render instead of once per section.
let lastText = null, lastLines = null;
function sectionSource(info) {
  if (info.text !== lastText) { lastText = info.text; lastLines = info.text.split('\n'); }
  return lastLines.slice(info.lineStart, info.lineEnd + 1).join('\n').trim();
}

// Ink file contents -> data, or null if it isn't (yet) a whole ink file (e.g. half-synced).
function parseInk(raw) {
  try { const d = JSON.parse(raw); return d && d.sections && typeof d.sections === 'object' ? d : null; } catch (e) { return null; }
}

// Identical blocks (two "---" lines, a repeated heading) would hash to the same key and share
// one set of ink. The first keeps the plain key (so existing ink stays put); later copies get "~n".
// Only whole earlier blocks with the same text count (from Obsidian's own section list), never
// the Properties block or a line inside some other block. No section list: no suffix.
let repText = null, repSections = null, repStarts = null;
function repeatIndex(info, src, sections) {
  if (!sections || !sections.length) return 0;
  if (repText !== info.text || repSections !== sections) {
    repText = info.text; repSections = sections; repStarts = new Map();
    const lines = info.text.split('\n');
    for (const sec of sections) {
      if (sec.type === 'yaml' || !sec.position) continue;
      const a = sec.position.start.line, b = sec.position.end.line;
      const t = lines.slice(a, b + 1).join('\n').trim();
      if (!repStarts.has(t)) repStarts.set(t, []);
      repStarts.get(t).push(a);
    }
  }
  const starts = repStarts.get(src);
  return starts ? starts.filter(a => a < info.lineStart).length : 0;
}

// Ink sections compared by content: same strokes per paragraph, whatever the key order.
function sameInk(a, b) {
  const norm = (secs) => JSON.stringify(Object.keys(secs).filter(k => secs[k] && secs[k].length).sort().map(k => [k, secs[k]]));
  return norm(a) === norm(b);
}

// Every section of a note as key -> its text, keyed exactly like the post-processor does.
// null when Obsidian hasn't indexed the note yet.
function noteSections(text, sections) {
  if (typeof text !== 'string' || !sections || !sections.length) return null;
  const lines = text.split('\n'), out = new Map();
  for (const sec of sections) {
    if (!sec.position) continue;
    const a = sec.position.start.line, src = lines.slice(a, sec.position.end.line + 1).join('\n').trim();
    if (!src) continue;
    const n = repeatIndex({ text, lineStart: a }, src, sections);
    out.set(hash(src) + (n ? '~' + n : ''), src);
  }
  return out;
}

// How alike two paragraphs are, 0 to 1 (shared pairs of letters). A fixed typo or an added
// sentence scores high; a different paragraph scores low.
function similarity(a, b) {
  a = a.toLowerCase().replace(/\s+/g, ' '); b = b.toLowerCase().replace(/\s+/g, ' ');
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const m = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.substr(i, 2); m.set(g, (m.get(g) || 0) + 1); }
  let hit = 0;
  for (let i = 0; i < b.length - 1; i++) { const g = b.substr(i, 2), n = m.get(g); if (n) { hit++; m.set(g, n - 1); } }
  return (2 * hit) / (a.length + b.length - 2);
}

// Where each changed paragraph sits: between which unchanged neighbors (keys in both versions).
function slots(cur, other) {
  const keys = [...cur.keys()], out = new Map();
  let prev = '^';
  for (let i = 0; i < keys.length; i++) {
    if (other.has(keys[i])) { prev = keys[i]; continue; }
    let next = '$';
    for (let j = i + 1; j < keys.length; j++) if (other.has(keys[j])) { next = keys[j]; break; }
    out.set(keys[i], prev + '|' + next);
  }
  return out;
}

// A note was edited: which inked paragraphs became which new ones. A paragraph that's gone and
// has ink goes to the most alike new paragraph in the same spot (between the same unchanged
// neighbors), one each, if they're alike enough. Unrelated English text scores up to ~0.55.
const MATCH = 0.6;
function matchEdits(before, after, hasInk) {
  const gone = [...before.keys()].filter(k => !after.has(k) && hasInk(k));
  const fresh = [...after.keys()].filter(k => !before.has(k) && !hasInk(k));
  const sb = slots(before, after), sa = slots(after, before), pairs = [];
  for (const g of gone) for (const f of fresh) {
    if (sb.get(g) !== sa.get(f)) continue;
    const sc = similarity(before.get(g), after.get(f));
    if (sc >= MATCH) pairs.push([sc, g, f]);
  }
  pairs.sort((x, y) => y[0] - x[0]);
  const used = new Set(), moves = [];
  for (const [, g, f] of pairs) if (!used.has(g) && !used.has(f)) { used.add(g); used.add(f); moves.push([g, f]); }
  return { moves, lost: gone.filter(g => !used.has(g)) };
}

const isColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const clone = (o) => JSON.parse(JSON.stringify(o));

// Strokes saved before v1.2 have no `kind`; the old highlighter was the only translucent tool.
const isHighlight = (s) => (s.kind ? s.kind === 'hl' : s.opacity < 1);
const isFountain = (s) => s.type === 'fountain';

function validFavorite(f) {
  if (!f || !['pen', 'hl'].includes(f.tool) || !isColor(f.color) || !SIZES[f.tool].includes(f.size)) return null;
  const out = { tool: f.tool, color: f.color.toLowerCase(), size: f.size };
  if (f.tool === 'pen') { out.type = f.type === 'fountain' ? 'fountain' : 'ball'; out.dash = ['dash', 'dot'].includes(f.dash) ? f.dash : 'solid'; }
  return out;
}

// A usable ink folder name, or '' if it isn't one (empty, or hidden like ".obsidian",
// which the vault doesn't index).
function cleanFolder(name) {
  const f = normalizePath(String(name || '').trim());
  if (!f || f === '/' || f.split('/').some(part => part.startsWith('.'))) return '';
  return f;
}

function mergePrefs(saved) {
  const p = clone(DEFAULT_PREFS);
  if (!saved || typeof saved !== 'object') return p;
  if (['pen', 'hl', 'shape', 'eraser', 'lasso', 'laser'].includes(saved.tool)) p.tool = saved.tool;
  if (['pen', 'hl', 'shape'].includes(saved.lastDrawTool)) p.lastDrawTool = saved.lastDrawTool;
  for (const k of ['pen', 'hl', 'shape']) {
    const s = saved[k];
    if (!s) continue;
    if (isColor(s.color)) p[k].color = s.color.toLowerCase();
    if (typeof s.size === 'number' && s.size > 0 && s.size <= 64) p[k].size = s.size;
  }
  if (saved.pen && saved.pen.type === 'fountain') p.pen.type = 'fountain';
  if (saved.hl && saved.hl.straight === true) p.hl.straight = true;
  if (saved.shape && SHAPES.includes(saved.shape.kind)) p.shape.kind = saved.shape.kind;
  for (const k of ['pen', 'shape']) {
    if (saved[k] && ['dash', 'dot'].includes(saved[k].dash)) p[k].dash = saved[k].dash;
    if (saved[k] && typeof saved[k].opacity === 'number' && saved[k].opacity >= 0.1 && saved[k].opacity <= 1) p[k].opacity = saved[k].opacity;
  }
  const sh = saved.shape;
  if (sh && (sh.fill === null || isColor(sh.fill))) p.shape.fill = sh.fill;
  if (sh && [0, 1, 2].includes(sh.rough)) p.shape.rough = sh.rough;
  if (sh && sh.edges === 'round') p.shape.edges = 'round';
  const e = saved.eraser;
  if (e && ['stroke', 'partial'].includes(e.mode)) p.eraser.mode = e.mode;
  if (e && SIZES.eraser.includes(e.size)) p.eraser.size = e.size;
  if (e && ['all', 'pen', 'hl'].includes(e.only)) p.eraser.only = e.only;
  if (e && e.autoReturn === true) p.eraser.autoReturn = true;
  if (Array.isArray(saved.favorites)) p.favorites = saved.favorites.map(validFavorite).filter(Boolean).slice(0, MAX_FAVORITES);
  if (Array.isArray(saved.recent)) p.recent = saved.recent.filter(isColor).slice(0, MAX_RECENT);
  if (typeof saved.barVertical === 'boolean') p.barVertical = saved.barVertical;
  const b = saved.barPos, frac = (v) => typeof v === 'number' && v >= 0 && v <= 1;
  if (b && frac(b.x) && frac(b.y)) p.barPos = { x: b.x, y: b.y };
  if (typeof saved.holdToStraighten === 'boolean') p.holdToStraighten = saved.holdToStraighten;
  if (typeof saved.fingerDraws === 'boolean') p.fingerDraws = saved.fingerDraws;
  if (saved.syncTipShown === true) p.syncTipShown = true;
  if (typeof saved.folder === 'string' && cleanFolder(saved.folder)) p.folder = cleanFolder(saved.folder);
  if (typeof saved.smoothing === 'number' && saved.smoothing >= 0 && saved.smoothing <= 80) p.smoothing = saved.smoothing;
  return p;
}

// Appends a smooth curve through `arr` (px points) to path data `d`, assuming we're already at arr[0].
function smoothThrough(arr) {
  let d = '';
  for (let i = 1; i < arr.length - 1; i++) {
    const mx = (arr[i][0] + arr[i + 1][0]) / 2, my = (arr[i][1] + arr[i + 1][1]) / 2;
    d += ` Q${arr[i][0].toFixed(1)},${arr[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const L = arr[arr.length - 1];
  return d + ` L${L[0].toFixed(1)},${L[1].toFixed(1)}`;
}

// Center line of a stroke. x is stored as 0..1 of the section width, y in px.
// `sharp` (shapes) joins the points with straight lines instead of smoothing through them.
function pathData(pts, w, sharp) {
  if (!pts.length) return '';
  const P = pts.map(p => [p[0] * w, p[1]]);
  if (P.length === 1) return `M${P[0][0]},${P[0][1]} l0.1,0`;
  if (sharp) return 'M' + P.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
  return `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}` + smoothThrough(P);
}

// Fountain pen: a filled outline whose width follows pressure (3rd value of each point),
// tapered at both ends. Hand-rolled so there are no dependencies.
// `o.noTaperStart` / `o.noTaperEnd`: for pieces of a stroke still being drawn (they join up).
function outlineData(s, w, o) {
  const P = s.pts.map(q => [q[0] * w, q[1], q[2] != null ? q[2] : 0.5]);
  const n = P.length;
  if (!n) return '';
  const startTaper = o && o.noTaperStart ? Infinity : 0, endTaper = o && o.noTaperEnd ? Infinity : 0;
  const radius = (i) => {
    const taper = Math.min(1, 0.4 + 0.2 * Math.min(i + startTaper, n - 1 - i + endTaper));
    return Math.max(0.3, (s.width * (0.4 + 1.2 * P[i][2]) * taper) / 2);
  };
  if (n === 1) {
    const r = radius(0), [x, y] = P[0];
    return `M${(x - r).toFixed(1)},${y.toFixed(1)} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0 Z`;
  }
  const left = [], right = [], rs = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, r = radius(i);
    rs.push(r);
    left.push([P[i][0] + nx * r, P[i][1] + ny * r]);
    right.push([P[i][0] - nx * r, P[i][1] - ny * r]);
  }
  right.reverse();
  const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const rEnd = rs[n - 1].toFixed(2), rStart = rs[0].toFixed(2);
  return `M${f(left[0])}` + smoothThrough(left) +
    ` A${rEnd},${rEnd} 0 0 0 ${f(right[0])}` + smoothThrough(right) +
    ` A${rStart},${rStart} 0 0 0 ${f(left[0])} Z`;
}

// ----- Excalidraw-style looks for shapes: fill, sloppiness, rounded edges -----
const FILLS = ['#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99', '#e9ecef'];   // light fills, like Excalidraw's backgrounds
const FILL_OPACITY = 0.55;

// Tiny seeded random generator (mulberry32), so a sketchy shape wobbles the same way on every redraw.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const newSeed = () => (Math.random() * 2147483647) | 0;
const isClosed = (P) => P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 0.5;
const fmt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

// Round the corners of a polyline (px). Closed outlines get their starting corner rounded too.
function roundCorners(P, closed) {
  const corner = (prev, c, next) => {
    const l1 = Math.hypot(c[0] - prev[0], c[1] - prev[1]), l2 = Math.hypot(next[0] - c[0], next[1] - c[1]);
    const r = Math.min(24, l1 * 0.25, l2 * 0.25);
    if (r < 1) return [c];
    const a = [c[0] + (prev[0] - c[0]) * r / l1, c[1] + (prev[1] - c[1]) * r / l1];
    const b = [c[0] + (next[0] - c[0]) * r / l2, c[1] + (next[1] - c[1]) * r / l2];
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
    return pts;
  };
  const out = [];
  if (closed) {
    const Q = P.slice(0, -1), m = Q.length;
    for (let i = 0; i < m; i++) out.push(...corner(Q[(i - 1 + m) % m], Q[i], Q[(i + 1) % m]));
    out.push(out[0]);
    return out;
  }
  out.push(P[0]);
  for (let i = 1; i < P.length - 1; i++) out.push(...corner(P[i - 1], P[i], P[i + 1]));
  out.push(P[P.length - 1]);
  return out;
}

// Smooth curve through every point (Catmull-Rom spline as cubic Béziers): no kinks, unlike
// smoothThrough(), which only passes near the points. Returns path data after the initial M.
function catmull(Q, closed) {
  const n = Q.length;
  if (n < 3) return Q.slice(1).map(p => ` L${fmt(p)}`).join('');
  const at = (i) => (closed ? Q[(i + n) % n] : Q[Math.max(0, Math.min(n - 1, i))]);
  let d = '';
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += ` C${fmt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${fmt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${fmt(p2)}`;
  }
  return d;
}

// Evenly spaced points along a polyline, `step` px apart. Smooth splines through unevenly spaced
// points (dense in rounded corners, sparse along the sides) overshoot past the corners.
function resample(P, step) {
  const out = [P[0]];
  let acc = 0;                                   // distance since the last point we kept
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let pos = step - acc;
    while (pos <= L) { const t = pos / L; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); pos += step; }
    acc = L - (pos - step);
  }
  const last = P[P.length - 1], end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > step / 3) out.push(last);
  return out;
}

// Center and radii of a full (un-erased) ellipse shape, from its outline points. Else null.
// A rotated ellipse (s.rot, degrees, set by Select's rotate knob) is measured in its own axes.
function ellipseOf(s, P) {
  // A turned ellipse (s.rot, from Select's rotate knob) is drawn from its own points instead, so its
  // outline always matches its fill and selection, even when the paragraph is a different width.
  if (s.geom !== 'ellipse' || s.rot || P.length < 60 || !isClosed(P)) return null;
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
  return { cx: (l + r) / 2, cy: (t + b) / 2, rx: (r - l) / 2, ry: (b - t) / 2, rot: 0 };
}

// A point on ellipse E at angle a (in the ellipse's own, possibly rotated, frame).
function onEllipse(E, cx, cy, rx, ry, a) {
  const x = rx * Math.cos(a), y = ry * Math.sin(a);
  if (!E.rot) return [cx + x, cy + y];
  const c = Math.cos(E.rot * Math.PI / 180), n = Math.sin(E.rot * Math.PI / 180);
  return [cx + x * c - y * n, cy + x * n + y * c];
}

// Sketchy ellipse: two passes around the true ellipse, each starting at a random angle with a
// little wobble in the radius, overlapping a bit where the line meets itself (like Excalidraw).
function roughEllipse(E, level, seed, width) {
  const amp = (level === 1 ? 0.9 : 2.2) * (1 + Math.min(width, 8) * 0.1);
  const n = Math.max(12, Math.min(32, Math.round((Math.PI * (E.rx + E.ry)) / 18)));
  let d = '';
  for (let pass = 0; pass < 2; pass++) {
    const r = rng(seed + pass * 7919), j = (k) => (r() * 2 - 1) * amp * k;
    const a0 = r() * Math.PI * 2, overlap = (0.06 + r() * 0.08) * Math.PI * 2;
    const cx = E.cx + j(0.4), cy = E.cy + j(0.4), Q = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI * 2 + overlap);
      Q.push(onEllipse(E, cx, cy, E.rx + j(1), E.ry + j(1), a));
    }
    d += ` M${fmt(Q[0])}` + catmull(Q, false);
  }
  return d.trim();
}

// Hand-drawn look: two slightly different wobbly passes (level 1 = sketchy, 2 = rough).
// `straight`: polygons/lines/arrows draw each side as its own bowed line that overshoots a bit.
function roughData(P, level, seed, width, closed, straight) {
  const amp = (level === 1 ? 1.1 : 2.6) * (1 + Math.min(width, 8) * 0.12);
  let d = '';
  for (let pass = 0; pass < 2; pass++) {
    const r = rng(seed + pass * 7919), j = (k) => (r() * 2 - 1) * amp * k;
    if (straight) {
      for (let i = 1; i < P.length; i++) {
        const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, over = amp * 0.8 * r();
        const a2 = [a[0] - ux * over + j(0.6), a[1] - uy * over + j(0.6)];
        const b2 = [b[0] + ux * over + j(0.6), b[1] + uy * over + j(0.6)];
        const bow = j(1.4) * Math.min(1, L / 120);
        d += ` M${fmt(a2)} Q${fmt([(a[0] + b[0]) / 2 - uy * bow, (a[1] + b[1]) / 2 + ux * bow])} ${fmt(b2)}`;
      }
    } else {
      // Rounded shapes and partly erased ellipses: a smooth wobbly spline through the outline.
      const even = resample(P, 16), base = closed ? even.slice(0, -1) : even, Q = [];
      if (base.length < 2) { d += ` M${fmt(P[0])} L${fmt(P[P.length - 1])}`; continue; }   // zero-size (a shape's first instant)
      for (const p of base) Q.push([p[0] + j(0.8), p[1] + j(0.8)]);
      d += ` M${fmt(Q[0])}` + catmull(Q, closed) + (closed ? ' Z' : '');
    }
  }
  return d.trim();
}

// The outline points (px) of a shape, with rounded corners applied.
function shapeOutline(s, w) {
  let P = s.pts.map(p => [p[0] * w, p[1]]);
  const closed = isClosed(P), rounded = s.edges === 'round' && CORNERED.includes(s.geom) && P.length > 2;
  if (rounded) P = roundCorners(P, closed);
  return { P, closed, rounded };
}

function geomData(s, w) {
  if (s.pts.length < 2) return pathData(s.pts, w, true);
  const { P, closed, rounded } = shapeOutline(s, w);
  const E = ellipseOf(s, P);
  if (E && !s.rough) {     // a true ellipse (two half arcs), not a polygon
    const R = `${E.rx.toFixed(1)},${E.ry.toFixed(1)} ${(E.rot || 0).toFixed(1)}`;
    const a = fmt(onEllipse(E, E.cx, E.cy, E.rx, E.ry, 0)), b = fmt(onEllipse(E, E.cx, E.cy, E.rx, E.ry, Math.PI));
    return `M${a} A${R} 1 1 ${b} A${R} 1 1 ${a} Z`;
  }
  if (E) return roughEllipse(E, s.rough, s.seed || 1, s.width);
  if (s.geom === 'ellipse' && !s.rough && closed && P.length > 3) return `M${fmt(P[0])}` + catmull(P.slice(0, -1), true) + ' Z';   // turned: smooth through its points
  if (s.rough) return roughData(P, s.rough, s.seed || 1, s.width, closed, !rounded && s.geom !== 'ellipse');
  return 'M' + P.map(fmt).join(' L');
}

const strokeData = (s, w) => (isFountain(s) ? outlineData(s, w) : s.geom ? geomData(s, w) : pathData(s.pts, w));

// A shape's fill. It goes in the blended highlighter layer, so text stays readable through it.
function makeFill(s, w) {
  if (!s.fill || !s.geom || s.pts.length < 3) return null;
  const { P, closed } = shapeOutline(s, w);
  if (!closed) return null;                     // partly erased outlines lose their fill
  const p = activeDocument.createElementNS(SVGNS, 'path');
  p.classList.add('pa-fill');                  // styles.css tones fills down in dark mode
  p.setAttribute('d', 'M' + P.map(fmt).join(' L') + ' Z');
  p.setAttribute('fill', s.fill);
  p.setAttribute('fill-opacity', (FILL_OPACITY * (s.opacity != null ? s.opacity : 1)).toFixed(2));
  p.setAttribute('stroke', 'none');
  return p;
}

// Dash pattern for a line of width w. Round caps add w/2 to each end of a dash, so gaps get +w.
function dashArray(kind, w) {
  if (kind === 'dot') return `0.01 ${(w * 2 + 3).toFixed(1)}`;
  if (kind === 'dash') return `${Math.max(3, w * 2.5).toFixed(1)} ${(Math.max(4, w * 2) + w).toFixed(1)}`;
  return '';
}

// Highlighter gets flat ends like a chisel marker; pens (and single dots) get round ends.
const capFor = (s) => (isHighlight(s) && s.pts.length > 1 ? 'butt' : 'round');

function makePath(s, w) {
  const p = activeDocument.createElementNS(SVGNS, 'path');
  p.setAttribute('d', strokeData(s, w));
  const opacity = s.opacity != null ? s.opacity : 1;
  if (isFountain(s)) {
    p.setAttribute('fill', s.color);
    p.setAttribute('fill-opacity', opacity);
    p.setAttribute('stroke', 'none');
  } else {
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', s.color);
    p.setAttribute('stroke-width', s.width);
    p.setAttribute('stroke-opacity', opacity);
    p.setAttribute('stroke-linecap', capFor(s));
    p.setAttribute('stroke-linejoin', 'round');
    if (s.dash) p.setAttribute('stroke-dasharray', dashArray(s.dash, s.width));
  }
  return p;
}

// A soft glow drawn under a stroke picked with the lasso.
function makeHalo(s, w) {
  const p = activeDocument.createElementNS(SVGNS, 'path');
  p.setAttribute('d', pathData(s.pts, w, !!s.geom));
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke-width', String(s.width + 8));
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('stroke-linejoin', 'round');
  p.classList.add('pa-halo');
  return p;
}

// Thin out a finished stroke: drop points that change the line by less than `eps` px
// (Ramer-Douglas-Peucker). For the fountain pen, pressure changes count too, so its swells stay.
function simplify(pts, w, eps, pressurePx) {
  const n = pts.length;
  if (n < 3) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a][0] * w, ay = pts[a][1], bx = pts[b][0] * w, by = pts[b][1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let idx = -1, max = eps;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] * w, py = pts[i][1];
      let d = distToSegment(px, py, ax, ay, bx, by);
      if (pressurePx && pts[i][2] != null) {
        const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
        d = Math.max(d, Math.abs(pts[i][2] - (pts[a][2] + (pts[b][2] - pts[a][2]) * t)) * pressurePx);
      }
      if (d > max) { max = d; idx = i; }
    }
    if (idx >= 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Distance from point (px,py) to the line segment a-b.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Does an eraser of radius r at (x,y) touch stroke s? (Checks the segments, not just the points,
// so long straight lines with few points still get erased.)
// A drawing's bounding box in section px, cached until its points or the width change.
// Lets the eraser skip far-away ink cheaply now that it checks every paragraph's ink.
const BOXES = new WeakMap();
function strokeBox(s, w) {
  const c = BOXES.get(s);
  if (c && c.pts === s.pts && c.n === s.pts.length && c.w === w) return c.box;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const p of s.pts) { const x = p[0] * w; if (x < l) l = x; if (x > r) r = x; if (p[1] < t) t = p[1]; if (p[1] > b) b = p[1]; }
  const box = [l, t, r, b];
  BOXES.set(s, { pts: s.pts, n: s.pts.length, w, box });
  return box;
}

function eraserHits(s, w, x, y, r) {
  const tol = r + s.width / 2, P = s.pts;
  if (P.length === 1) return Math.hypot(P[0][0] * w - x, P[0][1] - y) < tol;
  for (let i = 1; i < P.length; i++) {
    if (distToSegment(x, y, P[i - 1][0] * w, P[i - 1][1], P[i][0] * w, P[i][1]) < tol) return true;
  }
  return false;
}

// Where segment a->b crosses the circle (cx,cy,r): the t values strictly between 0 and 1.
function circleCrossings(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const A = dx * dx + dy * dy;
  if (!A) return [];
  const B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return [];
  const sq = Math.sqrt(disc);
  return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].filter(t => t > 0 && t < 1);
}

// Partial eraser: cut out the part of stroke s that's under the eraser circle.
// Returns null if the eraser doesn't touch s, otherwise the leftover pieces (possibly none),
// each a copy of s with its own points. Pressure (3rd value) is carried along.
function cutStroke(s, w, x, y, r) {
  if (!eraserHits(s, w, x, y, r)) return null;
  const R = r + s.width / 2;
  const P = s.pts.map(p => [p[0] * w, p[1], p[2]]);
  const inside = (p) => Math.hypot(p[0] - x, p[1] - y) < R;
  if (P.length === 1) return [];
  const pieces = [];
  let cur = inside(P[0]) ? null : [P[0]];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    let wasInside = inside(a);
    for (const t of circleCrossings(a[0], a[1], b[0], b[1], x, y, R)) {
      const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] != null ? a[2] + (b[2] - a[2]) * t : undefined];
      if (wasInside) cur = [q];                                    // leaving the eraser: new piece
      else { if (cur) { cur.push(q); pieces.push(cur); } cur = null; }   // entering: piece ends here
      wasInside = !wasInside;
    }
    if (!inside(b)) (cur = cur || []).push(b);
  }
  if (cur) pieces.push(cur);
  // Closed outlines (rectangles, ellipses...) start and end at the same point. If that seam
  // wasn't erased, the first and last pieces are really one piece: join them back up.
  const n = P.length, closed = n > 2 && Math.hypot(P[0][0] - P[n - 1][0], P[0][1] - P[n - 1][1]) < 0.5;
  if (closed && pieces.length > 1 && !inside(P[0])) pieces.unshift(pieces.pop().concat(pieces.shift().slice(1)));
  const length = (pts) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  const back = (p) => (p[2] != null ? [+(p[0] / w).toFixed(4), +p[1].toFixed(1), +p[2].toFixed(2)] : [+(p[0] / w).toFixed(4), +p[1].toFixed(1)]);
  return pieces
    .filter(pts => pts.length >= 2 && length(pts) >= 2)          // drop crumbs
    .map(pts => ({ ...s, pts: pts.map(back) }));
}

// Snap a straight line from (x0,y0) to (x,y) to flat or upright when it's within SNAP_DEG.
function snapAxis(x0, y0, x, y) {
  const deg = Math.abs(Math.atan2(y - y0, x - x0) * 180 / Math.PI);
  if (deg < SNAP_DEG || deg > 180 - SNAP_DEG) return [x, y0];
  if (Math.abs(deg - 90) < SNAP_DEG) return [x0, y];
  return [x, y];
}

// Points (px) for a shape dragged from (x0,y0) to (x1,y1). Closed shapes repeat the first point.
// Near-square rectangles/ellipses snap to perfect squares/circles; near-flat lines snap flat.
function shapePoints(kind, x0, y0, x1, y1, width) {
  if (kind !== 'line' && kind !== 'arrow' && kind !== 'triangle') {   // near-square drags snap to square (regular shapes)
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), m = Math.max(w, h);
    if (m && Math.abs(w - h) / m < SQUARE_SNAP) { x1 = x0 + Math.sign(x1 - x0 || 1) * m; y1 = y0 + Math.sign(y1 - y0 || 1) * m; }
  }
  const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  if (kind === 'rect') return [[l, t], [r, t], [r, b], [l, b], [l, t]];
  if (kind === 'triangle') return [[(l + r) / 2, t], [r, b], [l, b], [(l + r) / 2, t]];
  if (kind === 'diamond') return [[(l + r) / 2, t], [r, (t + b) / 2], [(l + r) / 2, b], [l, (t + b) / 2], [(l + r) / 2, t]];
  if (kind === 'pentagon' || kind === 'hexagon' || kind === 'star') {
    // A regular polygon (or 5-point star), first point at the top, stretched to fill the drag box.
    const n = kind === 'pentagon' ? 5 : kind === 'hexagon' ? 6 : 10, U = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (kind === 'hexagon' ? Math.PI / 6 : 0), rad = kind === 'star' && i % 2 ? 0.42 : 1;
      U.push([rad * Math.cos(a), rad * Math.sin(a)]);
    }
    const xs = U.map(p => p[0]), ys = U.map(p => p[1]), ux = Math.min(...xs), uy = Math.min(...ys);
    const sx = (r - l) / (Math.max(...xs) - ux || 1), sy = (b - t) / (Math.max(...ys) - uy || 1);
    const P = U.map(p => [l + (p[0] - ux) * sx, t + (p[1] - uy) * sy]);
    return [...P, P[0]];
  }
  if (kind === 'ellipse') {
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = (r - l) / 2, ry = (b - t) / 2, n = 64, pts = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return pts;
  }
  [x1, y1] = snapAxis(x0, y0, x1, y1);
  if (kind === 'line') return [[x0, y0], [x1, y1]];
  // arrow: shaft, then the two sides of the head (one continuous line, so it erases/moves as one)
  const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.max(10, width * 3 + 8), spread = Math.PI / 7;
  const wing = (s) => [x1 - len * Math.cos(ang + s), y1 - len * Math.sin(ang + s)];
  return [[x0, y0], [x1, y1], wing(spread), [x1, y1], wing(-spread)];
}

// Shortest distance between segments a-b and c-d (0 if they cross).
function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
  return Math.min(distToSegment(a[0], a[1], c[0], c[1], d[0], d[1]), distToSegment(b[0], b[1], c[0], c[1], d[0], d[1]),
    distToSegment(c[0], c[1], a[0], a[1], b[0], b[1]), distToSegment(d[0], d[1], a[0], a[1], b[0], b[1]));
}

// Select tool: does the loop `poly` pick the drawing `pts` (both in screen px)? Yes if any point of
// the drawing is inside the loop, or the loop's line passes within `reach` of the drawing.
function loopPicks(poly, pts, reach) {
  const box = (P) => P.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const A = box(poly), B = box(pts);
  if (A[2] + reach < B[0] || B[2] + reach < A[0] || A[3] + reach < B[1] || B[3] + reach < A[1]) return false;   // far apart
  if (poly.length >= 3 && pts.some(p => inPolygon(p[0], p[1], poly))) return true;
  const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((p, i) => [pts[i], p]);
  for (let i = 1; i < poly.length; i++) {
    for (const [c, d] of segs) if (segmentDistance(poly[i - 1], poly[i], c, d) <= reach) return true;
  }
  return false;
}

// Is (x,y) inside the polygon? (ray casting)
function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Icons drawn on a 24x24 grid (outline style, like Obsidian's own icons).
// The highlighter and sliders shapes follow Lucide's icons (ISC license).
const ICONS = {
  hand: ['M8 13V6a1.5 1.5 0 0 1 3 0v5', 'M11 11V4.5a1.5 1.5 0 0 1 3 0V11', 'M14 11V6a1.5 1.5 0 0 1 3 0v6',
    'M17 11.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.5-2L4.3 16.6a1.5 1.5 0 0 1 2.2-2L8 16V13'],
  pen: ['M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z', 'M14.5 5.5l3 3'],
  highlighter: ['M9 11l-6 6v3h9l3-3', 'M21.5 12.5l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8l4.6-4.6'],
  eraser: ['M4.4 13.6l8.2-8.2a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L12 20H8l-3.6-3.6a2 2 0 0 1 0-2.8z', 'M8.5 9.5l6 6', 'M12 20h8'],
  laser: ['M4 20l8.5-8.5', 'M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M16.5 1.5v1', 'M22.5 7.5h-1', 'M20.7 3.3l-.8.8', 'M12.3 3.3l.8.8', 'M20.7 11.7l-.8-.8'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  duplicate: ['M8 8h12v12H8z', 'M4 16V4h12'],
  rotate: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  copy: ['M9 2h6v4H9z', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'],
  paste: ['M9 2h6v4H9z', 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5', 'M16 4h2a2 2 0 0 1 2 2v4', 'M13 15h8', 'M18 12l3 3-3 3'],
  front: ['M12 19V5', 'M5 12l7-7 7 7'],
  back: ['M12 5v14', 'M19 12l-7 7-7-7'],
  select: ['M11 3.5c4.6-.6 9.6 1.4 9.5 5.8-.1 3.7-3.2 4.6-3.6 7.6-.4 3.1-4.6 4.4-8.2 3.3C4.7 19 2.8 15.6 3.6 11.5 4.3 7.5 6.9 4 11 3.5z'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  toVertical: ['M12 3v18', 'M8 7l4-4 4 4', 'M8 17l4 4 4-4'],
  toHorizontal: ['M3 12h18', 'M7 8l-4 4 4 4', 'M17 8l4 4-4 4'],
  check: ['M20 6L9 17l-5-5'],
  grip: ['M9 5.5h.01', 'M15 5.5h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18.5h.01', 'M15 18.5h.01'],
  trash: ['M3 6h18', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6', 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
  starFilled: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
  rect: ['M4 5h16v14H4z'],
  ellipse: ['M3 12a9 7 0 1 0 18 0a9 7 0 1 0 -18 0'],
  triangle: ['M12 4L21 20H3z'],
  diamond: ['M12 3l9 9-9 9-9-9z'],
  pentagon: ['M12 3l9 6.5-3.4 10.5H6.4L3 9.5z'],
  hexagon: ['M7 4h10l5 8-5 8H7l-5-8z'],
  line: ['M4 20L20 4'],
  arrow: ['M4 20L20 4', 'M10 4h10v10'],
};
const SHAPE_NAMES = { rect: 'Rectangle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', pentagon: 'Pentagon', hexagon: 'Hexagon', star: 'Star', line: 'Line', arrow: 'Arrow' };

function svgIcon(paths, size, strokeWidth, dash) {
  const svg = activeDocument.createElementNS(SVGNS, 'svg');
  const px = String(size || 24);
  svg.setAttribute('width', px); svg.setAttribute('height', px); svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', String(strokeWidth || 1.8));
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  if (dash) svg.setAttribute('stroke-dasharray', dash);
  for (const d of paths) {
    const p = activeDocument.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

// Where a paragraph is on screen and how much it's magnified. `width` is its real (unzoomed)
// width and `s` the scale (Pen Ink's zoom, or any other CSS scaling). Ink is always stored
// unzoomed, so a screen point becomes ink coordinates as (client - left) / s.
function frameOf(el) {
  const r = el.getBoundingClientRect(), width = el.offsetWidth || r.width || 1;
  return { left: r.left, top: r.top, width, s: (r.width / width) || 1 };
}

// Put an absolutely positioned (visible) HTML element's top-left corner at viewport point (x, y).
// It measures where left/top 0 actually lands and corrects for it, instead of guessing the
// containing block. Guessing went wrong twice: the eraser ring ~1in too high (v1.4), and the
// laser dot / eraser ring a few px off in real Obsidian (v1.9.1). Measuring can't be fooled by
// headers, borders, scrolling or transformed containers.
function placeAt(el, x, y) {
  const r = el.getBoundingClientRect();
  const left = parseFloat(el.style.left) || 0, top = parseFloat(el.style.top) || 0;   // styles.css starts it at 0,0
  css(el, { left: (left + x - r.left) + 'px', top: (top + y - r.top) + 'px' });
}

// The only two ways this plugin touches inline styles, both for values that change at runtime
// (positions, sizes, the colors you pick). Every fixed look is a class in styles.css.
// setCssStyles / setCssProps are Obsidian's helpers for exactly this. Never pass fixed values here.
function css(el, styles) { el.setCssStyles(styles); }
function cssVars(el, vars) { el.setCssProps(vars); }
const show = (el, on) => el.classList.toggle('pa-hidden', !on);

function makeLayer(cls) {
  const svg = activeDocument.createElementNS(SVGNS, 'svg');
  svg.classList.add('pa-overlay', cls);
  // Layout-critical styles are inline so ink lands in the right place even if styles.css is stale.
  svg.classList.add('pa-hidden');                 // shown once it has ink
  return svg;
}

// Tiny DOM helper: h('div', 'class names', child, child...)
function h(tag, cls, ...kids) {
  const el = activeDocument.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k != null) el.append(k);
  return el;
}

// ---------------------------------------------------------------------------
// One rendered section of a note (paragraph, list, heading...) and its ink layers
// ---------------------------------------------------------------------------
class SectionChild extends MarkdownRenderChild {
  constructor(el, plugin, notePath, key) {
    super(el); this.plugin = plugin; this.notePath = notePath; this.key = key; this.live = null;
  }
  onload() {
    const el = this.containerEl;
    // Always make the section the anchor for its overlays. Don't check getComputedStyle()
    // first: post-processors run while the element is still detached from the page, so the
    // computed style is empty. That's what made all the ink pile up at the top in v1.1.
    el.classList.add('pa-section');
    // Two layers: highlighter (blended so the text shows through) under the pen ink.
    this.hlLayer = makeLayer('pa-layer-hl');
    this.inkLayer = makeLayer('pa-layer-ink');
    el.append(this.hlLayer, this.inkLayer);
    el.dataset.paKey = this.key;
    el.dataset.paPath = this.notePath;
    el.paChild = this;
    this.plugin.sawKey(this.notePath, this.key);
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(el);
    // Draw right away when the ink is already loaded: Export to PDF renders the note into a fresh
    // page and prints it soon after, so waiting a tick could leave the ink out.
    if (this.plugin.inkData(this.notePath)) this.draw();
    else this.plugin.loadInk(this.notePath).then(() => this.draw());
  }
  onunload() {
    if (this.ro) this.ro.disconnect();
    if (this.hlLayer) this.hlLayer.remove();
    if (this.inkLayer) this.inkLayer.remove();
    if (this.containerEl.paChild === this) delete this.containerEl.paChild;
  }
  width() { return this.containerEl.offsetWidth || this.containerEl.clientWidth || 1; }   // unzoomed
  layerFor(s) { return isHighlight(s) ? this.hlLayer : this.inkLayer; }

  // Show a stroke while it's being drawn (survives redraws). setLive(null) removes it.
  setLive(path, s, fill) {
    if (this.live) { this.live.path.remove(); if (this.live.fill) this.live.fill.remove(); }
    this.live = path ? { path, s, fill } : null;
    if (path) { const layer = this.layerFor(s); show(layer, true); layer.appendChild(path); }
    if (fill) { show(this.hlLayer, true); this.hlLayer.appendChild(fill); }
  }

  draw() {
    if (!this.inkLayer) return;
    const w = this.width(), selected = this.plugin.selected;
    this.hlLayer.replaceChildren();
    this.inkLayer.replaceChildren();
    for (const s of this.plugin.strokesFor(this.notePath, this.key)) {
      if (selected.has(s)) this.inkLayer.appendChild(makeHalo(s, w));
      const fill = makeFill(s, w);
      if (fill) this.hlLayer.appendChild(fill);
      this.layerFor(s).appendChild(makePath(s, w));
    }
    if (this.live) {
      this.layerFor(this.live.s).appendChild(this.live.path);
      if (this.live.fill) this.hlLayer.appendChild(this.live.fill);
    }
    // Hide empty layers so long notes don't pay for hundreds of blended layers.
    show(this.hlLayer, !!this.hlLayer.firstChild);
    show(this.inkLayer, !!this.inkLayer.firstChild);
  }
}

// ---------------------------------------------------------------------------
// Settings → Pen Ink
// ---------------------------------------------------------------------------
const PenInkSettings = PluginSettingTab && class extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const el = this.containerEl, P = this.plugin.prefs;
    el.empty();
    const changed = () => { this.plugin.savePrefs(); this.plugin.refreshToolbars(); };
    new Setting(el).setName('Ink folder')
      .setDesc('Where drawings are saved, as one .json file per note. Changing this doesn\'t move existing drawings: move the folder yourself.')
      .addText(t => {
        t.setPlaceholder(FOLDER).setValue(this.plugin.inkFolder());
        // Apply when the field is left / Enter is pressed, not on every keystroke.
        t.inputEl.addEventListener('change', () => {
          if (cleanFolder(t.getValue())) this.plugin.changeFolder(t.getValue());
          else t.setValue(this.plugin.inkFolder());
        });
      });
    new Setting(el).setName('Draw with finger')
      .setDesc('One finger draws; two fingers scroll and zoom. On by default on phones. A pen always draws, and once you use one, fingers go back to scrolling until you tap Done.')
      .addToggle(t => t.setValue(this.plugin.fingerSetting()).onChange(v => { P.fingerDraws = v; changed(); }));
    new Setting(el).setName('Hold to straighten')
      .setDesc('Pause at the end of a pen or highlighter line and it snaps into a straight line.')
      .addToggle(t => t.setValue(P.holdToStraighten).onChange(v => { P.holdToStraighten = v; changed(); }));
    new Setting(el).setName('Straight highlighter')
      .setDesc('Every highlight is a straight line (great for marking text). Also in the highlighter card.')
      .addToggle(t => t.setValue(P.hl.straight).onChange(v => { P.hl.straight = v; changed(); }));
    new Setting(el).setName('Smoothing')
      .setDesc('Steadies shaky lines. 0 = exactly what you draw.')
      .addSlider(s => s.setLimits(0, 80, 10).setValue(P.smoothing).setDynamicTooltip().onChange(v => { P.smoothing = v; changed(); }));
    new Setting(el).setName('Eraser switches back')
      .setDesc('After erasing, go back to the pen or highlighter you were using. Also in the eraser card.')
      .addToggle(t => t.setValue(P.eraser.autoReturn).onChange(v => { P.eraser.autoReturn = v; changed(); }));
  }
};

// ---------------------------------------------------------------------------
// The plugin
// ---------------------------------------------------------------------------
class PenInk extends Plugin {
  // NOTE: never name methods load, unload, register*, addChild, loadData, saveData, etc.
  // They'd override Obsidian's Component/Plugin methods (that's what crashed v1.0).
  async onload() {
    try { await this.setup(); }
    catch (e) {
      console.error('Pen Ink failed to start', e);
      new Notice('Pen Ink error: ' + ((e && (e.stack || e.message)) || e), 0);
    }
  }

  async setup() {
    this.cache = new Map();        // notePath -> ink data (or a Promise while loading)
    this.saveTimers = new Map();   // notePath -> pending debounced save
    this.lastWritten = new Map();  // notePath -> JSON we last wrote/read (to spot Sync changes)
    this.sessions = new Map();     // MarkdownView -> annotation session state
    this.selected = new Set();     // strokes picked with the lasso
    this.inkClip = null;           // copied ink: { w, h, n, strokes } in px from the copied box's top-left
    this.undoStack = [];
    this.redoStack = [];
    this.saveFails = new Map();    // notePath -> failed attempts to read/write the ink file
    this.writing = new Map();      // notePath -> JSON being written right now
    this.noteText = new Map();     // notePath -> its sections (key -> text) as last seen, to follow edits
    this.seenKeys = new Map();     // notePath -> keys rendered since launch (and not edited away since)
    this.hiddenNotice = null;      // { notice, at } of the last "ink is hidden" notice
    this.lostKeys = new Map();     // notePath -> keys whose ink an edit hid (what the notice brings back)
    this.editQueue = new Map();    // notePath -> the edit being followed (one at a time, in order)
    this.prefsTimer = null;
    this.prefs = mergePrefs(await this.loadData());

    if (PenInkSettings) this.addSettingTab(new PenInkSettings(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => {
      const info = ctx.getSectionInfo(el);
      if (!info || !ctx.sourcePath) return;
      const src = sectionSource(info);
      if (!src) return;
      const meta = this.app.metadataCache && this.app.metadataCache.getCache ? this.app.metadataCache.getCache(ctx.sourcePath) : null;
      const n = repeatIndex(info, src, meta && meta.sections);
      ctx.addChild(new SectionChild(el, this, ctx.sourcePath, hash(src) + (n ? '~' + n : '')));
    });

    const inSession = (fn) => (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !this.sessions.has(view)) return false;
      if (!checking) fn(view);
      return true;
    };
    this.addCommand({ id: 'toggle', name: 'Toggle annotation mode', checkCallback: (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return false;
      if (!checking) this.toggle(view);
      return true;
    }});
    this.addCommand({ id: 'undo', name: 'Undo last ink change', checkCallback: inSession(() => this.undoLast()) });
    this.addCommand({ id: 'redo', name: 'Redo last ink change', checkCallback: inSession(() => this.redoLast()) });
    this.addCommand({ id: 'reset-zoom', name: 'Reset zoom to 100%', checkCallback: inSession((view) => this.resetZoom(this.sessions.get(view))) });
    const withSel = (fn) => (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !this.sessions.has(view) || !this.selected.size) return false;
      if (!checking) fn(this.sessions.get(view));
      return true;
    };
    this.addCommand({ id: 'copy-ink', name: 'Copy selected ink', checkCallback: withSel((st) => this.copySelection(st)) });
    this.addCommand({ id: 'cut-ink', name: 'Cut selected ink', checkCallback: withSel((st) => this.copySelection(st, true)) });
    this.addCommand({ id: 'paste-ink', name: 'Paste ink', checkCallback: (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !this.sessions.has(view) || !this.inkClip) return false;
      if (!checking) this.pasteInk(this.sessions.get(view));
      return true;
    }});
    this.addCommand({ id: 'recover-hidden-ink', name: 'Bring back hidden ink', checkCallback: (checking) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.file || !this.hiddenKeys(view.file.path).length) return false;
      if (!checking) { const j = this.justHidden(view.file.path); this.recoverHidden(view, j.length ? j : null); }
      return true;
    }});
    // Cmd/Ctrl + C, X, V while marking up. Only when there's ink to act on, and never while typing
    // in a field, so normal copy and paste keep working everywhere else.
    this.registerDomEvent(activeDocument, 'keydown', (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const view = this.app.workspace.getActiveViewOfType(MarkdownView), st = view && this.sessions.get(view);
      if (!st) return;
      const k = e.key.toLowerCase();
      if ((k === 'c' || k === 'x') && this.selected.size) { e.preventDefault(); this.copySelection(st, k === 'x'); }
      else if (k === 'v' && this.inkClip) { e.preventDefault(); this.pasteInk(st); }
    });

    // Header button: our own marker icon, so it doesn't look like Obsidian's edit (pencil) toggle.
    let headerIcon = 'highlighter';
    if (typeof addIcon === 'function') {
      headerIcon = 'pen-ink-marker';
      const paths = ICONS.highlighter.map(d => `<path d="${d}"/>`).join('');
      addIcon(headerIcon, `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`);
    }
    const addButtons = () => this.app.workspace.iterateAllLeaves(leaf => {
      const v = leaf.view;
      if (v instanceof MarkdownView && !v.penInkButton) v.penInkButton = v.addAction(headerIcon, 'Mark up with Pen Ink', () => this.toggle(v));
    });
    this.app.workspace.onLayoutReady(addButtons);
    this.registerEvent(this.app.workspace.on('layout-change', addButtons));
    // A pane that was closed while marking up: end its session (listeners, toolbar, timers).
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      for (const [v, st] of [...this.sessions]) {
        const c = v.containerEl;
        if (c && (!c.isConnected || (st.doc && c.ownerDocument !== st.doc))) this.stop(v);   // closed, or moved to another window
      }
    }));

    this.registerEvent(this.app.vault.on('rename', async (file, oldPath) => {
      if (!(file instanceof TFile) || !oldPath.endsWith('.md')) return;
      for (const m of [this.noteText, this.seenKeys, this.lostKeys]) if (m.has(oldPath)) { m.set(file.path, m.get(oldPath)); m.delete(oldPath); }
      try {
        if (this.saveTimers.has(oldPath)) await this.writeInk(oldPath);   // save under the old name first
        const from = this.dataPath(oldPath), to = this.dataPath(file.path), src = this.inkFile(from), dest = this.inkFile(to);
        if (from !== to && src && !dest) {
          await this.ensureFolder(to);
          await this.app.vault.rename(src, to);
          for (const m of [this.cache, this.lastWritten]) if (m.has(oldPath)) { m.set(file.path, m.get(oldPath)); m.delete(oldPath); }
        } else if (from !== to && src && dest) {
          // An ink file already has the new name (left by a deleted note). Keep both: add this note's
          // ink to it, then move the old file to the trash (recoverable), never delete it outright.
          const mine = parseInk(await this.app.vault.read(src)), other = parseInk(await this.app.vault.read(dest));
          if (!mine || !other) throw new Error('an ink file could not be read; nothing was changed');
          for (const k of Object.keys(mine.sections)) other.sections[k] = [...(other.sections[k] || []), ...mine.sections[k]];
          const json = JSON.stringify(other);
          await this.app.vault.modify(dest, json);
          if (this.app.fileManager && this.app.fileManager.trashFile) await this.app.fileManager.trashFile(src);
          this.cache.delete(oldPath); this.lastWritten.delete(oldPath);
          this.cache.set(file.path, other); this.lastWritten.set(file.path, json);
          this.forgetHistory(oldPath);
          this.redraw(file.path);
        } else {
          for (const m of [this.cache, this.lastWritten]) if (m.has(oldPath)) { m.set(file.path, m.get(oldPath)); m.delete(oldPath); }
        }
        // Rendered paragraphs and undo steps still name the old path.
        for (const el of activeDocument.querySelectorAll('[data-pa-path]')) {
          if (el.dataset.paPath !== oldPath) continue;
          el.dataset.paPath = file.path;
          if (el.paChild) el.paChild.notePath = file.path;
        }
        const retarget = (a) => { if (a.type === 'batch') a.items.forEach(retarget); else if (a.path === oldPath) a.path = file.path; };
        for (const a of [...this.undoStack, ...this.redoStack]) retarget(a);
      } catch (e) { console.error('Pen Ink: could not move ink for renamed note', oldPath, e); }
    }));

    // A note was edited: move ink along with paragraphs that only changed a little.
    if (this.app.metadataCache && this.app.metadataCache.on) {
      this.registerEvent(this.app.metadataCache.on('changed', (file, data, cache) => this.onNoteChanged(file, data, cache)));
    }
    // Notes opened straight into editing (no reading view yet) still need a "before" to compare to.
    const watchNote = (file) => {
      if (file instanceof TFile && file.path.endsWith('.md') && !this.noteText.has(file.path) && this.inkFile(this.dataPath(file.path))) this.snapshot(file.path);
    };
    this.registerEvent(this.app.workspace.on('file-open', watchNote));
    this.app.workspace.onLayoutReady(() => this.app.workspace.iterateAllLeaves(leaf => { if (leaf.view instanceof MarkdownView) watchNote(leaf.view.file); }));

    // Ink changed on another device (Obsidian Sync): reload it so we never save stale data over it.
    this.registerEvent(this.app.vault.on('modify', (file) => this.onInkFileChanged(file)));
    // ...or arrived for the first time (Sync creates the file) while the note is already open.
    this.registerEvent(this.app.vault.on('create', (file) => this.onInkFileChanged(file)));
    // Notes already open in reading view were rendered before we loaded: re-render them so their
    // paragraphs get ink layers (also after an update or turning the plugin off and on).
    this.app.workspace.onLayoutReady(() => this.app.workspace.iterateAllLeaves(leaf => {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.getMode && v.getMode() === 'preview' && v.previewMode && v.previewMode.rerender) v.previewMode.rerender(true);
    }));
  }

  onunload() {
    for (const view of [...this.sessions.keys()]) this.stop(view);
    this.app.workspace.iterateAllLeaves(leaf => {
      const v = leaf.view;
      if (v && v.penInkButton) { v.penInkButton.remove(); delete v.penInkButton; }
    });
    for (const notePath of [...this.saveTimers.keys()]) this.writeInk(notePath);   // flush pending saves
    // Rendered paragraphs belong to Obsidian's renderer, not to us: take our layers off them now,
    // so a re-enabled (or updated) copy of the plugin starts clean.
    for (const el of activeDocument.querySelectorAll('[data-pa-key]')) if (el.paChild) el.paChild.onunload();
    if (this.prefsTimer) { window.clearTimeout(this.prefsTimer); this.saveData(this.prefs); }
  }

  // ----- ink storage -------------------------------------------------------

  inkFolder() { return cleanFolder(this.prefs.folder) || FOLDER; }
  fingerSetting() { const f = this.prefs.fingerDraws; return typeof f === 'boolean' ? f : !!Platform.isPhone; }
  dataPath(notePath) { return normalizePath(`${this.inkFolder()}/${notePath.replace(/\.md$/, '')}.json`); }
  inkFile(path) { const f = this.app.vault.getAbstractFileByPath(path); return f instanceof TFile ? f : null; }

  async ensureFolder(filePath) {
    const parts = filePath.split('/').slice(0, -1); let cur = '';
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        try { await this.app.vault.createFolder(cur); } catch (e) { /* created in the meantime */ }
      }
    }
  }

  async readInkFile(notePath) {
    let data = { version: 1, sections: {} };
    try {
      const file = this.inkFile(this.dataPath(notePath));
      if (file) {
        const raw = await this.app.vault.read(file);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sections && typeof parsed.sections === 'object') data = parsed;
        this.lastWritten.set(notePath, raw);
      }
    } catch (e) { console.error('Pen Ink: could not read ink for', notePath, e); }
    return data;
  }

  loadInk(notePath) {
    if (this.cache.has(notePath)) return Promise.resolve(this.cache.get(notePath));
    const p = this.readInkFile(notePath).then(data => { this.cache.set(notePath, data); return data; });
    this.cache.set(notePath, p);
    if (!this.noteText.has(notePath)) this.snapshot(notePath);
    return p;
  }

  // ----- following edits ---------------------------------------------------
  // Ink is stored per paragraph text, so editing a paragraph used to hide its ink. Now: when a
  // paragraph with ink changes only a little (a typo, an added sentence), the ink moves to the
  // new version. Bigger rewrites keep it hidden (it may not line up), with a way to bring it back.

  // Read the note's sections now (in line with the edits being followed, never in between).
  snapshot(notePath) {
    const run = async () => {
      const file = this.app.vault.getAbstractFileByPath(notePath), mc = this.app.metadataCache;
      if (!(file instanceof TFile) || !mc || !mc.getCache || !this.app.vault.cachedRead) return;
      try {
        const text = await this.app.vault.cachedRead(file), meta = mc.getCache(notePath), secs = meta && meta.sections;
        // The index may lag behind the text for a moment: then its line numbers don't fit. Skip it.
        if (!secs || secs.some(x => x.position && typeof x.position.end.offset === 'number' && x.position.end.offset > text.length)) return;
        const out = noteSections(text, secs);
        if (out) this.noteText.set(notePath, out);
      } catch (e) { /* not readable right now: no snapshot */ }
    };
    const q = (this.editQueue.get(notePath) || Promise.resolve()).then(run).catch(() => {});
    this.editQueue.set(notePath, q);
    return q;
  }

  // Edited here: the note is open in a pane on this device (any mode: Obsidian can index an edit
  // just after you switch to reading view). Edits to notes that aren't open, like ones arriving
  // through Sync, are left alone: the device they were typed on moves the ink and syncs that.
  openHere(notePath) {
    let open = false;
    this.app.workspace.iterateAllLeaves(leaf => { const v = leaf.view; if (v instanceof MarkdownView && v.file && v.file.path === notePath) open = true; });
    return open;
  }

  sawKey(notePath, key) {
    if (!this.seenKeys.has(notePath)) this.seenKeys.set(notePath, new Set());
    this.seenKeys.get(notePath).add(key);
  }

  // One edit at a time per note, in order: each compares against the one before it.
  onNoteChanged(file, data, cache) {
    if (!(file instanceof TFile) || !file.path.endsWith('.md')) return Promise.resolve();
    const notePath = file.path, local = this.openHere(notePath), run = () => this.followEdit(notePath, data, cache, local);
    const q = (this.editQueue.get(notePath) || Promise.resolve()).then(run)
      .catch(e => console.error('Pen Ink: could not follow an edit in', notePath, e));
    this.editQueue.set(notePath, q);
    return q;
  }

  async followEdit(notePath, data, cache, local) {
    const before = this.noteText.get(notePath), hasInk = this.cache.has(notePath) || !!this.inkFile(this.dataPath(notePath));
    if (!before && !hasInk) return;   // nothing to follow: don't keep the text of every note around
    const after = noteSections(data, cache && cache.sections);
    if (!after) return;
    this.noteText.set(notePath, after);
    if (!before) return;
    const seen = this.seenKeys.get(notePath);
    if (seen) for (const k of before.keys()) if (!after.has(k)) seen.delete(k);
    if (!hasInk || !local) return;
    const d = await this.loadInk(notePath);
    const { moves, lost } = matchEdits(before, after, k => !!(d.sections[k] && d.sections[k].length));
    if (moves.length) {
      const retarget = (a, from, to) => { if (a.type === 'batch') a.items.forEach(i => retarget(i, from, to)); else if (a.path === notePath && a.key === from) a.key = to; };
      for (const [from, to] of moves) {
        d.sections[to] = d.sections[from];
        delete d.sections[from];
        for (const a of [...this.undoStack, ...this.redoStack]) retarget(a, from, to);
        this.redraw(notePath, from);
        this.redraw(notePath, to);
      }
      this.saveInk(notePath);
    }
    if (lost.length) {
      if (!this.lostKeys.has(notePath)) this.lostKeys.set(notePath, new Set());
      for (const k of lost) this.lostKeys.get(notePath).add(k);
      this.tellHidden(notePath);
    }
  }

  // Paragraph keys with ink that no paragraph of the note has anymore. A key Obsidian rendered
  // since launch, and that no edit took away, always counts as present.
  hiddenKeys(notePath) {
    const d = this.inkData(notePath), cur = this.noteText.get(notePath);
    if (!d || !cur) return [];
    const seen = this.seenKeys.get(notePath) || new Set();
    return Object.keys(d.sections).filter(k => d.sections[k] && d.sections[k].length && !cur.has(k) && !seen.has(k));
  }

  // Hidden ink that an edit seen here took away (what the notice offers to bring back).
  justHidden(notePath) {
    const lost = this.lostKeys.get(notePath);
    return lost ? this.hiddenKeys(notePath).filter(k => lost.has(k)) : [];
  }

  tellHidden(notePath) {
    const n = this.justHidden(notePath).length;
    if (!n) return;
    const H = this.hiddenNotice;
    if (H && Date.now() - H.at < 8000 && H.notice.hide) H.notice.hide();   // one notice, updated, while deleting a few
    const msg = `Pen Ink hid the ink on ${n === 1 ? 'a paragraph' : n + ' paragraphs'} you rewrote or deleted, since it may not line up anymore.`;
    let content = msg;
    if (activeDocument.createDocumentFragment) {
      content = activeDocument.createDocumentFragment();
      content.append(msg + ' ');
      const b = h('button', 'pa-notice-btn', 'Bring it back');
      b.addEventListener('click', () => {
        const v = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (v && v.file && v.file.path === notePath) this.recoverHidden(v, this.justHidden(notePath));
        else new Notice('Open the note, then run "Pen Ink: Bring back hidden ink".');
      });
      content.append(b);
    }
    this.hiddenNotice = { notice: new Notice(content, 10000), at: Date.now() };
  }

  // Put hidden ink back on the page: stacked in the middle of the screen, selected, so it can be
  // dragged where it belongs (or deleted). One undo puts it back into hiding.
  // `only`: just these keys (the notice's); otherwise all hidden ink in the note.
  async recoverHidden(view, only) {
    if (!view.file) return false;
    const notePath = view.file.path;
    if (!this.sessions.has(view)) await this.start(view);
    const st = this.sessions.get(view);
    if (!st) return false;
    await this.loadInk(notePath);
    await this.snapshot(notePath);
    for (let i = 0; i < 20 && !this.sections(st.root).length; i++) await new Promise(r => window.setTimeout(r, 50));   // just switched to reading view
    const keys = this.hiddenKeys(notePath).filter(k => !only || only.includes(k)), d = this.inkData(notePath), first = this.sections(st.root)[0];
    if (!keys.length || !d || !first) { new Notice('Pen Ink: no hidden ink in this note.'); return false; }
    const W = frameOf(first).width, GAP = 24, strokes = [], erased = [];
    let y = 0, w = 0;
    for (const k of keys) {
      const list = d.sections[k].filter(s => s.pts && s.pts.length);
      if (!list.length) continue;
      let x0 = Infinity, y0 = Infinity, y1 = -Infinity;   // loops, not Math.min(...): long strokes have many points
      for (const s of list) for (const p of s.pts) { x0 = Math.min(x0, p[0] * W); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      for (const s of list) {
        const c = clone(s);
        c.pts = s.pts.map(p => { const q = p.slice(); q[0] = +(p[0] * W - x0).toFixed(1); q[1] = +(p[1] - y0 + y).toFixed(1); w = Math.max(w, q[0]); return q; });
        strokes.push(c);
        const i = d.sections[k].indexOf(s);
        d.sections[k].splice(i, 1);
        erased.push({ type: 'erase', path: notePath, key: k, s, index: i });
      }
      y += y1 - y0 + GAP;
    }
    const placed = strokes.length ? this.placeClip(st, { w, h: y - GAP, strokes }, 0, erased, true) : 0;
    if (placed !== strokes.length || !placed) {
      // Every piece must land in this note, or nothing moves (one undo step to take back).
      if (placed) { this.undoLast(notePath); this.redoStack.pop(); }
      else for (const a of [...erased].reverse()) this.applyChange(a, true);
      new Notice('Pen Ink: could not bring the hidden ink back here.');
      return false;
    }
    this.saveInk(notePath);
    new Notice(`Pen Ink brought back the ink from ${keys.length === 1 ? 'a paragraph' : keys.length + ' paragraphs'}. It's selected: drag it into place, or delete it.`);
    return true;
  }

  inkData(notePath) { const d = this.cache.get(notePath); return d && !(d instanceof Promise) ? d : null; }
  strokesFor(notePath, key) { const d = this.inkData(notePath); return (d && d.sections[key]) || []; }

  saveInk(notePath) {
    window.clearTimeout(this.saveTimers.get(notePath));
    this.saveTimers.set(notePath, window.setTimeout(() => this.writeInk(notePath), SAVE_DELAY));
  }

  async writeInk(notePath) {
    window.clearTimeout(this.saveTimers.get(notePath));
    this.saveTimers.delete(notePath);
    const d = this.inkData(notePath); if (!d) return;
    const f = this.dataPath(notePath);
    try {
      // Never save over ink we haven't seen. If the file changed since we last read or wrote it
      // (another device, via Sync), merge both sides. If it isn't a whole ink file right now
      // (half-synced, or unreadable), leave it alone and try again shortly.
      const existing = this.inkFile(f);
      if (existing) {
        const raw = await this.app.vault.read(existing);
        if (raw !== this.lastWritten.get(notePath)) {
          const theirs = parseInk(raw);
          if (!theirs) { this.retrySave(notePath); return; }
          if (this.mergeInk(notePath, d, theirs)) { this.forgetHistory(notePath); this.redraw(notePath); this.afterHistory(); }
        }
      }
      this.saveFails.delete(notePath);
      for (const k of Object.keys(d.sections)) if (!d.sections[k].length) delete d.sections[k];
      const json = JSON.stringify(d);
      // Only what actually reached the disk becomes the merge base (lastWritten). While the write is
      // in flight, its own modify/create event is recognized through `writing`.
      this.writing.set(notePath, json);
      const file = this.inkFile(f);
      if (file) await this.app.vault.modify(file, json);
      else { await this.ensureFolder(f); const again = this.inkFile(f); if (again) { this.writing.delete(notePath); this.saveInk(notePath); return; } await this.app.vault.create(f, json); }
      this.lastWritten.set(notePath, json);
      this.writing.delete(notePath);
      this.syncTip();
    } catch (e) {
      this.writing.delete(notePath);
      console.error('Pen Ink: could not save ink for', notePath, e);
      if (!this.saveFails.get(notePath)) new Notice('Pen Ink: could not save ink, trying again. ' + (e && e.message ? e.message : e));
      this.retrySave(notePath);
    }
  }

  // The ink file can't be read as ink right now: keep our copy in memory and try again soon.
  retrySave(notePath) {
    const n = (this.saveFails.get(notePath) || 0) + 1;
    this.saveFails.set(notePath, n);
    if (n === 5) new Notice(`Pen Ink: can't read the ink file for ${notePath}, so new ink isn't being saved over it yet. It will keep trying.`, 10000);
    window.clearTimeout(this.saveTimers.get(notePath));
    this.saveTimers.set(notePath, window.setTimeout(() => this.writeInk(notePath), Math.min(30000, 1500 * n)));
  }

  // Three-way merge, per paragraph: start from their strokes, drop the ones we deleted, add the
  // ones we drew (unless they deleted them). "Base" is the file as we last read or wrote it.
  // Strokes are compared by content; ours are kept as the same objects (undo/selection still work).
  // Returns true if our copy changed.
  mergeInk(notePath, d, theirs) {
    const base = parseInk(this.lastWritten.get(notePath) || '') || { sections: {} };
    const bag = (arr) => { const m = new Map(); for (const x of arr) { const j = JSON.stringify(x); m.set(j, (m.get(j) || 0) + 1); } return m; };
    const take = (m, j) => { const n = m.get(j) || 0; if (n > 0) m.set(j, n - 1); return n > 0; };
    let changed = false;
    for (const k of new Set([...Object.keys(d.sections), ...Object.keys(theirs.sections)])) {
      const mine = d.sections[k] || [], other = theirs.sections[k] || [], B = bag(base.sections[k] || []);
      const M = bag(mine), O = bag(other), delMine = new Map(), delOther = new Map();
      for (const [j, n] of B) { if (n > (M.get(j) || 0)) delMine.set(j, n - (M.get(j) || 0)); if (n > (O.get(j) || 0)) delOther.set(j, n - (O.get(j) || 0)); }
      const used = new Set(), out = [];
      for (const x of other) {
        const j = JSON.stringify(x);
        if (take(delMine, j)) continue;
        const same = mine.find(y => !used.has(y) && JSON.stringify(y) === j);
        if (same) used.add(same);
        out.push(same || x);
      }
      for (const y of mine) if (!used.has(y) && !take(delOther, JSON.stringify(y))) out.push(y);
      if (out.length !== mine.length || out.some((x, i) => x !== mine[i])) {
        changed = true;
        if (d.sections[k]) d.sections[k].splice(0, d.sections[k].length, ...out); else d.sections[k] = out;
      }
    }
    return changed;
  }

  // Undo steps for a note that just changed underneath us point at strokes that may be gone.
  forgetHistory(notePath) {
    const touches = (a) => this.pathsOf(a).includes(notePath);
    for (const stack of [this.undoStack, this.redoStack]) {
      const keep = stack.filter(a => !touches(a));
      stack.splice(0, stack.length, ...keep);
    }
  }

  async onInkFileChanged(changed) {
    const filePath = changed && changed.path, folder = this.inkFolder();
    if (!filePath || !filePath.startsWith(folder + '/') || !filePath.endsWith('.json')) return;
    const notePath = filePath.slice(folder.length + 1, -'.json'.length) + '.md';
    if (!this.inkData(notePath) || this.saveTimers.has(notePath)) return;  // not open, or our own save is pending
    const file = this.inkFile(filePath);
    if (!file) return;
    let raw;
    try { raw = await this.app.vault.read(file); } catch (e) { return; }
    if (raw === this.lastWritten.get(notePath) || raw === this.writing.get(notePath) || this.saveTimers.has(notePath)) return;  // our own write / new local ink
    const theirs = parseInk(raw);
    if (!theirs) return;   // half-synced: the next modify event will have all of it
    const d = this.inkData(notePath);
    if (!d) return;
    const merged = this.mergeInk(notePath, d, theirs);
    this.lastWritten.set(notePath, raw);
    if (!sameInk(d.sections, theirs.sections)) this.saveInk(notePath);   // we had ink they don't (order doesn't count)
    if (!merged) return;
    this.forgetHistory(notePath);
    this.redraw(notePath);
    this.afterHistory();
  }

  redraw(notePath, key) {
    for (const el of activeDocument.querySelectorAll('[data-pa-key]')) {
      if (el.dataset.paPath === notePath && (!key || el.dataset.paKey === key) && el.paChild) el.paChild.draw();
    }
  }

  // Obsidian Sync skips .json files unless "Sync all other types" is on, on every device.
  // Say so once, the first time ink is saved (only public APIs: we can't check Sync's settings).
  syncTip() {
    if (this.prefs.syncTipShown) return;
    this.prefs.syncTipShown = true;
    this.savePrefs();
    new Notice(`Pen Ink saves your drawings as .json files in the "${this.inkFolder()}" folder. If you use Obsidian Sync, turn on "Sync all other types" in its settings on every device so they sync too.`, 15000);
  }

  // The ink folder setting changed: save anything pending to the old place, then reload.
  async changeFolder(name) {
    const next = cleanFolder(name) || FOLDER;
    if (next === this.inkFolder()) return;
    for (const notePath of [...this.saveTimers.keys()]) await this.writeInk(notePath);
    this.prefs.folder = next;
    this.savePrefs();
    this.cache.clear();
    this.lastWritten.clear();
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.clearSelection();
    for (const el of activeDocument.querySelectorAll('[data-pa-key]')) {
      if (el.paChild) this.loadInk(el.dataset.paPath).then(() => el.paChild.draw());
    }
    this.refreshToolbars();
  }

  savePrefs() {
    window.clearTimeout(this.prefsTimer);
    this.prefsTimer = window.setTimeout(() => {
      this.prefsTimer = null;
      this.saveData(this.prefs).catch(e => console.error('Pen Ink: could not save settings', e));
    }, 400);
  }

  // ----- annotation mode -----------------------------------------------------

  sections(root) {
    return [...root.querySelectorAll('.markdown-preview-view [data-pa-key]')].filter(el => el.paChild && el.getBoundingClientRect().height);
  }

  // The section under the pointer, or else the nearest one. Ink can start anywhere: over the
  // title, the Properties block or blank space (none of which are markdown sections), it's
  // attached to the closest paragraph and drawn where it was put. (It used to need a section
  // within 80px, so the top few inches of a note with Properties couldn't be drawn on.)
  sectionAt(root, x, y, notePath = null) {
    let best = null, bestDist = Infinity;
    for (const el of this.sections(root)) {
      if (notePath && el.dataset.paPath !== notePath) continue;   // e.g. skip an embedded note's paragraphs
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return el;
      const d = Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
      if (d < bestDist) { bestDist = d; best = el; }
    }
    return best;
  }

  async toggle(view) { this.sessions.has(view) ? this.stop(view) : await this.start(view); }

  async start(view) {
    if (view.getMode() !== 'preview') {
      await view.setState({ ...view.getState(), mode: 'preview' }, { history: false });
    }
    if (this.sessions.has(view)) return;
    const P = this.prefs;
    const root = view.contentEl;
    const st = { view, root, stroke: null, eraserId: null, lastErase: null, lastPenTime: 0, penDownAt: 0, tap: null, lasso: null, moving: null, hold: null, laserId: null, laserPts: [], laserDot: null, laserSeen: 0, laserRaf: 0, zoom: { s: 1, tx: 0, ty: 0 }, pinch: null };
    // What pinch-zoom magnifies: the reading view's outer box (see setZoom).
    st.zoomEl = root.querySelector('.markdown-reading-view') || root.querySelector('.markdown-preview-view');
    st.scroller = root.querySelector('.markdown-preview-view');   // what one-finger scrolling moves
    if (st.zoomEl) st.zoomEl.classList.add('pa-zoom-target');
    root.classList.add('pa-annotating');

    // A soft circle showing where the eraser is.
    st.ring = h('div', 'pa-ring pa-hidden');
    root.appendChild(st.ring);
    const showRing = (e) => {
      const R = P.eraser.size;
      cssVars(st.ring, { '--pa-d': (2 * R) + 'px' });
      st.ring.classList.toggle('is-partial', P.eraser.mode === 'partial');
      show(st.ring, true);                        // must be visible to be measured
      placeAt(st.ring, e.clientX - R, e.clientY - R);
    };
    const hideRing = () => show(st.ring, false);
    st.hideRing = hideRing;

    // The dashed loop you draw with the lasso. The SVG sits inside an HTML <div> because only
    // HTML elements can be placed reliably (v1.6.0 bug: the loop was drawn
    // shifted right/down by the sidebar and tab bar).
    st.lassoBox = h('div', 'pa-lasso pa-hidden');
    st.lassoSvg = activeDocument.createElementNS(SVGNS, 'svg');
    st.lassoPath = activeDocument.createElementNS(SVGNS, 'path');
    st.lassoSvg.appendChild(st.lassoPath);
    st.lassoBox.appendChild(st.lassoSvg);
    root.appendChild(st.lassoBox);

    // Laser pointer: a glowing red dot with a short fading trail. Never saved, nothing to undo.
    st.laserBox = h('div', 'pa-laser pa-hidden');
    st.laserBox.className = 'pa-laser';
    st.laserSvg = activeDocument.createElementNS(SVGNS, 'svg');
    st.laserTrail = activeDocument.createElementNS(SVGNS, 'g');
    st.laserDotEl = activeDocument.createElementNS(SVGNS, 'circle');
    st.laserDotEl.setAttribute('r', '5'); st.laserDotEl.setAttribute('fill', '#ff3b30');
    st.laserDotEl.setAttribute('stroke', '#fff'); st.laserDotEl.setAttribute('stroke-width', '1.5');
    st.laserSvg.append(st.laserTrail, st.laserDotEl);
    st.laserBox.appendChild(st.laserSvg);
    root.appendChild(st.laserBox);

    // Draw with finger: one finger draws, unless a pen has been used this session (then fingers are
    // palms and scrolling again). Only the first finger down draws; a second one turns it into scrolling.
    const fingerOn = () => this.fingerSetting() && !st.penSeen && !st.hand;
    const canDraw = (e) => e.pointerType === 'pen' || (e.pointerType === 'mouse' && !Platform.isMobile) ||
      (e.pointerType === 'touch' && e.isPrimary && fingerOn());
    const inToolbar = (e) => !!(e.target && e.target.closest && e.target.closest('.pa-toolbar, .pa-ui'));
    const reading = () => view.getMode() === 'preview';

    // Stop the Pencil from scrolling / selecting text. NOT on the toolbar: there iOS must be
    // allowed to turn a Pencil tap into a click (v1.1 bug: buttons only worked with a finger).
    st.onTouchStart = (e) => {
      if (inToolbar(e) || !reading()) { st.tap = null; return; }
      // iPad marks Pencil touches with touchType 'stylus'. Other browsers (Android, Windows) don't,
      // but they send the pen's pointerdown just before its touchstart, so we remember that.
      const pen = [...e.touches].some(t => t.touchType === 'stylus') || (e.touches.length === 1 && Date.now() - st.penDownAt < 100);
      // While you're drawing, a palm or finger resting on the screen must not scroll or zoom.
      const busy = st.stroke || st.eraserId != null || st.lasso || st.moving || st.shape || st.laserId != null;
      if (fingerOn() && !pen) {
        // Drawing with a finger: one finger is a pen (its pointer events draw). A second finger
        // drops what the first one started and the two scroll and zoom together.
        e.preventDefault();
        this.stopGlide(st);
        this.trackTwoFingerTap(st, e);
        st.pan = null;
        if (e.touches.length === 2 && st.zoomEl) {
          this.dropFingerAction(st);
          const [a, b] = e.touches, m = [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2];
          st.pinch = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, s0: st.zoom.s, last: m, both: true };
        } else { if (e.touches.length > 2) this.dropFingerAction(st); st.pinch = null; }
        return;
      }
      if (pen || busy) { st.tap = null; st.pinch = null; st.pan = null; e.preventDefault(); return; }
      // Fingers: we scroll, pan and zoom ourselves while annotating. Once iOS's own scrolling
      // takes over a gesture it stops sending us touch moves, which made pinches right after a
      // scroll do nothing. So the page's built-in gesture never starts.
      e.preventDefault();
      this.stopGlide(st);
      if (e.touches.length === 2 && st.zoomEl) {
        const [a, b] = e.touches;
        st.pinch = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, m0: [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2], z0: { ...st.zoom } };
        st.pan = null;
      } else if (e.touches.length === 1) {
        st.pinch = null;
        st.pan = this.panStart(e.touches[0], e);
      } else { st.pinch = null; st.pan = null; }
      this.trackTwoFingerTap(st, e);
    };
    st.onTouchMove = (e) => {
      if (st.pinch && st.pinch.both && e.touches.length === 2) {
        // Two fingers while drawing with a finger: spread to zoom, move together to scroll.
        e.preventDefault();
        const [a, b] = e.touches, P0 = st.pinch, m = [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2];
        this.zoomAround(st, P0.s0 * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / P0.d0, m[0], m[1]);
        this.panBy(st, m[0] - P0.last[0], m[1] - P0.last[1]);
        P0.last = m;
      } else if (st.pinch && e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = e.touches, P0 = st.pinch;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        this.pinchTo(st, P0.z0.s * d / P0.d0, P0.m0, [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2], P0.z0);
      } else if (st.pan && e.touches.length === 1 && e.touches[0].identifier === st.pan.id) {
        e.preventDefault();
        const t = e.touches[0], P = st.pan, now = e.timeStamp || performance.now();
        const dx = t.clientX - P.x, dy = t.clientY - P.y, dt = Math.max(1, now - P.t);
        // Smoothed finger speed (px/ms), for the glide after letting go.
        P.vx = 0.75 * (dx / dt) + 0.25 * P.vx; P.vy = 0.75 * (dy / dt) + 0.25 * P.vy;
        P.x = t.clientX; P.y = t.clientY; P.t = now;
        P.moved = Math.max(P.moved, Math.hypot(t.clientX - P.x0, t.clientY - P.y0));
        this.panBy(st, dx, dy);
      } else if (fingerOn() && !inToolbar(e) && reading()) e.preventDefault();   // the drawing finger mustn't scroll
      if (!st.tap) return;
      for (const t of e.changedTouches) {
        const s = st.tap.start[t.identifier];
        if (s && Math.hypot(t.clientX - s[0], t.clientY - s[1]) > 10) st.tap.cancelled = true;
      }
    };
    st.onTouchEnd = (e) => {
      if (e.touches.length < 2 && st.pinch) {
        st.pinch = null;
        if (st.zoom.s < 1.05) this.setZoom(st, 1, 0, 0);
        // Lifted one finger of a pinch: the other one carries on moving the page.
        if (e.touches.length === 1) st.pan = { ...this.panStart(e.touches[0], e), moved: 99 };
      } else if (st.pan && !e.touches.length) {
        const P = st.pan, now = e.timeStamp || performance.now();
        st.pan = null;
        const twoFinger = st.tap && st.tap.max > 1;
        if (P.moved < 8 && now - P.t0 < 500 && !twoFinger) this.fingerTap(P.x0, P.y0);    // a tap: let links etc. work
        else if (now - P.t < 80) this.glide(st, P.vx, P.vy);                               // keep sliding a bit
      }
      if (!st.tap || e.touches.length) return;
      const tap = st.tap; st.tap = null;
      if (!tap.cancelled && tap.max === 2 && Date.now() - tap.t0 < 400) this.undoLast(view.file ? view.file.path : null);
    };
    // Mac trackpad pinch arrives as Ctrl + scroll; Ctrl/Cmd + mouse wheel zooms too.
    // While zoomed, sideways scrolling pans left/right (up/down still scrolls the note).
    st.onWheel = (e) => {
      if (!reading() || !st.zoomEl) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); e.stopPropagation();
        this.zoomAround(st, st.zoom.s * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      } else if (st.zoom.s > 1 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        this.setZoom(st, st.zoom.s, st.zoom.tx - e.deltaX, st.zoom.ty);
      }
    };

    // Hold-to-straighten: (re)start a timer whenever the Pencil moves; if it sits still, snap.
    const armHold = (e) => {
      if (st.hold) window.clearTimeout(st.hold.timer);
      st.hold = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => this.straightenIfHeld(st), HOLD_MS) };
    };
    const disarmHold = () => { if (st.hold) window.clearTimeout(st.hold.timer); st.hold = null; };

    st.onDown = (e) => {
      if (e.pointerType === 'pen' && !inToolbar(e)) {
        st.penDownAt = Date.now();
        if (!st.penSeen) { st.penSeen = true; st.hand = false; if (st.toolbar) st.toolbar.paint(); }   // fingers scroll now anyway: no hand needed
      }
      // A pen's eraser end (button 5) or held side button (button 2) erases for that one stroke,
      // whatever tool is picked (S Pen, Surface and Wacom pens; the Apple Pencil has neither).
      const penErase = e.pointerType === 'pen' && P.penButtonErases !== false && (e.button === 5 || e.button === 2 || (e.buttons & 34) > 0);
      if (!canDraw(e) || (e.button > 0 && !penErase) || inToolbar(e) || !reading()) return;
      if (st.stroke || st.eraserId != null || st.lasso || st.moving || st.shape || st.laserId != null) return;   // already busy with another pointer
      const tool = penErase ? 'eraser' : P.tool;
      st.fingerId = e.pointerType === 'touch' ? e.pointerId : null;
      st.tempErase = penErase && P.tool !== 'eraser';
      if (penErase) st.penEraseAt = Date.now();
      st.penErasing = penErase;

      if (tool === 'laser') {
        e.preventDefault();
        st.lastPenTime = Date.now();
        st.toolbar.closePanel();
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        st.laserId = e.pointerId;
        this.laserMove(st, e);
        return;
      }

      if (tool === 'lasso') {
        e.preventDefault();
        st.lastPenTime = Date.now();
        st.toolbar.closePanel();
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
        const grab = this.selected.size ? this.handleAt(st, e.clientX, e.clientY) : null;
        if (grab) {
          this.startMove(st, e, grab);
        } else {
          this.clearSelection();
          this.startLasso(st, e);
        }
        return;
      }

      const el = this.sectionAt(root, e.clientX, e.clientY);
      if (!el) return;
      e.preventDefault();
      st.lastPenTime = Date.now();
      st.toolbar.closePanel();
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* e.g. synthetic test events */ }
      if (tool === 'eraser') {
        st.eraserId = e.pointerId;
        st.lastErase = [e.clientX, e.clientY];
        st.eraseBatch = { type: 'batch', items: [] };   // the whole swipe undoes in one go
        showRing(e);
        st.eraseEls = this.sections(root);
        this.eraseNear(st.eraseEls, e.clientX, e.clientY, st.eraseBatch);
        return;
      }
      if (tool === 'shape') { this.startShape(st, el, e); return; }
      const opt = P[tool];
      const rect = frameOf(el);
      const s = { kind: tool, color: opt.color, width: opt.size, opacity: tool === 'hl' ? HL_OPACITY : (opt.opacity || 1), pts: [] };
      if (tool === 'pen' && opt.type === 'fountain') s.type = 'fountain';
      else if (tool === 'pen' && ['dash', 'dot'].includes(opt.dash)) s.dash = opt.dash;
      st.stroke = { el, rect, s, pointerId: e.pointerId, straight: tool === 'hl' && opt.straight, snapped: false, sm: null, raw: null };
      this.liveBegin(st.stroke);
      this.addPoint(st, e);
      if (P.holdToStraighten && !st.stroke.straight) armHold(e);
    };

    st.onMove = (e) => {
      // Eraser ring follows the Pencil (also while hovering, on iPads that support it).
      if ((P.tool === 'eraser' || (st.tempErase && st.eraserId === e.pointerId)) && canDraw(e) && !inToolbar(e)) showRing(e);
      // Laser: the dot follows the Pencil/mouse (also while hovering); a trail while pressed.
      if (P.tool === 'laser' && st.eraserId !== e.pointerId && canDraw(e) && (!inToolbar(e) || st.laserId === e.pointerId)) {
        if (st.laserId === e.pointerId) e.preventDefault();
        this.laserMove(st, e);
        return;
      }
      if (P.tool === 'lasso' && !st.moving && e.pointerType === 'mouse') {
        // Mouse hover over the selection: show what a drag there would do.
        const g = this.selected.size ? this.handleAt(st, e.clientX, e.clientY) : null;
        for (const [k, c] of [['move', 'pa-cur-move'], ['rotate', 'pa-cur-rotate'], ['nw', 'pa-cur-nwse'], ['ne', 'pa-cur-nesw']]) {
          root.classList.toggle(c, g === k || (k === 'nw' && g === 'se') || (k === 'ne' && g === 'sw'));
        }
      }
      if (st.lasso && e.pointerId === st.lasso.id) { e.preventDefault(); this.extendLasso(st, e); return; }
      if (st.shape && e.pointerId === st.shape.id) { e.preventDefault(); this.dragShape(st, e); return; }
      if (st.moving && e.pointerId === st.moving.id) { e.preventDefault(); this.moveSelection(st, e); return; }
      if (st.eraserId != null && e.pointerId === st.eraserId) {
        st.lastPenTime = Date.now();
        // Erase along the whole swipe, not just where move events happened to land.
        const [x0, y0] = st.lastErase, x1 = e.clientX, y1 = e.clientY;
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(2, P.eraser.size / 2)));
        for (let i = 1; i <= steps; i++) {
          const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
          this.eraseNear(st.eraseEls || this.sections(root), x, y, st.eraseBatch);
        }
        st.lastErase = [x1, y1];
        return;
      }
      if (!st.stroke || e.pointerId !== st.stroke.pointerId) return;   // ignore palms/fingers mid-stroke
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of (evs.length ? evs : [e])) this.addPoint(st, ev);
      if (st.hold && Math.hypot(e.clientX - st.hold.x, e.clientY - st.hold.y) > 4) armHold(e);
    };

    st.onUp = (e) => {
      if (e.pointerType === 'pen') hideRing();
      if (st.laserId != null && e.pointerId === st.laserId) { st.laserId = null; st.lastPenTime = Date.now(); return; }
      if (st.lasso && e.pointerId === st.lasso.id) { st.lastPenTime = Date.now(); this.finishLasso(st); return; }
      if (st.shape && e.pointerId === st.shape.id) { st.lastPenTime = Date.now(); this.finishShape(st); return; }
      if (st.moving && e.pointerId === st.moving.id) { st.lastPenTime = Date.now(); this.finishMove(st); return; }
      if (st.eraserId != null && e.pointerId === st.eraserId) {
        st.eraserId = null;
        st.lastPenTime = Date.now();
        if (st.eraseBatch && st.eraseBatch.items.length) this.record(st.eraseBatch);
        st.eraseBatch = null;
        if (st.penErasing) { st.penEraseAt = Date.now(); st.penErasing = false; }   // the right-click menu comes after the lift
        if (st.tempErase) { st.tempErase = false; hideRing(); return; }   // pen button: the picked tool never changed
        if (P.eraser.autoReturn) { P.tool = P.lastDrawTool; this.savePrefs(); this.refreshToolbars(); }
        return;
      }
      if (!st.stroke || e.pointerId !== st.stroke.pointerId) return;
      disarmHold();
      const S = st.stroke, { el, s } = S;
      st.stroke = null;
      st.lastPenTime = Date.now();
      if (S.raf) window.cancelAnimationFrame(S.raf);
      if (el.paChild) el.paChild.setLive(null);
      // Smoothing trails slightly behind the Pencil; finish the line exactly where it lifted.
      if (!S.straight && !S.snapped && S.raw && s.pts.length) {
        const L = s.pts[s.pts.length - 1], w = S.rect.width;
        if (Math.hypot(L[0] * w - S.raw[0], L[1] - S.raw[1]) > 1) s.pts.push(this.point(s, S.raw[0] / w, S.raw[1], S.raw[2]));
      }
      // Drop points that don't change the shape: smaller files, faster redraws, same look.
      if (!S.straight && !S.snapped) s.pts = simplify(s.pts, S.rect.width, 0.35, isFountain(s) ? s.width * 2 : 0);
      // A single tap with the highlighter is almost always an accident; a pen dot can be on purpose.
      if (s.pts.length < 2 && s.kind === 'hl') { if (el.paChild) el.paChild.draw(); return; }
      const path = el.dataset.paPath, key = el.dataset.paKey;
      const d = this.inkData(path);
      if (!d) { if (el.paChild) el.paChild.draw(); return; }
      if (!d.sections[key]) d.sections[key] = [];
      d.sections[key].push(s);
      this.record({ type: 'add', path, key, s });
      if (el.paChild) el.paChild.draw(); else this.redraw(path, key);
      this.saveInk(path);
    };
    st.onLeave = (e) => { if (e.pointerType !== 'touch') { hideRing(); if (st.laserId == null) st.laserSeen = 0; } };
    // Swallow the click that follows a pen stroke so links don't open.
    // A pen's side button counts as a right-click on Windows/Android: no context menu after using it to erase.
    st.onContext = (e) => { if (Date.now() - (st.penEraseAt || 0) < 1500 || st.eraserId != null) e.preventDefault(); };
    st.onClick = (e) => {
      if (Date.now() - st.lastPenTime < 400 && !inToolbar(e)) { e.preventDefault(); e.stopPropagation(); }
    };
    st.onScroll = () => this.updateSelectionBox(st);

    root.addEventListener('touchstart', st.onTouchStart, { passive: false });
    root.addEventListener('touchmove', st.onTouchMove, { passive: false });
    root.addEventListener('wheel', st.onWheel, { passive: false });
    root.addEventListener('touchend', st.onTouchEnd, { passive: true });
    root.addEventListener('touchcancel', st.onTouchEnd, { passive: true });
    root.addEventListener('pointerdown', st.onDown);
    root.addEventListener('pointermove', st.onMove);
    // Lifts are caught on the whole document: if the Pencil comes up outside the note (or iOS
    // drops pointer capture), the stroke still ends instead of merging into the next one.
    st.doc = root.ownerDocument || activeDocument;   // a popout window has its own document
    st.doc.addEventListener('pointerup', st.onUp);
    st.doc.addEventListener('pointercancel', st.onUp);
    root.addEventListener('pointerleave', st.onLeave);
    root.addEventListener('click', st.onClick, true);
    root.addEventListener('contextmenu', st.onContext, true);
    root.addEventListener('scroll', st.onScroll, true);

    st.toolbar = this.buildToolbar(view, st);
    root.append(st.toolbar.el, ...st.toolbar.extras);
    st.toolbar.place();
    this.sessions.set(view, st);
    if (view.penInkButton) view.penInkButton.classList.add('is-active');
  }

  stop(view) {
    const st = this.sessions.get(view); if (!st) return;
    const r = st.root;
    if (st.stroke) { if (st.stroke.raf) window.cancelAnimationFrame(st.stroke.raf); if (st.stroke.el.paChild) st.stroke.el.paChild.setLive(null); st.stroke = null; }
    if (st.shape) { if (st.shape.el.paChild) st.shape.el.paChild.setLive(null); st.shape = null; }
    if (st.hold) window.clearTimeout(st.hold.timer);
    this.stopGlide(st);
    r.removeEventListener('touchstart', st.onTouchStart, { passive: false });
    r.removeEventListener('touchmove', st.onTouchMove, { passive: false });
    r.removeEventListener('wheel', st.onWheel, { passive: false });
    r.removeEventListener('touchend', st.onTouchEnd, { passive: true });
    r.removeEventListener('touchcancel', st.onTouchEnd, { passive: true });
    r.removeEventListener('pointerdown', st.onDown);
    r.removeEventListener('pointermove', st.onMove);
    (st.doc || activeDocument).removeEventListener('pointerup', st.onUp);
    (st.doc || activeDocument).removeEventListener('pointercancel', st.onUp);
    r.removeEventListener('pointerleave', st.onLeave);
    r.removeEventListener('click', st.onClick, true);
    r.removeEventListener('contextmenu', st.onContext, true);
    r.removeEventListener('scroll', st.onScroll, true);
    r.classList.remove('pa-annotating', 'pa-no-cursor', 'pa-zoomed', 'pa-cur-move', 'pa-cur-rotate', 'pa-cur-nwse', 'pa-cur-nesw');
    if (st.zoomEl) { css(st.zoomEl, { transform: '' }); st.zoomEl.classList.remove('pa-zoom-target'); }   // back to 100%
    this.clearSelection();          // while the session still exists, so its halos get redrawn away
    this.sessions.delete(view);
    st.toolbar.destroy();
    st.toolbar.el.remove();
    for (const x of st.toolbar.extras) x.remove();
    st.ring.remove();
    st.lassoBox.remove();
    if (st.laserRaf) window.cancelAnimationFrame(st.laserRaf);
    st.laserBox.remove();
    if (view.penInkButton) view.penInkButton.classList.remove('is-active');
  }

  // Two fingers down and up quickly without moving = undo.
  // A second finger landed while the first was drawing: that was the start of a scroll or pinch,
  // not ink. Throw away a stroke or shape in progress; end anything else (lasso, eraser) as is.
  dropFingerAction(st) {
    const id = st.fingerId;
    st.fingerId = null;
    if (id == null) return;
    if (st.stroke && st.stroke.pointerId === id) {
      const S = st.stroke; st.stroke = null;
      if (S.raf) window.cancelAnimationFrame(S.raf);
      if (st.hold) { window.clearTimeout(st.hold.timer); st.hold = null; }
      if (S.el.paChild) { S.el.paChild.setLive(null); S.el.paChild.draw(); }
    } else if (st.shape && st.shape.id === id) {
      const el = st.shape.el; st.shape = null;
      if (el.paChild) { el.paChild.setLive(null); el.paChild.draw(); }
    } else if (st.onUp) st.onUp({ pointerId: id, pointerType: 'touch' });
  }

  trackTwoFingerTap(st, e) {
    const now = Date.now();
    if (e.touches.length === 1) st.tap = { t0: now, max: 1, cancelled: false, start: {} };
    if (!st.tap) return;
    for (const t of e.changedTouches) st.tap.start[t.identifier] = [t.clientX, t.clientY];
    st.tap.max = Math.max(st.tap.max, e.touches.length);
    if (e.touches.length > 2 || now - st.tap.t0 > 250) st.tap.cancelled = true;
  }

  // ----- drawing -----------------------------------------------------------------

  // A stored point: [x as 0..1 of section width, y px] plus pressure for the fountain pen.
  point(s, x, y, p) {
    return isFountain(s) ? [+x.toFixed(4), +y.toFixed(1), +p.toFixed(2)] : [+x.toFixed(4), +y.toFixed(1)];
  }

  addPoint(st, e) {
    const S = st.stroke, { rect, s } = S, w = rect.width;
    let x = (e.clientX - rect.left) / rect.s, y = (e.clientY - rect.top) / rect.s;
    let p = e.pressure > 0 ? e.pressure : 0.5;

    // Straight line (straight highlighter, or after hold-to-straighten): first point + where the Pencil is.
    if (S.straight || S.snapped) {
      if (s.pts.length) {
        const f = s.pts[0];
        [x, y] = snapAxis(f[0] * w, f[1], x, y);
        s.pts.length = 1;
      }
      s.pts.push(this.point(s, x / w, y, p));
      this.liveSchedule(S);
      return;
    }

    // Stabilizer: ease toward the Pencil instead of following every wobble.
    S.raw = [x, y, p];
    const a = 1 - this.prefs.smoothing / 100;
    if (S.sm) { x = S.sm[0] + (x - S.sm[0]) * a; y = S.sm[1] + (y - S.sm[1]) * a; p = S.sm[2] + (p - S.sm[2]) * a; }
    S.sm = [x, y, p];

    const L = s.pts[s.pts.length - 1];
    if (L && Math.abs(L[0] * w - x) < 1 && Math.abs(L[1] - y) < 1) return;
    s.pts.push(this.point(s, x / w, y, p));
    this.liveSchedule(S);
  }

  // ----- the stroke being drawn ---------------------------------------------------
  // Redrawing the whole line on every Pencil sample gets slower the longer the line is (a very
  // long stroke used to lag badly). So the live line is a group of pieces: older pieces are
  // frozen and never touched again, only the newest piece is redrawn, and at most once per frame.
  // The group carries the opacity, so overlapping pieces don't show darker seams.

  liveBegin(S) {
    S.group = activeDocument.createElementNS(SVGNS, 'g');
    S.group.setAttribute('opacity', S.s.opacity != null ? S.s.opacity : 1);
    S.chunkStart = 0;
    S.active = this.livePiece(S);
    S.group.appendChild(S.active);
    S.raf = 0;
    if (S.el.paChild) S.el.paChild.setLive(S.group, S.s);
  }

  livePiece(S) {
    const p = makePath({ ...S.s, opacity: 1, pts: [] }, S.rect.width);
    if (!isFountain(S.s)) p.setAttribute('stroke-linecap', isHighlight(S.s) ? 'butt' : 'round');
    return p;
  }

  liveSchedule(S) {
    if (!S.raf) S.raf = window.requestAnimationFrame(() => this.liveRender(S));
  }

  liveRender(S) {
    S.raf = 0;
    const s = S.s, w = S.rect.width, n = s.pts.length;
    if (!n) return;
    const piece = (a, b, last) => {
      const sub = { ...s, pts: s.pts.slice(a, b + 1) };
      return isFountain(s) ? outlineData(sub, w, { noTaperStart: a > 0, noTaperEnd: !last }) : pathData(sub.pts, w);
    };
    if (n - S.chunkStart > LIVE_CHUNK) {
      // Freeze everything but the last few points; the new piece overlaps by one point to join up.
      const cut = n - 8, frozen = this.livePiece(S);
      frozen.setAttribute('d', piece(S.chunkStart, cut, false));
      S.group.insertBefore(frozen, S.active);
      S.chunkStart = cut;
    }
    S.active.setAttribute('d', piece(S.chunkStart, n - 1, true));
  }

  // Throw away frozen pieces (after the points were replaced, e.g. hold-to-straighten).
  liveReset(S) {
    while (S.group.firstChild !== S.active) S.group.firstChild.remove();
    S.chunkStart = 0;
    if (S.raf) { window.cancelAnimationFrame(S.raf); S.raf = 0; }
    this.liveRender(S);
  }

  // Called when the Pencil has been still for HOLD_MS mid-stroke. If what's been drawn is
  // already roughly a line, turn it into a perfectly straight one (and keep following the Pencil).
  straightenIfHeld(st) {
    const S = st.stroke;
    if (!S || S.straight || S.snapped || !this.prefs.holdToStraighten || S.s.pts.length < 2) return;
    const w = S.rect.width, P = S.s.pts.map(p => [p[0] * w, p[1]]);
    const [x0, y0] = P[0], [x1, y1] = S.raw || P[P.length - 1];
    const chord = Math.hypot(x1 - x0, y1 - y0);
    if (chord < 24) return;
    const maxDev = Math.max(...P.map(p => distToSegment(p[0], p[1], x0, y0, x1, y1)));
    if (maxDev > Math.max(12, chord * 0.18)) return;       // a curve or a circle: leave it alone
    S.snapped = true;
    const [sx, sy] = snapAxis(x0, y0, x1, y1);
    const first = S.s.pts[0], p = S.raw ? S.raw[2] : 0.5;
    S.s.pts = [first, this.point(S.s, sx / w, sy, p)];
    this.liveReset(S);
  }

  // ----- zoom ----------------------------------------------------------------------
  // Pinch (or trackpad pinch / Ctrl + scroll) magnifies the reading view's outer box with a CSS
  // transform. The note inside doesn't know it's zoomed, so Obsidian's lazy rendering and
  // scrolling keep working, the toolbar stays put, and frameOf() turns screen points back into
  // real-size ink coordinates.

  setZoom(st, s, tx, ty) {
    const el = st.zoomEl;
    if (!el) return;
    s = Math.max(1, Math.min(ZOOM_MAX, s));
    if (s < 1.02) { s = 1; tx = 0; ty = 0; }
    const W = el.offsetWidth, H = el.offsetHeight;      // keep the magnified box covering the view
    tx = Math.min(0, Math.max(W - W * s, tx));
    ty = Math.min(0, Math.max(H - H * s, ty));
    st.zoom = { s, tx, ty };
    st.root.classList.toggle('pa-zoomed', s !== 1);
    css(el, { transform: s === 1 ? '' : `translate(${tx}px, ${ty}px) scale(${s})` });
    this.updateSelectionBox(st);
    if (st.toolbar) st.toolbar.paint();
  }

  // Zoom to `s` keeping what was under screen point `from` (at zoom z0) under screen point `to`.
  pinchTo(st, s, from, to, z0) {
    s = Math.max(1, Math.min(ZOOM_MAX, s));
    const r = st.zoomEl.getBoundingClientRect();
    const ox = r.left - st.zoom.tx, oy = r.top - st.zoom.ty;           // the unzoomed box's corner
    const px = (from[0] - ox - z0.tx) / z0.s, py = (from[1] - oy - z0.ty) / z0.s;
    this.setZoom(st, s, to[0] - ox - px * s, to[1] - oy - py * s);
  }

  zoomAround(st, s, cx, cy) { this.pinchTo(st, s, [cx, cy], [cx, cy], { ...st.zoom }); }

  resetZoom(st) { this.setZoom(st, 1, 0, 0); }

  // ----- finger scrolling (annotation mode) -----------------------------------------
  panStart(t, e) {
    const now = e.timeStamp || performance.now();
    return { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t: now, t0: now, vx: 0, vy: 0, moved: 0 };
  }

  // Move the page with a finger: up/down scrolls the note; when zoomed, whatever scrolling can't
  // take (at the top/bottom of the note) and all sideways movement pans the magnified view.
  panBy(st, dx, dy) {
    const Z = st.zoom, sc = st.scroller;
    let restY = dy;
    if (sc && dy) {
      const before = sc.scrollTop;
      sc.scrollTop = before - dy / Z.s;
      restY = dy - (before - sc.scrollTop) * Z.s;
    }
    if (Z.s > 1 && (dx || restY)) this.setZoom(st, Z.s, Z.tx + dx, Z.ty + restY);
  }

  // After a flick, keep sliding and slow down, like normal scrolling.
  glide(st, vx, vy) {
    this.stopGlide(st);
    if (Math.hypot(vx, vy) < 0.05) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(40, now - last); last = now;
      this.panBy(st, vx * dt, vy * dt);
      const f = Math.pow(0.95, dt / 16);
      vx *= f; vy *= f;
      st.glideRaf = Math.hypot(vx, vy) > 0.02 ? window.requestAnimationFrame(step) : 0;
    };
    st.glideRaf = window.requestAnimationFrame(step);
  }

  stopGlide(st) { if (st.glideRaf) window.cancelAnimationFrame(st.glideRaf); st.glideRaf = 0; }

  // We stopped the browser's own touch handling, so a finger tap on a link would no longer
  // "click". Click whatever was tapped ourselves.
  fingerTap(x, y) {
    const el = activeDocument.elementFromPoint(x, y);
    if (el && el.closest && !el.closest('.pa-ui')) el.click();
  }

  // ----- laser pointer ---------------------------------------------------------------

  laserMove(st, e) {
    const r = st.root.getBoundingClientRect(), box = st.laserBox;
    show(box, true);
    css(box, { width: r.width + 'px', height: r.height + 'px' });
    placeAt(box, r.left, r.top);                              // re-placed every time: survives scroll/resize
    const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
    st.laserDot = [x, y];
    st.laserSeen = now;
    // Move the dot right now (not on the next frame), so it never trails behind the pointer.
    st.laserDotEl.setAttribute('cx', x); st.laserDotEl.setAttribute('cy', y);
    st.laserDotEl.classList.remove('pa-hidden');
    if (st.laserId === e.pointerId) st.laserPts.push([x, y, now]);
    if (!st.laserRaf) st.laserRaf = window.requestAnimationFrame(() => this.laserFrame(st));
  }

  laserFrame(st) {
    st.laserRaf = 0;
    const now = performance.now(), svg = st.laserTrail;
    st.laserPts = st.laserPts.filter(p => now - p[2] < LASER_TRAIL_MS);
    svg.replaceChildren();
    const P = st.laserPts;
    for (let i = 1; i < P.length; i++) {
      const fade = 1 - (now - P[i][2]) / LASER_TRAIL_MS;
      const l = activeDocument.createElementNS(SVGNS, 'line');
      l.setAttribute('x1', P[i - 1][0]); l.setAttribute('y1', P[i - 1][1]);
      l.setAttribute('x2', P[i][0]); l.setAttribute('y2', P[i][1]);
      l.setAttribute('stroke', '#ff3b30'); l.setAttribute('stroke-linecap', 'round');
      l.setAttribute('stroke-width', (1 + 3 * fade).toFixed(2)); l.setAttribute('stroke-opacity', fade.toFixed(2));
      svg.appendChild(l);
    }
    const dotAlive = st.laserDot && (st.laserId != null || now - st.laserSeen < 1200);
    st.laserDotEl.classList.toggle('pa-hidden', !dotAlive);
    if (P.length || dotAlive) st.laserRaf = window.requestAnimationFrame(() => this.laserFrame(st));
    else show(st.laserBox, false);
  }

  // ----- shapes --------------------------------------------------------------------
  // Press where one corner goes and drag; the shape is stored as ordinary ink (a polyline with
  // `geom` set), so the eraser, lasso, recolor and undo all work on it.

  startShape(st, el, e) {
    const o = this.prefs.shape, rect = frameOf(el);
    const s = { kind: 'pen', geom: o.kind, color: o.color, width: o.size, opacity: o.opacity || 1, pts: [], seed: newSeed() };
    if (['dash', 'dot'].includes(o.dash)) s.dash = o.dash;
    if (o.rough) s.rough = o.rough;
    if (o.edges === 'round' && CORNERED.includes(o.kind)) s.edges = 'round';
    if (o.fill && FILLABLE.includes(o.kind)) s.fill = o.fill;
    st.shape = { id: e.pointerId, el, rect, s, x0: (e.clientX - rect.left) / rect.s, y0: (e.clientY - rect.top) / rect.s, path: null };
    this.dragShape(st, e);
  }

  dragShape(st, e) {
    const S = st.shape, w = S.rect.width;
    const pts = shapePoints(S.s.geom, S.x0, S.y0, (e.clientX - S.rect.left) / S.rect.s, (e.clientY - S.rect.top) / S.rect.s, S.s.width);
    S.s.pts = pts.map(p => [+(p[0] / w).toFixed(4), +p[1].toFixed(1)]);
    S.size = Math.max(...pts.map(p => Math.hypot(p[0] - S.x0, p[1] - S.y0)));
    S.path = makePath(S.s, w);
    if (S.el.paChild) S.el.paChild.setLive(S.path, S.s, makeFill(S.s, w));
  }

  finishShape(st) {
    const S = st.shape; st.shape = null;
    if (S.el.paChild) S.el.paChild.setLive(null);
    if (!S.size || S.size < 6) { this.redraw(S.el.dataset.paPath, S.el.dataset.paKey); return; }      // a tap, not a drag
    const path = S.el.dataset.paPath, key = S.el.dataset.paKey, d = this.inkData(path);
    if (!d) { this.redraw(S.el.dataset.paPath, S.el.dataset.paKey); return; }
    (d.sections[key] = d.sections[key] || []).push(S.s);
    this.record({ type: 'add', path, key, s: S.s });
    if (S.el.paChild) S.el.paChild.draw(); else this.redraw(S.el.dataset.paPath, S.el.dataset.paKey);
    this.saveInk(path);
  }

  // ----- erasing -----------------------------------------------------------------

  // Erase at a screen point. Ink belongs to a paragraph but can reach well outside it (a circle
  // around a word near the edge, ink drawn in blank space or over the title), so every rendered
  // paragraph's ink is checked, not just the one under the eraser. `els` is that list for the swipe.
  eraseNear(els, cx, cy, batch) {
    for (const el of els) if (el.isConnected && el.paChild) this.eraseAt(el, cx, cy, batch);
  }

  eraseAt(el, cx, cy, batch) {
    const r = frameOf(el);
    const x = (cx - r.left) / r.s, y = (cy - r.top) / r.s;
    const path = el.dataset.paPath, key = el.dataset.paKey;
    const list = this.strokesFor(path, key);
    const E = this.prefs.eraser, radius = E.size / r.s, partial = E.mode === 'partial';   // the ring is screen-sized
    let changed = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if ((E.only === 'pen' && isHighlight(s)) || (E.only === 'hl' && !isHighlight(s))) continue;
      const bx = strokeBox(s, r.width), pad = radius + s.width / 2;
      if (x < bx[0] - pad || x > bx[2] + pad || y < bx[1] - pad || y > bx[3] + pad) continue;   // nowhere near
      let action;
      if (partial) {
        const news = cutStroke(s, r.width, x, y, radius);
        if (!news) continue;
        list.splice(i, 1, ...news);
        action = { type: 'replace', path, key, index: i, old: s, news };
      } else {
        if (!eraserHits(s, r.width, x, y, radius)) continue;
        list.splice(i, 1);
        action = { type: 'erase', path, key, s, index: i };
      }
      if (batch) batch.items.push(action); else this.record(action);
      changed = true;
    }
    if (changed) { if (el.paChild) el.paChild.draw(); this.saveInk(path); }
  }

  // ----- select (internally still called "lasso") -----------------------------------
  // Draw any free-form loop or line over ink: everything it surrounds (even partly) or touches
  // is selected. Then drag inside the dashed box to move it, or use the little menu to
  // recolor / delete. Tap outside (or switch tools) to let go.

  startLasso(st, e) {
    const r = st.root.getBoundingClientRect();
    show(st.lassoBox, true);
    css(st.lassoBox, { width: r.width + 'px', height: r.height + 'px' });
    placeAt(st.lassoBox, r.left, r.top);
    st.lasso = { id: e.pointerId, origin: [r.left, r.top], pts: [[e.clientX, e.clientY]] };
    this.extendLasso(st, e);
  }

  extendLasso(st, e) {
    const L = st.lasso;
    L.pts.push([e.clientX, e.clientY]);
    const [ox, oy] = L.origin;
    st.lassoPath.setAttribute('d', 'M' + L.pts.map(p => `${(p[0] - ox).toFixed(1)},${(p[1] - oy).toFixed(1)}`).join(' L') + ' Z');
  }

  finishLasso(st) {
    const poly = st.lasso.pts;
    st.lasso = null;
    show(st.lassoBox, false);
    st.lassoPath.setAttribute('d', '');
    if (poly.length < 2) return;
    // A drawing is picked if the loop surrounds any part of it, or the loop's line touches it.
    for (const el of this.sections(st.root)) {
      const r = frameOf(el), w = r.width;
      for (const s of this.strokesFor(el.dataset.paPath, el.dataset.paKey)) {
        const pts = s.pts.map(p => [p[0] * w * r.s + r.left, p[1] * r.s + r.top]);
        if (loopPicks(poly, pts, (s.width / 2) * r.s + 4)) this.selected.add(s);
      }
    }
    this.showSelection(st);
  }

  // Where each selected stroke lives: [{el, path, key, s}]
  selectionItems(st) {
    const items = [];
    for (const el of this.sections(st.root)) {
      for (const s of this.strokesFor(el.dataset.paPath, el.dataset.paKey)) {
        if (this.selected.has(s)) items.push({ el, path: el.dataset.paPath, key: el.dataset.paKey, s });
      }
    }
    return items;
  }

  selectionRect(st) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const { el, s } of this.selectionItems(st)) {
      const rc = frameOf(el), pad = (s.width / 2) * rc.s + 6;
      for (const p of s.pts) {
        const x = p[0] * rc.width * rc.s + rc.left, y = p[1] * rc.s + rc.top;
        l = Math.min(l, x - pad); r = Math.max(r, x + pad); t = Math.min(t, y - pad); b = Math.max(b, y + pad);
      }
    }
    return l < Infinity ? { left: l, top: t, right: r, bottom: b } : null;
  }

  pointInBox(box, x, y) { return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom; }

  // What a press at (x, y) grabs on the selection: a corner handle ('nw' | 'ne' | 'sw' | 'se'),
  // the rotate knob under the box ('rotate'), the inside ('move'), or nothing (null).
  handleAt(st, x, y) {
    const b = st.selBox;
    if (!b) return null;
    const R = 18;   // generous: a fingertip-sized Pencil target
    const k = this.knobAt(b);
    if (Math.hypot(x - k[0], y - k[1]) <= R) return 'rotate';
    // The nearest corner wins. Inside a small box the corner zones shrink, so there's always
    // room left in the middle to grab and move it (a thin line's box is only ~15px tall).
    const inside = this.pointInBox(b, x, y);
    const reach = inside ? Math.min(R, Math.min(b.right - b.left, b.bottom - b.top) / 3) : R;
    let best = null, bestD = reach;
    for (const [id, cx, cy] of [['nw', b.left, b.top], ['ne', b.right, b.top], ['sw', b.left, b.bottom], ['se', b.right, b.bottom]]) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= bestD) { best = id; bestD = d; }
    }
    return best || (inside ? 'move' : null);
  }

  knobAt(b) { return [(b.left + b.right) / 2, b.bottom + KNOB_GAP]; }

  showSelection(st) {
    const items = this.selectionItems(st);
    // Drop strokes that no longer exist (undo, Sync) from the selection.
    const alive = new Set(items.map(i => i.s));
    for (const s of [...this.selected]) if (!alive.has(s)) this.selected.delete(s);
    for (const key of new Set(items.map(i => i.path + '\u0000' + i.key))) this.redraw(...key.split('\u0000'));
    this.updateSelectionBox(st);
  }

  updateSelectionBox(st) {
    const rect = this.selected.size ? this.selectionRect(st) : null;
    st.selBox = rect;
    if (st.toolbar) st.toolbar.showSelection(rect);
  }

  clearSelection() {
    for (const st of this.sessions.values()) if (st.preview) this.commitPreview(st);
    if (!this.selected.size) { for (const st of this.sessions.values()) this.updateSelectionBox(st); return; }
    const touched = new Set();
    for (const st of this.sessions.values()) for (const i of this.selectionItems(st)) touched.add(i.path + '\u0000' + i.key);
    this.selected.clear();
    for (const key of touched) this.redraw(...key.split('\u0000'));
    for (const st of this.sessions.values()) this.updateSelectionBox(st);
  }

  // Drag the selection: `mode` is 'move', a corner ('nw' | 'ne' | 'sw' | 'se': resize, keeping the
  // proportions, from the opposite corner) or 'rotate' (around the box's center).
  startMove(st, e, mode = 'move') {
    const items = this.selectionItems(st), b = st.selBox;
    const M = { id: e.pointerId, mode, x0: e.clientX, y0: e.clientY, box: { ...b },
      items: items.map(i => { const f = frameOf(i.el); return { ...i, f, w: f.width, sc: f.s, before: clone(i.s.pts), bw: i.s.width, brot: i.s.rot }; }) };
    if (mode === 'rotate') {
      M.c = [(b.left + b.right) / 2, (b.top + b.bottom) / 2];
      M.a0 = Math.atan2(e.clientY - M.c[1], e.clientX - M.c[0]);
    } else if (mode !== 'move') {
      M.anchor = [mode.includes('w') ? b.right : b.left, mode.includes('n') ? b.bottom : b.top];
      M.d0 = Math.max(1, Math.hypot(e.clientX - M.anchor[0], e.clientY - M.anchor[1]));
      M.kMin = 16 / Math.max(1, Math.hypot(b.right - b.left, b.bottom - b.top));   // never smaller than ~16px across
    }
    st.moving = M;
  }

  moveSelection(st, e) {
    const M = st.moving, dx = e.clientX - M.x0, dy = e.clientY - M.y0;
    if (M.mode === 'move') {
      for (const it of M.items) it.s.pts = it.before.map(p => { const q = p.slice(); q[0] = +(p[0] + dx / (it.w * it.sc)).toFixed(4); q[1] = +(p[1] + dy / it.sc).toFixed(1); return q; });
    } else {
      // Work in screen space, so a selection spanning several paragraphs (or a zoomed note) turns as one piece.
      let map, k = 1, deg = 0;
      if (M.mode === 'rotate') {
        let a = Math.atan2(e.clientY - M.c[1], e.clientX - M.c[0]) - M.a0;
        deg = a * 180 / Math.PI;
        const snap = Math.round(deg / 45) * 45;                  // settle on 0, 45, 90... when close
        if (Math.abs(deg - snap) < 4) deg = snap;
        a = deg * Math.PI / 180;
        const c = Math.cos(a), n = Math.sin(a), [cx, cy] = M.c;
        map = (X, Y) => [cx + (X - cx) * c - (Y - cy) * n, cy + (X - cx) * n + (Y - cy) * c];
      } else {
        k = Math.max(M.kMin, Math.min(8, Math.hypot(e.clientX - M.anchor[0], e.clientY - M.anchor[1]) / M.d0));
        const [ax, ay] = M.anchor;
        map = (X, Y) => [ax + (X - ax) * k, ay + (Y - ay) * k];
      }
      for (const it of M.items) {
        const { f } = it;
        it.s.pts = it.before.map(p => {
          const [X, Y] = map(p[0] * f.width * f.s + f.left, p[1] * f.s + f.top), q = p.slice();
          q[0] = +((X - f.left) / (f.width * f.s)).toFixed(4); q[1] = +((Y - f.top) / f.s).toFixed(1);
          return q;
        });
        if (k !== 1) it.s.width = +Math.max(0.5, it.bw * k).toFixed(2);       // lines thicken/thin with the drawing
        if (M.mode === 'rotate' && it.s.geom === 'ellipse') {
          const r = (((it.brot || 0) + deg) % 360 + 360) % 360;
          if (r) it.s.rot = +r.toFixed(1); else delete it.s.rot;
        }
      }
    }
    for (const el of new Set(M.items.map(it => it.el))) if (el.paChild) el.paChild.draw();
    this.updateSelectionBox(st);
  }

  // Done dragging the lasso selection. Ink is attached to a paragraph, so a drawing dropped onto a
  // different paragraph moves into that paragraph's ink (it then scrolls/reflows with it).
  // Undo puts it back exactly where it was.
  finishMove(st) {
    const M = st.moving; st.moving = null;
    const changes = [], touched = new Set();
    for (const it of M.items) {
      touched.add(it.el);
      if (JSON.stringify(it.before) === JSON.stringify(it.s.pts) && it.bw === it.s.width && it.brot === it.s.rot) continue;
      // What a drag can change: points, and for resize/rotate the line width and an ellipse's angle.
      const ell = it.s.geom === 'ellipse';
      const was = { pts: it.before, width: it.bw, ...(ell ? { rot: it.brot === undefined ? null : it.brot } : {}) };
      const now = { pts: clone(it.s.pts), width: it.s.width, ...(ell ? { rot: it.s.rot === undefined ? null : it.s.rot } : {}) };
      const r0 = frameOf(it.el);
      const xs = it.s.pts.map(p => p[0] * r0.width * r0.s + r0.left), ys = it.s.pts.map(p => p[1] * r0.s + r0.top);
      const target = this.sectionAt(st.root, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      if (target && target !== it.el && target.dataset.paPath === it.path) {
        const r1 = frameOf(target), list = this.strokesFor(it.path, it.key), idx = list.indexOf(it.s);
        const moved = { ...it.s, pts: it.s.pts.map(p => { const q = p.slice(); q[0] = +((p[0] * r0.width * r0.s + r0.left - r1.left) / (r1.width * r1.s)).toFixed(4); q[1] = +((p[1] * r0.s + r0.top - r1.top) / r1.s).toFixed(1); return q; }) };
        Object.assign(it.s, was);                  // the original object stays as it was, for undo
        if (it.s.rot === null) delete it.s.rot;
        if (moved.rot == null) delete moved.rot;
        if (idx >= 0) list.splice(idx, 1);
        const d = this.inkData(it.path), nkey = target.dataset.paKey;
        (d.sections[nkey] = d.sections[nkey] || []).push(moved);
        if (this.selected.delete(it.s)) this.selected.add(moved);
        changes.push({ type: 'erase', path: it.path, key: it.key, s: it.s, index: idx }, { type: 'add', path: it.path, key: nkey, s: moved });
        touched.add(target);
      } else {
        changes.push({ type: 'edit', path: it.path, key: it.key, s: it.s, before: was, after: now });
      }
      this.saveInk(it.path);
    }
    for (const el of touched) if (el.paChild) el.paChild.draw();
    if (changes.length) this.record({ type: 'batch', items: changes });
    this.updateSelectionBox(st);
  }

  // Change fields on every selected drawing that `filter` accepts. `fieldsFor(s)` returns the new values.
  // One undo step. (null means "not set", so undo can clear a field that wasn't there before.)
  restyleSelection(st, filter, fieldsFor) {
    const items = this.selectionItems(st).filter(i => filter(i.s));
    if (!items.length) return;
    const change = { type: 'batch', items: items.map(i => {
      const after = fieldsFor(i.s), before = {};
      for (const k in after) before[k] = i.s[k] === undefined ? null : clone(i.s[k]);
      return { type: 'edit', path: i.path, key: i.key, s: i.s, before, after: clone(after) };
    }) };
    this.applyChange(change, false);
    this.record(change);
    this.updateSelectionBox(st);
  }

  // Slider support: show a value live while dragging, then commit it as one undo step.
  previewSelection(st, filter, key, value) {
    // A drag that ended back where it started fires no "change": drop a preview left from an old selection.
    if (st.preview && (st.preview.key !== key || st.preview.items.some(i => !this.selected.has(i.s)))) this.commitPreview(st);
    if (!st.preview) st.preview = { key, items: this.selectionItems(st).filter(i => filter(i.s)).map(i => ({ ...i, before: i.s[key] === undefined ? null : i.s[key] })) };
    for (const it of st.preview.items) it.s[key] = value;
    for (const el of new Set(st.preview.items.map(i => i.el))) if (el.paChild) el.paChild.draw();
  }

  commitPreview(st) {
    const pv = st.preview; st.preview = null;
    if (!pv) return;
    const items = pv.items.filter(it => it.s[pv.key] !== it.before);
    if (!items.length) return;
    this.record({ type: 'batch', items: items.map(it => ({ type: 'edit', path: it.path, key: it.key, s: it.s, before: { [pv.key]: it.before }, after: { [pv.key]: it.s[pv.key] } })) });
    for (const p of new Set(items.map(i => i.path))) this.saveInk(p);
  }

  // Copies of the selection, nudged down-right; the copies become the selection.
  duplicateSelection(st) {
    const items = this.selectionItems(st);
    if (!items.length) return;
    const adds = [];
    for (const i of items) {
      const w = frameOf(i.el).width, c = clone(i.s);
      c.pts = c.pts.map(p => { const q = p.slice(); q[0] = +(p[0] + 16 / w).toFixed(4); q[1] = +(p[1] + 16).toFixed(1); return q; });
      if (c.seed) c.seed = newSeed();
      const d = this.inkData(i.path);
      (d.sections[i.key] = d.sections[i.key] || []).push(c);
      adds.push({ type: 'add', path: i.path, key: i.key, s: c });
    }
    this.selected.clear();
    for (const a of adds) this.selected.add(a.s);
    this.record({ type: 'batch', items: adds });
    for (const p of new Set(items.map(i => i.path))) this.saveInk(p);
    this.showSelection(st);
  }

  // Layers: move the selection above (front) or below (back) everything else in its paragraph.
  reorderSelection(st, toFront) {
    const seen = new Set(), changes = [];
    for (const i of this.selectionItems(st)) {
      const id = i.path + '\u0000' + i.key;
      if (seen.has(id)) continue;
      seen.add(id);
      const list = this.strokesFor(i.path, i.key);
      const sel = list.filter(s => this.selected.has(s)), rest = list.filter(s => !this.selected.has(s));
      const after = toFront ? [...rest, ...sel] : [...sel, ...rest];
      if (after.every((s, k) => s === list[k])) continue;
      changes.push({ type: 'order', path: i.path, key: i.key, before: [...list], after });
    }
    if (!changes.length) return;
    const change = { type: 'batch', items: changes };
    this.applyChange(change, false);
    this.record(change);
  }

  recolorSelection(st, color) {
    const items = this.selectionItems(st).filter(i => i.s.color !== color);
    if (!items.length) return;
    const change = { type: 'batch', items: items.map(i => ({ type: 'edit', path: i.path, key: i.key, s: i.s, before: { color: i.s.color }, after: { color } })) };
    this.applyChange(change, false);
    this.record(change);
  }

  // Copy (or cut) the selection. Points are kept in px from the selection box's top-left, so
  // the ink keeps its size when pasted into a paragraph of another width or another note.
  copySelection(st, cut = false) {
    const items = this.selectionItems(st), box = this.selectionRect(st);
    if (!items.length || !box) return false;
    const s0 = frameOf(items[0].el).s;
    this.inkClip = { w: (box.right - box.left) / s0, h: (box.bottom - box.top) / s0, n: 0, strokes: items.map(({ el, s }) => {
      const f = frameOf(el), c = clone(s);
      c.pts = s.pts.map(p => { const q = p.slice(); q[0] = +((p[0] * f.width * f.s + f.left - box.left) / f.s).toFixed(1); q[1] = +((p[1] * f.s + f.top - box.top) / f.s).toFixed(1); return q; });
      return c;
    }) };
    if (cut) this.deleteSelection(st);
    this.refreshToolbars();
    return true;
  }

  // Paste copied ink in the middle of what's on screen (each repeat nudged down-right), attached to
  // whichever paragraph it lands on. It comes in selected, with Select on, ready to drag into place.
  pasteInk(st) {
    const C = this.inkClip;
    if (!C || !C.strokes.length) return false;
    return this.placeClip(st, C, 16 * (C.n++ % 8));
  }

  // Drop clip ink onto the page, centered on screen (plus `nudge` px). `before` are changes that go
  // into the same undo step; `keepSeed` keeps sketchy lines exactly as they were.
  placeClip(st, C, nudge, before = [], keepSeed = false) {
    if (!C || !C.strokes.length) return false;
    const rr = st.root.getBoundingClientRect(), first = this.sections(st.root)[0], s = first ? frameOf(first).s : 1;
    const off = nudge * s;
    const left = (rr.left + rr.right) / 2 - (C.w * s) / 2 + off, top = (rr.top + rr.bottom) / 2 - (C.h * s) / 2 + off;
    const adds = [];
    for (const c0 of C.strokes) {
      const c = clone(c0), X = c.pts.map(p => left + p[0] * s), Y = c.pts.map(p => top + p[1] * s);
      const el = this.sectionAt(st.root, (Math.min(...X) + Math.max(...X)) / 2, (Math.min(...Y) + Math.max(...Y)) / 2, keepSeed ? st.view.file.path : null);
      if (!el) continue;
      const f = frameOf(el), path = el.dataset.paPath, key = el.dataset.paKey, d = this.inkData(path);
      if (!d || (keepSeed && path !== st.view.file.path)) continue;   // recovered ink stays in its own note
      if (c.seed && !keepSeed) c.seed = newSeed();
      c.pts = c.pts.map((p, i) => { const q = p.slice(); q[0] = +((X[i] - f.left) / (f.width * f.s)).toFixed(4); q[1] = +((Y[i] - f.top) / f.s).toFixed(1); return q; });
      (d.sections[key] = d.sections[key] || []).push(c);
      adds.push({ type: 'add', path, key, s: c });
    }
    if (!adds.length) return 0;
    this.clearSelection();
    for (const a of adds) this.selected.add(a.s);
    this.record({ type: 'batch', items: [...before, ...adds] });
    for (const p of new Set(adds.map(a => a.path))) this.saveInk(p);
    if (this.prefs.tool !== 'lasso') { this.prefs.tool = 'lasso'; this.savePrefs(); }
    this.refreshToolbars();
    this.showSelection(st);
    return adds.length;
  }

  deleteSelection(st) {
    const items = this.selectionItems(st);
    if (!items.length) return;
    const actions = [];
    for (const i of items) {
      const list = this.strokesFor(i.path, i.key), idx = list.indexOf(i.s);
      if (idx < 0) continue;
      list.splice(idx, 1);
      actions.push({ type: 'erase', path: i.path, key: i.key, s: i.s, index: idx });
    }
    this.selected.clear();
    for (const i of items) { if (i.el.paChild) i.el.paChild.draw(); this.saveInk(i.path); }
    if (actions.length) this.record({ type: 'batch', items: actions });   // undo replays these backwards, restoring each index
    this.updateSelectionBox(st);
  }

  // ----- undo / redo -----------------------------------------------------------
  // A change is one of:
  //   {type: 'add' | 'erase', path, key, s, index}
  //   {type: 'replace', path, key, index, old, news}   partial erase: one stroke became pieces
  //   {type: 'edit', path, key, s, before, after}      select move/recolor/restyle: fields changed in place
  //   {type: 'order', path, key, before, after}         bring to front / send to back (whole list order)
  //   {type: 'batch', items: [...]}                     one eraser swipe / lasso action = one undo
  // Undo reverses a change; redo replays it.

  // Undo and redo are per note: undoing in one note never changes another one.
  record(action) {
    this.undoStack.push(action);
    const paths = this.pathsOf(action), keep = this.redoStack.filter(a => !this.pathsOf(a).some(p => paths.includes(p)));
    this.redoStack.splice(0, this.redoStack.length, ...keep);
    this.refreshToolbars();
  }

  pathsOf(a) { return a.type === 'batch' ? a.items.flatMap(i => this.pathsOf(i)) : [a.path]; }
  activeNotePath() { const v = this.app.workspace.getActiveViewOfType(MarkdownView); return v && v.file ? v.file.path : null; }
  // Index of the newest step for this note (any note if notePath is null), or -1.
  lastFor(stack, notePath) {
    for (let i = stack.length - 1; i >= 0; i--) if (!notePath || this.pathsOf(stack[i]).includes(notePath)) return i;
    return -1;
  }

  applyChange(a, reverse) {
    if (a.type === 'batch') {
      for (const it of (reverse ? [...a.items].reverse() : a.items)) this.applyChange(it, reverse);
      return;
    }
    const d = this.inkData(a.path); if (!d) return;
    const list = d.sections[a.key] || (d.sections[a.key] = []);
    if (a.type === 'order') {
      list.splice(0, list.length, ...(reverse ? a.before : a.after));
    } else if (a.type === 'edit') {
      Object.assign(a.s, clone(reverse ? a.before : a.after));
    } else if (a.type === 'replace') {
      if (!reverse) { const i = list.indexOf(a.old); if (i >= 0) list.splice(i, 1, ...a.news); }
      else {
        let at = -1;
        for (const n of a.news) { const i = list.indexOf(n); if (i >= 0) { list.splice(i, 1); if (at < 0 || i < at) at = i; } }
        list.splice(at >= 0 ? at : Math.min(a.index, list.length), 0, a.old);
      }
    } else {
      const remove = (a.type === 'erase') !== reverse;   // redo erase / undo add -> remove the stroke
      if (remove) { const i = list.lastIndexOf(a.s); if (i >= 0) list.splice(i, 1); }
      else list.splice(a.type === 'erase' ? Math.min(a.index, list.length) : list.length, 0, a.s);
    }
    this.saveInk(a.path);
    this.redraw(a.path, a.key);
  }

  undoLast(notePath = this.activeNotePath()) {
    const i = this.lastFor(this.undoStack, notePath);
    if (i < 0) { new Notice('Nothing to undo'); return; }
    const [a] = this.undoStack.splice(i, 1);
    this.applyChange(a, true);
    this.redoStack.push(a);
    this.afterHistory();
  }

  redoLast(notePath = this.activeNotePath()) {
    const i = this.lastFor(this.redoStack, notePath);
    if (i < 0) { new Notice('Nothing to redo'); return; }
    const [a] = this.redoStack.splice(i, 1);
    this.applyChange(a, false);
    this.undoStack.push(a);
    this.afterHistory();
  }

  afterHistory() {
    for (const st of this.sessions.values()) if (this.selected.size) this.showSelection(st);
    this.refreshToolbars();
  }

  refreshToolbars() { for (const st of this.sessions.values()) if (st.toolbar) st.toolbar.paint(); }

  // ----- toolbar ---------------------------------------------------------------
  //   [grip] [↕] [pen] [highlighter] [shapes] [eraser] [select] [laser] [favorites...] | [options] | [undo] [redo] [Done]
  // [↕] flips the toolbar between a row and a column.
  // Drag the grip to move the toolbar; double-tap it to snap back to the top-right.
  // "Options" (or tapping the active tool again) opens that tool's card.
  //
  // Inline styles + hand-drawn SVG icons on purpose: Obsidian's mobile button styles beat
  // stylesheet classes, and setIcon() rendered nothing in the toolbar on the iPad.

  buildToolbar(view, st) {
    const P = this.prefs;

    const bar = h('div', 'pa-toolbar pa-ui');
    const row = h('div', 'pa-row pa-card');
    const panel = h('div', 'pa-panel pa-card pa-hidden');
    bar.append(row, panel);

    // Run `fn` on pointerup (Pencil, finger and mouse alike), with click as a fallback for the
    // keyboard. The shared timestamp ignores the click that follows a handled tap.
    let lastTap = 0;
    const onTap = (el, fn) => {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('pointerup', (e) => { e.stopPropagation(); lastTap = Date.now(); fn(); });
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (Date.now() - lastTap > 600) fn(); });
    };
    // A toolbar button. `cls`: extra classes for its size/kind (see styles.css).
    const button = (label, content, fn, cls) => {
      const b = h('button', 'pa-btn' + (cls ? ' ' + cls : ''), ...(Array.isArray(content) ? content : [content]));
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
      onTap(b, fn);
      return b;
    };
    const on = (el, yes) => el.classList.toggle('is-on', !!yes);
    const active = (el, yes) => el.classList.toggle('is-active', !!yes);
    const L = (text) => h('div', 'pa-label', text);
    // A round color chip: `--pa-c` carries the color into styles.css.
    const chipOf = (color, size) => { const c = h('span', 'pa-chip' + (size ? ' ' + size : '')); cssVars(c, { '--pa-c': color }); return c; };

    // Segmented control: [A | B | C]. Returns { el, paint }.
    const segmented = (options, get, set) => {
      const el = h('div', 'pa-seg');
      const btns = options.map(([value, label]) => {
        const b = button(label, label, () => { set(value); paint(); this.savePrefs(); }, 'pa-btn-text');
        b.dataset.value = value;
        return b;
      });
      el.append(...btns);
      return { el, paint: () => { for (const b of btns) on(b, b.dataset.value === get()); } };
    };
    // On/off switch with a label. Returns { el, paint }.
    const toggle = (label, get, set) => {
      const track = h('span', 'pa-track', h('span', 'pa-knob'));
      const b = button(label, [h('span', 'pa-switch-label', label), track], () => { set(!get()); paint(); this.savePrefs(); }, 'pa-btn-text pa-switch');
      b.setAttribute('role', 'switch');
      return { el: b, paint: () => { const yes = !!get(); on(b, yes); b.setAttribute('aria-checked', String(yes)); } };
    };
    // Fill picker: none + light fills. Returns { el, paint }.
    const fillRow = (get, set) => {
      const el = h('div', 'pa-fills');
      const none = h('span', 'pa-chip is-small pa-chip-none', h('span', 'pa-chip-slash'));
      const btns = [[null, none, 'No fill'], ...FILLS.map(c => [c, chipOf(c, 'is-small'), `Fill ${c}`])]
        .map(([value, chipEl, label]) => {
          const b = button(label, chipEl, () => { set(value); paint(); this.savePrefs(); }, 'pa-btn-round');
          b.paValue = value; b.paChip = chipEl;
          return b;
        });
      el.append(...btns);
      return { el, paint: () => { const v = get() || null; for (const b of btns) on(b.paChip, b.paValue === v); } };
    };
    // Opacity slider (10-100%). onInput fires while dragging, onCommit when let go. Returns { el, paint }.
    const slider = (get, onInput, onCommit) => {
      const val = h('span', 'pa-range-val');
      const input = h('input', 'pa-range');
      input.type = 'range'; input.min = '10'; input.max = '100'; input.step = '5';
      input.setAttribute('aria-label', 'Opacity');
      input.addEventListener('pointerdown', (e) => e.stopPropagation());
      input.addEventListener('input', () => { val.textContent = input.value + '%'; onInput(Number(input.value) / 100); });
      input.addEventListener('change', () => onCommit(Number(input.value) / 100));
      return { el: h('div', 'pa-slider', input, val), input, paint: () => {
        if (input.ownerDocument.activeElement === input) return;
        const v = Math.round((get() || 1) * 100);
        input.value = String(v); val.textContent = v + '%';
      } };
    };
    // A size button showing a sample line. Returns the button (its line is `b.paLine`).
    const sizeButton = (label, width, fn, hl) => {
      const svg = activeDocument.createElementNS(SVGNS, 'svg');
      svg.setAttribute('width', '40'); svg.setAttribute('height', '22'); svg.setAttribute('viewBox', '0 0 40 22');
      const line = activeDocument.createElementNS(SVGNS, 'path');
      line.setAttribute('d', 'M8 11 L32 11');
      line.setAttribute('stroke-width', String(width));
      line.setAttribute('stroke-linecap', hl ? 'butt' : 'round');
      line.setAttribute('stroke-opacity', hl ? '0.6' : '1');
      svg.appendChild(line);
      const b = button(label, svg, fn, 'pa-btn-wide');
      b.paLine = line;
      return b;
    };

    // Tool buttons, each with a little bar underneath in that tool's current color.
    const colorBar = (cls) => h('span', 'pa-colorbar' + (cls ? ' ' + cls : ''));
    const penBar = colorBar(), hlBar = colorBar('is-hl'), shapeBar = colorBar();
    const shapeIcon = h('span', 'pa-shape-icon');
    const raised = (svg) => { svg.classList.add('pa-raised'); return svg; };
    // Hand: only while drawing with a finger. Tap it to scroll with one finger; tap a tool to draw again.
    // Not saved, so marking up always starts out drawing.
    const fingerMode = () => this.fingerSetting() && !st.penSeen;
    const handBtn = button('Scroll', svgIcon(ICONS.hand), () => { st.hand = !st.hand; if (st.hand) closePanel(); paint(); });
    const tools = {
      pen: button('Pen', [raised(svgIcon(ICONS.pen)), penBar], () => pickTool('pen')),
      hl: button('Highlighter', [raised(svgIcon(ICONS.highlighter)), hlBar], () => pickTool('hl')),
      shape: button('Shapes', [shapeIcon, shapeBar], () => pickTool('shape')),
      eraser: button('Eraser', svgIcon(ICONS.eraser), () => pickTool('eraser')),
      lasso: button('Select', svgIcon(ICONS.select, 24, 1.8, '3 2.6'), () => pickTool('lasso')),
      laser: button('Laser pointer', svgIcon(ICONS.laser), () => pickTool('laser')),
    };
    // Shows while zoomed in ("2.5×"); tap to go back to 100%.
    const zoomText = h('span', '', '');
    const zoomBtn = button('Reset zoom', zoomText, () => this.resetZoom(st), 'pa-btn-zoom pa-hidden');
    const pasteBtn = button('Paste ink', svgIcon(ICONS.paste), () => this.pasteInk(st), 'pa-hidden');

    // Favorites: one-tap presets of tool + color + size.
    const favRow = h('div', 'pa-favs');
    const sep = () => h('span', 'pa-sep');
    const favSep = sep();
    let favKey = null, favBtns = [];
    const favMatches = (f) => P.tool === f.tool && P[f.tool].color === f.color && P[f.tool].size === f.size &&
      (f.tool !== 'pen' || ((P.pen.type || 'ball') === f.type && (P.pen.dash || 'solid') === (f.dash || 'solid')));
    // A favorite looks like a mini tool button: the tool's icon in the saved color, a line under it
    // showing the saved thickness / dashes, and a small gold star so it reads as "favorite".
    const favChip = (f) => {
      const i = Math.max(0, SIZES[f.tool].indexOf(f.size)), hl = f.tool === 'hl';
      const icon = svgIcon(hl ? ICONS.highlighter : ICONS.pen, 20, hl ? 1.8 : 2);
      icon.classList.add('pa-fav-icon');
      const line = h('span', 'pa-fav-line' + (f.dash === 'dash' ? ' is-dash' : f.dash === 'dot' ? ' is-dot' : '') + (hl ? ' is-hl' : ''));
      cssVars(line, { '--pa-w': (hl ? 3 + i : 1.5 + i * 0.8) + 'px' });
      const star = svgIcon(ICONS.starFilled, 10, 1.5);
      star.classList.add('pa-fav-star');
      return [icon, line, star];
    };
    const applyFavorite = (f) => {
      st.hand = false;
      P.tool = f.tool; P.lastDrawTool = f.tool;
      P[f.tool].color = f.color; P[f.tool].size = f.size;
      if (f.tool === 'pen') { P.pen.type = f.type; P.pen.dash = f.dash || 'solid'; }
      this.clearSelection();
      closePanel(); paint(); this.savePrefs();
    };
    const buildFavorites = () => {
      const key = JSON.stringify(P.favorites);
      if (key === favKey) return;
      favKey = key;
      favBtns = P.favorites.map((f, i) => {
        const b = button(`Favorite ${i + 1}: ${f.tool === 'hl' ? 'highlighter' : (f.type === 'fountain' ? 'fountain pen' : 'pen')} ${f.color}`, favChip(f), () => applyFavorite(f), 'pa-btn-fav');
        cssVars(b, { '--pa-c': f.color });
        b.paFav = f;
        return b;
      });
      favRow.replaceChildren(...favBtns);
      show(favSep, P.favorites.length > 0);
      show(favRow, P.favorites.length > 0);
    };

    // Options button: a "settings" sliders icon with a dot in the current color.
    const chipDot = h('span', 'pa-opt-dot');
    const styleBtn = button('Color and size', h('span', 'pa-opt', svgIcon(ICONS.sliders, 22), chipDot), () => togglePanel());
    styleBtn.setAttribute('title', 'Options: color, size and style');

    const notePath = () => (view.file ? view.file.path : null);
    const undoBtn = button('Undo', svgIcon(ICONS.undo), () => this.undoLast(notePath()));
    const redoBtn = button('Redo', svgIcon(ICONS.redo), () => this.redoLast(notePath()));
    const doneIcon = svgIcon(ICONS.check, 22, 2.4);
    doneIcon.classList.add('pa-done-icon');
    const doneBtn = button('Done', [h('span', 'pa-done-text', 'Done'), doneIcon], () => this.stop(view), 'pa-btn-done');
    const orientIcon = h('span', 'pa-shape-icon');
    const orientBtn = button('Make toolbar vertical', orientIcon, () => {
      P.barVertical = !P.barVertical;
      applyOrientation(); place(); this.savePrefs();
    }, 'pa-btn-orient');

    const grip = h('div', 'pa-grip', svgIcon(ICONS.grip, 18, 3));
    grip.setAttribute('aria-label', 'Move toolbar (double-tap to reset)');
    grip.setAttribute('title', 'Drag to move. Double-tap to put it back.');

    row.append(grip, orientBtn, handBtn, tools.pen, tools.hl, tools.shape, tools.eraser, tools.lasso, pasteBtn, tools.laser, zoomBtn, favSep, favRow, sep(), styleBtn, sep(), undoBtn, redoBtn, doneBtn);

    // Vertical column along the side of the page (default), or a horizontal row.
    const applyOrientation = () => {
      const V = !!P.barVertical;
      bar.classList.toggle('is-vertical', V);
      orientIcon.replaceChildren(svgIcon(V ? ICONS.toHorizontal : ICONS.toVertical, 20));
      const label = V ? 'Make toolbar horizontal' : 'Make toolbar vertical';
      orientBtn.setAttribute('aria-label', label); orientBtn.setAttribute('title', label);
    };
    applyOrientation();

    // ----- moving the toolbar -----
    const M = 8;   // gap kept between the toolbar and the edges of the note area
    // Where it sits until you drag it: a column on the left side, or a row at the top right.
    const homeOf = () => (P.barVertical ? { x: 0, y: 0 } : { x: 1, y: 0 });
    const place = () => {
      if (!bar.isConnected) return;
      const r = st.root.getBoundingClientRect();
      const V = !!P.barVertical;
      // Too long for the screen? Wrap onto a 2nd row (horizontal) or a 2nd column (vertical).
      const rowMax = (V ? r.height : r.width) - 2 * M;
      css(row, V ? { maxHeight: Math.max(200, rowMax) + 'px', maxWidth: '' } : { maxWidth: Math.max(200, rowMax) + 'px', maxHeight: '' });
      const maxX = Math.max(0, r.width - bar.offsetWidth - 2 * M), maxY = Math.max(0, r.height - bar.offsetHeight - 2 * M);
      const pos = P.barPos || homeOf();
      placeAt(bar, Math.round(r.left + M + pos.x * maxX), Math.round(r.top + M + pos.y * maxY));
      // Open the card on whichever side has room: below/above a row, beside a column.
      panel.classList.toggle('is-up', pos.y > 0.5);
      panel.classList.toggle('is-left', pos.x < 0.5);
      const maxW = V ? r.width - bar.offsetWidth - 3 * M : r.width - 2 * M;
      const maxH = V ? r.height - 2 * M : r.height - bar.offsetHeight - 3 * M;
      css(panel, { maxWidth: Math.max(200, maxW) + 'px', maxHeight: Math.max(160, maxH) + 'px' });
    };
    let drag = null, lastGripTap = 0;
    grip.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const br = bar.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - br.left, dy: e.clientY - br.top, x0: e.clientX, y0: e.clientY, moved: false };
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      grip.classList.add('is-dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation(); e.preventDefault();
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
      drag.moved = true;
      const r = st.root.getBoundingClientRect();
      const maxX = Math.max(1, r.width - bar.offsetWidth - 2 * M), maxY = Math.max(1, r.height - bar.offsetHeight - 2 * M);
      const clamp = (v) => Math.max(0, Math.min(1, v));
      P.barPos = { x: clamp((e.clientX - drag.dx - r.left - M) / maxX), y: clamp((e.clientY - drag.dy - r.top - M) / maxY) };
      place();
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      const wasTap = !drag.moved;
      drag = null;
      grip.classList.remove('is-dragging');
      if (wasTap) {
        const now = Date.now();
        if (now - lastGripTap < 350) { P.barPos = null; place(); lastGripTap = 0; }   // double-tap: back home
        else lastGripTap = now;
      }
      this.savePrefs();
    };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    const ro = new ResizeObserver(() => place());   // keep it on screen when the pane resizes
    ro.observe(st.root);

    // ----- selection: dashed box + a small menu (recolor / style / duplicate / layers / delete) -----
    // Corner handles resize, the knob under the box rotates. They're only drawn here: presses are
    // matched by position in handleAt(), like the rest of the selection.
    const selBox = h('div', 'pa-selbox pa-hidden', ...['nw', 'ne', 'sw', 'se'].map(c => h('div', 'pa-handle is-' + c)),
      h('div', 'pa-knob-stem'), h('div', 'pa-knob', svgIcon(ICONS.rotate, 12)));
    const selMenu = h('div', 'pa-selmenu pa-card pa-ui pa-hidden');
    for (const c of SWATCHES) selMenu.append(button(`Recolor ${c}`, chipOf(c, 'is-tiny'), () => this.recolorSelection(st, c), 'pa-btn-round'));
    const styleSelBtn = button('Style selection', svgIcon(ICONS.sliders, 20), () => toggleSelCard(), 'pa-btn-small');
    selMenu.append(sep(), styleSelBtn,
      button('Duplicate', svgIcon(ICONS.duplicate, 20), () => { closeSelCard(); this.duplicateSelection(st); }, 'pa-btn-small'),
      button('Copy', svgIcon(ICONS.copy, 20), () => this.copySelection(st), 'pa-btn-small'),
      button('Bring to front', svgIcon(ICONS.front, 20), () => this.reorderSelection(st, true), 'pa-btn-small'),
      button('Send to back', svgIcon(ICONS.back, 20), () => this.reorderSelection(st, false), 'pa-btn-small'),
      button('Delete selection', svgIcon(ICONS.trash, 20), () => { closeSelCard(); this.deleteSelection(st); }, 'pa-btn-small'),
      button('Deselect', svgIcon(ICONS.close, 20), () => { closeSelCard(); this.clearSelection(); }, 'pa-btn-small'));

    // Style card for the selection: only shows the options that apply to what's selected.
    const selCard = h('div', 'pa-selcard pa-card pa-ui pa-hidden');
    let selPainters = [];
    const selCardOpen = () => !selCard.classList.contains('pa-hidden');
    const closeSelCard = () => { show(selCard, false); selPainters = []; active(styleSelBtn, false); };
    const toggleSelCard = () => {
      if (selCardOpen()) { closeSelCard(); return; }
      buildSelCard();
      show(selCard, true);
      active(styleSelBtn, true);
      this.updateSelectionBox(st);
      for (const f of selPainters) f();
    };
    const buildSelCard = () => {
      const S = this.selectionItems(st).map(i => i.s);
      const notHl = (s) => !isHighlight(s), lined = (s) => !isHighlight(s) && !isFountain(s);
      const fillable = (s) => FILLABLE.includes(s.geom), shaped = (s) => !!s.geom;
      const cornered = (s) => CORNERED.includes(s.geom);
      const first = (f) => S.find(f);
      const kids = [];
      selPainters = [];
      if (S.some(notHl)) {
        const btns = SIZES.pen.map((sz, i) => {
          const b = sizeButton(`Width ${i + 1} of ${SIZES.pen.length}`, sz, () => this.restyleSelection(st, notHl, () => ({ width: sz })));
          b.paLine.classList.add('pa-sample');
          b.paSize = sz;
          return b;
        });
        kids.push(L('Width'), h('div', 'pa-widths', ...btns));
        selPainters.push(() => { const f = first(notHl); for (const b of btns) active(b, f && f.width === b.paSize); });
      }
      if (S.some(lined)) {
        const seg = segmented([['solid', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted']], () => (first(lined) || {}).dash || 'solid',
          (v) => this.restyleSelection(st, lined, () => ({ dash: v === 'solid' ? null : v })));
        kids.push(L('Line'), seg.el); selPainters.push(seg.paint);
      }
      if (S.some(fillable)) {
        const fr = fillRow(() => (first(fillable) || {}).fill, (v) => this.restyleSelection(st, fillable, () => ({ fill: v })));
        kids.push(L('Fill'), fr.el); selPainters.push(fr.paint);
      }
      if (S.some(shaped)) {
        const seg = segmented([['0', 'Clean'], ['1', 'Sketchy'], ['2', 'Rough']], () => String((first(shaped) || {}).rough || 0),
          (v) => this.restyleSelection(st, shaped, (s) => ({ rough: Number(v) || null, seed: s.seed || newSeed() })));
        kids.push(L('Sloppiness'), seg.el); selPainters.push(seg.paint);
      }
      if (S.some(cornered)) {
        const seg = segmented([['sharp', 'Sharp'], ['round', 'Round']], () => (first(cornered) || {}).edges || 'sharp',
          (v) => this.restyleSelection(st, cornered, () => ({ edges: v === 'round' ? 'round' : null })));
        kids.push(L('Edges'), seg.el); selPainters.push(seg.paint);
      }
      if (S.some(notHl)) {
        const sl = slider(() => { const f = first(notHl); return f && f.opacity != null ? f.opacity : 1; },
          (v) => this.previewSelection(st, notHl, 'opacity', v), () => this.commitPreview(st));
        kids.push(L('Opacity'), sl.el); selPainters.push(sl.paint);
      }
      if (!kids.length) kids.push(h('div', 'pa-note', 'Highlights only have a color.'));
      kids[0].classList.add('is-first');
      selCard.replaceChildren(...kids);
    };
    const showSelection = (rect) => {
      if (!rect) { show(selBox, false); show(selMenu, false); closeSelCard(); return; }
      show(selBox, true);
      css(selBox, { width: (rect.right - rect.left) + 'px', height: (rect.bottom - rect.top) + 'px' });
      placeAt(selBox, rect.left, rect.top);
      show(selMenu, true);
      const rr = st.root.getBoundingClientRect(), mw = selMenu.offsetWidth, mh = selMenu.offsetHeight;
      let my = rect.top - mh - 8;
      if (my < rr.top + 4) my = rect.bottom + KNOB_GAP + 18;           // no room above: below, clear of the rotate knob
      const mx = Math.max(rr.left + 4, Math.min(rect.left, rr.right - mw - 4));
      css(selMenu, { maxWidth: (rr.width - 8) + 'px' });
      placeAt(selMenu, mx, my);
      if (selCardOpen()) {
        // The style card goes under the menu, or above it. If neither fits, beside the selection
        // (right, else left), so it never covers the menu.
        const mr = selMenu.getBoundingClientRect(), cw = selCard.offsetWidth, ch = selCard.offsetHeight;
        const top = Math.max(rr.top + 4, Math.min(rect.top, rr.bottom - ch - 4));
        let cx, cy;
        if (mr.bottom + 6 + ch <= rr.bottom - 4) { cy = mr.bottom + 6; cx = mr.left; }
        else if (mr.top - ch - 6 >= rr.top + 4) { cy = mr.top - ch - 6; cx = mr.left; }
        else if (rect.right + 8 + cw <= rr.right - 4) { cx = rect.right + 8; cy = top; }
        else if (rect.left - 8 - cw >= rr.left + 4) { cx = rect.left - 8 - cw; cy = top; }
        else { cx = mr.left; cy = rr.top + 4; }
        placeAt(selCard, Math.max(rr.left + 4, Math.min(cx, rr.right - cw - 4)), cy);
      }
    };

    const current = () => P[P.tool];
    const panelOpen = () => !panel.classList.contains('pa-hidden');
    let painters = [];

    const paint = () => {
      buildFavorites();
      const hand = fingerMode() && st.hand;
      show(handBtn, fingerMode());
      active(handBtn, hand);
      for (const k in tools) active(tools[k], k === P.tool && !hand);
      for (const b of favBtns) active(b, favMatches(b.paFav));
      cssVars(penBar, { '--pa-c': P.pen.color });
      cssVars(hlBar, { '--pa-c': P.hl.color });
      cssVars(shapeBar, { '--pa-c': P.shape.color });
      if (shapeIcon.dataset.kind !== P.shape.kind) {       // the Shapes button shows the current shape
        shapeIcon.dataset.kind = P.shape.kind;
        shapeIcon.replaceChildren(svgIcon(ICONS[P.shape.kind]));
      }
      const c = current(), noOptions = P.tool === 'lasso' || P.tool === 'laser';
      show(chipDot, !noOptions);
      chipDot.classList.toggle('is-hl', P.tool === 'hl');
      chipDot.classList.toggle('is-eraser', P.tool === 'eraser');
      chipDot.classList.toggle('is-partial', P.tool === 'eraser' && c.mode === 'partial');
      if (!noOptions && P.tool !== 'eraser') cssVars(chipDot, { '--pa-c': c.color });
      styleBtn.classList.toggle('is-dim', noOptions);
      active(styleBtn, !noOptions && panelOpen());
      styleBtn.setAttribute('aria-label', P.tool === 'laser' ? 'No options for the laser' : P.tool === 'lasso' ? 'No options for Select' : P.tool === 'eraser' ? 'Eraser options' : 'Color and size');
      const z = st.zoom ? st.zoom.s : 1;
      show(zoomBtn, z !== 1);
      show(pasteBtn, !!this.inkClip);
      zoomText.textContent = (Math.round(z * 10) / 10) + '×';
      undoBtn.classList.toggle('is-dim', this.lastFor(this.undoStack, notePath()) < 0);
      redoBtn.classList.toggle('is-dim', this.lastFor(this.redoStack, notePath()) < 0);
      if (P.tool !== 'eraser') st.hideRing();
      if (P.tool !== 'laser') { st.laserPts = []; st.laserDot = null; }
      st.root.classList.toggle('pa-no-cursor', P.tool === 'laser' || P.tool === 'eraser');   // the ring / dot is the pointer
      if (panelOpen()) for (const f of painters) f();
      if (selCardOpen()) for (const f of selPainters) f();
    };

    const closePanel = () => { if (panelOpen()) { show(panel, false); paint(); } };
    const togglePanel = () => {
      if (panelOpen() || P.tool === 'lasso' || P.tool === 'laser') { closePanel(); return; }
      painters = P.tool === 'eraser' ? buildEraserPanel() : buildInkPanel();
      show(panel, true);
      paint();
    };

    const setColor = (c, remember) => {
      const cur = current(); if (!['pen', 'hl', 'shape'].includes(P.tool) || !isColor(c)) return;
      cur.color = c.toLowerCase();
      if (remember && !SWATCHES.includes(cur.color)) P.recent = [cur.color, ...P.recent.filter(x => x !== cur.color)].slice(0, MAX_RECENT);
      paint();
      this.savePrefs();
    };
    const setSize = (sz) => { current().size = sz; paint(); this.savePrefs(); };

    // Pen / highlighter / shapes card. Built fresh each time it opens (so recent colors show up),
    // never while it's open: rebuilding would yank the color input out from under the iOS picker.
    const buildInkPanel = () => {
      const tool = P.tool;
      const grid = h('div', 'pa-grid');
      const swatches = [];
      for (const c of [...SWATCHES, ...P.recent.filter(c => !SWATCHES.includes(c))]) {
        const dot = chipOf(c);
        const b = button(c, dot, () => setColor(c, false), 'pa-btn-round');
        b.dataset.color = c;
        b.paDot = dot;
        swatches.push(b);
        grid.append(b);
      }
      // Color wheel: a rainbow dot with the native color input laid invisibly on top
      // (iPad WebKit opens its own color picker; no dependencies).
      const picker = h('input', 'pa-wheel-input');
      picker.type = 'color';
      picker.value = current().color;
      picker.setAttribute('aria-label', 'Pick any color');
      picker.setAttribute('title', 'Pick any color');
      picker.addEventListener('pointerdown', (e) => e.stopPropagation());
      picker.addEventListener('input', () => setColor(picker.value, false));
      picker.addEventListener('change', () => setColor(picker.value, true));
      const wheelDot = h('span', 'pa-wheel');
      grid.append(h('span', 'pa-wheel-wrap', wheelDot, picker));

      // Sizes, drawn as a sample stroke in the current color.
      const sizes = SIZES[tool].map((sz, i) => {
        const b = sizeButton(`Size ${i + 1} of ${SIZES[tool].length}`, Math.min(18, tool === 'hl' ? sz * 0.55 : sz), () => setSize(sz), tool === 'hl');
        b.dataset.size = String(sz);
        return b;
      });
      const sizeRow = h('div', 'pa-sizes', ...sizes);

      const extras = [];
      if (tool === 'pen') {
        extras.push(segmented([['ball', 'Ballpoint'], ['fountain', 'Fountain']], () => P.pen.type || 'ball', (v) => { P.pen.type = v; }));
        const lineStyle = segmented([['solid', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted']], () => P.pen.dash || 'solid', (v) => { P.pen.dash = v; });
        // The fountain pen is drawn as a filled shape, so dashes don't apply to it.
        extras.push({ el: lineStyle.el, paint: () => { lineStyle.paint(); show(lineStyle.el, P.pen.type !== 'fountain'); } });
        const op = slider(() => P.pen.opacity, (v) => { P.pen.opacity = v; }, () => this.savePrefs());
        extras.push({ el: h('div', 'pa-seg-wrap', L('Opacity'), op.el), paint: op.paint });
      } else if (tool === 'shape') {
        // Shape picker: a row of icon buttons.
        const pick = h('div', 'pa-seg pa-shape-grid');
        const btns = SHAPES.map(k => {
          const b = button(SHAPE_NAMES[k], svgIcon(ICONS[k], 22), () => { P.shape.kind = k; paint(); this.savePrefs(); }, 'pa-btn-shape');
          b.dataset.kind = k;
          return b;
        });
        pick.append(...btns);
        extras.push({ el: pick, paint: () => { for (const b of btns) on(b, b.dataset.kind === P.shape.kind); } });
      } else {
        extras.push(toggle('Straight lines', () => P.hl.straight, (v) => { P.hl.straight = v; }));
      }

      // Save / remove the current setup as a favorite.
      const favLabel = h('span', '', '');
      const favBtn = button('Favorite', [svgIcon(ICONS.star, 16), favLabel], () => {
        const f = validFavorite({ tool, color: P[tool].color, size: P[tool].size, type: P.pen.type, dash: P.pen.dash });
        if (!f) { new Notice('Pen Ink: pick one of the 4 sizes to save a favorite.'); return; }
        const i = P.favorites.findIndex(x => JSON.stringify(x) === JSON.stringify(f));
        if (i >= 0) P.favorites.splice(i, 1);
        else if (P.favorites.length >= MAX_FAVORITES) { new Notice(`Pen Ink: up to ${MAX_FAVORITES} favorites. Remove one first.`); return; }
        else P.favorites.push(f);
        paint(); this.savePrefs();
      }, 'pa-btn-text pa-fav-toggle');

      if (tool === 'shape') {
        const S = P.shape;
        const fill = fillRow(() => S.fill, (v) => { S.fill = v; });
        const dash = segmented([['solid', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted']], () => S.dash || 'solid', (v) => { S.dash = v; });
        const rough = segmented([['0', 'Clean'], ['1', 'Sketchy'], ['2', 'Rough']], () => String(S.rough || 0), (v) => { S.rough = Number(v); });
        const edges = segmented([['sharp', 'Sharp'], ['round', 'Round']], () => S.edges || 'sharp', (v) => { S.edges = v; });
        const edgesLabel = L('Edges'), fillLabel = L('Fill');
        const op = slider(() => S.opacity, (v) => { S.opacity = v; }, () => this.savePrefs());
        extras.push(fill, dash, rough, op, { el: null, paint: () => {
          edges.paint();
          const cornered = CORNERED.includes(S.kind), fillable = FILLABLE.includes(S.kind);
          show(edges.el, cornered); show(edgesLabel, cornered);
          show(fill.el, fillable); show(fillLabel, fillable);
        } });
        const first = L('Shape');
        first.classList.add('is-first');
        panel.replaceChildren(first, extras[0].el, L('Color'), grid, fillLabel, fill.el, L('Size'), sizeRow,
          L('Line'), dash.el, L('Sloppiness'), rough.el, edgesLabel, edges.el, L('Opacity'), op.el);
      } else {
        const first = L('Color');
        first.classList.add('is-first');
        panel.replaceChildren(first, grid, L('Size'), sizeRow, ...extras.map(x => x.el).filter(Boolean), favBtn);
      }

      return [
        () => {
          const cur = current(); if (!['pen', 'hl', 'shape'].includes(P.tool)) return;
          let matched = false;
          for (const b of swatches) { const yes = b.dataset.color === cur.color; matched = matched || yes; on(b.paDot, yes); }
          on(wheelDot, !matched);
          if (picker.ownerDocument.activeElement !== picker) picker.value = cur.color;
          const dashed = P.tool !== 'hl' && cur.dash && cur.dash !== 'solid' && !(P.tool === 'pen' && P.pen.type === 'fountain');
          for (const b of sizes) {
            b.paLine.setAttribute('stroke', cur.color);
            b.paLine.setAttribute('stroke-dasharray', dashed ? dashArray(cur.dash, Number(b.paLine.getAttribute('stroke-width'))) : '');
            active(b, Number(b.dataset.size) === cur.size);
          }
          const isFav = P.favorites.some(f => favMatches(f));
          favLabel.textContent = isFav ? 'Remove from favorites' : 'Save as favorite';
          on(favBtn, isFav);
        },
        ...extras.map(x => x.paint),
      ];
    };

    // Eraser card: whole-stroke vs partial, what it erases, size, and auto switch-back.
    const buildEraserPanel = () => {
      const E = P.eraser;
      const mode = segmented([['stroke', 'Whole stroke'], ['partial', 'Partial']], () => E.mode, (v) => { E.mode = v; });
      const only = segmented([['all', 'All ink'], ['pen', 'Pen'], ['hl', 'Highlighter']], () => E.only || 'all', (v) => { E.only = v; });
      const back = toggle('Switch back after erasing', () => E.autoReturn, (v) => { E.autoReturn = v; });
      const hint = h('div', 'pa-hint');
      const sizes = SIZES.eraser.map((sz, i) => {
        const circle = h('span', 'pa-eraser-dot');
        cssVars(circle, { '--pa-d': (8 + i * 6) + 'px' });
        const b = button(`Eraser size ${i + 1} of ${SIZES.eraser.length}`, circle, () => setSize(sz), 'pa-btn-wide');
        b.dataset.size = String(sz);
        b.paCircle = circle;
        return b;
      });
      const first = L('Eraser');
      first.classList.add('is-first');
      panel.replaceChildren(first, mode.el, hint, L('Erases'), only.el, L('Size'), h('div', 'pa-sizes', ...sizes), back.el);
      return [mode.paint, only.paint, back.paint, () => {
        hint.textContent = E.mode === 'partial' ? 'Erases only the part of a stroke you touch.' : 'Removes any stroke you touch.';
        for (const b of sizes) {
          active(b, Number(b.dataset.size) === E.size);
          b.paCircle.classList.toggle('is-partial', E.mode === 'partial');
        }
      }];
    };

    const pickTool = (tool) => {
      if (st.hand) { st.hand = false; if (P.tool === tool) { paint(); return; } }   // back to drawing
      if (P.tool === tool) { togglePanel(); return; }   // tap the active tool again = its options
      P.tool = tool;
      if (tool === 'pen' || tool === 'hl' || tool === 'shape') P.lastDrawTool = tool;
      if (tool !== 'lasso') this.clearSelection();
      if (panelOpen()) { closePanel(); togglePanel(); }   // keep the card open, for the new tool
      paint();
      this.savePrefs();
    };

    paint();
    return { el: bar, extras: [selBox, selMenu, selCard], closePanel, paint, place, showSelection, destroy: () => ro.disconnect() };
  }
}

module.exports = PenInk;
module.exports.default = PenInk;
})();

/* nosourcemap */