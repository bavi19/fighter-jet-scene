/* ============================================================================
   Fighter Jet Scene — free-flight recreation
   One component, mirroring the original Forge project:
   "Fighter jet scene" — a pixel-art jet in continuous free flight over a
   procedurally seeded ocean-and-islands world.
   No build step, no dependencies: plain Canvas 2D + DOM.
   Controls: Touch (drag) / Gyro (tilt) / Mouse / Keyboard (GTA-style).
   Views: Top / Chase / Cockpit — Space cycles them.
   ========================================================================== */
'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

/* ---------------- Defaults (match the Forge scene's parameters) ------------ */
const DEFAULTS = {
  speed: 92, turnRate: 1.25, bank: 52, cruiseAlt: 110, ceiling: 300, floor: 7,
  jetSize: 0.6, pixel: 3, islands: 0.33, clouds: 0.45, seed: 7,
  timeOfDay: 'day', body: '#d9382e', accent: '#f0580e', canopy: '#9aa5b1',
  trails: true, shadow: true, helper: true, autoroll: true, touchButtons: true,
  invertPitch: false,
};
let P = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('fjs-settings') || 'null');
  if (saved) P = { ...DEFAULTS, ...saved };
} catch (e) { /* ignore corrupt saved settings */ }
function saveSettings() { try { localStorage.setItem('fjs-settings', JSON.stringify(P)); } catch (e) {} }

/* ---------------- Palettes: improved, cleaner graphics -------------------- */
const PALETTES = {
  day: {
    skyTop: '#6fb2e6', skyBot: '#d8ecf9', oceanTop: '#3f8fd2', oceanBot: '#1c6cb0',
    deep: '#175a94', cloud: '#ffffff', cloudShadow: 'rgba(18,58,104,0.20)',
    sand: '#ecd9a0', grass: '#5cb85f', grass2: '#3f9a4e', forest: '#2c7a3e',
    rock: '#8d97a3', wave: 'rgba(255,255,255,0.20)', stars: 0,
  },
  sunset: {
    skyTop: '#ff8f4d', skyBot: '#ffd9a3', oceanTop: '#c06a52', oceanBot: '#5e3a63',
    deep: '#4a2c50', cloud: '#ffe9d6', cloudShadow: 'rgba(60,20,50,0.28)',
    sand: '#eec493', grass: '#8aa050', grass2: '#6d8a42', forest: '#4f7034',
    rock: '#9a7f72', wave: 'rgba(255,220,180,0.25)', stars: 0,
  },
  night: {
    skyTop: '#070d1f', skyBot: '#16294d', oceanTop: '#16385e', oceanBot: '#0b1f3a',
    deep: '#081728', cloud: '#93a9c9', cloudShadow: 'rgba(0,0,0,0.40)',
    sand: '#8a7f63', grass: '#2c5a3a', grass2: '#234a30', forest: '#1c4527',
    rock: '#5a6572', wave: 'rgba(160,200,255,0.12)', stars: 1,
  },
};
const pal = () => PALETTES[P.timeOfDay] || PALETTES.day;

