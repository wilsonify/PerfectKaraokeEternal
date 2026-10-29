import assert from 'node:assert/strict'
import test from 'node:test'
import { VISUALIZER_COLORS } from '../js/player.js'

const RGBA = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/

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
