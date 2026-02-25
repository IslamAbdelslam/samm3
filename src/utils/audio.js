/**
 * audio.js — Schroeder Reverberator
 *
 * Uses a classic Schroeder reverb: 4 parallel comb filters + 2 allpass filters.
 * Every parameter has a DIRECT, mathematically precise effect on the output.
 *
 * Parameters map:
 *   roomSize        → scales all delay-line lengths (larger = more spacious)
 *   reverbTime      → controls comb filter feedback gain (higher = longer tail)
 *   damping         → LP filter coefficient inside comb loop (higher = darker)
 *   inputBandwidth  → LP filter on the input before reverb (higher = warmer)
 *   dryLevel (dB)   → dry signal gain
 *   earlyLevel (dB) → early reflection echo gain
 *   tailLevel (dB)  → reverb tail (comb+allpass) gain
 */

let _audioCtx = null

function getCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

// ── Decode / Encode Helpers ──────────────────────────────────

async function blobToChannelData(blob) {
  const ab  = await blob.arrayBuffer()
  const ctx = getCtx()
  const buf = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej))
  // Return mono mix; if stereo, average L+R
  const ch0 = buf.getChannelData(0)
  if (buf.numberOfChannels === 1) return { data: Float32Array.from(ch0), sampleRate: buf.sampleRate }
  const ch1 = buf.getChannelData(1)
  const mono = new Float32Array(ch0.length)
  for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5
  return { data: mono, sampleRate: buf.sampleRate }
}

function channelDataToBlob(data, sampleRate) {
  const length = data.length * 2
  const ab   = new ArrayBuffer(44 + length)
  const view = new DataView(ab)
  const str  = (s, off) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }

  str('RIFF', 0); view.setUint32(4, 36 + length, true)
  str('WAVE', 8); str('fmt ', 12)
  view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)               // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str('data', 36); view.setUint32(40, length, true)

  let off = 44
  for (let i = 0; i < data.length; i++) {
    view.setInt16(off, Math.max(-1, Math.min(1, data[i])) * 0x7FFF, true)
    off += 2
  }
  return new Blob([view], { type: 'audio/wav' })
}

function dB(v) { return Math.pow(10, v / 20) }

// ── Schroeder Reverb Primitives ──────────────────────────────

/** Comb filter with LP damping. feedback + damping → decay character */
class CombFilter {
  constructor(delaySamples) {
    this.buf     = new Float32Array(delaySamples)
    this.pos     = 0
    this.len     = delaySamples
    this.fb      = 0.7   // feedback
    this.damp    = 0.5   // LP coefficient
    this.y       = 0     // LP state
  }
  tick(x) {
    const out   = this.buf[this.pos]
    this.y      = out * (1 - this.damp) + this.y * this.damp   // LP smoothing
    this.buf[this.pos] = x + this.y * this.fb
    this.pos    = (this.pos + 1) % this.len
    return out
  }
}

/** Allpass filter — disperses energy across time without changing spectrum */
class AllpassFilter {
  constructor(delaySamples, g = 0.7) {
    this.buf  = new Float32Array(delaySamples)
    this.pos  = 0
    this.len  = delaySamples
    this.g    = g
  }
  tick(x) {
    const buf_out = this.buf[this.pos]
    const v       = x + buf_out * this.g
    this.buf[this.pos] = v
    this.pos          = (this.pos + 1) % this.len
    return buf_out - v * this.g
  }
}

// ── Main Export ──────────────────────────────────────────────

export async function applyReverb(blob, {
  roomSize       = 0.7,
  reverbTime     = 2.5,
  damping        = 0.5,
  inputBandwidth = 0.5,
  dryLevel       = -1,
  earlyLevel     = -6,
  tailLevel      = -6,
} = {}) {

  const { data: input, sampleRate } = await blobToChannelData(blob)

  // ── Delay line lengths (from classic Freeverb, scaled by roomSize) ──
  // Base lengths at 44100 Hz, then rate-adjusted AND room-scaled
  const rate    = sampleRate / 44100
  const scale   = 0.4 + roomSize * 0.6               // 0.4–1.0
  const combMs  = [29.7, 37.1, 41.1, 43.7]           // ms
  const apMs    = [12.6,  10.0]                       // ms

  // Comb feedback: use rt60 formula.  For delay d seconds: g = 10^(-3d/T60)
  // With d ≈ avg comb delay ~35ms, reverbTime in 0.1–10 s:
  // g(0.1)=0.007 → too low; so use a perceptual mapping:
  const avgD   = 0.035                               // 35 ms average comb delay
  const g60    = Math.pow(10, -3 * avgD / reverbTime) // theoretical
  const combFb = Math.min(0.97,  Math.max(0.1, g60)) // clamp for safety

  // Damping LP coefficient (0=no damp, 1=full damp → silence)
  const dampCoeff = Math.min(0.95, damping * 0.85)

  // Input bandwidth LP (0=flat, 1=very filtered)
  const bwCoeff = inputBandwidth * 0.92

  // Build filters
  const combs = combMs.map(ms => {
    const c   = new CombFilter(Math.round(ms / 1000 * sampleRate * scale))
    c.fb      = combFb
    c.damp    = dampCoeff
    return c
  })
  const aps = apMs.map(ms => new AllpassFilter(Math.round(ms / 1000 * sampleRate * scale)))

  // Early reflection: one echo at 20ms + roomSize*40ms
  const erDelay = Math.round(sampleRate * (0.020 + roomSize * 0.040))

  // Gains
  const dryG  = dB(dryLevel)
  const erG   = dB(earlyLevel)
  const tailG = dB(tailLevel)

  // Output buffer: input + extra tail (reverbTime + 1s)
  const tailExtra  = Math.ceil(sampleRate * (reverbTime + 1))
  const out        = new Float32Array(input.length + tailExtra)
  let   bwState    = 0   // LP state for input bandwidth filter

  for (let i = 0; i < out.length; i++) {
    const x = i < input.length ? input[i] : 0

    // 1. Input bandwidth (LP filter on reverb send)
    bwState = x * (1 - bwCoeff) + bwState * bwCoeff
    const xf = bwState

    // 2. Parallel comb filters
    let wet = 0
    for (const c of combs) wet += c.tick(xf)
    wet /= combs.length

    // 3. Series allpass filters
    for (const ap of aps) wet = ap.tick(wet)

    // 4. Early reflection (simple delay of dry signal)
    const er = (i >= erDelay && i - erDelay < input.length)
      ? input[i - erDelay] * erG
      : 0

    // 5. Mix
    out[i] = x * dryG + er + wet * tailG
  }

  return channelDataToBlob(out, sampleRate)
}

// ── Real-time waveform visualizer ───────────────────────────

export function drawWaveform(analyser, canvas) {
  if (!analyser || !canvas) return
  const ctx = canvas.getContext('2d')
  const w   = canvas.width
  const h   = canvas.height
  const arr = new Float32Array(analyser.fftSize)

  ;(function draw() {
    if (!canvas.isConnected) return
    analyser.getFloatTimeDomainData(arr)
    ctx.clearRect(0, 0, w, h)
    ctx.lineWidth   = 2
    ctx.strokeStyle = '#C9A84C'
    ctx.shadowColor = 'rgba(201,168,76,0.4)'
    ctx.shadowBlur  = 6
    ctx.beginPath()
    const step = w / arr.length
    for (let i = 0; i < arr.length; i++) {
      const x = i * step
      const y = (arr[i] * 0.5 + 0.5) * h
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
    requestAnimationFrame(draw)
  })()
}
