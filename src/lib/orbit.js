import { REENTRY_ALTITUDE, TRANSIT_ALTITUDE } from './planet-route.js'

const SIZE = 256
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function smoothstep(min, max, value) {
  const t = clamp((value - min) / (max - min), 0, 1)
  return t * t * (3 - 2 * t)
}

const pack = (r, g, b) => 0xff000000 | (b << 16) | (g << 8) | r

function blend(from, to, amount) {
  return pack(
    (from & 255) * (1 - amount) + (to & 255) * amount,
    ((from >>> 8) & 255) * (1 - amount) + ((to >>> 8) & 255) * amount,
    ((from >>> 16) & 255) * (1 - amount) + ((to >>> 16) & 255) * amount,
  )
}

// Cache the shaded sphere so sampling it at render time is just a texture lookup.
const planets = new Map()

function planetTexture(mars) {
  if (!planets.has(mars)) planets.set(mars, buildPlanet(mars))
  return planets.get(mars)
}

function buildPlanet(mars) {
  const texture = new Uint32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    const ny = (y + 0.5) * 2 / SIZE - 1
    for (let x = 0; x < SIZE; x++) {
      const nx = (x + 0.5) * 2 / SIZE - 1
      const distance = nx * nx + ny * ny
      if (distance >= 1) continue
      const nz = Math.sqrt(1 - distance)
      const lon = Math.atan2(nx, nz)
      const lat = Math.asin(ny)
      const detail = Math.sin(lon * 23 + lat * 14) * Math.cos(lat * 31 - lon * 13)
      const terrain = Math.sin(5 * lon + 2 * Math.sin(lat * 4))
        + 0.65 * Math.cos(8 * lat + 3 * lon) + 0.29 * detail
      const land = smoothstep(0.38, 0.49, terrain)
      const shelf = smoothstep(0.19, 0.45, terrain)
      const clouds = Math.sin(19 * lat + 3 * Math.sin(6 * lon + lat))
        + 0.65 * Math.sin(12 * lon - 7 * lat) + 0.4 * detail
      const dry = smoothstep(-0.3, 0.05, lat) * (1 - smoothstep(0.1, 0.5, lat))
      const ocean = blend(pack(13, 61, 130), pack(25, 121, 160), shelf)
      const surface = blend(ocean, blend(pack(56, 109, 63), pack(183, 147, 88), dry), land)
      const ice = smoothstep(0.91, 1.16, Math.abs(lat) + 0.06 * detail)
      const cover = Math.max(ice, smoothstep(0.7, 1.65, clouds) * 0.85)
      const daylight = smoothstep(-0.32, 0.68, nz * 0.75 - nx * 0.58 - ny * 0.31)
      const desert = blend(pack(113, 45, 32), pack(211, 110, 65), smoothstep(-1.15, 1.45, terrain))
      const ground = mars ? blend(desert, pack(233, 188, 164), ice * 0.75)
        : blend(surface, pack(226, 239, 247), cover)
      const lit = blend(mars ? pack(22, 7, 12) : pack(5, 11, 29), ground, daylight)
      const rim = mars ? pack(231, 121, 76) : pack(95, 184, 249)
      texture[y * SIZE + x] = blend(lit, rim, (1 - smoothstep(0, 0.31, nz)) * (0.27 + 0.65 * daylight))
    }
  }
  return texture
}

export function orbitOpacity(altitude) {
  return smoothstep(185, 238, altitude)
}

export function createPlanetAim() {
  let target = null
  let lockX = 0
  let lockY = 0

  return (globes, x, y) => {
    for (let i = globes.length - 1; i >= 0; i--) {
      const globe = globes[i]
      if (globe.amount > 0.1 && Math.hypot(x - globe.x, y - globe.y) <= Math.max(6, globe.radius)) {
        target = globe.planet
        lockX = x
        lockY = y
        return target
      }
    }
    // Keep a steady cursor locked as the camera recenters the planet.
    if (!globes.length || Math.hypot(x - lockX, y - lockY) > 3) target = null
    return target
  }
}

export function placePlanetViewsOnScreen(globes, sheetCenter, frameCenter, pivotY, roll) {
  const c = Math.cos(roll)
  const s = Math.sin(roll)
  for (const globe of globes) {
    const x = globe.x - sheetCenter
    const y = globe.y - sheetCenter
    globe.x = frameCenter + c * x + s * y
    globe.y = pivotY - s * x + c * y
  }
}

