import assert from 'node:assert/strict'
import test from 'node:test'
import CDGDecoder from '../js/cdg.js'

// The decoder targets browsers; provide the single DOM API it constructs.
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor (width, height) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
}

const WIDTH = 300
const HEIGHT = 216
const TILE_WIDTH = 6
const TILE_ROWS = [0b111111, 0b111111, 0b111111, 0b111111, 0b111111, 0b111111,
  0b111111, 0b111111, 0b111111, 0b111111, 0b111111, 0b111111]

function packet (instruction, data = []) {
  const bytes = new Uint8Array(24)
  bytes[0] = 0x09
  bytes[1] = instruction
  bytes.set(data.slice(0, 20), 4)
  return bytes
}

function clutLow (colors) {
  const data = new Uint8Array(16)
  colors.forEach(([r, g, b], index) => {
    const value = (r << 8) | (g << 4) | b
    data[index * 2] = (value >> 6) & 0x3f
    data[index * 2 + 1] = value & 0x3f
  })
  return packet(30, data)
}

function tile (row, column, color0, color1, rows = TILE_ROWS) {
  return packet(6, [color0, color1, row, column, ...rows])
}

function padTo (packets, count) {
  while (packets.length < count) packets.push(new Uint8Array(24))
}

/** A three-second CD+G stream: colour band, recolour, then border + pattern. */
function buildCdg () {
  const packets = [
    packet(1, [0]), // memory preset: colour 0
    packet(28, [0]), // colour 0 is transparent
    clutLow([
      [0, 0, 0], [15, 15, 15], [15, 0, 0], [0, 15, 15],
      [0, 0, 15], [15, 15, 0], [15, 0, 15], [0, 15, 0],
    ]),
  ]

  for (let column = 0; column < WIDTH / TILE_WIDTH; column++) {
    packets.push(tile(8, column, 1, 1), tile(9, column, 1, 1))
  }
  padTo(packets, 300)

  for (let column = 20; column < 30; column++) {
    packets.push(tile(8, column, 2, 2), tile(9, column, 2, 2))
  }
  padTo(packets, 600)

  packets.push(packet(2, [3])) // border preset: colour 3
  for (let column = 0; column < WIDTH / TILE_WIDTH; column++) {
    packets.push(tile(10, column, 4, 5, Array(12).fill(0b010101)))
  }
  padTo(packets, 900)

  const bytes = new Uint8Array(packets.length * 24)
  packets.forEach((part, index) => bytes.set(part, index * 24))
  return bytes.buffer
}

const buffer = buildCdg()

/**
 * A stream whose background colour (0) is not the transparent key (1). The
 * player always asks for the background to be keyed, otherwise the opaque CDG
 * canvas would cover the visualizer behind it.
 */
function buildKeyedBackgroundCdg () {
  const packets = [
    packet(1, [0]), // memory preset: background colour 0
    packet(28, [1]), // colour 1 is transparent; colour 0 is not
    clutLow([
      [15, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
      [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
    ]),
  ]
  padTo(packets, 300)

  const bytes = new Uint8Array(packets.length * 24)
  packets.forEach((part, index) => bytes.set(part, index * 24))
  return bytes.buffer
}

/**
 * A stream whose lyric area grows over time: one short line, then a second
 * line below it, then a wide line above both. This mirrors the frame-by-frame
 * bounds the player uses to position the CD+G backdrop (issue #55).
 */
function buildGrowingCdg () {
  const packets = [
    packet(1, [0]), // memory preset: colour 0
    packet(28, [0]), // colour 0 is the transparent key
    clutLow([
      [0, 0, 0], [15, 15, 15], [15, 0, 0], [0, 15, 15],
      [0, 0, 15], [15, 15, 0], [15, 0, 15], [0, 15, 0],
    ]),
  ]

  for (let column = 10; column < 15; column++) packets.push(tile(8, column, 1, 1))
  padTo(packets, 300)

  for (let column = 5; column < 25; column++) packets.push(tile(14, column, 1, 1))
  padTo(packets, 600)

  for (let column = 2; column < 31; column++) packets.push(tile(4, column, 1, 1))
  padTo(packets, 900)

  const bytes = new Uint8Array(packets.length * 24)
  packets.forEach((part, index) => bytes.set(part, index * 24))
  return bytes.buffer
}

function opaqueCount (imageData) {
  let count = 0
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] > 0) count++
  }
  return count
}

