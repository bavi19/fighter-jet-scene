import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import FighterJetScene from './components/fighter-jet-scene.js';
import FighterJetEject from './components/fighter-jet-eject.js';
import { sound } from './lib/sound.js';

const h = React.createElement;

// The published variant's live values, exactly as the original Forge scene ships them.
// (Source: the fragment's public share data — speed 92, seed 7, grey jet #545969, …)
const LIVE_VALUES = {
  showHint: true, touchControls: 'auto',
  speed: 92, boost: 1.8, agility: 1.25, bank: 52, altitude: 110, ceiling: 300,
  clearance: 7, wingmen: 0, followPointer: true, invertY: true, stunts: true,
  jetScale: 0.6, spread: 1, pixelSize: 3, intro: false,
  view: 'top', model: 'falcon', transition: 1.4, cameraFollow: 0.6, chaseDistance: 2.6,
  chaseAngle: 12, chaseSize: 0.19,
  timeOfDay: 'day', land: 0.33, clouds: 0.45, seed: 7, shadow: true,
  flameStyle: 'realistic', afterburner: 1, trails: true,
  bodyColor: '#545969', accentColor: '#f0580e', canopyColor: '#1e8ca0',
  // Mission mode (the fighterv2 remix): combat, crashes and the rescue, at its
  // published defaults. Free-fly ignores these; mission mode ignores `model`'s
  // specs only where a plane's own spec overrides them — the plane picker works
  // in both modes. `sound` is not in here: the shared mute drives both sound
  // systems (the free-fly synth and the mission mode's recordings).
  crash: true, weapons: true, ammo: 300, missiles: 6, reload: 5,
  enemies: 3, foeFire: true, slowMo: 1.3, ejectZoom: 0.8,
  bloom: 0.5, vivid: 0.25, vignette: 0.3, grain: 0, flash: 0.6, shake: 1, wake: 1, cloudCut: true,
  volume: 0.6, radio: true,
};

// Graphics quality: the renderer's real knobs. The scene draws into a low-res
// pixel buffer that is scaled up, so pixel size IS the resolution: smaller
// pixels = a bigger buffer = a crisper picture (and more work per frame).
// Three presets, all with smooth flames. The old 6px chunky Low is gone:
// Low is now the original as published (3px), Medium is the old High (2px),
// High is the old Ultra (1px, the screen's native resolution). (Very High
// at 1.5px was removed earlier: it looked almost the same as High.)
const GRAPHICS_PRESETS = {
  low: { label: 'Low', pixelSize: 3, flameStyle: 'realistic', desc: 'The original as published' },
  medium: { label: 'Medium', pixelSize: 2, flameStyle: 'realistic', desc: 'Crisp, needs a faster device' },
  high: { label: 'High', pixelSize: 1, flameStyle: 'realistic', desc: 'Native resolution — the sharpest possible, needs a fast desktop' },
};

// Planes: each is a different voxel model (cut from the original's slices) with its
// own default specs and livery, so each one feels different to fly.
const PLANES = {
  falcon: {
    label: 'Falcon', model: 'falcon',
    desc: 'The original — balanced, grey with orange accents.',
    spec: { speed: 92, boost: 1.8, agility: 1.25, bank: 52, altitude: 110, ceiling: 300, afterburner: 1, jetScale: 0.6, bodyColor: '#545969', accentColor: '#f0580e', canopyColor: '#1e8ca0' },
  },
  dart: {
    label: 'Dart', model: 'dart',
    desc: 'Narrow and long — fast and twitchy, climbs lower.',
    spec: { speed: 150, boost: 2.2, agility: 2.1, bank: 64, altitude: 90, ceiling: 260, afterburner: 1, jetScale: 0.55, bodyColor: '#3a3f52', accentColor: '#19b8d0', canopyColor: '#1e8ca0' },
  },
  titan: {
    label: 'Titan', model: 'titan',
    desc: 'Wide and heavy — slow to turn, but climbs the highest. The space climber.',
    spec: { speed: 68, boost: 1.5, agility: 0.75, bank: 38, altitude: 140, ceiling: 520, afterburner: 1, jetScale: 0.75, bodyColor: '#4a4438', accentColor: '#ffb020', canopyColor: '#2a6f7a' },
  },
};

