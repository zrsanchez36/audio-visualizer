"use client"

import { useRef, useCallback, useEffect } from "react"

export type VisualMode = "bars" | "wave" | "hybrid" | "pulse" | "particles"

interface UseCanvasAnimationProps {
  getFrequencyData: () => Uint8Array | null
  getTimeDomainData: () => Uint8Array | null
  getBassEnergy: () => number
  isPlaying: boolean
  mode: VisualMode
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function barColor(norm: number, value: number): string {
  const r = Math.min(255, Math.round(45  + norm * 80  + value * 60))
  const g = Math.min(255, Math.round(200 + norm * 30  + value * 25))
  const b = Math.min(255, Math.round(190 + norm * 55  + value * 45))
  return `rgba(${r},${g},${b},${(0.35 + value * 0.65).toFixed(2)})`
}

function glowColor(norm: number, alpha: number): string {
  const r = Math.min(255, Math.round(45  + norm * 80))
  const g = Math.min(255, Math.round(200 + norm * 30))
  const b = Math.min(255, Math.round(190 + norm * 55))
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

// Particle color: bass = teal (45,200,190) → treble = soft violet (160,140,255)
// Aurora-like gradient that complements the dark navy background
function particleColor(norm: number, alpha: number): [number, number, number] {
  const r = Math.min(255, Math.round(45  + norm * 115))   // 45  → 160
  const g = Math.min(255, Math.round(200 - norm * 60))    // 200 → 140
  const b = Math.min(255, Math.round(190 + norm * 65))    // 190 → 255
  return [r, g, b]
}

// ─── Bars — mirrored from center ─────────────────────────────────────────────
function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Uint8Array
) {
  const barCount = Math.min(80, Math.floor(width / 5))
  const barWidth = width / barCount
  const gap   = barWidth > 6 ? 2 : 1
  const midY  = height / 2

  for (let i = 0; i < barCount; i++) {
    const dataIndex = Math.floor((i / barCount) * data.length * 0.72)
    const value = data[dataIndex] / 255
    if (value < 0.01) continue

    const norm  = i / barCount
    const halfH = value * height * 0.46
    const x     = i * barWidth + gap / 2
    const w     = Math.max(1, barWidth - gap)
    const r     = Math.min(4, w / 2)

    ctx.fillStyle = barColor(norm, value)
    if (value > 0.45) {
      ctx.shadowColor = glowColor(norm, 0.55)
      ctx.shadowBlur  = 10 + value * 16
    } else {
      ctx.shadowBlur = 0
    }

    ctx.beginPath()
    ctx.roundRect(x, midY - halfH, w, halfH, [r, r, 0, 0])
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(x, midY, w, halfH, [0, 0, r, r])
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

// ─── Wave — double-pass neon glow ────────────────────────────────────────────
function drawWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: Uint8Array
) {
  const midY  = height / 2
  const slice = width / data.length

  ctx.lineWidth   = 7
  ctx.strokeStyle = "rgba(45,200,190,0.12)"
  ctx.shadowBlur  = 0
  ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    const y = midY + (data[i] / 128 - 1) * midY * 0.8
    i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y)
  }
  ctx.stroke()

  ctx.lineWidth   = 2.5
  ctx.strokeStyle = "rgba(80,220,210,0.95)"
  ctx.shadowColor = "rgba(45,200,190,0.75)"
  ctx.shadowBlur  = 24
  ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    const y = midY + (data[i] / 128 - 1) * midY * 0.8
    i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
}

// ─── Pulse ────────────────────────────────────────────────────────────────────
interface Ring { radius: number; alpha: number; speed: number; hue: number }
const rings: Ring[] = []
let lastBeat = 0

