#!/usr/bin/env node
/*
 * Regenerate the MP3+G fixtures in this directory from the band's album.
 *
 *   node test/fixtures/media/generate.js \
 *     --album "C:/path/to/Tom-and-the-Back-Roads/album"
 *
 * The source audio is the karaoke mix, cut at MP3 frame boundaries. The CD+G
 * graphics use line timings from the matching LRC file, so the fixtures stay in
 * sync with the real recordings. Only short excerpts are written.
 *
 * This is a development tool, not part of the app or the test suite.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLrc } from '../../../js/lrc.js'

const WIDTH = 300
const HEIGHT = 216
const TILE_WIDTH = 6
const TILE_HEIGHT = 12
const PACKETS_PER_SECOND = 300
const SAMPLE_WIDTH = 5
const SAMPLE_HEIGHT = 7
const LETTER_SPACING = 1
const LINE_HEIGHT = 20
const RENDER_LEAD_SECONDS = 0.4

const OUT_DIR = dirname(fileURLToPath(import.meta.url))

const SPECS = [
  {
    name: 'Tom and the Back Roads - Breaking the Surface',
    title: 'Breaking the Surface',
    sourceBase: '01 - Between Tides/songs/01-breaking-the-surface/01 - Breaking the Surface',
    audioSuffix: ' - Karaoke',
    start: 42,
    duration: 21,
    zipped: false,
  },
  {
    name: 'Tom and the Back Roads - Wires Crossed',
    title: 'Wires Crossed',
    sourceBase: '01 - Between Tides/songs/02-wires-crossed/02 - Wires Crossed',
    audioSuffix: ' - Karaoke',
    start: 33,
    duration: 20.5,
    zipped: true,
  },
]

/*
 * Compact 5x7 bitmap font. Each glyph is seven rows of five bits. Lowercase
 * lyrics are upper-cased before drawing; that is normal for CD+G graphics.
 */
const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  'J': ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '\'': ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  ';': ['00000', '00100', '00100', '00000', '00100', '00100', '01000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10111', '10000', '01110'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '%': ['11001', '11010', '00100', '00100', '01000', '01011', '10011'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

// Palette entries are 4-bit RGB. 0 is the keyed-out background.
const COLOR = {
  background: 0,
  current: 1,
  accent: 3,
  heading: 4,
}
const PALETTE = [
  [0, 0, 0],
  [15, 15, 15],
  [0, 0, 0],
  [0, 12, 12],
  [13, 13, 13],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

function normalizeText (text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .toUpperCase()
}

function textWidth (text, scale) {
  if (!text.length) return 0
  return (text.length * (SAMPLE_WIDTH + LETTER_SPACING) - LETTER_SPACING) * scale
}

function wrapText (text, maxCharacters, maxRows = 2) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  const rows = []
  let row = ''

  for (const word of words) {
    if (word.length > maxCharacters) {
      if (row) {
        rows.push(row)
        row = ''
      }
      for (let index = 0; index < word.length; index += maxCharacters) {
        rows.push(word.slice(index, index + maxCharacters))
      }
      continue
    }

    const candidate = row ? `${row} ${word}` : word
    if (candidate.length <= maxCharacters) {
      row = candidate
    } else {
      if (row) rows.push(row)
      row = word
    }
  }

  if (row) rows.push(row)
  return rows.slice(0, maxRows)
}

function fillRect (screen, x, y, width, height, color) {
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      if (row >= 0 && row < HEIGHT && column >= 0 && column < WIDTH) {
        screen[row * WIDTH + column] = color
      }
    }
  }
}

function drawText (screen, text, x, y, scale, color) {
  const normalized = normalizeText(text)
  let cursor = x

  for (const character of normalized) {
    const glyph = FONT[character] ?? FONT['?']
    for (let row = 0; row < SAMPLE_HEIGHT; row++) {
      for (let column = 0; column < SAMPLE_WIDTH; column++) {
        if (glyph[row][column] !== '1') continue
        fillRect(
          screen,
          cursor + column * scale,
          y + row * scale,
          scale,
          scale,
          color,
        )
      }
    }
    cursor += (SAMPLE_WIDTH + LETTER_SPACING) * scale
  }
}