/* ---------------- Seeded world --------------------------------------------- */
const CELL = 320;
function hash2(cx, cy, salt) {
  let h = (P.seed | 0) ^ Math.imul(cx | 0, 374761393) ^ Math.imul(cy | 0, 668265263) ^ Math.imul(salt | 0, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const islandCache = new Map();
const cloudCache = new Map();
function clearWorldCache() { islandCache.clear(); cloudCache.clear(); }

function islandFor(cx, cy) {
  const key = cx + ',' + cy;
  if (islandCache.has(key)) return islandCache.get(key);
  let isl = null;
  if (hash2(cx, cy, 11) < P.islands) {
    const r = hash2(cx, cy, 12);
    const radius = 46 + r * 78;
    const radii = [];
    for (let i = 0; i < 14; i++) radii.push(0.78 + hash2(cx, cy, 20 + i) * 0.45);
    const trees = [];
    const nTrees = 6 + Math.floor(hash2(cx, cy, 40) * 14);
    for (let i = 0; i < nTrees; i++) {
      const a = hash2(cx, cy, 50 + i) * TAU;
      const d = hash2(cx, cy, 60 + i) * 0.62;
      trees.push({ dx: Math.cos(a) * d * radius, dy: Math.sin(a) * d * radius, r: 5 + hash2(cx, cy, 70 + i) * 7 });
    }
    const rocks = [];
    const nRocks = Math.floor(hash2(cx, cy, 80) * 4);
    for (let i = 0; i < nRocks; i++) {
      const a = hash2(cx, cy, 90 + i) * TAU;
      const d = 0.55 + hash2(cx, cy, 100 + i) * 0.3;
      rocks.push({ dx: Math.cos(a) * d * radius, dy: Math.sin(a) * d * radius, r: 6 + hash2(cx, cy, 110 + i) * 8 });
    }
    isl = {
      x: cx * CELL + (hash2(cx, cy, 13) - 0.5) * 170,
      y: cy * CELL + (hash2(cx, cy, 14) - 0.5) * 170,
      radius, radii, trees, rocks,
    };
  }
  islandCache.set(key, isl);
  return isl;
}

function cloudFor(cx, cy) {
  const key = cx + ',' + cy;
  if (cloudCache.has(key)) return cloudCache.get(key);
  let cl = null;
  if (hash2(cx, cy, 21) < P.clouds) {
    const puffs = [];
    const n = 4 + Math.floor(hash2(cx, cy, 22) * 3);
    for (let i = 0; i < n; i++) {
      puffs.push({
        dx: (hash2(cx, cy, 30 + i) - 0.5) * 110,
        dy: (hash2(cx, cy, 40 + i) - 0.5) * 44,
        r: 16 + hash2(cx, cy, 50 + i) * 26,
      });
    }
    cl = {
      x: cx * CELL + (hash2(cx, cy, 23) - 0.5) * 220,
      y: cy * CELL + (hash2(cx, cy, 24) - 0.5) * 220,
      drift: hash2(cx, cy, 25) * 6 + 2, puffs,
    };
  }
  cloudCache.set(key, cl);
  return cl;
}

/* ---------------- Flight state ---------------------------------------------- */
const jet = {
  x: 0, y: 0, heading: 0, alt: P.cruiseAlt, bank: 0, pitch: 0,
  rollAnim: 0, dist: 0, time: 0, speedNow: P.speed,
};
let view = 'top';            // 'top' | 'chase' | 'cockpit'
let viewFade = 0;            // brief fade on view change
let state = 'menu';          // 'menu' | 'flying' | 'paused'
let thrust = false;
let steerInput = 0;          // -1 (left) .. 1 (right)
let pitchInput = 0;          // >0 climb, <0 dive
let rollQueued = false;
const trails = [];           // {x, y, age} wingtip trail points (world space)
let lastTrail = 0;

/* ---------------- Jet pixel art (red plane, after the reference image) ----- */
/* 21 wide x 32 tall. B body, D dark shade, C canopy, A accent, W white. */
const JET_MAP = [
  '..........B..........',
  '.........BBB.........',
  '.........BBB.........',
  '.........BBB.........',
  '........BBBBB........',
  '........BBBBB........',
  '........BCCCB........',
  '........BCCCB........',
  '........BCCCB........',
  '........BBBBB........',
  '.......BBBBBBB.......',
  '.....BBBBBBBBBBB.....',
  '...BBBBBBBBBBBBBBB...',
  'BBBBBBBBBBBBBBBBBBBBB',
  'BBBDDBBBBBBBBBBDDBBBB',
  'BBBBBBBBBBBBBBBBBBBBB',
  '.BBBBBBBBBBBBBBBBBBB.',
  '..BBBBBBBBBBBBBBBBB..',
  '.........BBB.........',
  '.........BBB.........',
  '.........BAB.........',
  '.........BAB.........',
  '.........BBB.........',
  '.........BBB.........',
  '........BBBBB........',
  '......BBBBBBBBB......',
  '......BBDBBBDBB......',
  '........BBBBB........',
  '.........BBB.........',
  '.........BBB.........',
  '.........BBB.........',
  '..........B..........',
];
const JET_ROWS = JET_MAP.length, JET_COLS = JET_MAP[0].length;
const JET_COLORS = {
  B: () => P.body, D: () => shade(P.body, -0.35), C: () => P.canopy,
  A: () => P.accent, W: () => '#ffffff',
};
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* Draw the top-down pixel jet centred at (0,0), pointing up (-y).
   len = on-screen length in px. roll = visual roll radians. */
function drawJetTop(c, len, roll, flame, time) {
  const px = len / JET_ROWS;
  const w = JET_COLS * px;
  c.save();
  c.rotate(roll);
  // Crisp pixel grid: snap to whole pixels where possible.
  const x0 = -w / 2, y0 = -len / 2;
  // Side extrusion for a stacked-slice 3D feel (original technique, cleaner).
  c.save();
  c.translate(Math.sin(roll) * px * 1.2 + px * 0.6, px * 1.4);
  c.globalAlpha = 0.28;
  drawJetPixels(c, x0, y0, px, () => '#101826');
  c.restore();
  drawJetPixels(c, x0, y0, px, null);
  // Canopy glint.
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fillRect(x0 + 9 * px, y0 + 6 * px, px * 1.6, px * 1.2);
  // Afterburner flame behind the tail (bottom of the sprite).
  if (flame > 0.05) {
    const fl = len * 0.34 * flame * (0.85 + 0.3 * Math.sin(time * 34) * Math.random());
    const fx = 0, fy = len / 2;
    const grad = c.createLinearGradient(0, fy, 0, fy + fl);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.4, '#ffb347');
    grad.addColorStop(1, 'rgba(240,88,14,0)');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(fx - px * 1.6, fy);
    c.lineTo(fx, fy + fl);
    c.lineTo(fx + px * 1.6, fy);
    c.closePath();
    c.fill();
  }
  c.restore();
}
function drawJetPixels(c, x0, y0, px, colorOverride) {
  for (let r = 0; r < JET_ROWS; r++) {
    const row = JET_MAP[r];
    for (let col = 0; col < JET_COLS; col++) {
      const ch = row[col];
      if (ch === '.') continue;
      c.fillStyle = colorOverride ? colorOverride() : JET_COLORS[ch]();
      c.fillRect(x0 + col * px, y0 + r * px, px + 0.5, px + 0.5);
    }
  }
}

/* ---------------- World drawing (top view, world space) -------------------- */
function drawIsland(c, isl) {
  const p = pal();
  const path = (scale) => {
    c.beginPath();
    for (let i = 0; i <= isl.radii.length; i++) {
      const idx = i % isl.radii.length;
      const a = (idx / isl.radii.length) * TAU;
      const r = isl.radius * isl.radii[idx] * scale;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  };
  c.save();
  c.translate(isl.x, isl.y);
  path(1.14); c.fillStyle = p.sand; c.fill();
  path(1.0); c.fillStyle = p.grass; c.fill();
  path(0.72); c.fillStyle = p.grass2; c.fill();
  for (const t of isl.trees) {
    c.fillStyle = p.forest;
    c.beginPath(); c.arc(t.dx, t.dy, t.r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.arc(t.dx - t.r * 0.25, t.dy - t.r * 0.25, t.r * 0.45, 0, TAU); c.fill();
  }
  for (const rk of isl.rocks) {
    c.fillStyle = p.rock;
    c.beginPath(); c.arc(rk.dx, rk.dy, rk.r, 0, TAU); c.fill();
  }
  c.restore();
}
function drawCloud(c, cl, time) {
  const p = pal();
  const driftX = ((time * cl.drift) % CELL + CELL) % CELL - CELL / 2;
  c.save();
  c.translate(cl.x + driftX, cl.y);
  // Soft shadow on the ocean, offset down-sun.
  c.fillStyle = p.cloudShadow;
  for (const pf of cl.puffs) {
    c.beginPath(); c.ellipse(pf.dx + 26, pf.dy + 20, pf.r, pf.r * 0.62, 0, 0, TAU); c.fill();
  }
  c.fillStyle = p.cloud;
  for (const pf of cl.puffs) {
    c.beginPath(); c.ellipse(pf.dx, pf.dy, pf.r, pf.r * 0.62, 0, 0, TAU); c.fill();
  }
  c.restore();
}
function drawOceanSpeckles(c, cx, cy, range) {
  const p = pal();
  c.fillStyle = p.wave;
  for (let gx = cx - range; gx <= cx + range; gx++) {
    for (let gy = cy - range; gy <= cy + range; gy++) {
      for (let i = 0; i < 4; i++) {
        const sx = gx * CELL + hash2(gx, gy, 200 + i) * CELL;
        const sy = gy * CELL + hash2(gx, gy, 210 + i) * CELL;
        c.fillRect(sx, sy, 7, 2.5);
      }
    }
  }
}

/* ---------------- Views ------------------------------------------------------ */
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

function oceanGradient(c, x0, y0, x1, y1) {
  const p = pal();
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, p.oceanTop); g.addColorStop(1, p.oceanBot);
  return g;
}

function drawTopView(c, time) {
  const p = pal();
  c.fillStyle = oceanGradient(c, 0, 0, 0, H);
  c.fillRect(0, 0, W, H);
  const scale = Math.min(W, H) / 460 * (P.jetSize / 0.6) * 1.9;
  const range = Math.ceil((Math.hypot(W, H) / 2) / (CELL * scale)) + 1;
  const ccx = Math.floor(jet.x / CELL), ccy = Math.floor(jet.y / CELL);

  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-jet.heading);
  c.scale(scale, scale);
  c.translate(-jet.x, -jet.y);
  drawOceanSpeckles(c, ccx, ccy, range);
  // Islands below clouds, clouds above islands.
  for (let gx = ccx - range; gx <= ccx + range; gx++)
    for (let gy = ccy - range; gy <= ccy + range; gy++) {
      const isl = islandFor(gx, gy);
      if (isl) drawIsland(c, isl);
    }
  // Jet shadow on the ocean (offset by sun, fades + shrinks with altitude).
  if (P.shadow) {
    const altF = clamp(jet.alt / P.ceiling, 0, 1);
    c.save();
    c.translate(jet.x + 14 + altF * 26, jet.y + 10 + altF * 22);
    c.rotate(jet.heading);
    c.globalAlpha = 0.30 * (1 - altF * 0.65);
    c.fillStyle = '#06203a';
    c.beginPath(); c.ellipse(0, 0, 46 * (1 - altF * 0.3), 14 * (1 - altF * 0.3), 0, 0, TAU); c.fill();
    c.restore();
  }
  // Wingtip trails (fading world-space polylines, both wingtips).
  if (P.trails && trails.length > 1) {
    c.save();
    c.lineCap = 'round';
    c.lineWidth = 2.2;
    const drawTrail = (ox, oy) => {
      for (let i = 1; i < trails.length; i++) {
        const a = trails[i], b = trails[i - 1];
        c.strokeStyle = `rgba(255,255,255,${(0.55 * (1 - a.age / 1.6)).toFixed(3)})`;
        c.beginPath(); c.moveTo(a.x + ox, a.y + oy); c.lineTo(b.x + ox, b.y + oy); c.stroke();
      }
    };
    drawTrail(0, 0);
    drawTrail(Math.cos(jet.heading) * 76, Math.sin(jet.heading) * 76);
    c.restore();
  }
  for (let gx = ccx - range; gx <= ccx + range; gx++)
    for (let gy = ccy - range; gy <= ccy + range; gy++) {
      const cl = cloudFor(gx, gy);
      if (cl) drawCloud(c, cl, time);
    }
  c.restore();

  // How-to-fly helper line ahead of the jet.
  if (P.helper) {
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(jet.bank * 0.12);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 2;
    c.setLineDash([10, 12]);
    c.beginPath(); c.moveTo(0, -70); c.lineTo(0, -Math.min(H * 0.32, 260)); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.moveTo(0, -Math.min(H * 0.32, 260) - 12); c.lineTo(-7, -Math.min(H * 0.32, 260)); c.lineTo(7, -Math.min(H * 0.32, 260)); c.closePath(); c.fill();
    c.restore();
  }

  // The jet itself, centred, banked, with a barrel-roll spin when rolling.
  const jetLen = Math.min(W, H) * 0.24 * (P.jetSize / 0.6) + 46;
  const rollVis = jet.bank * Math.PI / 180 * 0.9 + (jet.rollAnim > 0 ? (1 - jet.rollAnim) * TAU : 0);
  const flame = thrust ? 1 : 0.45;
  drawJetTop(c, jetLen, rollVis, flame, time);

  // Boost speed streaks (nod to the reference image's white streaks).
  if (thrust) {
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const sx = hash2(i, Math.floor(time * 7), 300) * W;
      const sy = (hash2(i, Math.floor(time * 7), 310) * H + time * 900) % H;
      const len = 50 + hash2(i, 3, 320) * 90;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy + len); c.stroke();
    }
    c.restore();
  }
}

