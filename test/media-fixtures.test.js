import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import CDGDecoder from '../js/cdg.js'
import { buildLibrary } from '../js/library.js'
import { parseLrc } from '../js/lrc.js'
import { readZipDirectory, readZipEntry } from '../js/zip.js'

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor (width, height) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(width * height * 4)
    }
  }
}

const MEDIA_DIR = fileURLToPath(new URL('./fixtures/media/', import.meta.url))
const MANIFEST = JSON.parse(await readFile(join(MEDIA_DIR, 'fixtures.json'), 'utf8'))
const SAMPLE_DELAY = 0.6

function sha256 (bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function asArrayBuffer (bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function opaqueCount (imageData) {
  let count = 0
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] > 0) count++
  }
  return count
}

function frameHash (imageData) {
  return sha256(imageData.data)
}

/**
 * Walk the MPEG-1 Layer III frames in one of the fixture excerpts. The cut is
 * made on frame boundaries, so every byte after the first header must parse.
 */
function mp3Frames (bytes) {
  const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  const sampleRates = [44100, 48000, 32000]
  const frames = []
  let offset = 0
  let duration = 0

  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff, `missing MP3 frame sync at byte ${offset}`)
    assert.equal(bytes[offset + 1] & 0xe0, 0xe0, `invalid MP3 frame at byte ${offset}`)
    assert.equal((bytes[offset + 1] >> 3) & 3, 3, 'fixture is not MPEG-1')
    assert.equal((bytes[offset + 1] >> 1) & 3, 1, 'fixture is not Layer III')

    const bitrate = bitrates[(bytes[offset + 2] >> 4) & 15]
    const sampleRate = sampleRates[(bytes[offset + 2] >> 2) & 3]
    const padding = (bytes[offset + 2] >> 1) & 1
    const length = Math.floor(144000 * bitrate / sampleRate) + padding

    assert.ok(bitrate > 0 && sampleRate > 0)
    assert.ok(length > 4 && offset + length <= bytes.length)

    frames.push({ offset, length })
    duration += 1152 / sampleRate
    offset += length
  }

  return { frames, duration }
}

function recordsFor (fileNames, bytesByName) {
  return fileNames.map(name => ({
    file: new File([bytesByName.get(name)], name),
    path: name,
  }))
}

async function loadFixtureAssets (fixture) {
  if (fixture.zip) {
    const zipBytes = await readFile(join(MEDIA_DIR, fixture.zip.file))
    const zip = new Blob([zipBytes])
    const directory = await readZipDirectory(zip)
    const entries = await Promise.all(directory.entries.map(async entry => [
      entry.name,
      await readZipEntry(zip, entry),
    ]))
    return new Map(entries)
  }

  const names = [fixture.mp3.file, fixture.cdg.file, fixture.lrc.file]
  const entries = await Promise.all(names.map(async name => [name, await readFile(join(MEDIA_DIR, name))]))
  return new Map(entries)
}

function renderFixtureLines (cdgBytes, fixture) {
  const decoder = new CDGDecoder(asArrayBuffer(cdgBytes))
  const hashes = new Set()
  const counts = []

  for (const line of fixture.lines) {
    const frame = decoder.render(line.at + SAMPLE_DELAY)
    hashes.add(frameHash(frame.imageData))
    counts.push(opaqueCount(frame.imageData))
  }

  return { decoder, hashes, counts }
}

