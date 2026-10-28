/*
 * Minimal ZIP reader for MP3+G archives.
 *
 * Supports the ZIP features needed by karaoke files: stored and deflated
 * entries, UTF-8 names, and archives below the ZIP64 limits. Decompression uses
 * the browser's built-in DecompressionStream, so there is no dependency.
 */
const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const LOCAL_FILE_HEADER = 0x04034b50
const MAX_COMMENT_SIZE = 0xffff
const EOCD_SIZE = 22

function readU16 (view, offset) {
  return view.getUint16(offset, true)
}

function readU32 (view, offset) {
  return view.getUint32(offset, true)
}

function decodeName (bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  }
}

async function readBlobSlice (blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer())
}

/**
 * List entries without loading file data. The file is read in three slices
 * (tail, central directory, and per-entry headers), which keeps scanning large
 * archives fast.
 */
export async function readZipDirectory (blob) {
  if (!(blob instanceof Blob)) throw new TypeError('ZIP source must be a Blob or File')
  if (blob.size < EOCD_SIZE) throw new Error('ZIP file is too small')

  const tailSize = Math.min(blob.size, EOCD_SIZE + MAX_COMMENT_SIZE)
  const tailStart = blob.size - tailSize
  const tail = await readBlobSlice(blob, tailStart, blob.size)
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength)

  let eocd = -1
  for (let i = tail.length - EOCD_SIZE; i >= 0; i--) {
    if (readU32(tailView, i) === END_OF_CENTRAL_DIRECTORY) {
      eocd = i
      break
    }
  }

  if (eocd === -1) throw new Error('Not a ZIP file (end record not found)')

  const diskNumber = readU16(tailView, eocd + 4)
  const centralDisk = readU16(tailView, eocd + 6)
  const entriesOnDisk = readU16(tailView, eocd + 8)
  const totalEntries = readU16(tailView, eocd + 10)
  const centralSize = readU32(tailView, eocd + 12)
  const centralOffset = readU32(tailView, eocd + 16)

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error('Multi-disk ZIP files are not supported')
  }

  if (centralOffset === 0xffffffff || centralSize === 0xffffffff || totalEntries === 0xffff) {
    throw new Error('ZIP64 archives are not supported')
  }

  const central = await readBlobSlice(blob, centralOffset, centralOffset + centralSize)
  const view = new DataView(central.buffer, central.byteOffset, central.byteLength)
  const entries = []
  let offset = 0

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > central.length || readU32(view, offset) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new Error('Invalid ZIP central directory')
    }

    const flags = readU16(view, offset + 8)
    const method = readU16(view, offset + 10)
    const compressedSize = readU32(view, offset + 20)
    const size = readU32(view, offset + 24)
    const nameLength = readU16(view, offset + 28)
    const extraLength = readU16(view, offset + 30)
    const commentLength = readU16(view, offset + 32)
    const localOffset = readU32(view, offset + 42)
    const nameBytes = central.subarray(offset + 46, offset + 46 + nameLength)
    const name = decodeName(nameBytes).replace(/\\/g, '/')

    if ((flags & 0x0001) !== 0) {
      throw new Error(`Encrypted ZIP entries are not supported: ${name}`)
    }

    if (method !== 0 && method !== 8) {
      throw new Error(`Unsupported ZIP compression method ${method}: ${name}`)
    }

    entries.push({
      name,
      method,
      compressedSize,
      size,
      localOffset,
      isDirectory: name.endsWith('/'),
    })

    offset += 46 + nameLength + extraLength + commentLength
  }

  return { entries, size: entries.length }
}

/** Read and, when necessary, decompress a single entry. */
export async function readZipEntry (blob, entry) {
  const header = await readBlobSlice(blob, entry.localOffset, entry.localOffset + 30)
  if (header.length < 30) throw new Error(`Invalid ZIP entry: ${entry.name}`)

  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  if (readU32(view, 0) !== LOCAL_FILE_HEADER) {
    throw new Error(`Invalid ZIP local header: ${entry.name}`)
  }

  const nameLength = readU16(view, 26)
  const extraLength = readU16(view, 28)
  const dataStart = entry.localOffset + 30 + nameLength + extraLength
  const compressed = await readBlobSlice(blob, dataStart, dataStart + entry.compressedSize)

  if (entry.method === 0) {
    if (compressed.length !== entry.size) {
      throw new Error(`ZIP entry size mismatch: ${entry.name}`)
    }
    return compressed
  }

  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress ZIP files (DecompressionStream is unavailable)')
  }

  try {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const data = new Uint8Array(await new Response(stream).arrayBuffer())
    if (data.length !== entry.size) {
      throw new Error(`ZIP entry size mismatch: ${entry.name}`)
    }
    return data
  } catch (error) {
    throw new Error(`Could not decompress ${entry.name}: ${error.message}`)
  }
}
