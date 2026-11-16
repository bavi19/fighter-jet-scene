# Fighter Jet Scene — Free Flight

A pixel-art fighter jet in continuous free flight over a procedurally seeded
ocean-and-islands world. A from-scratch recreation of the
[Forge UI8 “fighter” scene](https://forge.ui8.ai/share/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24),
rebuilt with crisper, cleaner graphics in the style of the red pixel plane
(pale sky, flat shaded pixels, soft shadows, white speed streaks).

No build step, no dependencies — plain HTML + CSS + Canvas 2D. Open
`index.html` or serve the folder with any static host / Vercel.

## Same architecture as the original

One component — **Fighter jet scene** — with the same parameter set:

| Group | Parameters |
|---|---|
| Flight | Speed 92 · Thruster boost 1.8× · Turn rate 1.25 · Bank 52° · Cruising altitude 110 · Ceiling 300 · Ground clearance 7 · Wingmen 0 |
| Sprite stack | Jet size 0.6 · Slice spacing 1 · Pixel size 3 (stacked-slice extrusion under the jet) |
| Camera | Top / Chase / Cockpit (Space cycles) · View change ~1.4 s fade · Chase distance 2.6 jet lengths |
| World | Time of day Day/Sunset/Night · Islands 0.33 · Clouds 0.45 · World seed 7 · Jet shadow on |
| Effects | Afterburner flames · Wingtip trails on |
| Jet colours | Body, Accent, Canopy (default red `#d9382e` to match the reference plane) |

The world is procedurally seeded (seed 7 by default): islands with beaches,
grass, forest and rock, drifting clouds with shadows on the ocean, all
deterministic per seed. There is no score, enemy, or end state — free flight,
exactly like the original.

## Controls — pick one on the start screen

| Mode | How to fly |
|---|---|
| 👆 **Touch** | Drag anywhere to steer — drag down to climb, up to dive. Tap to roll. On-screen Thrust button for afterburner. |
| 📱 **Gyro** | Tilt the phone to steer — tilt left/right to turn, tilt back to climb, forward to dive. Tap **Enable motion** (iOS asks permission), then **Calibrate** while holding the phone as you will fly. Falls back gracefully if the device has no gyro. |
| 🖱️ **Mouse** | Move the mouse to steer — down climbs, up dives. Click to roll. Hold the mouse button (or Shift) for afterburner. |
| ⌨️ **Keyboard** | GTA-style: ← → / A–D to turn, ↑ ↓ / W–S to pitch (down climbs), Shift for afterburner, Q / E to roll, Space to change view, P to pause. |

Space cycles **Top → Chase → Cockpit** in every mode. Settings (⚙️) tune
every parameter above live, and are saved in the browser.

## Responsive

Full-viewport canvas, device-pixel-ratio aware, `viewport-fit=cover` with
safe-area insets. Works in portrait and landscape on phones, tablets and
desktop; touch targets are thumb-sized and the layout collapses to one column
under 640 px.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Static site — deploy the repo root as-is on Vercel (no build command, no
output directory change needed).