function drawChaseView(c, time) {
  const p = pal();
  const horizonY = H * 0.42 + jet.pitch * H * 0.16;
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-jet.bank * 0.35 * Math.PI / 180);
  c.translate(-W / 2, -H / 2);
  // Sky.
  const sky = c.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, p.skyTop); sky.addColorStop(1, p.skyBot);
  c.fillStyle = sky; c.fillRect(-40, -40, W + 80, horizonY + 40);
  if (p.stars) {
    c.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) c.fillRect(hash2(i, 7, 400) * W, hash2(i, 8, 410) * horizonY * 0.9, 2, 2);
  }
  // Ocean below the horizon.
  c.fillStyle = oceanGradient(c, 0, horizonY, 0, H);
  c.fillRect(-40, horizonY, W + 80, H - horizonY + 40);
  c.fillStyle = p.wave;
  for (let i = 0; i < 14; i++) {
    const wy = horizonY + 14 + ((i * 53 + time * 60) % (H - horizonY));
    c.fillRect(0, wy, W, 2);
  }
  // Islands ahead, projected with simple perspective.
  const fx = Math.sin(jet.heading), fy = -Math.cos(jet.heading);
  const rx = Math.cos(jet.heading), ry = Math.sin(jet.heading);
  const ccx = Math.floor(jet.x / CELL), ccy = Math.floor(jet.y / CELL);
  const seen = [];
  for (let gx = ccx - 4; gx <= ccx + 4; gx++)
    for (let gy = ccy - 4; gy <= ccy + 4; gy++) {
      const isl = islandFor(gx, gy);
      if (!isl) continue;
      const dx = isl.x - jet.x, dy = isl.y - jet.y;
      const fwd = dx * fx + dy * fy, lat = dx * rx + dy * ry;
      if (fwd > 120 && fwd < 4200) seen.push({ isl, fwd, lat });
    }
  seen.sort((a, b) => b.fwd - a.fwd);
  for (const s of seen) {
    const k = 620 / s.fwd;
    const sx = W / 2 + s.lat * k * 0.9;
    const sy = horizonY + (H - horizonY) * (1 - 260 / s.fwd) * 0.92;
    const r = s.isl.radius * k * 0.55;
    if (r < 2) continue;
    c.fillStyle = p.sand;
    c.beginPath(); c.ellipse(sx, sy, r * 1.12, r * 0.42, 0, 0, TAU); c.fill();
    c.fillStyle = p.grass;
    c.beginPath(); c.ellipse(sx, sy, r, r * 0.36, 0, 0, TAU); c.fill();
    c.fillStyle = p.forest;
    c.beginPath(); c.ellipse(sx - r * 0.2, sy - r * 0.08, r * 0.3, r * 0.14, 0, 0, TAU); c.fill();
  }
  // Clouds as billboards.
  for (let gx = ccx - 3; gx <= ccx + 3; gx++)
    for (let gy = ccy - 3; gy <= ccy + 3; gy++) {
      const cl = cloudFor(gx, gy);
      if (!cl) continue;
      const dx = cl.x - jet.x, dy = cl.y - jet.y;
      const fwd = dx * fx + dy * fy, lat = dx * rx + dy * ry;
      if (fwd < 200 || fwd > 3600) continue;
      const k = 620 / fwd;
      const sx = W / 2 + lat * k;
      const sy = horizonY - 60 * k - (jet.alt - 110) * 0.12;
      c.fillStyle = p.cloud;
      c.beginPath(); c.ellipse(sx, sy, 70 * k, 20 * k, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(sx + 30 * k, sy + 6 * k, 46 * k, 15 * k, 0, 0, TAU); c.fill();
    }
  c.restore();

  // Rear view of the jet, centred low, banked.
  const jw = Math.min(W, H) * 0.34 * (P.jetSize / 0.6) + 40;
  const jx = W / 2, jy = H * 0.60;
  c.save();
  c.translate(jx, jy);
  c.rotate(jet.bank * Math.PI / 180 * 0.55 + (jet.rollAnim > 0 ? (1 - jet.rollAnim) * TAU : 0));
  // Twin afterburner flames.
  const fl = (thrust ? 1 : 0.45) * jw * 0.5 * (0.9 + 0.2 * Math.sin(time * 30));
  const grad = c.createLinearGradient(0, 0, 0, fl);
  grad.addColorStop(0, '#fff3b0'); grad.addColorStop(0.45, '#ffb347'); grad.addColorStop(1, 'rgba(240,88,14,0)');
  c.fillStyle = grad;
  for (const ox of [-jw * 0.09, jw * 0.09]) {
    c.beginPath();
    c.moveTo(ox - jw * 0.045, jw * 0.06);
    c.lineTo(ox, jw * 0.06 + fl);
    c.lineTo(ox + jw * 0.045, jw * 0.06);
    c.closePath(); c.fill();
  }
  // Wings, fuselage, tail — rear view, crisp pixel-ish rects.
  c.fillStyle = shade(P.body, -0.15);
  c.fillRect(-jw / 2, -jw * 0.02, jw, jw * 0.10);            // main wing
  c.fillStyle = P.body;
  c.fillRect(-jw * 0.07, -jw * 0.34, jw * 0.14, jw * 0.62);   // fuselage
  c.fillStyle = P.canopy;
  c.beginPath(); c.ellipse(0, -jw * 0.16, jw * 0.055, jw * 0.10, 0, 0, TAU); c.fill();
  c.fillStyle = shade(P.body, -0.3);
  c.fillRect(-jw * 0.20, jw * 0.16, jw * 0.40, jw * 0.07);    // tailplane
  c.fillStyle = P.accent;
  c.fillRect(-jw * 0.07, -jw * 0.34, jw * 0.14, jw * 0.05);   // nose stripe
  // Wingtip trails streaming back.
  if (P.trails) {
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 3; c.lineCap = 'round';
    for (const ox of [-jw / 2, jw / 2]) {
      c.beginPath(); c.moveTo(ox, 0); c.lineTo(ox * 1.25, jw * 0.85); c.stroke();
    }
  }
  c.restore();
}

