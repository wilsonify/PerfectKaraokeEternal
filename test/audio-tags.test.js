import assert from 'node:assert/strict'
import test from 'node:test'
import { parseReplayGain, replayGainFactor } from '../js/audio-tags.js'

const encoder = new TextEncoder()

function concat (parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function synchsafe (value) {
  return [(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f]
}

function bigEndian (value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function txxxFrame (description, value) {
  return Uint8Array.from([3, ...encoder.encode(description), 0, ...encoder.encode(value)])
}

/** Build a minimal ID3v2 tag containing TXXX frames. */
function buildTag (version, fields) {
  const frames = fields.map(([description, value]) => {
    const data = txxxFrame(description, value)
    const size = version === 4 ? synchsafe(data.length) : bigEndian(data.length)
    return concat([encoder.encode('TXXX'), Uint8Array.from(size), Uint8Array.from([0, 0]), data])
  })
  const body = concat(frames)
  const header = Uint8Array.from([0x49, 0x44, 0x33, version, 0, 0, ...synchsafe(body.length)])
  return concat([header, body])
}

test('parseReplayGain reads ID3v2.4 TXXX fields', () => {
  const tag = buildTag(4, [
    ['replaygain_track_gain', '-3.50 dB'],
    ['replaygain_track_peak', '0.988'],
  ])

  assert.deepEqual(parseReplayGain(tag), { gainDb: -3.5, peak: 0.988 })
  assert.deepEqual(parseReplayGain(tag.buffer), { gainDb: -3.5, peak: 0.988 })
})

test('parseReplayGain reads ID3v2.3 frames with plain sizes', () => {
  const tag = buildTag(3, [
    ['replaygain_track_gain', '+1.25 dB'],
    ['replaygain_track_peak', '1.5'],
  ])

  assert.deepEqual(parseReplayGain(tag), { gainDb: 1.25, peak: 1.5 })
})

test('parseReplayGain tolerates a missing peak and rejects other data', () => {
  const tag = buildTag(4, [['replaygain_track_gain', '-6.20 dB']])
  assert.deepEqual(parseReplayGain(tag), { gainDb: -6.2, peak: null })

  const other = buildTag(4, [['title', 'Some Song']])
  assert.equal(parseReplayGain(other), null)

  assert.equal(parseReplayGain(new Uint8Array(0)), null)
  assert.equal(parseReplayGain(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), null)

  const broken = buildTag(4, [['replaygain_track_gain', 'not a number']])
  assert.equal(parseReplayGain(broken), null)
})

test('replayGainFactor converts dB to a linear factor', () => {
  assert.ok(Math.abs(replayGainFactor(-6, null) - 0.501187) < 1e-6)
  assert.equal(replayGainFactor(Number.NaN, null), 1)
})

test('replayGainFactor stays clip-safe when gain plus peak exceeds 0 dB', () => {
  const raw = replayGainFactor(3, null)
  const safe = replayGainFactor(3, 0.9)

  assert.ok(raw > safe)
  // peak 0.9 ≈ -0.915 dB, so the safe gain is -0.01 - (-0.915) ≈ 0.905 dB
  assert.ok(Math.abs(safe - 1.1098) < 0.001)
  assert.ok(safe < 1.12)
})