test('real MP3+G fixtures contain valid MP3 frames and changing CD+G lyrics', async () => {
  assert.ok(MANIFEST.fixtures.length >= 2)

  for (const fixture of MANIFEST.fixtures) {
    const assets = await loadFixtureAssets(fixture)
    const mp3 = assets.get(fixture.mp3.file)
    const cdg = assets.get(fixture.cdg.file)

    assert.equal(sha256(mp3), fixture.mp3.sha256, fixture.mp3.file)
    assert.equal(sha256(cdg), fixture.cdg.sha256, fixture.cdg.file)
    assert.equal(cdg.length % 24, 0)
    assert.ok(cdg.length >= fixture.durationSeconds * 300 * 24)
    assert.ok(cdg.length <= (fixture.durationSeconds + 2) * 300 * 24)

    const { frames, duration } = mp3Frames(mp3)
    assert.ok(frames.length > 500)
    assert.ok(Math.abs(duration - fixture.durationSeconds) < 0.05)

    // The source masters are VBR, so each cut carries a rewritten Xing header.
    // Without it Chromium estimates the duration from the first frame's bitrate.
    assert.equal(new TextDecoder().decode(mp3.subarray(36, 40)), 'Xing')
    const xing = new DataView(mp3.buffer, mp3.byteOffset, mp3.byteLength)
    assert.equal(xing.getUint32(40), 0x03)
    assert.equal(xing.getUint32(44), frames.length)
    assert.equal(xing.getUint32(48), mp3.length)

    const { decoder, hashes, counts } = renderFixtureLines(cdg, fixture)
    assert.ok(counts.every(count => count > 1500), fixture.name)
    assert.ok(hashes.size >= Math.min(4, fixture.lines.length), fixture.name)

    // A backwards seek restarts the stream and reproduces the first line.
    const first = decoder.render(fixture.lines[0].at + SAMPLE_DELAY)
    assert.equal(opaqueCount(first.imageData), counts[0])
  }
})

test('buildLibrary pairs the real folder fixture and prefers CD+G over LRC', async () => {
  const fixture = MANIFEST.fixtures.find(entry => !entry.zip)
  const bytes = await loadFixtureAssets(fixture)
  const { tracks, warnings } = await buildLibrary(
    recordsFor([...bytes.keys()], bytes),
  )

  assert.deepEqual(warnings, [])
  assert.equal(tracks.length, 1)

  const [track] = tracks
  assert.equal(track.kind, 'cdg')
  assert.equal(track.artist, fixture.artist)
  assert.equal(track.title, fixture.title)
  assert.equal(track.lrcFile, null)
  assert.ok(track.cdgFile instanceof File)
  assert.equal(track.size, bytes.get(fixture.mp3.file).length + bytes.get(fixture.cdg.file).length)
})

test('buildLibrary reads the real zipped MP3+G fixture', async () => {
  const fixture = MANIFEST.fixtures.find(entry => entry.zip)
  const zipBytes = await readFile(join(MEDIA_DIR, fixture.zip.file))
  const zip = new Blob([zipBytes])

  assert.equal(sha256(zipBytes), fixture.zip.sha256)
  const directory = await readZipDirectory(zip)
  assert.deepEqual(directory.entries.map(entry => entry.name), fixture.zip.entries)

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zipBytes], fixture.zip.file), path: fixture.zip.file },
  ])

  assert.deepEqual(warnings, [])
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'zip')
  assert.equal(tracks[0].artist, fixture.artist)
  assert.equal(tracks[0].title, fixture.title)

  const audioEntry = directory.entries.find(entry => entry.name === fixture.mp3.file)
  const cdgEntry = directory.entries.find(entry => entry.name === fixture.cdg.file)
  const lrcEntry = directory.entries.find(entry => entry.name === fixture.lrc.file)
  assert.ok(audioEntry && cdgEntry && lrcEntry)

  const audio = await readZipEntry(zip, audioEntry)
  const cdg = await readZipEntry(zip, cdgEntry)
  assert.ok(mp3Frames(audio).frames.length > 500)
  assert.ok(renderFixtureLines(cdg, fixture).counts.every(count => count > 1500))
})

test('excerpt LRC files match the timings recorded in the fixture manifest', async () => {
  for (const fixture of MANIFEST.fixtures) {
    const assets = await loadFixtureAssets(fixture)
    const lrc = parseLrc(new TextDecoder().decode(assets.get(fixture.lrc.file)))
    assert.equal(lrc.meta.ar, fixture.artist)
    assert.equal(lrc.meta.ti, fixture.title)
    assert.deepEqual(
      lrc.lines.map(line => ({ text: line.text, at: Math.round(line.time * 1000) / 1000 })),
      fixture.lines,
    )
  }
})