function drawPulse(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bassEnergy: number,
  avgVolume: number,
  t: number
) {
  const cx   = width  / 2
  const cy   = height / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)

  if (bassEnergy > 0.42 && t - lastBeat > 160) {
    lastBeat = t
    rings.push({ radius: 14 + bassEnergy * 22, alpha: 0.8 + bassEnergy * 0.2, speed: 2 + bassEnergy * 3, hue: 175 + Math.random() * 35 })
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i]
    ring.radius += ring.speed
    ring.alpha  *= 0.962
    if (ring.alpha < 0.012 || ring.radius > maxR * 1.15) { rings.splice(i, 1); continue }
    const off = ring.hue - 180
    const rC  = Math.max(0, Math.min(255, Math.round(45  + off * 1.5)))
    const bC  = Math.max(0, Math.min(255, Math.round(190 - off * 0.8)))
    ctx.beginPath()
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${rC},200,${bC},${ring.alpha.toFixed(3)})`
    ctx.lineWidth   = 1.5 + ring.alpha * 2.5
    ctx.shadowColor = `rgba(45,200,190,${(ring.alpha * 0.5).toFixed(3)})`
    ctx.shadowBlur  = 12
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  const orbR = 5 + avgVolume * 22
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 3.5)
  grad.addColorStop(0, `rgba(120,240,230,${(0.38 + avgVolume * 0.42).toFixed(2)})`)
  grad.addColorStop(1, "rgba(45,200,190,0)")
  ctx.beginPath(); ctx.arc(cx, cy, orbR * 3.5, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2)
  ctx.fillStyle   = `rgba(140,245,235,${(0.75 + avgVolume * 0.25).toFixed(2)})`
  ctx.shadowColor = "rgba(45,200,190,0.9)"; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0
}

// ─── Particles ────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number
  radius: number; alpha: number; decay: number; norm: number
}

const particles: Particle[] = []
const MAX_PARTICLES = 120

function spawnParticles(
  width: number,
  height: number,
  freqData: Uint8Array | null,
  avgVolume: number,
  idle: boolean,
  subtle = false   // true when used as hybrid background layer
) {
  if (idle || !freqData) {
    // Idle: slow trickle across the full canvas
    if (particles.length < MAX_PARTICLES && Math.random() < 0.3) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.08 + Math.random() * 0.2
      particles.push({
        x: width  / 2 + (Math.random() - 0.5) * width  * 0.7,
        y: height / 2 + (Math.random() - 0.5) * height * 0.7,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.04,
        radius: 0.8 + Math.random() * 1.2,
        alpha:  0.12 + Math.random() * 0.18,
        decay:  1 / (160 + Math.random() * 100),
        norm:   Math.random(),
      })
    }
    return
  }

  const maxCount  = subtle ? MAX_PARTICLES * 0.4 : MAX_PARTICLES
  const spawnBase = subtle ? 1 : 3
  const spawnCount = Math.max(spawnBase, Math.floor(2 + avgVolume * (subtle ? 3 : 6)))

  for (let s = 0; s < spawnCount; s++) {
    if (particles.length >= maxCount) break

    const binIndex = Math.floor(Math.random() * freqData.length * 0.75)
    const binValue = freqData[binIndex] / 255
    const norm     = binIndex / (freqData.length * 0.75)

    if (binValue < 0.02) continue

    // Spread across full canvas area — not just center cluster
    const cx = width  / 2 + (Math.random() - 0.5) * width  * 0.65
    const cy = height / 2 + (Math.random() - 0.5) * height * 0.65

    const angle = Math.random() * Math.PI * 2
    const speed = 0.15 + Math.random() * 0.45 + avgVolume * 0.3
    const alphaBase = subtle ? 0.18 : 0.35

    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.08,
      radius: 1.4 + (1 - norm) * 1.8 + binValue * 1.6,
      alpha:  alphaBase + binValue * (subtle ? 0.25 : 0.5),
      decay:  1 / (140 + Math.random() * 80),
      norm,
    })
  }
}

function renderParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bassEnergy: number
) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]

    // Gentle pull toward center — loose orbital drift
    const dx   = width  / 2 - p.x
    const dy   = height / 2 - p.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    p.vx += (dx / dist) * 0.003
    p.vy += (dy / dist) * 0.003
    p.x  += p.vx
    p.y  += p.vy
    p.alpha -= p.decay

    if (p.alpha <= 0.01) { particles.splice(i, 1); continue }

    const pulsedRadius = p.radius * (1 + bassEnergy * 0.3)
    const [r, g, b]    = particleColor(p.norm, p.alpha)

    // Soft halo
    const haloR = pulsedRadius * 3.5
    const grad  = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR)
    grad.addColorStop(0, `rgba(${r},${g},${b},${(p.alpha * 0.3).toFixed(3)})`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.beginPath(); ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2)
    ctx.fillStyle = grad; ctx.fill()

    // Solid core
    ctx.beginPath(); ctx.arc(p.x, p.y, pulsedRadius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, p.alpha * 1.4).toFixed(3)})`
    ctx.fill()
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  freqData: Uint8Array | null,
  avgVolume: number,
  bassEnergy: number,
  idle = false,
  subtle = false
) {
  spawnParticles(width, height, freqData, avgVolume, idle, subtle)
  renderParticles(ctx, width, height, bassEnergy)
}