function drawCockpitView(c, time) {
  const p = pal();
  const horizonY = H * 0.36 + jet.pitch * H * 0.14;
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(-jet.bank * 0.5 * Math.PI / 180);
  c.translate(-W / 2, -H / 2);
  const sky = c.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, p.skyTop); sky.addColorStop(1, p.skyBot);
  c.fillStyle = sky; c.fillRect(-60, -60, W + 120, horizonY + 60);
  c.fillStyle = oceanGradient(c, 0, horizonY, 0, H);
  c.fillRect(-60, horizonY, W + 120, H - horizonY + 60);
  // Clouds drifting past.
  c.fillStyle = p.cloud;
  for (let i = 0; i < 7; i++) {
    const cxp = ((hash2(i, 3, 500) * W * 1.4 - time * (30 + i * 8)) % (W + 300) + W + 300) % (W + 300) - 150;
    const cyp = horizonY - 30 - hash2(i, 4, 510) * horizonY * 0.7;
    c.beginPath(); c.ellipse(cxp, cyp, 64, 16, 0, 0, TAU); c.fill();
  }
  c.restore();

  // Instrument panel.
  const panelY = H * 0.66;
  const pg = c.createLinearGradient(0, panelY, 0, H);
  pg.addColorStop(0, '#1a2230'); pg.addColorStop(1, '#0a0f18');
  c.fillStyle = pg;
  c.beginPath();
  c.moveTo(0, H); c.lineTo(0, panelY + 18);
  c.quadraticCurveTo(W / 2, panelY - 26, W, panelY + 18);
  c.lineTo(W, H); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 2; c.stroke();

  const cy = panelY + (H - panelY) * 0.52;
  const r = Math.min((H - panelY) * 0.36, W * 0.13);
  // Radar (left).
  const rx = W * 0.16;
  c.save();
  c.beginPath(); c.arc(rx, cy, r, 0, TAU); c.clip();
  c.fillStyle = '#04140a'; c.fillRect(rx - r, cy - r, r * 2, r * 2);
  c.strokeStyle = 'rgba(60,255,140,0.5)'; c.lineWidth = 1;
  for (const rr of [0.33, 0.66, 1]) { c.beginPath(); c.arc(rx, cy, r * rr, 0, TAU); c.stroke(); }
  // Island blips ahead.
  const fx = Math.sin(jet.heading), fy = -Math.cos(jet.heading);
  const ccx = Math.floor(jet.x / CELL), ccy = Math.floor(jet.y / CELL);
  c.fillStyle = '#3cff8c';
  for (let gx = ccx - 2; gx <= ccx + 2; gx++)
    for (let gy = ccy - 2; gy <= ccy + 2; gy++) {
      const isl = islandFor(gx, gy);
      if (!isl) continue;
      const dx = isl.x - jet.x, dy = isl.y - jet.y;
      const fwd = dx * fx + dy * fy, lat = dx * Math.cos(jet.heading) + dy * Math.sin(jet.heading);
      if (fwd < 0 || fwd > 1600) continue;
      c.beginPath(); c.arc(rx + lat / 1600 * r, cy - fwd / 1600 * r, 3, 0, TAU); c.fill();
    }
  // Sweep.
  const sa = time * 1.4;
  const sg = c.createLinearGradient(rx, cy, rx + Math.cos(sa) * r, cy + Math.sin(sa) * r);
  sg.addColorStop(0, 'rgba(60,255,140,0.5)'); sg.addColorStop(1, 'rgba(60,255,140,0)');
  c.strokeStyle = '#3cff8c'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(rx, cy); c.lineTo(rx + Math.cos(sa) * r, cy + Math.sin(sa) * r); c.stroke();
  c.restore();
  c.strokeStyle = '#2c4a3a'; c.lineWidth = 2;
  c.beginPath(); c.arc(rx, cy, r, 0, TAU); c.stroke();

  // Artificial horizon (centre).
  const ax = W / 2;
  c.save();
  c.beginPath(); c.arc(ax, cy, r, 0, TAU); c.clip();
  c.translate(ax, cy);
  c.rotate(-jet.bank * Math.PI / 180);
  c.translate(0, jet.pitch * r * 0.5);
  c.fillStyle = '#2f7fc2'; c.fillRect(-r, -r, r * 2, r);
  c.fillStyle = '#8a5a30'; c.fillRect(-r, 0, r * 2, r);
  c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke();
  c.restore();
  c.strokeStyle = '#3a4658'; c.lineWidth = 3;
  c.beginPath(); c.arc(ax, cy, r, 0, TAU); c.stroke();
  c.fillStyle = '#f5c542';
  c.beginPath(); c.moveTo(ax - 14, cy); c.lineTo(ax - 4, cy); c.lineTo(ax, cy - 5); c.lineTo(ax + 4, cy); c.lineTo(ax + 14, cy); c.stroke();
  c.fillStyle = '#fff'; c.font = `bold ${Math.max(11, r * 0.22)}px monospace`; c.textAlign = 'center';
  c.fillText('ATT', ax, cy - r - 8);

  // Right display: jet silhouette + readout (as in the original cockpit).
  const dx = W * 0.84;
  c.fillStyle = '#0d1522';
  c.beginPath();
  if (typeof c.roundRect === 'function') c.roundRect(dx - r * 1.05, cy - r, r * 2.1, r * 2, 10);
  else c.rect(dx - r * 1.05, cy - r, r * 2.1, r * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.stroke();
  c.save();
  c.translate(dx, cy - r * 0.28);
  c.scale(0.55, 0.55);
  drawJetTop(c, 46, 0, 0, time);
  c.restore();
  c.fillStyle = '#7ee2a8';
  c.font = `bold ${Math.max(13, r * 0.3)}px monospace`;
  c.fillText(String(Math.round(jet.alt * 118)), dx, cy + r * 0.62);
  c.fillStyle = '#a9bed6';
  c.font = `${Math.max(10, r * 0.18)}px monospace`;
  c.fillText(Math.round(jet.speedNow * 3.1) + ' KT', dx, cy + r * 0.88);

  // Canopy frame / vignette.
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,8,18,0.55)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(4,10,20,0.85)';
  c.fillRect(0, 0, 10, H); c.fillRect(W - 10, 0, 10, H);
}