// The game in front of the game: Free Fly is the original scene as it is;
// Mission Mode is the fighterv2 remix — combat, ejection and rescue on the
// same world. The choice is saved, like the control mode.
const GAME_MODES = [
  { id: 'free', label: 'Free Fly', desc: 'The original scene — just fly, no enemies, no score' },
  { id: 'mission', label: 'Mission Mode', desc: 'Fight enemy jets · eject and get rescued · kills are the score' },
];

const MODES = [
  { id: 'touch', label: 'Touch', desc: 'Drag to steer · tap to roll' },
  { id: 'gyro', label: 'Gyro', desc: 'Tilt your phone to fly' },
  { id: 'mouse', label: 'Mouse', desc: 'Move to steer · click to roll' },
  { id: 'keyboard', label: 'Keyboard', desc: 'Arrows / WASD · Shift boost' },
];

const SECTIONS = [
  { title: 'Flight', controls: [
    { prop: 'speed', label: 'Speed', min: 20, max: 220, step: 1 },
    { prop: 'boost', label: 'Thruster boost', min: 1, max: 3, step: 0.05 },
    { prop: 'agility', label: 'Turn rate', min: 0.3, max: 3, step: 0.05 },
    { prop: 'bank', label: 'Bank angle', min: 0, max: 80, step: 1 },
    { prop: 'altitude', label: 'Cruising altitude', min: 10, max: 600, step: 1 },
    { prop: 'ceiling', label: 'Ceiling', min: 60, max: 900, step: 5 },
    { prop: 'clearance', label: 'Ground clearance', min: 3, max: 40, step: 1 },
    { prop: 'wingmen', label: 'Wingmen', min: 0, max: 2, step: 1 },
  ] },
  { title: 'Sprite stack', controls: [
    { prop: 'jetScale', label: 'Jet size', min: 0.6, max: 1.6, step: 0.05 },
    { prop: 'spread', label: 'Slice spacing', min: 1, max: 7, step: 0.1 },
    { prop: 'pixelSize', label: 'Pixel size (0 = auto)', min: 0, max: 12, step: 0.5 },
  ] },
  { title: 'Combat', mission: true, controls: [
    { prop: 'ammo', label: 'Cannon rounds before a reload (0 = no limit)', min: 0, max: 1000, step: 10 },
    { prop: 'missiles', label: 'Missiles before a reload (0 = no limit)', min: 0, max: 12, step: 1 },
    { prop: 'reload', label: 'Reload time, cannon and missiles (seconds)', min: 0, max: 15, step: 0.5 },
    { prop: 'enemies', label: 'Enemy jets', min: 0, max: 5, step: 1 },
    { prop: 'slowMo', label: 'Dodge slow motion (seconds, 0 = off)', min: 0, max: 2.5, step: 0.05 },
  ] },
  { title: 'Look', mission: true, controls: [
    { prop: 'bloom', label: 'Glow (fire, sun, engines, glints)', min: 0, max: 1, step: 0.05 },
    { prop: 'vivid', label: 'Colour depth and contrast', min: 0, max: 1, step: 0.05 },
    { prop: 'vignette', label: 'Darkened corners', min: 0, max: 1, step: 0.05 },
    { prop: 'grain', label: 'Film grain', min: 0, max: 1, step: 0.05 },
  ] },
  { title: 'Camera', controls: [
    { prop: 'ejectZoom', label: 'Ejection: close-up on the pilot (0 = none)', min: 0, max: 1.5, step: 0.05, mission: true },
    { prop: 'transition', label: 'View change (seconds)', min: 0.4, max: 4, step: 0.1 },
    { prop: 'cameraFollow', label: 'Overhead: turn with the jet', min: 0, max: 1, step: 0.05 },
    { prop: 'chaseDistance', label: 'Chase: distance (jet lengths)', min: 1.4, max: 6, step: 0.1 },
    { prop: 'chaseAngle', label: 'Chase: height (degrees)', min: 4, max: 35, step: 1 },
    { prop: 'chaseSize', label: 'Chase: jet width on screen', min: 0.08, max: 0.4, step: 0.01 },
  ] },
  { title: 'World', controls: [
    { prop: 'land', label: 'Islands', min: 0.05, max: 0.75, step: 0.01 },
    { prop: 'clouds', label: 'Clouds', min: 0, max: 1, step: 0.05 },
    { prop: 'seed', label: 'World seed', min: 1, max: 999, step: 1 },
  ] },
  { title: 'Effects', controls: [
    { prop: 'afterburner', label: 'Afterburner', min: 0, max: 1, step: 0.05 },
    { prop: 'flash', label: 'Explosion: flash and sparks', min: 0, max: 1, step: 0.05, mission: true },
    { prop: 'shake', label: 'Explosion: camera shake', min: 0, max: 2, step: 0.1, mission: true },
    { prop: 'wake', label: 'Wake and spray low over the sea', min: 0, max: 2, step: 0.1, mission: true },
  ] },
];

