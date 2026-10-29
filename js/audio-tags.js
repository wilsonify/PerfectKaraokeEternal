/*
 * Extract ReplayGain tags from an ID3v2 header. Browsers don't expose audio
 * metadata, so this reads the small portion of the file we need. Only the
 * standard TXXX fields written by ReplayGain tools are supported.
 */
function synchsafe (bytes) {
  return ((bytes[0] & 0x7f) << 21)
    | ((bytes[1] & 0x7f) << 14)
    | ((bytes[2] & 0x7f) << 7)
    | (bytes[3] & 0x7f)
}

function readU32 (bytes) {
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
}

function decodeText (bytes, encoding) {
  if (bytes.length === 0) return ''

  try {
    if (encoding === 1 || encoding === 2) {
      return new TextDecoder('utf-16le').decode(bytes)
    }
    if (encoding === 3) return new TextDecoder('utf-8').decode(bytes)
    return new TextDecoder('latin1').decode(bytes)
  } catch {
    return ''
  }
}

function readTerminated (bytes, encoding, start) {
  const width = encoding === 1 || encoding === 2 ? 2 : 1

  for (let i = start; i + width <= bytes.length; i += width) {
    if (width === 1 && bytes[i] === 0) {
      return { text: decodeText(bytes.subarray(start, i), encoding), next: i + 1 }
    }
    if (width === 2 && bytes[i] === 0 && bytes[i + 1] === 0) {
      return { text: decodeText(bytes.subarray(start, i), encoding), next: i + 2 }
    }
  }

  return { text: decodeText(bytes.subarray(start), encoding), next: bytes.length }
}

function parseTxxx (bytes) {
  if (bytes.length < 2) return null
  const encoding = bytes[0]
  const description = readTerminated(bytes, encoding, 1)
  let value = decodeText(bytes.subarray(description.next), encoding)
  while (value.endsWith('\0')) value = value.slice(0, -1)
  value = value.trim()
  return { description: description.text.trim(), value }
}

export function parseReplayGain (buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return null
  }

  const version = bytes[3]
  if (version < 3 || version > 4) return null

  const tagSize = synchsafe(bytes.subarray(6, 10))
  const end = Math.min(bytes.length, 10 + tagSize)
  let offset = 10

  if ((bytes[5] & 0x40) !== 0 && offset + 4 <= end) {
    const extendedSize = version === 4
      ? synchsafe(bytes.subarray(offset, offset + 4))
      : readU32(bytes.subarray(offset, offset + 4)) + 4
    offset += Math.max(extendedSize, 4)
  }

  const fields = new Map()

  while (offset + 10 <= end) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4))
    if (id === '\0\0\0\0' || !/^[A-Z0-9]{4}$/.test(id)) break

    const frameSize = version === 4
      ? synchsafe(bytes.subarray(offset + 4, offset + 8))
      : readU32(bytes.subarray(offset + 4, offset + 8))

    if (frameSize <= 0 || offset + 10 + frameSize > end) break

    if (id === 'TXXX') {
      const field = parseTxxx(bytes.subarray(offset + 10, offset + 10 + frameSize))
      if (field) fields.set(field.description.toLowerCase(), field.value)
    }

    offset += 10 + frameSize
  }

  const gainValue = fields.get('replaygain_track_gain')
  if (!gainValue) return null

  const gainDb = Number.parseFloat(gainValue)
  const peak = Number.parseFloat(fields.get('replaygain_track_peak') ?? '')

  if (!Number.isFinite(gainDb)) return null

  return {
    gainDb,
    peak: Number.isFinite(peak) && peak > 0 ? peak : null,
  }
}

export function replayGainFactor (gainDb, peak) {
  if (!Number.isFinite(gainDb)) return 1

  let safeGainDb = gainDb
  if (Number.isFinite(peak) && peak > 0) {
    const peakDb = 20 * Math.log10(peak)
    if (gainDb + peakDb >= 0) safeGainDb = -0.01 - peakDb
  }

  return Math.pow(10, safeGainDb / 20)
}