// ─── Idle — layered sine waves ────────────────────────────────────────────────
function drawIdle(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const layers = [
    { amp: 10, freq: 5, speed: 0.0008, alpha: 0.22, lw: 1.5 },
    { amp:  6, freq: 9, speed: 0.0014, alpha: 0.13, lw: 1.0 },
    { amp: 16, freq: 3, speed: 0.0005, alpha: 0.09, lw: 2.0 },
  ]
  for (const l of layers) {
    ctx.lineWidth   = l.lw
    ctx.strokeStyle = `rgba(45,200,190,${l.alpha})`
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const y = height / 2 + Math.sin((x / width) * Math.PI * l.freq + t * l.speed) * l.amp
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useCanvasAnimation({
  getFrequencyData,
  getTimeDomainData,
  getBassEnergy,
  isPlaying,
  mode,
}: UseCanvasAnimationProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const modeRef      = useRef<VisualMode>(mode)
  const isPlayingRef = useRef(isPlaying)
  const avgVolumeRef = useRef(0)

  useEffect(() => { modeRef.current = mode },           [mode])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // ⚠️ Use CSS pixel dimensions, NOT canvas.width/height (which are physical
    // pixels = CSS × devicePixelRatio). After ctx.scale(dpr,dpr) the drawing
    // coordinate space is in CSS pixels, so we must divide back.
    const dpr    = window.devicePixelRatio || 1
    const width  = canvas.width  / dpr
    const height = canvas.height / dpr
    const t      = performance.now()
    const m      = modeRef.current

    const fade = (m === "pulse" || m === "particles") ? 0.12 : 0.18
    ctx.fillStyle = `rgba(13,15,25,${fade})`
    ctx.fillRect(0, 0, width, height)

    if (!isPlayingRef.current) {
      if (m === "particles") {
        drawParticles(ctx, width, height, null, 0, 0, true)
      } else {
        drawIdle(ctx, width, height, t)
      }
    } else {
      const freqData = getFrequencyData()
      const timeData = getTimeDomainData()
      const bass     = getBassEnergy()

      if (freqData) {
        const raw = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255
        avgVolumeRef.current = avgVolumeRef.current * 0.85 + raw * 0.15
      }
      const avg = avgVolumeRef.current

      if (m === "bars" && freqData) {
        drawBars(ctx, width, height, freqData)
      } else if (m === "wave" && timeData) {
        drawWave(ctx, width, height, timeData)
      } else if (m === "hybrid" && freqData && timeData) {
        // Particles as a subtle background layer, then bars + wave on top
        drawParticles(ctx, width, height, freqData, avg, bass, false, true)
        drawBars(ctx, width, height, freqData)
        drawWave(ctx, width, height, timeData)
      } else if (m === "pulse") {
        drawPulse(ctx, width, height, bass, avg, t)
      } else if (m === "particles") {
        drawParticles(ctx, width, height, freqData, avg, bass, false, false)
      }
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [getFrequencyData, getTimeDomainData, getBassEnergy])

  const startAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  const stopAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr  = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext("2d")
    if (ctx) ctx.scale(dpr, dpr)
  }, [])

  return { canvasRef, startAnimation, stopAnimation, resizeCanvas }
}