export function drawOrbit(buffer, depth, stride, left, right, top, bottom,
  frameWidth, frameHeight, centerX, centerY, horizon, perspective, yaw, altitude, opacity, route, globeAnchorY) {
  const atmosphericMars = route.orbit?.mars ?? route.mars
  const limbAmount = route.inSpace
    ? route.orbit ? 1 - smoothstep(REENTRY_ALTITUDE, TRANSIT_ALTITUDE, altitude) : 0
    : 1 - smoothstep(REENTRY_ALTITUDE, TRANSIT_ALTITUDE - 15, altitude)
  const current = limbAmount > 0 ? planetTexture(atmosphericMars) : null
  const retreat = smoothstep(210, 315, altitude)
  const size = Math.min(frameWidth, frameHeight)
  const radius = size * (0.43 + 2.15 * (1 - retreat) ** 3)
  const rim = Math.max(1, Math.min(size * 0.035, radius * 0.085))
  const pitchOffset = Number.isFinite(horizon)
    ? clamp(horizon - centerY, -frameHeight * 0.45, frameHeight * 0.45)
    : 0
  const nearLimb = centerY + frameHeight * 0.20 + pitchOffset * 0.62
  const farCenter = centerY + frameHeight * 0.22 + pitchOffset * 0.44
  const planetY = centerY + (nearLimb + radius - centerY) * (1 - retreat)
    + (farCenter - centerY) * retreat
  const globeY = centerY + (planetY - centerY) * perspective
  const outer = radius + rim
  const textureScale = SIZE / (2 * radius)
  const yawShift = Math.round(yaw * size * 0.3)
  const space = pack(4, 7, 17)
  const air = atmosphericMars ? pack(229, 111, 66) : pack(58, 153, 252)
  const globes = []
  if (route.inSpace && limbAmount < 1) {
    const farthestFirst = [...route.planets].sort((a, b) => b.distance - a.distance)
    for (const planet of farthestFirst) {
      if (planet !== route.target && !route.departureAhead) continue
      const angle = planet.bearing + yaw
      const forward = Math.cos(angle)
      if (forward <= 0) continue
      const radius = size * 0.68 * planet.radius / Math.max(200, planet.distance)
      const x = centerX + Math.sin(angle) / Math.max(0.25, forward) * frameWidth * 0.53
      if (x + radius < left || x - radius >= right) continue
      const amount = route.globeOpacity * (1 - limbAmount) * smoothstep(35, 125, planet.distance)
      globes.push({
        planet,
        texture: planetTexture(planet.mars),
        x,
        y: globeAnchorY + pitchOffset * 0.08,
        radius,
        scale: SIZE / (2 * radius),
        amount,
      })
    }
  }
  for (let y = top; y < bottom; y++) {
    const dy = y - globeY
    const ty = Math.floor(dy * textureScale + SIZE / 2)
    for (let x = left, i = y * stride + left; x < right; x++, i++) {
      const dx = x - centerX
      const distance = dx * dx + dy * dy
      const seed = Math.imul(x - Math.round(centerX) + yawShift, 374761393)
        + Math.imul(y - Math.round(centerY), 668265263)
      const star = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 24
      let pixel = star === 255 ? pack(124, 156, 197) : star === 254 ? pack(56, 74, 106) : space
      if (current && distance < outer * outer) {
        const tx = Math.floor(dx * textureScale + SIZE / 2)
        const surface = distance < radius * radius && tx >= 0 && tx < SIZE && ty >= 0 && ty < SIZE
          ? current[ty * SIZE + tx] : 0
        const limb = surface || blend(pixel, air, 0.72 * (1 - smoothstep(radius - 1, outer, Math.sqrt(distance))))
        pixel = limbAmount === 1 ? limb : blend(pixel, limb, limbAmount)
      }
      buffer[i] = opacity === 1 ? pixel : blend(buffer[i], pixel, opacity)
      if (opacity >= 0.8) depth[i] = 1e9
    }
  }
  for (const globe of globes) {
    const x0 = Math.max(left, Math.ceil(globe.x - globe.radius))
    const x1 = Math.min(right, Math.ceil(globe.x + globe.radius))
    const y0 = Math.max(top, Math.ceil(globe.y - globe.radius))
    const y1 = Math.min(bottom, Math.ceil(globe.y + globe.radius))
    const radiusSquared = globe.radius * globe.radius
    for (let y = y0; y < y1; y++) {
      const gy = y - globe.y
      const ty = Math.floor(gy * globe.scale + SIZE / 2)
      for (let x = x0, i = y * stride + x0; x < x1; x++, i++) {
        const gx = x - globe.x
        if (gx * gx + gy * gy >= radiusSquared) continue
        const tx = Math.floor(gx * globe.scale + SIZE / 2)
        const surface = globe.texture[ty * SIZE + tx]
        if (surface) buffer[i] = globe.amount === 1 ? surface : blend(buffer[i], surface, globe.amount)
      }
    }
  }
  return globes
}