/* ---------------- Flight update ---------------------------------------------- */
let lastAutoRoll = 0;
function update(dt, time) {
  // Menu attract mode: gentle autopilot behind the start screen.
  if (state === 'menu') {
    steerInput = Math.sin(time * 0.25) * 0.35;
    pitchInput = Math.sin(time * 0.4) * 0.15;
    thrust = false;
  }
  if (state === 'paused') return;

  // Keyboard mode reads live keys each frame.
  if (controlMode === 'keyboard' && state === 'flying') {
    steerInput = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    let kp = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    pitchInput = P.invertPitch ? -kp : kp;
    thrust = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }
  if (touchSteer !== 0) steerInput = touchSteer;

  if (rollQueued) { rollQueued = false; if (jet.rollAnim <= 0) jet.rollAnim = 1; }
  if (P.autoroll && Math.abs(steerInput) > 0.92 && jet.rollAnim <= 0 && time - lastAutoRoll > 5) {
    jet.rollAnim = 1; lastAutoRoll = time;
  }
  if (jet.rollAnim > 0) jet.rollAnim = Math.max(0, jet.rollAnim - dt / 0.7);

  const targetSpeed = P.speed * (thrust ? 1.8 : 1);
  jet.speedNow = lerp(jet.speedNow, targetSpeed, clamp(dt * 2.2, 0, 1));
  jet.bank = lerp(jet.bank, steerInput * P.bank, clamp(dt * 4, 0, 1));
  jet.pitch = lerp(jet.pitch, pitchInput, clamp(dt * 3, 0, 1));

  jet.heading += steerInput * P.turnRate * dt * (0.65 + 0.35 * (jet.speedNow / (P.speed * 1.8)));
  jet.alt = clamp(jet.alt + jet.pitch * 55 * dt, P.floor, P.ceiling);
  const fx = Math.sin(jet.heading), fy = -Math.cos(jet.heading);
  jet.x += fx * jet.speedNow * dt;
  jet.y += fy * jet.speedNow * dt;
  jet.dist += jet.speedNow * dt * 0.001;
  jet.time += dt;

  // Wingtip trail (left wingtip; the right one is drawn as an offset copy).
  if (P.trails && time - lastTrail > 0.06) {
    lastTrail = time;
    const rx = Math.cos(jet.heading), ry = Math.sin(jet.heading);
    trails.push({ x: jet.x - rx * 38, y: jet.y - ry * 38, age: 0 });
    if (trails.length > 90) trails.shift();
  }
  for (const t of trails) t.age += dt;
  while (trails.length && trails[0].age > 1.6) trails.shift();
}

