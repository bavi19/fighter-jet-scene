# Fighter Jet Scene

A pixel-art fighter jet in continuous free flight over a procedurally seeded
ocean-and-islands world — now with a Mission Mode: enemy jets, cannon and
missiles, ejection and rescue.

**Live:** https://fighter-jet-scene.vercel.app

## Two games, one world

The start screen asks which game to play:

- **Free Fly** — the original Forge scene as it is. No enemies, no score.
  Just fly.
- **Mission Mode** — the fighterv2 remix, ported the same way (see below):
  enemy jets hunt you, the cannon (right-click / Square / Gun button) and
  missiles (M / Circle / Missile button) answer back, lock-on brackets close
  in when one is ahead of you, and a roll at the last half-second throws an
  inbound missile off in slow motion — fire one back in that window for a
  triple counter. Hull is 6 hits; it regens if you are left alone. Go down
  (or dive into the ground on purpose) and you eject: the canopy pops, the
  seat fires, the parachute opens, and a new jet flies in and picks you up
  — radio chatter and all. Kills are the score, and they reset every time
  you are shot down. There is no win condition and no game-over screen;
  the rescue is the restart, in about three or four seconds. **T** runs a
  14-step tutorial flight (fly, tricks, fight, bail out); **I** opens the
  controls list and pauses the game. Mission Mode has its own settings too
  — Combat (ammo, missiles, reload, enemies, dodge slow-mo), Look (glow,
  colour, corners, grain), ejection close-up, explosion flash and shake,
  wake and cloud-cutting — all in the settings panel, only when Mission
  Mode is picked. The planes, graphics presets, control modes and the dark
  sky at altitude all work in Mission Mode exactly as in Free Fly.

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

The Mission Mode is a port of the same author's remix,
["fighter remix"](https://forge.ui8.ai/share/frag_f7618fc4-1958-48a9-bbb8-1c09ecb33736)
(entry `fighter-jet-eject`), recovered the same way:

- `src/components/fighter-jet-eject.js` — the remix's component (was
  `src/components/fighter-jet-eject.tsx`)
- `src/lib/eject/scene.js` + `src/lib/eject/tutorial.js` — its mission
  engine and tutorial (was `src/lib/eject/scene.ts` / `tutorial.ts`)
- `src/lib/post.js`, `src/lib/pilot-model.js`, `src/lib/voxel-sprite.js` —
  its post-processing, pilot/seat voxel models and voxel painter
- `src/lib/mission-sound.js` + `assets/sounds/*.mp3` — its sound engine
  and 30 recorded sounds (engine, guns, missiles, explosions, radio
  chatter). The import lines are rewritten to plain `/assets/sounds/…`
  URLs, since there is no bundler; the sounds are served from the site
  root, as the project is a plain static site (no framework `public/`
  folder).
- `original/v2/` — the remix's unmodified source, kept for reference

The only changes to the original files are mechanical: `.ts`/`.tsx` renamed
to `.js` with import paths fixed (the served files are already plain JS),
plus the clearly marked additions shared with Free Fly: the control modes
(`gyroRef`, `steerWithPointer`, `inputKind`), the dark sky at altitude, the
framing fix (`viewScale`), the three planes (`model` + `MODELS`, now in both
scenes), and one fixed bug in the remix — its scene queues a `release`
sound when a missile leaves the rail, but its sound table had no entry for
it, so it played nothing; `release` now reuses the swish recording.

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
- **Graphics quality (Low / Medium / High)** — the scene
  draws into a low-resolution pixel buffer that is scaled up, so pixel size
  *is* the resolution: Low uses 3 px with smooth flames (the original as
  published), Medium uses 2 px, High uses 1 px — the screen's native
  resolution, the sharpest the renderer can draw. (The old 6 px chunky Low
  was dropped, and the presets shifted up a step: Medium became Low, High
  became Medium, Ultra became High. Very High at 1.5 px was removed
  earlier: it looked almost the same as High.) The panel shows the live
  pixel-buffer size for the current choice. High is heavy: on the slow build
  machine it runs ~9 fps in the overhead view, so it is for fast desktops.
  The framing does not change with the setting: the overhead view is scaled
  so every setting frames exactly the same area — before this fix Low showed
  half the world and a jet twice as big on screen. Small screens are also
  zoomed out a little, so there is more room to play on a phone.
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
- **Sound effects** — Free Fly's are synthesized with Web Audio, no audio
  files: a low engine hum that rises with speed and boost, wind that grows
  with speed and height, a thruster roar while the afterburners are open, a
  spool-up sweep on take-off, a whoosh when the view changes, and a soft
  click when a graphics preset or a plane is picked. Mission Mode uses the
  remix's own recorded sounds instead (30 MP3s, ~1 MB, fetched lazily on
  the first click): engine, afterburner, wind, dive alarm, cannon, missiles,
  explosions, parachute, and radio chatter during a rescue. Audio starts on
  the Take off tap (browsers need a gesture); one Sound toggle in the
  settings panel mutes either system, remembered between visits. Mission
  Mode adds a Volume slider and a Radio chatter toggle in the same panel.
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

## Controls (Mission Mode only)

- **Right-click (hold) / Square / Gun button** — fire the cannon
- **M / Circle / Missile button** — fire a missile (at the locked target,
  or dumb); in the counter window after a dodge, one press fires three
- **F / G / L1 / R1 / Loop button** — loop back over the top / forward and under
- **I** — Intel (the controls list; pauses the game), **T** — the tutorial

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