function pixelAt (imageData, x, y) {
  const offset = (x + y * WIDTH) * 4
  return [...imageData.data.subarray(offset, offset + 4)]
}

test('CDGDecoder renders the frame at a given time', () => {
  const decoder = new CDGDecoder(buffer)
  const frame = decoder.render(0.5)

  assert.equal(frame.isChanged, true)
  assert.equal(frame.imageData.width, WIDTH)
  assert.equal(frame.imageData.height, HEIGHT)

  // Rows 8-9 are one solid band: 50 tiles * 6px * 2 tiles * 12px.
  assert.equal(opaqueCount(frame.imageData), 7200)
  assert.deepEqual(pixelAt(frame.imageData, 10, 100), [255, 255, 255, 255])
  assert.deepEqual(frame.contentBounds, [0, 96, 300, 120])
})

test('CDGDecoder keys out the background for the visualizer when requested', () => {
  const background = buildKeyedBackgroundCdg()
  const normal = new CDGDecoder(background).render(0.5)
  const keyed = new CDGDecoder(background).render(0.5, { forceKey: true })

  // Without keying, the background stays opaque and would hide the visualizer.
  assert.deepEqual(pixelAt(normal.imageData, 10, 100), [255, 0, 0, 255])
  assert.deepEqual(normal.contentBounds, [0, 0, 300, 216])

  // Keying makes it transparent while preserving the colour for the backdrop.
  assert.deepEqual(pixelAt(keyed.imageData, 10, 100), [255, 0, 0, 0])
  assert.deepEqual(keyed.contentBounds, [0, 0, 0, 0])
  assert.deepEqual(keyed.backgroundRGBA, [255, 0, 0, 0])
})

test('CDGDecoder reports no change when time does not advance', () => {
  const decoder = new CDGDecoder(buffer)
  decoder.render(0.5)
  assert.equal(decoder.render(0.5).isChanged, false)
})

test('CDGDecoder applies later packets and border presets', () => {
  const decoder = new CDGDecoder(buffer)
  decoder.render(0.5)
  const frame = decoder.render(2.5)

  assert.equal(frame.isChanged, true)
  assert.ok(opaqueCount(frame.imageData) > 7200)
  // Border colour 3 is (0, 15, 15) * 17.
  assert.deepEqual(pixelAt(frame.imageData, 10, 10), [0, 255, 255, 255])
})

test('CD+G content bounds grow and reset with new lyric graphics (issue #55)', () => {
  const decoder = new CDGDecoder(buildGrowingCdg())

  assert.deepEqual(decoder.render(0.5, { forceKey: true }).contentBounds, [60, 96, 90, 108])
  assert.deepEqual(decoder.render(1.5, { forceKey: true }).contentBounds, [30, 96, 150, 180])
  assert.deepEqual(decoder.render(2.5, { forceKey: true }).contentBounds, [12, 48, 186, 180])

  // Seeking back must shrink the bounds again, so the backdrop cannot stay
  // stuck at the bounds of a larger, later frame (the #55 symptom).
  assert.deepEqual(decoder.render(0.5, { forceKey: true }).contentBounds, [60, 96, 90, 108])
})

test('CDGDecoder restarts cleanly when seeking backwards', () => {
  const decoder = new CDGDecoder(buffer)
  decoder.render(2.5)
  const frame = decoder.render(0.5)

  assert.equal(frame.isChanged, true)
  assert.equal(opaqueCount(frame.imageData), 7200)
  // The border from the later frame is gone after the restart.
  assert.deepEqual(pixelAt(frame.imageData, 10, 10), [0, 0, 0, 0])
  assert.deepEqual(pixelAt(frame.imageData, 10, 100), [255, 255, 255, 255])
})

test('CDGDecoder rejects invalid input', () => {
  assert.throws(() => new CDGDecoder(new Uint8Array(24)), /ArrayBuffer/)
  const decoder = new CDGDecoder(buffer)
  assert.throws(() => decoder.render(-1), /Invalid CDG time/)
  assert.throws(() => decoder.render(Number.NaN), /Invalid CDG time/)
})
