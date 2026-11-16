// Sound effects, synthesized with Web Audio — no audio files, nothing to
// download. Everything is built from oscillators and filtered noise:
// a low engine hum that rises with speed and boost, wind that grows with
// speed and height, a thruster roar while the afterburners are open, and
// short one-shots for taking off, switching views and tapping buttons.
// Audio can only start after a user gesture, so call unlock() from the
// Take off button (and any pointer press) before expecting sound.
let ctx = null
let master = null
let muted = false
let engine = null
let wind = null
let thruster = null

function noiseBuffer() {
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function buildNodes() {
  // engine: two detuned saws through a lowpass, so it hums rather than buzzes
  const engGain = ctx.createGain()
  engGain.gain.value = 0
  const engFilter = ctx.createBiquadFilter()
  engFilter.type = 'lowpass'
  engFilter.frequency.value = 320
  engFilter.Q.value = 0.8
  const o1 = ctx.createOscillator()
  o1.type = 'sawtooth'
  o1.frequency.value = 55
  const o2 = ctx.createOscillator()
  o2.type = 'sawtooth'
  o2.frequency.value = 55.7
  o1.connect(engFilter)
  o2.connect(engFilter)
  engFilter.connect(engGain)
  engGain.connect(master)
  o1.start()
  o2.start()
  engine = { o1, o2, gain: engGain, filter: engFilter }

  // wind: looped white noise through a bandpass, quiet at low speed
  const windGain = ctx.createGain()
  windGain.gain.value = 0
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'bandpass'
  windFilter.frequency.value = 700
  windFilter.Q.value = 0.4
  const wsrc = ctx.createBufferSource()
  wsrc.buffer = noiseBuffer()
  wsrc.loop = true
  wsrc.connect(windFilter)
  windFilter.connect(windGain)
  windGain.connect(master)
  wsrc.start()
  wind = { gain: windGain, filter: windFilter }

  // thrusters: looped noise through a lowpass that opens up with boost
  const thrGain = ctx.createGain()
  thrGain.gain.value = 0
  const thrFilter = ctx.createBiquadFilter()
  thrFilter.type = 'lowpass'
  thrFilter.frequency.value = 900
  const tsrc = ctx.createBufferSource()
  tsrc.buffer = noiseBuffer()
  tsrc.loop = true
  tsrc.connect(thrFilter)
  thrFilter.connect(thrGain)
  thrGain.connect(master)
  tsrc.start()
  thruster = { gain: thrGain, filter: thrFilter }
}

function ensure() {
  if (typeof window === 'undefined') return false
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.85
    master.connect(ctx.destination)
    buildNodes()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return true
}

const ramp = (param, value, t = 0.12) => {
  if (param) param.setTargetAtTime(value, ctx.currentTime, t)
}

export const sound = {
  /** call from a user gesture (Take off, any tap): creates/resumes the context */
  unlock() { ensure() },

  setMuted(m) {
    muted = !!m
    if (master && ctx) ramp(master.gain, muted ? 0 : 0.85, 0.05)
  },
  get muted() { return muted },

  /** called every frame while flying: speed in the scene's units, boost 0..1 */
  update({ speed = 0, boost = 0, altitude = 0 } = {}) {
    if (!ctx || muted) return
    const t = 0.15
    // engine: pitch climbs with speed and boost, louder under thrust
    const freq = 48 + speed * 0.32 + boost * 55
    ramp(engine.o1.frequency, freq, t)
    ramp(engine.o2.frequency, freq * 1.012, t)
    ramp(engine.filter.frequency, 280 + boost * 500, t)
    ramp(engine.gain.gain, 0.045 + boost * 0.05, t)
    // wind: louder and brighter the faster and higher you fly
    const w = Math.min(1, speed / 260) * 0.11 + Math.min(1, altitude / 500) * 0.05
    ramp(wind.gain.gain, w, 0.25)
    ramp(wind.filter.frequency, 600 + speed * 4, 0.25)
    // thrusters: only while the afterburners are open
    ramp(thruster.gain.gain, boost * 0.16, 0.08)
    ramp(thruster.filter.frequency, 700 + boost * 1400, 0.1)
  },

  /** everything quiet (leaving the game, muting) */
  quiet() {
    if (!ctx) return
    ramp(engine.gain.gain, 0, 0.08)
    ramp(wind.gain.gain, 0, 0.08)
    ramp(thruster.gain.gain, 0, 0.08)
  },

  /** short blip for tapping a button */
  click() {
    if (!ensure() || muted) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = 880
    g.gain.setValueAtTime(0.06, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07)
    o.connect(g)
    g.connect(master)
    o.start()
    o.stop(ctx.currentTime + 0.08)
  },

  /** rising spool-up for taking off */
  takeoff() {
    if (!ensure() || muted) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const f = ctx.createBiquadFilter()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(90, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.9)
    f.type = 'lowpass'
    f.frequency.value = 900
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1)
    o.connect(f)
    f.connect(g)
    g.connect(master)
    o.start()
    o.stop(ctx.currentTime + 1.15)
  },

  /** airy sweep for switching views */
  whoosh() {
    if (!ensure() || muted) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer()
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(280, ctx.currentTime)
    f.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.35)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    src.connect(f)
    f.connect(g)
    g.connect(master)
    src.start()
    src.stop(ctx.currentTime + 0.5)
  },
}
