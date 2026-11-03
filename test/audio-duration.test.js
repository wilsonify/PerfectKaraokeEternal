import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateAudioDuration, estimateMp3Duration } from '../js/audio-duration.js'

/** A minimal MPEG-1 Layer III header: 128 kbps, 44.1 kHz, stereo. */
function mp3File ({ frames = null, size = 10000, id3 = false } = {}) {
  const start = id3 ? 20 : 0
  const bytes = new Uint8Array(start + size)

  if (id3) {
    bytes.set([0x49, 0x44, 0x33, 0x04, 0x00, 0x00], 0) // "ID3" v2.4
    // Synchsafe size of 10 bytes of tag content.
    bytes.set([0x00, 0x00, 0x00, 0x0a], 6)
  }

  bytes[start] = 0xff
  bytes[start + 1] = 0xfb
  bytes[start + 2] = 0x90
  bytes[start + 3] = 0x00

  if (frames !== null) {
    const offset = start + 4 + 32 // side info for stereo MPEG-1
    bytes.set([0x58, 0x69, 0x6e, 0x67], offset) // "Xing"
    const view = new DataView(bytes.buffer)
    view.setUint32(offset + 4, 1) // flags: frame count present
    view.setUint32(offset + 8, frames)
  }

  return new File([bytes], 'song.mp3')
}

test('estimateMp3Duration reads an exact frame count from a Xing header', async () => {
  const result = await estimateMp3Duration(mp3File({ frames: 1000 }))
  assert.ok(result)
  assert.equal(result.estimated, false)
  assert.ok(Math.abs(result.seconds - (1000 * 1152) / 44100) < 0.01)
})

test('estimateMp3Duration falls back to a constant-bitrate estimate', async () => {
  const result = await estimateMp3Duration(mp3File({ size: 128000 }))
  assert.ok(result)
  assert.equal(result.estimated, true)
  // 128 KB at 128 kbps is eight seconds.
  assert.ok(Math.abs(result.seconds - 8) < 0.01)
})

test('estimateMp3Duration skips an ID3v2 tag before the first frame', async () => {
  const result = await estimateMp3Duration(mp3File({ frames: 500, size: 4000, id3: true }))
  assert.ok(result)
  assert.ok(Math.abs(result.seconds - (500 * 1152) / 44100) < 0.01)
})

test('estimateMp3Duration rejects empty and non-MP3 data', async () => {
  assert.equal(await estimateMp3Duration(new File([], 'empty.mp3')), null)
  assert.equal(await estimateMp3Duration(new File([new Uint8Array(2048)], 'noise.mp3')), null)
})

test('estimateAudioDuration only handles MP3 files', async () => {
  const result = await estimateAudioDuration(mp3File({ frames: 10 }))
  assert.ok(result)

  assert.equal(await estimateAudioDuration(
    new File([new Uint8Array(10)], 'song.ogg'),
  ), null)
})