/* ---------------- Controls --------------------------------------------------- */
let controlMode = 'mouse';
try {
  const m = localStorage.getItem('fjs-mode');
  if (m) controlMode = m;
  else controlMode = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
} catch (e) {}
const keys = new Set();
let touchSteer = 0;
let gyroEnabled = false, gyroNeutral = null, gyroLastEvent = 0;

const MODE_HELP = {
  touch: 'Drag anywhere to steer — drag down to climb, up to dive. Tap to roll. Hold THRUST for afterburner.',
  gyro: 'Tilt your phone to steer — tilt left/right to turn, tilt back to climb, forward to dive. Tap Enable motion first, then Calibrate while holding the phone as you will fly.',
  mouse: 'Move the mouse to steer — down climbs, up dives. Click to roll. Hold the mouse button (or Shift) for afterburner.',
  keyboard: 'GTA-style: ← → or A/D to turn, ↑ ↓ or W/S to pitch (down climbs), Shift for afterburner, Q/E to roll, Space to change view, P to pause.',
};
function setMode(mode) {
  controlMode = mode;
  try { localStorage.setItem('fjs-mode', mode); } catch (e) {}
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('selected', b.dataset.mode === mode));
  const help = $('mode-help');
  if (help) help.textContent = MODE_HELP[mode] || '';
  $('gyro-bar').classList.toggle('hidden', mode !== 'gyro');
  updateTouchUI();
  updateHint();
}
function updateTouchUI() {
  const show = controlMode === 'touch' && P.touchButtons && state === 'flying';
  $('touch-ui').classList.toggle('hidden', !show);
}
function updateHint() {
  const viewWord = view === 'top' ? 'CHASE VIEW' : view === 'chase' ? 'THE COCKPIT' : 'TOP VIEW';
  const base = {
    touch: 'DRAG TO STEER · TAP TO ROLL · HOLD THRUST FOR AFTERBURNER · ',
    gyro: 'TILT TO STEER · TAP TO ROLL · HOLD THRUST FOR AFTERBURNER · ',
    mouse: 'MOVE TO STEER · CLICK TO ROLL · HOLD TO FIRE THE THRUSTERS · ',
    keyboard: 'ARROWS / WASD TO FLY · Q/E TO ROLL · SHIFT FOR AFTERBURNER · ',
  }[controlMode] || '';
  $('hint').textContent = base + 'SPACE FOR ' + viewWord;
}
function cycleView() {
  view = view === 'top' ? 'chase' : view === 'chase' ? 'cockpit' : 'top';
  viewFade = 1;
  $('hud-view').textContent = view.toUpperCase();
  updateHint();
}
function doRoll() { rollQueued = true; }

