export const TRANSIT_ALTITUDE = 320
export const REENTRY_ALTITUDE = 265
export const MIN_FLIGHT_CEILING = 350
const EARTH_RADIUS = 160
const MARS_RADIUS = EARTH_RADIUS * 0.532
const ORBIT_CLEARANCE = 220
const DEPARTURE_CLEARANCE = 90
const DISTANCE_TO_DESTINATION_ORBIT = 600
const SPACE_SPEED = 1.2
const APPROACH_SPEED = 0.52
const APPROACH_RANGE = 260
const ORBIT_HOLD_DEPTH = 85
const ORBIT_EXIT_MARGIN = 32

export function createPlanetRoute() {
  let inSpace = false
  let orbit = null
  let spaceTime = 0
  let departureAhead = false
  let speedScale = SPACE_SPEED
  function makePlanet(name, mars, radius) {
    return { name, mars, radius, orbitRadius: radius + ORBIT_CLEARANCE, x: 0, y: 0, distance: 0, bearing: 0 }
  }
  const earth = makePlanet('Earth', false, EARTH_RADIUS)
  const mars = makePlanet('Mars', true, MARS_RADIUS)
  const planets = [earth, mars]

  return {
    mars: false,
    planets,
    get inSpace() { return inSpace },
    get orbit() { return orbit },
    get speedScale() { return speedScale },
    get globeOpacity() { return 0.25 + 0.75 * Math.min(1, spaceTime / 1.1) },
    get target() { return this.mars ? earth : mars },
    get departureAhead() { return departureAhead },
    get planet() { return this.mars ? 'Mars' : 'Earth' },
    step(jet, dt) {
      if (!inSpace) {
        if (jet.z < TRANSIT_ALTITUDE) return false
        inSpace = true
        spaceTime = 0
        speedScale = SPACE_SPEED
        for (const planet of planets) {
          const offset = planet === this.target
            ? planet.orbitRadius + DISTANCE_TO_DESTINATION_ORBIT
            : -(planet.orbitRadius + DEPARTURE_CLEARANCE)
          planet.x = Math.sin(jet.yaw) * offset
          planet.y = -Math.cos(jet.yaw) * offset
        }
        dt = 0
      }
      spaceTime += dt
      let approach = 1
      if (dt > 0) {
        for (const planet of planets) {
          const closing = planet.x * jet.vx + planet.y * jet.vy > 0
          const gap = planet.distance - planet.orbitRadius
          if (closing || gap <= 0) approach = Math.min(approach, Math.max(0, gap / APPROACH_RANGE))
        }
      }
      const ease = approach * approach * (3 - 2 * approach)
      const goal = APPROACH_SPEED + (SPACE_SPEED - APPROACH_SPEED) * ease
      speedScale += (goal - speedScale) * (1 - Math.exp(-dt * 3))
      let dx = jet.vx * dt * speedScale
      let dy = jet.vy * dt * speedScale
      if (orbit && orbit.distance > 0) {
        const ux = orbit.x / orbit.distance
        const uy = orbit.y / orbit.distance
        const inward = dx * ux + dy * uy
        if (inward > 0) {
          // Ease toward a holding distance while leaving sideways and outward flight under pilot control.
          const remaining = Math.max(0, orbit.distance - (orbit.orbitRadius - ORBIT_HOLD_DEPTH))
          const allowed = Math.min(inward * Math.min(1, remaining / ORBIT_HOLD_DEPTH), remaining)
          dx -= ux * (inward - allowed)
          dy -= uy * (inward - allowed)
        }
      }
      const departure = this.mars ? mars : earth
      for (const planet of planets) {
        planet.x -= dx
        planet.y -= dy
        planet.distance = Math.hypot(planet.x, planet.y)
        planet.bearing = Math.atan2(planet.x, -planet.y)
      }
      departureAhead = Math.cos(departure.bearing - jet.yaw) > 0
      if (!orbit || orbit.distance > orbit.orbitRadius + ORBIT_EXIT_MARGIN) {
        orbit = planets.find(planet => planet.distance <= planet.orbitRadius) ?? null
      }
      if (!orbit || jet.z > REENTRY_ALTITUDE) return false
      const changedPlanet = this.mars !== orbit.mars
      this.mars = orbit.mars
      inSpace = false
      orbit = null
      return changedPlanet
    },
  }
}

const MARS_SURFACE = [
  [119, 56, 40], [133, 62, 42], [149, 70, 47], [160, 76, 50],
  [172, 86, 54], [180, 96, 61], [151, 65, 41], [133, 54, 38],
  [174, 79, 48], [148, 68, 48], [162, 78, 50], [185, 94, 57],
  [114, 54, 44], [92, 42, 37], [141, 65, 49], [195, 135, 111], [154, 96, 78],
]

export function marsTerrain(material, side = false) {
  const color = MARS_SURFACE[material]
  return side ? color.map(channel => channel * 0.8) : color
}

export function isOrbitDescentPointer(x, y, width, height, invertY) {
  const centered = Math.abs(x / width - 0.5) < 0.3
  return centered && (invertY ? y / height <= 0.10 : y / height >= 0.90)
}

export function drawPlanetNavigation(ctx, width, height, scene) {
  const route = scene.planetRoute
  const altitude = scene.altitude
  if (altitude < 135 && !route.mars) return
  ctx.save()
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#110e1c'
  ctx.shadowBlur = 4
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'center'
  const y = Math.max(42, height * 0.09)
  if (route.orbit) {
    const name = route.orbit.name.toUpperCase()
    ctx.fillText(name + ' ORBIT', width / 2, y)
    ctx.fillText(scene.orbitDescentHint, width / 2, y + 15)
  } else if (route.inSpace) {
    const target = scene.planetAim ?? route.target
    const turn = scene.destinationTurn
    const direction = Math.abs(turn) < 0.14 ? 'AHEAD' : turn < 0 ? '← TURN LEFT' : 'TURN RIGHT →'
    const distanceToOrbit = Math.ceil(target.distance - target.orbitRadius)
    ctx.fillText(target.name.toUpperCase() + ' ORBIT · ' + distanceToOrbit + ' AWAY', width / 2, y)
    const guidance = scene.planetAim ? 'AIM ASSIST ACTIVE' : direction + ' · Hover over the planet to steer'
    ctx.fillText(guidance, width / 2, y + 15)
  } else {
    ctx.fillText(route.planet.toUpperCase() + ' · ALT ' + Math.round(altitude), width / 2, y)
    if (altitude >= 135) {
      ctx.fillText('Climb to ' + TRANSIT_ALTITUDE + ' to reach space', width / 2, y + 15)
    }
  }
  ctx.restore()
}
