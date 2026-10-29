/**
 * Stage background visuals.
 *
 * Each style draws a single frame onto the shared visualizer canvas. The
 * canvas sits behind the lyrics, so every renderer keeps its colours and
 * opacity restrained; only the opt-in Hot Pink style carries saturated colour.
 */

export const DEFAULT_VISUAL_STYLE = 'classic'

export const VISUAL_STYLES = Object.freeze([
  { id: 'classic', label: 'Classic' },
  { id: 'hot-pink', label: 'Hot Pink' },
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'starfield', label: 'Starfield' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'off', label: 'Off' },
])

/**
 * Cool, low-alpha colours for the default spectrum. The spectrum sits behind
 * the lyrics, so it must stay dark and desaturated rather than becoming a
 * bright background of its own.
 */
export const VISUALIZER_COLORS = Object.freeze({
  barGradient: [
    'rgba(124, 154, 189, 0.38)',
    'rgba(84, 112, 148, 0.32)',
    'rgba(61, 84, 116, 0.38)',
  ],
  glow: [86, 120, 160],
  glowAlpha: 0.08,
  reflectionAlpha: 0.18,
})

const HOT_PINK_COLORS = Object.freeze({
  barGradient: [
    'rgba(255, 62, 165, 0.30)',
    'rgba(196, 58, 140, 0.26)',
    'rgba(128, 42, 105, 0.34)',
  ],
  glow: [190, 62, 130],
  glowAlpha: 0.06,
  reflectionAlpha: 0.12,
})

const STYLE_IDS = new Set(VISUAL_STYLES.map(style => style.id))
const EMPTY_SAMPLES = new Uint8Array(0)
const STAR_COUNT = 90

export function isVisualStyle (value) {
  return STYLE_IDS.has(value)
}

export function normalizeVisualStyle (value) {
  return isVisualStyle(value) ? value : DEFAULT_VISUAL_STYLE
}

/**
 * Resolve the selected visual from saved preferences, honouring the older
 * boolean `visualizer` setting for users who saved preferences before styles
 * existed.
 */
export function resolveSavedVisualStyle (savedStyle, legacyVisualizer) {
  if (isVisualStyle(savedStyle)) return savedStyle
  return legacyVisualizer === false ? 'off' : DEFAULT_VISUAL_STYLE
}

export function visualStyleUsesTimeDomain (style) {
  return normalizeVisualStyle(style) === 'waveform'
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function sensitivityFactor (sensitivity) {
  return Number.isFinite(sensitivity) ? clamp(sensitivity, 0, 2) : 1
}

function bandLevel (frequencyData, from, to) {
  const length = frequencyData?.length ?? 0
  if (!length) return 0

  const start = clamp(Math.floor(from * length), 0, length - 1)
  const end = clamp(Math.ceil(to * length), start + 1, length)
  let total = 0
  for (let i = start; i < end; i++) total += frequencyData[i]
  return total / ((end - start) * 255)
}

function overallLevel (frequencyData) {
  return bandLevel(frequencyData, 0, 1)
}

function drawMirroredBars (ctx, frame, palette) {
  const { width, height, dpr, frequencyData, sensitivity } = frame
  const bars = 40
  const gap = 3 * dpr
  const barWidth = (width - gap * (bars - 1)) / bars
  const baseline = height * 0.42
  const maxHeight = height * 0.5

  const [topColor, midColor, baseColor] = palette.barGradient
  const gradient = ctx.createLinearGradient(0, baseline - maxHeight, 0, baseline)
  gradient.addColorStop(0, topColor)
  gradient.addColorStop(0.55, midColor)
  gradient.addColorStop(1, baseColor)
  ctx.fillStyle = gradient

  for (let i = 0; i < bars; i++) {
    const sample = Math.floor((i / bars) * (frequencyData.length * 0.7))
    const value = (frequencyData[sample] ?? 0) / 255
    const barHeight = Math.max(2 * dpr, value * maxHeight * sensitivity)
    const x = i * (barWidth + gap)
    ctx.fillRect(x, baseline - barHeight / 2, barWidth, barHeight)

    ctx.globalAlpha = palette.reflectionAlpha
    ctx.fillRect(x, baseline + barHeight / 2, barWidth, barHeight * 0.35)
    ctx.globalAlpha = 1
  }

  // Soft glow that responds to overall level.
  let total = 0
  for (let i = 0; i < 32; i++) total += frequencyData[i] ?? 0
  const glow = Math.min(1, (total / (32 * 255)) * sensitivity)
  const radial = ctx.createRadialGradient(
    width / 2, height * 0.75, 0,
    width / 2, height * 0.75, width * 0.55,
  )
  radial.addColorStop(0, `rgba(${palette.glow.join(', ')}, ${palette.glowAlpha * glow})`)
  radial.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = radial
  ctx.fillRect(0, 0, width, height)
}

function drawClassic (ctx, frame) {
  drawMirroredBars(ctx, frame, VISUALIZER_COLORS)
}

function drawHotPink (ctx, frame) {
  drawMirroredBars(ctx, frame, HOT_PINK_COLORS)
}

function drawSpectrum (ctx, frame) {
  const { width, height, dpr, frequencyData, sensitivity } = frame
  const bars = 56
  const gap = 2 * dpr
  const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars)
  const maxHeight = height * 0.5
  const baseline = height * 0.94

  const gradient = ctx.createLinearGradient(0, baseline - maxHeight, 0, baseline)
  gradient.addColorStop(0, 'rgba(112, 150, 186, 0.28)')
  gradient.addColorStop(1, 'rgba(46, 70, 100, 0.42)')
  ctx.fillStyle = gradient

  const factor = sensitivityFactor(sensitivity)
  for (let i = 0; i < bars; i++) {
    const sample = Math.floor((i / bars) * (frequencyData.length * 0.75))
    const value = (frequencyData[sample] ?? 0) / 255
    const barHeight = Math.max(1.5 * dpr, value * maxHeight * factor)
    ctx.fillRect(i * (barWidth + gap), baseline - barHeight, barWidth, barHeight)
  }

  ctx.fillStyle = 'rgba(120, 152, 184, 0.10)'
  ctx.fillRect(0, baseline, width, Math.max(1, dpr))
}