/* Pointer (mouse + touch drag) on the canvas. */
let dragId = null, dragStart = null, dragTime = 0, mouseDownAt = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'flying') return;
  if (e.pointerType === 'touch' && controlMode === 'touch') {
    dragId = e.pointerId;
    dragStart = { x: e.clientX, y: e.clientY };
    dragTime = performance.now();
    canvas.setPointerCapture(e.pointerId);
  } else if (e.pointerType === 'mouse' && controlMode === 'mouse') {
    mouseDownAt = performance.now();
    thrust = true;
  } else if (e.pointerType === 'touch') {
    dragId = e.pointerId;
    dragStart = { x: e.clientX, y: e.clientY };
    dragTime = performance.now();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (state !== 'flying') return;
  if (e.pointerType === 'mouse' && controlMode === 'mouse') {
    steerInput = clamp((e.clientX - W / 2) / (W * 0.32), -1, 1);
    const py = clamp((e.clientY - H / 2) / (H * 0.32), -1, 1);
    pitchInput = P.invertPitch ? -py : py;
  } else if (e.pointerType === 'touch' && dragId === e.pointerId && dragStart) {
    const dx = clamp((e.clientX - dragStart.x) / 130, -1, 1);
    const dy = clamp((e.clientY - dragStart.y) / 130, -1, 1);
    steerInput = dx;
    pitchInput = P.invertPitch ? -dy : dy;
  }
});
function endPointer(e) {
  if (e.pointerType === 'mouse' && controlMode === 'mouse') {
    thrust = keys.has('ShiftLeft') || keys.has('ShiftRight') ? true : false;
    if (performance.now() - mouseDownAt < 250) doRoll();
  } else if (e.pointerType === 'touch' && dragId === e.pointerId) {
    const dtMs = performance.now() - dragTime;
    const moved = dragStart ? Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) : 999;
    if (dtMs < 250 && moved < 14) doRoll();
    dragId = null; dragStart = null;
    steerInput = 0; pitchInput = 0;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* Gyro. */
function onDeviceOrientation(e) {
  if (controlMode !== 'gyro' || !gyroEnabled) return;
  if (e.gamma == null || e.beta == null) return;
  gyroLastEvent = performance.now();
  if (!gyroNeutral) gyroNeutral = { gamma: e.gamma, beta: e.beta };
  steerInput = clamp((e.gamma - gyroNeutral.gamma) / 28, -1, 1);
  const p = clamp((e.beta - gyroNeutral.beta) / 22, -1, 1);
  pitchInput = P.invertPitch ? -p : p;
}
window.addEventListener('deviceorientation', onDeviceOrientation);
async function enableGyro() {
  const status = $('gyro-status');
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') { status.textContent = 'Motion permission denied — switch to Touch or Mouse.'; return; }
    }
    gyroEnabled = true;
    gyroNeutral = null;
    status.textContent = 'Motion on — hold the phone as you will fly, then Calibrate.';
    setTimeout(() => {
      if (performance.now() - gyroLastEvent > 1500) status.textContent = 'No motion data yet — this device/browser may not expose gyro.';
    }, 2000);
  } catch (err) {
    status.textContent = 'Motion is not available here — switch to Touch or Mouse.';
  }
}

/* Keyboard (GTA-style). */
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat && state === 'flying') cycleView();
    return;
  }
  if (e.code === 'KeyP' && !e.repeat) { togglePause(); return; }
  if ((e.code === 'KeyQ' || e.code === 'KeyE') && !e.repeat && state === 'flying') { doRoll(); return; }
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

