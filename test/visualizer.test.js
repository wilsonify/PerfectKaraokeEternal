import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_VISUAL_STYLE,
  drawVisualizerFrame,
  normalizeVisualStyle,
  resolveSavedVisualStyle,
  VISUAL_STYLES,
  VISUALIZER_COLORS,
} from '../js/visualizer.js'

const RGBA = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/
const REQUIRED_STYLES = [
  'hot-pink',
  'spectrum',
  'waveform',
  'aurora',
  'pulse',
  'starfield',
  'minimal',
  'off',
]
const LOUD = Uint8Array.from({ length: 128 }, (_, index) => 80 + (index % 40) * 4)
const SILENT = new Uint8Array(128)
const FLAT_WAVE = Uint8Array.from({ length: 256 }, () => 128)
const MOVING_WAVE = Uint8Array.from(
  { length: 256 },
  (_, index) => 128 + Math.round(Math.sin(index / 7) * 70),
)
const STARS = [{
  x: 0.5,
  y: 0.5,
  depth: 0.5,
  alpha: 0.4,
  drift: 0.05,
  phase: 0,
}]

function parseColor (value) {
  const match = RGBA.exec(value)
  assert.ok(match, `unexpected visualizer colour: ${value}`)
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    alpha: Number(match[4]),
  }
}

/** A 2D context stand-in that records every call, including gradient stops. */
function createRecordingContext () {
  const calls = []
  const gradient = () => ({
    addColorStop (offset, color) {
      calls.push(['addColorStop', offset, color])
    },
  })

  const base = {
    calls,
    createLinearGradient (...args) {
      calls.push(['createLinearGradient', ...args])
      return gradient()
    },
    createRadialGradient (...args) {
      calls.push(['createRadialGradient', ...args])
      return gradient()
    },
  }

  return new Proxy(base, {
    get (target, property) {
      if (Reflect.has(target, property)) return target[property]
      if (typeof property === 'symbol') return undefined
      return (...args) => calls.push([property, ...args])
    },
    set (target, property, value) {
      target[property] = value
      return true
    },
  })
}

function render (style, { frequencyData = SILENT, timeData = FLAT_WAVE } = {}) {
  const ctx = createRecordingContext()
  drawVisualizerFrame(ctx, {
    style,
    width: 320,
    height: 200,
    dpr: 1,
    frequencyData,
    timeData,
    sensitivity: 1,
    now: 5000,
    state: style === 'starfield' ? { stars: STARS.map(star => ({ ...star })) } : {},
  })
  return ctx.calls
}

test('visualizer palette stays dark and cool behind the lyrics', () => {
  assert.equal(VISUALIZER_COLORS.barGradient.length, 3)

  for (const color of VISUALIZER_COLORS.barGradient) {
    const { r, g, b, alpha } = parseColor(color)

    // Cool hues only: blue dominates and red recedes. Hot pink is the inverse.
    assert.ok(b > g && g > r, `${color} is not a cool blue-grey`)
    // Low alpha and brightness keep the spectrum from becoming a background.
    assert.ok(alpha <= 0.4, `${color} is too opaque`)
    assert.ok(r < 140, `${color} is too bright`)
  }

  const [glowR, glowG, glowB] = VISUALIZER_COLORS.glow
  assert.ok(glowB > glowG && glowG > glowR, 'the glow is not a cool blue')
  assert.ok(VISUALIZER_COLORS.glowAlpha <= 0.1, 'the glow is too strong')
  assert.ok(VISUALIZER_COLORS.reflectionAlpha <= 0.2, 'the reflection is too strong')
})

test('every requested background style is available and classic stays first', () => {
  const ids = VISUAL_STYLES.map(style => style.id)

  assert.equal(ids[0], DEFAULT_VISUAL_STYLE)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of REQUIRED_STYLES) {
    assert.ok(ids.includes(id), `missing visual style: ${id}`)
  }
  for (const style of VISUAL_STYLES) {
    assert.ok(style.label.length > 0, `${style.id} has no label`)
  }
})

test('style selection normalizes unknown values and migrates legacy preferences', () => {
  assert.equal(normalizeVisualStyle('waveform'), 'waveform')
  assert.equal(normalizeVisualStyle('off'), 'off')
  assert.equal(normalizeVisualStyle('nonsense'), DEFAULT_VISUAL_STYLE)
  assert.equal(normalizeVisualStyle(undefined), DEFAULT_VISUAL_STYLE)

  // No saved choice at all: the existing visualizer remains the default.
  assert.equal(resolveSavedVisualStyle(undefined, undefined), DEFAULT_VISUAL_STYLE)
  assert.equal(resolveSavedVisualStyle(undefined, true), DEFAULT_VISUAL_STYLE)
  // The old boolean checkbox is the only saved preference.
  assert.equal(resolveSavedVisualStyle(undefined, false), 'off')
  // A saved style wins over the legacy flag; invalid styles fall back to it.
  assert.equal(resolveSavedVisualStyle('aurora', false), 'aurora')
  assert.equal(resolveSavedVisualStyle('nonsense', false), 'off')
  assert.equal(resolveSavedVisualStyle('off', true), 'off')
})

test('every background style renders, and Off draws nothing', () => {
  for (const style of VISUAL_STYLES) {
    const calls = render(style.id, { frequencyData: LOUD, timeData: MOVING_WAVE })
    if (style.id === 'off') {
      assert.equal(calls.length, 0, 'Off drew something')
    } else {
      assert.ok(calls.length > 0, `${style.id} drew nothing`)
    }
  }
})

test('background styles do not throw without audio analysis data', () => {
  for (const style of VISUAL_STYLES) {
    assert.doesNotThrow(() => {
      drawVisualizerFrame(createRecordingContext(), {
        style: style.id,
        width: 320,
        height: 200,
      })
    }, `${style.id} threw without analyser data`)
  }
})

test('audio-reactive styles change their output with the audio signal', () => {
  for (const style of VISUAL_STYLES) {
    if (style.id === 'off') continue
    const quiet = render(style.id)
    const loud = render(style.id, { frequencyData: LOUD, timeData: MOVING_WAVE })
    assert.notDeepEqual(quiet, loud, `${style.id} ignored the audio data`)
  }
})