function drawWaveform (ctx, frame) {
  const { width, height, dpr, timeData, sensitivity } = frame
  if (!timeData?.length) return

  const points = 160
  const center = height * 0.6
  const amplitude = height * 0.18 * Math.max(0.35, sensitivityFactor(sensitivity))

  ctx.beginPath()
  for (let i = 0; i < points; i++) {
    const sample = timeData[Math.floor((i / points) * timeData.length)] ?? 128
    const x = (i / (points - 1)) * width
    const y = center + ((sample - 128) / 128) * amplitude
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(84, 116, 152, 0.16)'
  ctx.lineWidth = Math.max(1, 5 * dpr)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(136, 170, 202, 0.40)'
  ctx.lineWidth = Math.max(1, 1.5 * dpr)
  ctx.stroke()
}

function drawAurora (ctx, frame) {
  const { width, height, frequencyData, sensitivity, now } = frame
  const time = now / 1000
  const factor = sensitivityFactor(sensitivity)
  const bands = [
    {
      color: [58, 132, 182],
      level: bandLevel(frequencyData, 0, 0.16),
      x: 0.28 + Math.sin(time * 0.13) * 0.09,
      y: 0.72 + Math.cos(time * 0.11) * 0.06,
      size: 0.5,
    },
    {
      color: [40, 142, 132],
      level: bandLevel(frequencyData, 0.16, 0.45),
      x: 0.68 + Math.cos(time * 0.1) * 0.08,
      y: 0.62 + Math.sin(time * 0.14) * 0.05,
      size: 0.46,
    },
    {
      color: [112, 88, 166],
      level: bandLevel(frequencyData, 0.45, 0.8),
      x: 0.5 + Math.sin(time * 0.07 + 1.7) * 0.12,
      y: 0.78 + Math.cos(time * 0.09) * 0.04,
      size: 0.54,
    },
  ]

  for (const band of bands) {
    const radius = width * (band.size + band.level * 0.12 * factor)
    const alpha = 0.16 + band.level * 0.22 * factor
    const x = band.x * width
    const y = band.y * height
    const radial = ctx.createRadialGradient(x, y, 0, x, y, radius)
    radial.addColorStop(0, `rgba(${band.color.join(', ')}, ${alpha})`)
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = radial
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
}

function drawPulse (ctx, frame) {
  const { width, height, dpr, frequencyData, sensitivity, now } = frame
  const factor = sensitivityFactor(sensitivity)
  const bass = Math.min(1, bandLevel(frequencyData, 0, 0.12) * 1.5 * factor)
  const time = now / 1000
  const cx = width / 2
  const cy = height * 0.58
  const maxRadius = Math.min(width, height) * 0.48

  const glowRadius = maxRadius * 0.6
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
  glow.addColorStop(0, `rgba(96, 136, 178, ${0.06 + 0.1 * bass})`)
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(cx - glowRadius, cy - glowRadius, glowRadius * 2, glowRadius * 2)

  ctx.lineWidth = Math.max(1, 1.4 * dpr)
  for (let i = 0; i < 3; i++) {
    const phase = (time * (0.1 + 0.16 * bass) + i / 3) % 1
    const radius = maxRadius * (0.2 + phase * 0.8)
    const alpha = (1 - phase) * (0.12 + 0.26 * bass)
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(112, 150, 190, ${alpha})`
    ctx.stroke()
  }
}

function ensureStars (state) {
  if (!state.stars) {
    state.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      depth: 0.25 + Math.random() * 0.75,
      alpha: 0.2 + Math.random() * 0.5,
      drift: 0.04 + Math.random() * 0.06,
      phase: Math.random() * Math.PI * 2,
    }))
  }
  return state.stars
}

function drawStarfield (ctx, frame) {
  const { width, height, dpr, frequencyData, sensitivity, now, state } = frame
  const stars = ensureStars(state)
  const level = overallLevel(frequencyData)
  const factor = sensitivityFactor(sensitivity)
  const last = Number.isFinite(state.lastNow) ? state.lastNow : now
  const delta = Math.min(0.05, Math.max(0, (now - last) / 1000))
  state.lastNow = now

  const speed = 0.15 + level * 0.9 * factor
  for (const star of stars) {
    star.y = (star.y + star.drift * star.depth * speed * delta) % 1
    const x = (star.x + Math.sin(now / 6000 + star.phase) * 0.002) * width
    const size = Math.max(1, (0.7 + star.depth * 1.5) * dpr * (1 + level * factor * 0.5))
    const alpha = clamp(star.alpha * (0.18 + level * 0.7 * factor + 0.1), 0, 0.5)
    ctx.fillStyle = `rgba(158, 184, 212, ${alpha})`
    ctx.fillRect(x, star.y * height, size, size)
  }
}

function drawMinimal (ctx, frame) {
  const { width, height, dpr, frequencyData, sensitivity, now } = frame
  const factor = sensitivityFactor(sensitivity)
  const level = overallLevel(frequencyData)
  const bass = bandLevel(frequencyData, 0, 0.1)
  const cx = width / 2
  const radius = width * (0.34 + 0.06 * level * factor)
  const cy = height * (0.94 + Math.sin(now / 5000) * 0.01)

  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  radial.addColorStop(0, `rgba(74, 110, 148, ${0.07 + level * 0.1 * factor})`)
  radial.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = radial
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)

  const lineWidth = width * (0.12 + bass * 0.25 * factor)
  ctx.fillStyle = `rgba(118, 148, 182, ${0.14 + bass * 0.14 * factor})`
  ctx.fillRect(cx - lineWidth / 2, height * 0.94, lineWidth, Math.max(1, 2 * dpr))
}

const RENDERERS = {
  'classic': drawClassic,
  'hot-pink': drawHotPink,
  'spectrum': drawSpectrum,
  'waveform': drawWaveform,
  'aurora': drawAurora,
  'pulse': drawPulse,
  'starfield': drawStarfield,
  'minimal': drawMinimal,
}

export function drawVisualizerFrame (ctx, {
  style = DEFAULT_VISUAL_STYLE,
  width = 0,
  height = 0,
  dpr = 1,
  frequencyData = EMPTY_SAMPLES,
  timeData = EMPTY_SAMPLES,
  sensitivity = 1,
  now = 0,
  state = {},
} = {}) {
  const id = normalizeVisualStyle(style)
  if (id === 'off' || !ctx || !(width > 0) || !(height > 0)) return

  const renderer = RENDERERS[id] ?? RENDERERS[DEFAULT_VISUAL_STYLE]
  renderer(ctx, {
    width,
    height,
    dpr: Number.isFinite(dpr) ? dpr : 1,
    frequencyData: frequencyData ?? EMPTY_SAMPLES,
    timeData: timeData ?? EMPTY_SAMPLES,
    sensitivity: Number.isFinite(sensitivity) ? sensitivity : 1,
    now: Number.isFinite(now) ? now : 0,
    state,
  })
}