function drawCentered (screen, text, y, scale, color) {
  const x = Math.round((WIDTH - textWidth(text, scale)) / 2)
  drawText(screen, text, x, y, scale, color)
}

function createScreen () {
  return new Uint8Array(WIDTH * HEIGHT)
}

function drawHeader (screen, title) {
  drawCentered(screen, 'Tom and the Back Roads', 9, 1, COLOR.accent)
  drawCentered(screen, title, 22, 2, COLOR.heading)
  fillRect(screen, 60, 45, WIDTH - 120, 1, COLOR.accent)
}

function drawLyrics (screen, current) {
  if (!current) return

  const rows = wrapText(current.text, 24)
  let y = rows.length > 1 ? 84 : 96
  for (const row of rows) {
    drawCentered(screen, row, y, 2, COLOR.current)
    y += LINE_HEIGHT
  }
}

export function createState (title, current) {
  const screen = createScreen()
  drawHeader(screen, title)
  drawLyrics(screen, current)
  return screen
}

function packet (instruction, data) {
  const bytes = new Uint8Array(24)
  bytes[0] = 0x09
  bytes[1] = instruction
  bytes.set(data.slice(0, 20), 4)
  return bytes
}

function palettePacket (offset) {
  const data = new Uint8Array(16)
  for (let index = 0; index < 8; index++) {
    const [red, green, blue] = PALETTE[offset + index]
    const value = (red << 8) | (green << 4) | blue
    data[index * 2] = (value >> 6) & 0x3f
    data[index * 2 + 1] = value & 0x3f
  }
  return packet(offset === 0 ? 30 : 31, data)
}

function tileData (screen, row, column) {
  const counts = new Map()
  const pixels = []

  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      const pixel = screen[(row * TILE_HEIGHT + y) * WIDTH + column * TILE_WIDTH + x]
      counts.set(pixel, (counts.get(pixel) ?? 0) + 1)
      pixels.push(pixel)
    }
  }

  const present = [...counts.entries()].sort((a, b) => b[1] - a[1])
  let color0 = COLOR.background
  let color1 = COLOR.background

  if (counts.has(COLOR.background)) {
    color1 = present.find(([color]) => color !== COLOR.background)?.[0] ?? COLOR.background
  } else if (present.length > 0) {
    color0 = present[0][0]
    color1 = present[1]?.[0] ?? color0
  }

  const rows = new Uint8Array(TILE_HEIGHT)
  for (let y = 0; y < TILE_HEIGHT; y++) {
    let bits = 0
    for (let x = 0; x < TILE_WIDTH; x++) {
      const pixel = pixels[y * TILE_WIDTH + x]
      if (pixel !== color0) bits |= 1 << (5 - x)
    }
    rows[y] = bits
  }

  return { color0, color1, rows }
}

function signature (tile) {
  return `${tile.color0},${tile.color1},${tile.rows.join(',')}`
}

export function drawScreenDiff (packets, cursor, previous, screen) {
  for (let row = 0; row < HEIGHT / TILE_HEIGHT; row++) {
    for (let column = 0; column < WIDTH / TILE_WIDTH; column++) {
      const currentTile = tileData(screen, row, column)
      const previousTile = tileData(previous, row, column)
      if (signature(currentTile) === signature(previousTile)) continue

      const data = new Uint8Array([
        currentTile.color0,
        currentTile.color1,
        row,
        column,
        ...currentTile.rows,
      ])
      packets[cursor++] = packet(6, data)
    }
  }

  return cursor
}

