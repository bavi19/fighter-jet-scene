# Fighter Jet Scene

A pixel-art fighter jet in continuous free flight over a procedurally seeded
ocean-and-islands world. No enemies, no score — just fly.

**Live:** https://fighter-jet-scene.vercel.app

## Origin — the original code, not a rewrite

This is a port of the original Forge UI8 project
["fighter"](https://forge.ui8.ai/share/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24)
(Fighter jet scene), which is published publicly with remix access. Its exact
source was recovered from the project's public preview and is used here as the
base, with only the small additions listed below:

- `src/components/fighter-jet-scene.js` — the original React component
  (was `src/components/fighter-jet-scene.tsx`)
- `src/lib/scene.js` — the original software renderer: low-resolution pixel
  buffer, sprite-stack jet, stacked islands and clouds, overhead + chase +
  cockpit cameras (was `src/lib/scene.ts`)
- `src/lib/cockpit.js`, `src/lib/jet-model.js`, `src/lib/flame-layer.js` —
  the original cockpit instruments, jet voxel model and flame layer
- `original/` — the unmodified source files exactly as served by the Forge
  preview, kept for reference

The only changes to the original files are mechanical: `.ts`/`.tsx` renamed
to `.js` with import paths fixed (the served files are already plain JS), and
three small, clearly marked additions in the component for the control modes
below (`gyroRef`, `steerWithPointer`, `inputKind`).

The jet art is procedural: the voxel model is run-length encoded inside
`src/lib/jet-model.js` — no image assets are needed.

## What's added on top

- **Control modes** (start screen, switchable any time from Controls):
  Touch (drag to steer, tap to roll), **Gyro** (tilt the phone to fly, with
  Calibrate), Mouse (move to steer, click to roll), Keyboard (GTA-style
  arrows/WASD, Shift for the thrusters, Space to change view). The original
  already had touch, mouse, keyboard and gamepad input; gyro is new.
- **Scene settings panel** — every one of the original's parameters, live:
  speed, boost, turn rate, bank, cruising altitude, ceiling, jet size, slice
  spacing, pixel size, cameras, time of day, islands, clouds, seed, flames,
  trails, shadow, jet colours. Saved in localStorage, with Reset defaults.
- **Graphics quality (Low / Medium / High / Ultra)** — the scene
  draws into a low-resolution pixel buffer that is scaled up, so pixel size
  *is* the resolution: Low uses 6 px pixels with pixel flames (chunky retro,
  lightest), Medium uses 3 px with smooth flames (the original as
  published), High uses 2 px, Ultra uses 1 px — the screen's native
  resolution, the sharpest the renderer can draw. (Very High at 1.5 px was
  removed: it looked almost the same as High.) The panel shows the live
  pixel-buffer size for the current choice. Ultra is heavy: on the slow build
  machine it runs ~9 fps in the overhead view, so it is for fast desktops. The framing does not
  change with the setting: the overhead view is scaled so Low frames exactly
  the same area as Medium (only chunkier) — before this fix Low showed half
  the world and a jet twice as big on screen. Small screens are also zoomed
  out a little, so there is more room to play on a phone.
- **Three planes** — Falcon (the original, balanced), Dart (narrow and
  long: faster, twitchier, lower ceiling) and Titan (wide and heavy: slow
  to turn, climbs the highest). Each is a different voxel model cut from
  the original's slices, with its own default speed, turn rate, bank,
  ceiling, cruising altitude and livery. Pick one on the start screen or
  in settings; tuning the Flight sliders afterwards makes it a custom mix.
- **Leaving the atmosphere** — climb (Cruising altitude and Ceiling now
  reach 900) and the sky darkens to space from about altitude 120: stars
  fade in, the world below going dark, until at full space only a dark sky,
  stars and the height readout are left. (An earlier globe — the ground
  turning into a ball — was tried twice and dropped at the user's request:
  a dark sky is enough.) The Titan's ceiling (520) takes you deepest; the
  Falcon (300) just reaches full space.
- **Sound effects** — synthesized with Web Audio, no audio files: a low
  engine hum that rises with speed and boost, wind that grows with speed
  and height, a thruster roar while the afterburners are open, a spool-up
  sweep on take-off, a whoosh when the view changes, and a soft click when
  a graphics preset or a plane is picked. Audio starts on the Take off tap
  (browsers need a gesture); a Sound toggle in the settings panel mutes it,
  remembered between visits.
- **Responsive** — fills the viewport (`100dvh`, safe-area aware) on mobile
  and desktop; the pixel buffer resizes with the window.

## Controls (original)

- **Space** — cycle Top → Chase → Cockpit
- **Arrows / WASD** — fly (down climbs, up dives, like a flight stick)
- **Shift** — fire the thrusters
- **Click / tap** — roll
- **Hold** — thrusters (mouse hold / Boost button on touch)
- **Gamepad** — left stick to fly, Cross to roll, R2 for thrusters,
  Triangle to change view

## Run it

No build step. Serve the folder statically and open it:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

React 19 comes from esm.sh via an import map in `index.html`; Tailwind
classes (used by the original component) come from the Tailwind browser CDN.

## Deploy

Static site. The Vercel project `fighter-jet-scene` is linked to this repo's
`main` branch and redeploys automatically on every push (Framework: Other,
no build command).

## Original parameters (as published)

Speed 92 · Thruster boost 1.8× · Turn rate 1.25 · Bank 52° · Cruising
altitude 110 · Ceiling 300 · Ground clearance 7 · Wingmen 0 · Jet size 0.6 ·
Slice spacing 1 · Pixel size 3 · View change 1.4s · Chase distance 2.6 jet
lengths · Chase height 12° · Chase jet width 0.19 · Islands 0.33 · Clouds
0.45 · World seed 7 · Afterburner 1 · Flame style realistic · Jet colours
Body `#545969`, Accent `#f0580e`, Canopy `#1e8ca0`.
