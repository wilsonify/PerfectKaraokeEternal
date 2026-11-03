/*
 * Lightweight audio duration estimation.
 *
 * Karaoke libraries rely on file durations for queue estimates, but the
 * browser does not expose them until a track is loaded. Reading metadata for
 * every song would be slow and would create one media element per file, so this
 * module reads only the first MPEG frame:
 *
 * - A Xing/Info header gives an exact frame count (the common case).
 * - Otherwise the first frame's bitrate is used to estimate a CBR file.
 *
 * Formats that need a full container parse (MP4, OGG) return null and are
 * displayed as unknown until the player loads them.
 */

const MPEG1_LAYER3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const MPEG2_LAYER3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
const SAMPLE_RATES = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
}
const HEADER_BYTES = 10
const AUDIO_WINDOW = 64 * 1024

function synchsafe (bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f)
}

function hasId3v2 (bytes) {
  return bytes.length >= HEADER_BYTES
    && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33
}

function frameHeader (bytes, offset) {
  if (offset + 4 > bytes.length) return null
  if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null

  const version = (bytes[offset + 1] >> 3) & 3
  const layer = (bytes[offset + 1] >> 1) & 3
  const bitrateIndex = (bytes[offset + 2] >> 4) & 15
  const sampleIndex = (bytes[offset + 2] >> 2) & 3
  const padding = (bytes[offset + 2] >> 1) & 1
  const channelMode = (bytes[offset + 3] >> 6) & 3

  // 1 = reserved version, 0 = reserved layer; only Layer III is handled here.
  if (version === 1 || layer !== 1) return null
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return null

  const bitrate = (version === 3 ? MPEG1_LAYER3_BITRATES : MPEG2_LAYER3_BITRATES)[bitrateIndex]
  const sampleRate = SAMPLE_RATES[version][sampleIndex]
  if (!bitrate || !sampleRate) return null

  const samplesPerFrame = version === 3 ? 1152 : 576
  const frameLength = Math.floor(
    (version === 3 ? 144000 : 72000) * bitrate / sampleRate,
  ) + padding
  const sideInfo = version === 3
    ? (channelMode === 3 ? 17 : 32)
    : (channelMode === 3 ? 9 : 17)

  return { bitrate, sampleRate, samplesPerFrame, frameLength, sideInfo }
}

function findFrame (bytes, start) {
  for (let offset = start; offset + 4 <= bytes.length; offset++) {
    const header = frameHeader(bytes, offset)
    if (header) return { offset, header }
  }
  return null
}

function xingFrameCount (bytes, frame) {
  const offset = frame.offset + 4 + frame.header.sideInfo
  if (offset + 12 > bytes.length) return null

  const marker = String.fromCharCode(
    bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3],
  )
  if (marker !== 'Xing' && marker !== 'Info') return null

  const flags = (bytes[offset + 4] << 24)
    | (bytes[offset + 5] << 16)
    | (bytes[offset + 6] << 8)
    | bytes[offset + 7]
  if ((flags & 1) === 0) return null

  return (bytes[offset + 8] << 24)
    | (bytes[offset + 9] << 16)
    | (bytes[offset + 10] << 8)
    | bytes[offset + 11]
}

/**
 * Estimate an MP3's duration from its first frame. Returns
 * `{ seconds, estimated }`, or null when the file is not a readable MP3.
 */
export async function estimateMp3Duration (blob) {
  if (!blob || !Number.isFinite(blob.size) || blob.size <= 0) return null

  const head = new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer())
  const audioStart = hasId3v2(head) ? HEADER_BYTES + synchsafe(head, 6) : 0
  if (audioStart >= blob.size) return null

  const bytes = new Uint8Array(
    await blob.slice(audioStart, Math.min(blob.size, audioStart + AUDIO_WINDOW)).arrayBuffer(),
  )
  const found = findFrame(bytes, 0)
  if (!found) return null

  const frames = xingFrameCount(bytes, found)
  if (frames) {
    return {
      seconds: (frames * found.header.samplesPerFrame) / found.header.sampleRate,
      estimated: false,
    }
  }

  const audioBytes = Math.max(0, blob.size - audioStart)
  const seconds = (audioBytes * 8) / (found.header.bitrate * 1000)
  return seconds > 0 ? { seconds, estimated: true } : null
}

/** Estimate duration for the formats handled without a full media element. */
export async function estimateAudioDuration (file) {
  const name = String(file?.name ?? '').toLowerCase()
  if (!name.endsWith('.mp3')) return null
  try {
    return await estimateMp3Duration(file)
  } catch {
    return null
  }
}