function formatTime (seconds) {
  const hundredths = Math.max(0, Math.round(seconds * 1000))
  const minutes = Math.floor(hundredths / 60000)
  const remainder = hundredths % 60000
  const wholeSeconds = Math.floor(remainder / 1000)
  const milliseconds = remainder % 1000
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

export function buildCdg (title, lines, duration) {
  const packetCount = Math.ceil((duration + 0.75) * PACKETS_PER_SECOND)
  const packets = Array.from({ length: packetCount }, () => new Uint8Array(24))
  let cursor = 0

  packets[cursor++] = palettePacket(0)
  packets[cursor++] = palettePacket(8)
  packets[cursor++] = packet(1, [COLOR.background]) // memory preset
  packets[cursor++] = packet(28, [COLOR.background]) // transparent background

  const states = []
  if (lines.length === 0 || lines[0].at > 0) {
    states.push({ at: 0, current: null })
  }
  for (const line of lines) {
    states.push({
      at: Math.max(0, line.at - RENDER_LEAD_SECONDS),
      current: line,
    })
  }

  let screen = createScreen()
  for (const state of states) {
    cursor = Math.max(cursor, Math.round(state.at * PACKETS_PER_SECOND))
    const nextScreen = createState(title, state.current)
    cursor = drawScreenDiff(packets, cursor, screen, nextScreen)
    screen = nextScreen
  }

  const bytes = new Uint8Array(packets.length * 24)
  packets.forEach((part, index) => bytes.set(part, index * 24))
  return bytes
}

function buildExcerptLrc (spec, lines) {
  const header = [
    '[ar:Tom and the Back Roads]',
    `[ti:${spec.title}]`,
    '[al:Between Tides]',
    `[length:${Math.floor(spec.duration / 60)}:${String(Math.round(spec.duration % 60)).padStart(2, '0')}]`,
    '',
  ]
  const body = lines.map(line => `[${formatTime(line.at)}]${line.text}`)
  return [...header, ...body, ''].join('\n')
}

function parseMp3 (buffer) {
  let offset = 0
  if (buffer.subarray(0, 3).toString() === 'ID3') {
    const size = ((buffer[6] & 0x7f) << 21)
      | ((buffer[7] & 0x7f) << 14)
      | ((buffer[8] & 0x7f) << 7)
      | (buffer[9] & 0x7f)
    offset = 10 + size
  }

  const bitrates = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  }
  const sampleRates = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] }
  const frames = []
  let time = 0

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset++
      continue
    }

    const versionBits = (buffer[offset + 1] >> 3) & 3
    const layerBits = (buffer[offset + 1] >> 1) & 3
    const bitrateIndex = (buffer[offset + 2] >> 4) & 15
    const sampleRateIndex = (buffer[offset + 2] >> 2) & 3
    const padding = (buffer[offset + 2] >> 1) & 1
    const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : versionBits === 0 ? 25 : null

    if (version === null || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      offset++
      continue
    }

    const bitrate = bitrates[version === 1 ? 1 : 2][bitrateIndex]
    const sampleRate = sampleRates[version][sampleRateIndex]
    const samples = version === 1 ? 1152 : 576
    const frameLength = Math.floor((version === 1 ? 144000 : 72000) * bitrate / sampleRate) + padding

    if (frameLength < 24 || offset + frameLength > buffer.length) break

    frames.push({ offset, length: frameLength, time, duration: samples / sampleRate })
    time += samples / sampleRate
    offset += frameLength
  }

  if (frames.length === 0) throw new Error('no MPEG audio frames found')

  return { frames, duration: time }
}

function sliceMp3 (buffer, parsed, start, duration) {
  const { frames } = parsed
  const first = frames.findIndex(frame => frame.time >= start)
  if (first === -1) throw new Error(`start ${start}s is past the end of the MP3`)

  const startTime = frames[first].time
  const last = frames.findIndex((frame, index) =>
    index >= first && frame.time + frame.duration >= startTime + duration,
  )
  if (last === -1) throw new Error(`duration ${duration}s is past the end of the MP3`)

  const slice = buffer.subarray(frames[first].offset, frames[last].offset + frames[last].length)
  const headerFrame = Buffer.from(
    buffer.subarray(frames[0].offset, frames[0].offset + frames[0].length),
  )

  // The karaoke masters are VBR. A cut that drops the original Xing header makes
  // browsers estimate the duration from the first frame's bitrate, which is wildly
  // inaccurate. Rewrite the source header with the excerpt's frame count and size.
  if (headerFrame.subarray(36, 40).toString() !== 'Xing') {
    throw new Error('source MP3 has no Xing header to rewrite')
  }
  headerFrame.writeUInt32BE(0x00000003, 40) // frames + bytes, no stale TOC
  headerFrame.writeUInt32BE(last - first + 2, 44)
  headerFrame.writeUInt32BE(headerFrame.length + slice.length, 48)

  return {
    bytes: Buffer.concat([headerFrame, slice]),
    startTime,
    endTime: frames[last].time + frames[last].duration,
    headerDuration: frames[0].duration,
  }
}