/* Touch buttons. */
function bindHold(id, on, off) {
  const el = $(id);
  if (!el) return;
  const start = (e) => { e.preventDefault(); el.classList.add('active'); on(); };
  const stop = (e) => { e.preventDefault(); el.classList.remove('active'); off(); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
}
bindHold('touch-left', () => { touchSteer = -1; }, () => { touchSteer = 0; });
bindHold('touch-right', () => { touchSteer = 1; }, () => { touchSteer = 0; });
bindHold('touch-thrust', () => { thrust = true; }, () => { thrust = false; });
$('touch-roll').addEventListener('click', doRoll);

/* ---------------- UI wiring -------------------------------------------------- */
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function resetFlight() {
  jet.x = 0; jet.y = 0; jet.heading = 0; jet.alt = P.cruiseAlt;
  jet.bank = 0; jet.pitch = 0; jet.rollAnim = 0;
  jet.dist = 0; jet.time = 0; jet.speedNow = P.speed;
  trails.length = 0;
  steerInput = 0; pitchInput = 0; thrust = false;
}
function startFlying() {
  state = 'flying';
  show('start-screen', false); show('pause-screen', false); show('settings-screen', false);
  show('hud', true); show('hint', true);
  updateTouchUI(); updateHint();
}
function togglePause() {
  if (state === 'flying') {
    state = 'paused';
    show('pause-screen', true);
    updateTouchUI();
  } else if (state === 'paused') {
    state = 'flying';
    show('pause-screen', false);
    updateTouchUI();
  }
}
$('btn-fly').addEventListener('click', startFlying);
$('btn-resume').addEventListener('click', togglePause);
$('btn-restart').addEventListener('click', () => { resetFlight(); startFlying(); });
$('btn-quit').addEventListener('click', () => {
  state = 'menu'; resetFlight();
  show('pause-screen', false); show('hud', false); show('hint', false);
  show('start-screen', true);
  updateTouchUI();
});
$('btn-view').addEventListener('click', () => { if (state === 'flying') cycleView(); });
$('btn-pause').addEventListener('click', togglePause);
$('btn-gyro-enable').addEventListener('click', enableGyro);
$('btn-gyro-calibrate').addEventListener('click', () => {
  gyroNeutral = null;
  $('gyro-status').textContent = 'Calibrated — hold this position as neutral.';
});
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

/* Settings. */
let settingsWasFlying = false;
function openSettings() {
  settingsWasFlying = state === 'flying';
  if (settingsWasFlying) state = 'paused';
  syncSettingsUI();
  show('settings-screen', true);
}
function closeSettings() {
  show('settings-screen', false);
  if (settingsWasFlying) { state = 'flying'; settingsWasFlying = false; }
}
$('btn-settings').addEventListener('click', openSettings);
$('btn-start-settings').addEventListener('click', openSettings);
$('btn-settings-done').addEventListener('click', closeSettings);
$('btn-settings-reset').addEventListener('click', () => {
  P = { ...DEFAULTS };
  saveSettings(); clearWorldCache(); syncSettingsUI();
});
$('btn-random-seed').addEventListener('click', () => {
  P.seed = 1 + Math.floor(Math.random() * 9999);
  saveSettings(); clearWorldCache(); syncSettingsUI();
});
function bindRange(id, valId, get, set, fmt, world) {
  const el = $(id);
  el.addEventListener('input', () => {
    set(parseFloat(el.value));
    $(valId).textContent = fmt();
    saveSettings();
    if (world) clearWorldCache();
  });
  return { el, get, fmt, valId };
}
const rangeBindings = [
  bindRange('set-speed', 'val-speed', () => P.speed, (v) => { P.speed = v; }, () => String(P.speed)),
  bindRange('set-turn', 'val-turn', () => P.turnRate, (v) => { P.turnRate = v; }, () => P.turnRate.toFixed(2)),
  bindRange('set-bank', 'val-bank', () => P.bank, (v) => { P.bank = v; }, () => P.bank + '°'),
  bindRange('set-cruise', 'val-cruise', () => P.cruiseAlt, (v) => { P.cruiseAlt = v; }, () => String(P.cruiseAlt)),
  bindRange('set-ceiling', 'val-ceiling', () => P.ceiling, (v) => { P.ceiling = v; }, () => String(P.ceiling)),
  bindRange('set-islands', 'val-islands', () => P.islands, (v) => { P.islands = v; }, () => P.islands.toFixed(2), true),
  bindRange('set-clouds', 'val-clouds', () => P.clouds, (v) => { P.clouds = v; }, () => P.clouds.toFixed(2), true),
];
function syncSettingsUI() {
  for (const b of rangeBindings) { b.el.value = b.get(); $(b.valId).textContent = b.fmt(); }
  $('set-seed').value = P.seed;
  $('val-seed').textContent = '#' + P.seed;
  $('set-tod').value = P.timeOfDay;
  $('set-body').value = P.body;
  $('set-accent').value = P.accent;
  $('set-canopy').value = P.canopy;
  $('set-trails').checked = P.trails;
  $('set-shadow').checked = P.shadow;
  $('set-helper').checked = P.helper;
  $('set-autoroll').checked = P.autoroll;
  $('set-touchbtn').checked = P.touchButtons;
  $('set-invert').checked = P.invertPitch;
}
$('set-seed').addEventListener('change', () => {
  P.seed = clamp(parseInt($('set-seed').value, 10) || 7, 1, 9999);
  saveSettings(); clearWorldCache(); syncSettingsUI();
});
$('set-tod').addEventListener('change', () => { P.timeOfDay = $('set-tod').value; saveSettings(); });
$('set-body').addEventListener('input', () => { P.body = $('set-body').value; saveSettings(); });
$('set-accent').addEventListener('input', () => { P.accent = $('set-accent').value; saveSettings(); });
$('set-canopy').addEventListener('input', () => { P.canopy = $('set-canopy').value; saveSettings(); });
$('set-trails').addEventListener('change', () => { P.trails = $('set-trails').checked; saveSettings(); });
$('set-shadow').addEventListener('change', () => { P.shadow = $('set-shadow').checked; saveSettings(); });
$('set-helper').addEventListener('change', () => { P.helper = $('set-helper').checked; saveSettings(); });
$('set-autoroll').addEventListener('change', () => { P.autoroll = $('set-autoroll').checked; saveSettings(); });
$('set-touchbtn').addEventListener('change', () => { P.touchButtons = $('set-touchbtn').checked; saveSettings(); updateTouchUI(); });
$('set-invert').addEventListener('change', () => { P.invertPitch = $('set-invert').checked; saveSettings(); });

/* ---------------- HUD + main loop -------------------------------------------- */
let hudTick = 0;
function updateHUD() {
  $('hud-speed').textContent = Math.round(jet.speedNow * 3.1);
  $('hud-alt').textContent = Math.round(jet.alt * 118).toLocaleString('en-US');
  const deg = ((jet.heading * 180 / Math.PI) % 360 + 360) % 360;
  $('hud-hdg').textContent = String(Math.round(deg)).padStart(3, '0') + '°';
  $('hud-dist').textContent = jet.dist.toFixed(1);
  const s = Math.floor(jet.time);
  $('hud-time').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  $('hud-view').textContent = view.toUpperCase();
}
let lastT = performance.now();
function frame(now) {
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;
  const time = now / 1000;
  update(dt, time);
  ctx.clearRect(0, 0, W, H);
  if (view === 'top') drawTopView(ctx, time);
  else if (view === 'chase') drawChaseView(ctx, time);
  else drawCockpitView(ctx, time);
  if (viewFade > 0) {
    viewFade = Math.max(0, viewFade - dt * 2.2);
    ctx.fillStyle = `rgba(4,10,20,${(viewFade * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state === 'flying' && ++hudTick % 5 === 0) updateHUD();
  requestAnimationFrame(frame);
}

/* ---------------- Init -------------------------------------------------------- */
resize();
resetFlight();
setMode(controlMode);
syncSettingsUI();
updateHUD();
requestAnimationFrame(frame);
