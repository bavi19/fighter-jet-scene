import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import FighterJetScene from './components/fighter-jet-scene.js';

const h = React.createElement;

// The published variant's live values, exactly as the original Forge scene ships them.
// (Source: the fragment's public share data — speed 92, seed 7, grey jet #545969, …)
const LIVE_VALUES = {
  showHint: true, touchControls: 'auto',
  speed: 92, boost: 1.8, agility: 1.25, bank: 52, altitude: 110, ceiling: 300,
  clearance: 7, wingmen: 0, followPointer: true, invertY: true, stunts: true,
  jetScale: 0.6, spread: 1, pixelSize: 3, intro: false,
  view: 'top', transition: 1.4, cameraFollow: 0.6, chaseDistance: 2.6,
  chaseAngle: 12, chaseSize: 0.19,
  timeOfDay: 'day', land: 0.33, clouds: 0.45, seed: 7, shadow: true,
  flameStyle: 'realistic', afterburner: 1, trails: true,
  bodyColor: '#545969', accentColor: '#f0580e', canopyColor: '#1e8ca0',
};

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
    { prop: 'altitude', label: 'Cruising altitude', min: 10, max: 300, step: 1 },
    { prop: 'ceiling', label: 'Ceiling', min: 60, max: 600, step: 5 },
    { prop: 'clearance', label: 'Ground clearance', min: 3, max: 40, step: 1 },
    { prop: 'wingmen', label: 'Wingmen', min: 0, max: 2, step: 1 },
  ] },
  { title: 'Sprite stack', controls: [
    { prop: 'jetScale', label: 'Jet size', min: 0.6, max: 1.6, step: 0.05 },
    { prop: 'spread', label: 'Slice spacing', min: 1, max: 7, step: 0.1 },
    { prop: 'pixelSize', label: 'Pixel size (0 = auto)', min: 0, max: 12, step: 1 },
  ] },
  { title: 'Camera', controls: [
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
  const [started, setStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gyroOn, setGyroOn] = useState(false);
  const [gyroMsg, setGyroMsg] = useState('');
  const gyroRef = useRef({ turn: 0, climb: 0, active: false });
  const calibRef = useRef(null);

  useEffect(() => { try { localStorage.setItem('fighter-jet-params', JSON.stringify(params)); } catch {} }, [params]);
  useEffect(() => { try { localStorage.setItem('fighter-jet-mode', mode); } catch {} }, [mode]);

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
    h(FighterJetScene, {
      ...params,
      gyroRef,
      steerWithPointer: mode !== 'gyro' && mode !== 'keyboard',
      inputKind: mode === 'gyro' ? 'gyro' : mode === 'keyboard' ? 'keyboard' : '',
    }),

    started && h('div', { style: { position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 30 } },
      h('button', { onClick: () => setStarted(false), style: btnStyle }, 'Controls'),
      h('button', { onClick: () => setShowSettings(true), style: btnStyle, 'aria-label': 'Scene settings' }, '⚙ Settings')),

    started && mode === 'gyro' && gyroOn &&
      h('button', { onClick: () => { calibRef.current = null; }, style: { ...btnStyle, position: 'absolute', top: 12, left: 12, zIndex: 30 } }, 'Calibrate'),

    !started && h('div', {
      style: {
        position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(11,26,51,0.55)', padding: 16,
      },
    },
      h('div', { style: { width: 'min(560px, 94vw)', background: 'rgba(8,20,40,0.88)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: 24, color: '#fff' } },
        h('div', { style: { fontSize: 11, letterSpacing: '0.3em', color: '#f0580e', textTransform: 'uppercase', marginBottom: 6 } }, 'Free flight · Pixel art'),
        h('h1', { style: { margin: '0 0 6px', fontSize: 28, letterSpacing: '0.06em' } }, 'FIGHTER JET SCENE'),
        h('p', { style: { margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)' } },
          'The original Forge scene, rebuilt on its own code — a pixel-art fighter jet over a seeded ocean-and-islands world. No enemies, no score. Just fly.'),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'How do you want to fly?'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 } }, modeButtons),
        gyroMsg && h('p', { style: { color: '#fca5a5', fontSize: 12, margin: '0 0 8px' } }, gyroMsg),
        mode === 'gyro' && gyroOn && h('p', { style: { color: '#86efac', fontSize: 12, margin: '0 0 8px' } }, 'Motion controls on — hold your phone level, then tilt to steer. Tap Calibrate any time.'),
        h('div', { style: { display: 'flex', gap: 8, marginTop: 14 } },
          h('button', {
            onClick: () => setStarted(true),
            style: { ...btnStyle, flex: 1, background: '#d9382e', borderColor: '#d9382e', fontSize: 14, padding: '13px' },
          }, 'Take off ✈'),
          h('button', { onClick: () => setShowSettings(true), style: btnStyle }, 'Scene settings')),
        h('p', { style: { margin: '14px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 } },
          'Space cycles Top → Chase → Cockpit · Click to roll · Hold for the thrusters'))),

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
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Controls'),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 } }, modeButtons),
        gyroMsg && h('p', { style: { color: '#fca5a5', fontSize: 12, margin: '0 0 8px' } }, gyroMsg),
        SECTIONS.map((s) =>
          h('div', { key: s.title, style: { marginBottom: 16 } },
            h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, s.title),
            s.controls.map(sliderRow))),
        h('div', { style: { fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 } }, 'Switches'),
        TOGGLES.map(toggleRow),
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