function crc32 (buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeStoredZip (entries) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const [name, bytes] of entries) {
    const nameBytes = Buffer.from(name, 'utf8')
    const data = Buffer.from(bytes)
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)

    localParts.push(local, nameBytes, data)
    centralParts.push(central, nameBytes)
    offset += local.length + nameBytes.length + data.length
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...localParts, ...centralParts, end])
}

function sha256 (bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function relativeLines (lines, startTime, endTime) {
  const firstActive = lines.findLastIndex(line => line.time <= startTime)
  const selected = []
  for (let index = Math.max(0, firstActive); index < lines.length; index++) {
    const line = lines[index]
    if (line.time >= endTime) break
    selected.push({
      text: line.text,
      at: Math.max(0, Math.round((line.time - startTime) * 1000) / 1000),
    })
  }
  return selected
}

async function generateSpec (album, spec) {
  const audio = await readFile(join(album, `${spec.sourceBase}${spec.audioSuffix}.mp3`))
  const lrcText = await readFile(join(album, `${spec.sourceBase}.lrc`), 'utf8')
  const lrc = parseLrc(lrcText)
  const parsed = parseMp3(audio)
  const sliced = sliceMp3(audio, parsed, spec.start, spec.duration)
  const lines = relativeLines(lrc.lines, sliced.startTime, sliced.endTime)
  if (lines.length === 0) throw new Error(`${spec.title}: no lyrics overlap the excerpt`)

  const duration = sliced.endTime - sliced.startTime + sliced.headerDuration
  const cdg = buildCdg(spec.title, lines, duration)
  const excerptLrc = Buffer.from(buildExcerptLrc(spec, lines), 'utf8')

  const files = [
    [`${spec.name}.mp3`, sliced.bytes],
    [`${spec.name}.cdg`, cdg],
    [`${spec.name}.lrc`, excerptLrc],
  ]

  const fixture = {
    name: spec.name,
    artist: 'Tom and the Back Roads',
    title: spec.title,
    source: `${spec.sourceBase}${spec.audioSuffix}.mp3`,
    startSeconds: Math.round(sliced.startTime * 1000) / 1000,
    durationSeconds: Math.round(duration * 1000) / 1000,
    lines,
    mp3: {
      file: `${spec.name}.mp3`,
      bytes: sliced.bytes.length,
      sha256: sha256(sliced.bytes),
    },
    cdg: {
      file: `${spec.name}.cdg`,
      bytes: cdg.length,
      sha256: sha256(cdg),
    },
    lrc: {
      file: `${spec.name}.lrc`,
      bytes: excerptLrc.length,
    },
  }

  if (spec.zipped) {
    const zip = makeStoredZip(files)
    await writeFile(join(OUT_DIR, `${spec.name}.zip`), zip)
    fixture.zip = {
      file: `${spec.name}.zip`,
      bytes: zip.length,
      sha256: sha256(zip),
      entries: files.map(([name]) => name),
    }
  } else {
    for (const [name, bytes] of files) {
      await writeFile(join(OUT_DIR, name), bytes)
    }
  }

  return fixture
}

function parseArgs (argv) {
  const index = argv.indexOf('--album')
  if (index === -1 || !argv[index + 1]) {
    throw new Error('usage: node test/fixtures/media/generate.js --album <album directory>')
  }
  return { album: resolve(argv[index + 1]) }
}

async function main () {
  const { album } = parseArgs(process.argv.slice(2))
  await mkdir(OUT_DIR, { recursive: true })

  const fixtures = []
  for (const spec of SPECS) {
    fixtures.push(await generateSpec(album, spec))
    console.log(`wrote ${spec.name}`)
  }

  const manifest = {
    description: 'Short MP3+G excerpts from Tom and the Back Roads, used by the test suite.',
    license: 'Original recordings supplied by the repository owner for test use. No commercial karaoke content.',
    sourceAlbum: 'Tom and the Back Roads — Between Tides',
    generatedBy: 'node test/fixtures/media/generate.js --album <album directory>',
    fixtures,
  }
  await writeFile(join(OUT_DIR, 'fixtures.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log('wrote fixtures.json')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