const TOGGLES = [
  { prop: 'showHint', label: 'Show helpers (how-to-fly line)' },
  { prop: 'followPointer', label: 'Steer with pointer' },
  { prop: 'invertY', label: 'Flight-stick up/down (down climbs, up dives)' },
  { prop: 'stunts', label: 'Rolls on autopilot' },
  { prop: 'trails', label: 'Wingtip trails' },
  { prop: 'shadow', label: 'Jet shadow' },
  { prop: 'intro', label: 'Stack-up intro' },
  { prop: 'crash', label: 'Crashes (dive into the ground to eject)', mission: true },
  { prop: 'weapons', label: 'Weapons (right-click cannon, M missiles)', mission: true },
  { prop: 'foeFire', label: 'Enemies attack (guns and missiles; roll to dodge)', mission: true },
  { prop: 'cloudCut', label: 'Jets cut through clouds', mission: true },
];

const SEGMENTED = [
  { prop: 'timeOfDay', label: 'Time of day', options: ['day', 'sunset', 'night'] },
  { prop: 'flameStyle', label: 'Thruster flames', options: ['pixel', 'realistic'] },
  { prop: 'touchControls', label: 'Touch buttons', options: ['auto', 'on', 'off'] },
];

const COLOURS = [
  { prop: 'bodyColor', label: 'Body' },
  { prop: 'accentColor', label: 'Accent' },
  { prop: 'canopyColor', label: 'Canopy' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dz = (v, t = 4) => (Math.abs(v) < t ? 0 : v);

const btnStyle = {
  fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.35)',
  background: 'rgba(11,26,51,0.6)', color: 'rgba(255,255,255,0.9)', borderRadius: 4,
  padding: '10px 14px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em',
};

function App() {
  const [params, setParams] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('fighter-jet-params') || 'null');
      return saved ? { ...LIVE_VALUES, ...saved } : LIVE_VALUES;
    } catch { return LIVE_VALUES; }
  });
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('fighter-jet-mode') || 'mouse'; } catch { return 'mouse'; }
  });
  const [gameMode, setGameMode] = useState(() => {
    try { return localStorage.getItem('fighter-jet-game-mode') || 'free'; } catch { return 'free'; }
  });
  const [started, setStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('fighter-jet-sound') === 'off'; } catch { return false; }
  });
  const [gyroOn, setGyroOn] = useState(false);
  const [gyroMsg, setGyroMsg] = useState('');
  const gyroRef = useRef({ turn: 0, climb: 0, active: false });
  const calibRef = useRef(null);

  useEffect(() => { try { localStorage.setItem('fighter-jet-params', JSON.stringify(params)); } catch {} }, [params]);
  useEffect(() => { try { localStorage.setItem('fighter-jet-mode', mode); } catch {} }, [mode]);
  useEffect(() => { try { localStorage.setItem('fighter-jet-game-mode', gameMode); } catch {} }, [gameMode]);
  useEffect(() => { sound.setMuted(muted); try { localStorage.setItem('fighter-jet-sound', muted ? 'off' : 'on'); } catch {} }, [muted]);

  // Gyro: tilt the device to fly. Calibrated to wherever the device is when enabled.
  useEffect(() => {
    if (mode !== 'gyro' || !gyroOn) { gyroRef.current.active = false; return; }
    const onMove = (e) => {
      if (e.gamma == null || e.beta == null) return;
      if (!calibRef.current) calibRef.current = { gamma: e.gamma, beta: e.beta };
      gyroRef.current.turn = clamp(dz(e.gamma - calibRef.current.gamma) / 28, -1, 1);
      gyroRef.current.climb = clamp(-dz(e.beta - calibRef.current.beta) / 28, -1, 1);
      gyroRef.current.active = true;
    };
    window.addEventListener('deviceorientation', onMove);
    return () => { window.removeEventListener('deviceorientation', onMove); gyroRef.current.active = false; };
  }, [mode, gyroOn]);

  const enableGyro = async () => {
    setGyroMsg('');
    try {
      if (typeof DeviceOrientationEvent === 'undefined') { setGyroMsg('This device has no motion sensor.'); return; }
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') { setGyroMsg('Motion access was denied — pick another mode, or allow it and try again.'); return; }
      }
      calibRef.current = null;
      setGyroOn(true);
      setMode('gyro');
    } catch { setGyroMsg('Could not enable motion controls on this device.'); }
  };

  const pickMode = (id) => {
    if (id === 'gyro') { enableGyro(); return; }
    setGyroOn(false);
    setGyroMsg('');
    setMode(id);
  };

  const setParam = (prop, v) => setParams((p) => ({ ...p, [prop]: v }));

  // Which preset the current pixel size + flame style match ('' = a custom mix).
  const activeGraphics = Object.keys(GRAPHICS_PRESETS).find((k) =>
    params.pixelSize === GRAPHICS_PRESETS[k].pixelSize &&
    params.flameStyle === GRAPHICS_PRESETS[k].flameStyle) || '';
  const applyGraphics = (key) => {
    const preset = GRAPHICS_PRESETS[key];
    sound.click();
    setParams((p) => ({ ...p, pixelSize: preset.pixelSize, flameStyle: preset.flameStyle }));
  };
  // Which plane the current model + specs match ('' = a custom mix).
  const activePlane = Object.keys(PLANES).find((k) => {
    const pl = PLANES[k];
    return params.model === pl.model && Object.keys(pl.spec).every((key) => params[key] === pl.spec[key]);
  }) || '';
  const applyPlane = (key) => {
    const pl = PLANES[key];
    sound.click();
    setParams((p) => ({ ...p, model: pl.model, ...pl.spec }));
  };
  // The pixel buffer this quality draws into, at the current window size.
  const effPx = params.pixelSize > 0
    ? params.pixelSize
    : Math.min(12, Math.max(2, Math.round(Math.sqrt((window.innerWidth * window.innerHeight) / 100000))));
  const bufferText = `Pixel buffer ${Math.ceil(window.innerWidth / effPx)} × ${Math.ceil(window.innerHeight / effPx)}`;

  const gameModeButtons = GAME_MODES.map((m) =>
    h('button', {
      key: m.id, onClick: () => { setGameMode(m.id); },
      style: {
        ...btnStyle, flex: 1, minWidth: 160, textAlign: 'left', padding: '12px',
        borderColor: gameMode === m.id ? '#f0580e' : 'rgba(255,255,255,0.35)',
        background: gameMode === m.id ? 'rgba(240,88,14,0.25)' : 'rgba(11,26,51,0.6)',
      },
    },
      h('div', { style: { fontSize: 14, marginBottom: 4 } }, m.label),
      h('div', { style: { fontSize: 11, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.65)' } }, m.desc),
    ));

  const modeButtons = MODES.map((m) =>
    h('button', {
      key: m.id, onClick: () => pickMode(m.id),
      style: {
        ...btnStyle, flex: 1, minWidth: 120, textAlign: 'left', padding: '12px',
        borderColor: mode === m.id ? '#f0580e' : 'rgba(255,255,255,0.35)',
        background: mode === m.id ? 'rgba(240,88,14,0.25)' : 'rgba(11,26,51,0.6)',
      },
    },
      h('div', { style: { fontSize: 13, marginBottom: 4 } }, m.label),
      h('div', { style: { fontSize: 11, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.65)' } }, m.desc),
    ));

  const planeButtons = Object.keys(PLANES).map((k) => {
    const pl = PLANES[k];
    return h('button', {
      key: k, onClick: () => applyPlane(k),
      style: {
        ...btnStyle, flex: 1, minWidth: 100, textAlign: 'left', padding: '10px 12px',
        borderColor: activePlane === k ? '#f0580e' : 'rgba(255,255,255,0.35)',
        background: activePlane === k ? 'rgba(240,88,14,0.25)' : 'rgba(11,26,51,0.6)',
      },
    },
      h('div', { style: { fontSize: 13, marginBottom: 4 } }, pl.label),
      h('div', { style: { fontSize: 11, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.65)' } }, `Speed ${pl.spec.speed} · Turn ${pl.spec.agility} · Ceiling ${pl.spec.ceiling}`));
  });

  const sliderRow = (c) =>
    h('label', { key: c.prop, style: { display: 'block', marginBottom: 12 } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#dbeafe', marginBottom: 2 } },
        h('span', null, c.label),
        h('span', null, String(params[c.prop]))),
      h('input', {
        type: 'range', min: c.min, max: c.max, step: c.step, value: params[c.prop],
        onChange: (e) => setParam(c.prop, Number(e.target.value)), style: { width: '100%' },
      }));

  const toggleRow = (t) =>
    h('label', { key: t.prop, style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#dbeafe', marginBottom: 10, cursor: 'pointer' } },
      h('input', { type: 'checkbox', checked: !!params[t.prop], onChange: (e) => setParam(t.prop, e.target.checked) }),
      h('span', null, t.label));

  const segRow = (s) =>
    h('div', { key: s.prop, style: { marginBottom: 12 } },
      h('div', { style: { fontSize: 12, color: '#dbeafe', marginBottom: 4 } }, s.label),
      h('div', { style: { display: 'flex', gap: 6 } },
        s.options.map((o) =>
          h('button', {
            key: o, onClick: () => setParam(s.prop, o),
            style: { ...btnStyle, flex: 1, padding: '7px 4px', fontSize: 11, borderColor: params[s.prop] === o ? '#f0580e' : 'rgba(255,255,255,0.3)', background: params[s.prop] === o ? 'rgba(240,88,14,0.25)' : 'rgba(11,26,51,0.6)' },
          }, o))));

  const colourRow = (c) =>
    h('label', { key: c.prop, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#dbeafe', marginBottom: 10 } },
      h('span', null, c.label),
      h('input', { type: 'color', value: params[c.prop], onChange: (e) => setParam(c.prop, e.target.value), style: { width: 44, height: 28, border: 'none', background: 'none', cursor: 'pointer' } }));

  return h('div', { style: { position: 'relative', height: '100dvh', width: '100%', overflow: 'hidden', background: '#2468b4', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' } },
    gameMode === 'mission'
      ? h(FighterJetEject, {
        ...params,
        sound: !muted, // the mission sound is the remix's own recordings; the mute is shared
        gyroRef,
        steerWithPointer: mode !== 'gyro' && mode !== 'keyboard',
        inputKind: mode === 'gyro' ? 'gyro' : mode === 'keyboard' ? 'keyboard' : '',
      })
      : h(FighterJetScene, {
        ...params,
        gyroRef,
        steerWithPointer: mode !== 'gyro' && mode !== 'keyboard',
        inputKind: mode === 'gyro' ? 'gyro' : mode === 'keyboard' ? 'keyboard' : '',
      }),

    started && h('div', { style: gameMode === 'mission'
      ? { position: 'absolute', top: 60, left: 12, display: 'flex', gap: 8, zIndex: 30 }
      : { position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 30 } },
      h('button', { onClick: () => setStarted(false), style: btnStyle }, 'Controls'),
      h('button', { onClick: () => setShowSettings(true), style: btnStyle, 'aria-label': 'Scene settings' }, '⚙ Settings')),

    started && mode === 'gyro' && gyroOn &&
      h('button', { onClick: () => { calibRef.current = null; }, style: { ...btnStyle, position: 'absolute', top: gameMode === 'mission' ? 108 : 12, left: 12, zIndex: 30 } }, 'Calibrate'),

    !started && h('div', {
      style: {
        position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(11,26,51,0.55)', padding: 16,
      },
    },
      h('div', { style: { width: 'min(560px, 94vw)', background: 'rgba(8,20,40,0.88)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: 24, color: '#fff' } },
        h('div', { style: { fontSize: 11, letterSpacing: '0.3em', color: '#f0580e', textTransform: 'uppercase', marginBottom: 6 } }, gameMode === 'mission' ? 'Mission · Combat & rescue' : 'Free flight · Pixel art'),
        h('h1', { style: { margin: '0 0 6px', fontSize: 28, letterSpacing: '0.06em' } }, gameMode === 'mission' ? 'FIGHTER JET — MISSION' : 'FIGHTER JET SCENE'),
        h('p', { style: { margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)' } },
          gameMode === 'mission'
            ? 'The same scene, now a fight: enemy jets hunt you, the cannon and missiles answer back, and a roll at the last half-second throws a missile off in slow motion — fire one back for a triple counter. Go down and you eject, come down under the parachute, and a new jet picks you up. Kills are the score, and they reset every time you are shot down.'
            : 'The original Forge scene, rebuilt on its own code — a pixel-art fighter jet over a seeded ocean-and-islands world. No enemies, no score. Just fly.'),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Choose your game'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 } }, gameModeButtons),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'How do you want to fly?'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 } }, modeButtons),
        gyroMsg && h('p', { style: { color: '#fca5a5', fontSize: 12, margin: '0 0 8px' } }, gyroMsg),
        mode === 'gyro' && gyroOn && h('p', { style: { color: '#86efac', fontSize: 12, margin: '0 0 8px' } }, 'Motion controls on — hold your phone level, then tilt to steer. Tap Calibrate any time.'),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Pick your plane'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 } }, planeButtons),
        h('p', { style: { margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 } },
          activePlane ? PLANES[activePlane].desc : 'Each plane flies differently — pick one, or tune the Flight sliders later.'),
        h('div', { style: { display: 'flex', gap: 8, marginTop: 14 } },
          h('button', {
            onClick: () => { sound.unlock(); sound.takeoff(); setStarted(true); },
            style: { ...btnStyle, flex: 1, background: '#d9382e', borderColor: '#d9382e', fontSize: 14, padding: '13px' },
          }, 'Take off ✈'),
          h('button', { onClick: () => setShowSettings(true), style: btnStyle }, 'Scene settings')),
        h('p', { style: { margin: '14px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 } },
          gameMode === 'mission'
            ? 'V cycles Top → Chase → Cockpit · Click to roll · Hold for the thrusters · Right-click fires the cannon · Space fires a missile · Dive into the ground to eject · T runs the tutorial'
            : 'V cycles Top → Chase → Cockpit · Click to roll · Hold for the thrusters'))),

    showSettings && h('div', {
      style: { position: 'absolute', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)' },
      onClick: () => setShowSettings(false),
    },
      h('div', {
        style: {
          width: 'min(380px, 94vw)', height: '100%', overflowY: 'auto', background: 'rgba(8,20,40,0.96)',
          color: '#fff', padding: '18px 18px 28px', borderLeft: '1px solid rgba(255,255,255,0.2)',
        },
        onClick: (e) => e.stopPropagation(),
      },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
          h('h2', { style: { margin: 0, fontSize: 16, letterSpacing: '0.08em' } }, 'SCENE SETTINGS'),
          h('button', { onClick: () => setShowSettings(false), style: { ...btnStyle, padding: '6px 10px' } }, '✕')),
        h('p', { style: { fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 } }, 'The original scene’s parameters — tune them live.'),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Graphics'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 } },
          Object.keys(GRAPHICS_PRESETS).map((k) =>
            h('button', {
              key: k, onClick: () => applyGraphics(k),
              style: {
                ...btnStyle, flex: 1, minWidth: 80, padding: '9px 4px', fontSize: 12,
                borderColor: activeGraphics === k ? '#f0580e' : 'rgba(255,255,255,0.3)',
                background: activeGraphics === k ? 'rgba(240,88,14,0.25)' : 'rgba(11,26,51,0.6)',
              },
            }, GRAPHICS_PRESETS[k].label))),
        h('p', { style: { fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 } },
          activeGraphics
            ? `${GRAPHICS_PRESETS[activeGraphics].desc} · ${bufferText}`
            : `Custom mix — pick a preset, or tune Pixel size and flames below · ${bufferText}`),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Sound'),
        h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#dbeafe', marginBottom: gameMode === 'mission' ? 10 : 16, cursor: 'pointer' } },
          h('input', { type: 'checkbox', checked: !muted, onChange: (e) => { setMuted(!e.target.checked); if (e.target.checked) sound.unlock(); } }),
          h('span', null, gameMode === 'mission'
            ? 'Sound — the mission mode’s recorded engine, guns, explosions and radio chatter'
            : 'Sound effects — engine hum, wind and thrusters (synthesized, no downloads)')),
        gameMode === 'mission' && sliderRow({ prop: 'volume', label: 'Volume', min: 0, max: 1, step: 0.05 }),
        gameMode === 'mission' && toggleRow({ prop: 'radio', label: 'Radio chatter during a rescue', mission: true }),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Plane'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 } }, planeButtons),
        h('p', { style: { fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px', lineHeight: 1.5 } },
          activePlane ? PLANES[activePlane].desc : 'Custom mix — pick a plane, or tune the Flight sliders below.'),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Controls'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 } }, modeButtons),
        gyroMsg && h('p', { style: { color: '#fca5a5', fontSize: 12, margin: '0 0 8px' } }, gyroMsg),
        SECTIONS.filter((s) => !s.mission || gameMode === 'mission').map((s) =>
          h('div', { key: s.title, style: { marginBottom: 16 } },
            h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, s.title),
            s.controls.filter((c) => !c.mission || gameMode === 'mission').map(sliderRow))),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Switches'),
        TOGGLES.filter((t) => !t.mission || gameMode === 'mission').map(toggleRow),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginTop: 14 } }, 'Options'),
        SEGMENTED.map(segRow),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8, marginTop: 14 } }, 'Jet colours'),
        COLOURS.map(colourRow),
        h('div', { style: { display: 'flex', gap: 8, marginTop: 18 } },
          h('button', { onClick: () => { setParams(LIVE_VALUES); setMode('mouse'); }, style: { ...btnStyle, flex: 1 } }, 'Reset defaults'),
          h('button', { onClick: () => setShowSettings(false), style: { ...btnStyle, flex: 1, background: '#d9382e', borderColor: '#d9382e' } }, 'Done')))),
  );
}

createRoot(document.getElementById('root')).render(h(App));
