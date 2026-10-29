import { readZipDirectory, readZipEntry } from './zip.js'
import { parseLyrics } from './lrc.js'

export const CDG_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.flac']
export const VIDEO_EXTENSIONS = ['.mp4']
export const LYRIC_EXTENSIONS = ['.lrc', '.elrc']
export const SUPPORTED_EXTENSIONS = [
  ...CDG_AUDIO_EXTENSIONS,
  '.cdg',
  ...LYRIC_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  '.zip',
]

const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function getExtension (name) {
  const index = name.lastIndexOf('.')
  return index === -1 ? '' : name.slice(index).toLowerCase()
}

export function getBaseName (name) {
  const index = name.lastIndexOf('.')
  return index === -1 ? name : name.slice(0, index)
}

function dirName (path) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function fileName (path) {
  const index = path.lastIndexOf('/')
  return index === -1 ? path : path.slice(index + 1)
}

export function audioMimeType (name) {
  return AUDIO_MIME_TYPES[getExtension(name)] ?? 'application/octet-stream'
}

export function normalizeString (str, articles = ['A', 'An', 'The']) {
  return removeArticles(str, articles)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(' & ', ' and ')
    .replace(/[^\p{L}\p{N}\s\p{M}]/gu, '')
    .trim()
}

function moveArticles (str, articles) {
  if (!Array.isArray(articles)) return str

  for (const article of articles) {
    const search = `${article} `
    if (new RegExp(`^${search}`, 'i').test(str)) {
      const parensIndex = str.search(/[([{]/)
      if (parensIndex !== -1) {
        return `${str.substring(search.length, parensIndex).trim()}, ${article} ${str.slice(parensIndex)}`.trim()
      }
      return `${str.substring(search.length)}, ${article}`.trim()
    }
  }

  return str.trim()
}

function removeArticles (str, articles) {
  if (!Array.isArray(articles)) return str

  for (const article of articles) {
    const leading = new RegExp(`^${article} `, 'i')
    const trailing = new RegExp(`, ${article}$`, 'i')

    if (leading.test(str)) {
      return str.replace(leading, '').trim()
    }
    if (trailing.test(str)) {
      return str.replace(trailing, '').trim()
    }
  }

  return str.trim()
}

function cleanParts (parts) {
  const patterns = [
    /^\d*\.?$/,
    /^\W*$/,
    /^[a-zA-Z]{2,6}[ -]?\d{1,}/i,
  ]

  for (let i = 0; i < parts.length; i++) {
    if (patterns.some(pattern => pattern.test(parts[i].trim())) && parts.length > 2) {
      parts.shift()
      i--
    } else {
      break
    }
  }
}

/**
 * Parse the default "Artist - Title" naming convention used by Karaoke Eternal.
 * Throws when no artist/title delimiter is found, matching the previous server.
 */
export function parseTrackName (name, cfg = {}) {
  const articles = Array.isArray(cfg.articles) ? cfg.articles : ['A', 'An', 'The']
  let parsedName = name.replace(/_/g, ' ').replace(/ {2,}/g, ' ')
  parsedName = parsedName.replace(/[([{](?=[^([{]*$).*(?:karaoke|vocal).*[)\]}]/i, '')

  const inTheStyleOf = parsedName.match(/ in the style of /i)
  const delimiter = cfg.delimiter ?? (inTheStyleOf ? inTheStyleOf[0] : '-')
  const artistOnLeft = typeof cfg.artistOnLeft === 'boolean' ? cfg.artistOnLeft : !inTheStyleOf

  const delimiterPattern = delimiter instanceof RegExp
    ? delimiter
    : new RegExp(` ?${delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ?`, 'g')
  const matches = parsedName.match(delimiterPattern)

  if (!matches) throw new Error('no artist/title delimiter in filename')

  const longest = matches.reduce((a, b) => (a.length > b.length ? a : b))
  const parts = parsedName.split(longest)

  if (parts.length < 2) throw new Error('no artist/title delimiter in filename')

  cleanParts(parts)

  let title = artistOnLeft ? parts.pop() : parts.shift()
  let artist = parts.join(delimiter)
  title = title.trim()
  artist = artist.trim()

  artist = artist.replace(/^['|"](.*)['|"]$/, '$1')
  title = title.replace(/^['|"](.*)['|"]$/, '$1')

  const articleLookahead = articles.length ? `(?!${articles.join(' |')} )` : ''
  const artistPattern = new RegExp(`^([\\w ]+), ${articleLookahead}(\\w+ ?\\w+)$`, 'i')
  artist = artist.replace(artistPattern, '$2 $1')
  artist = artist.replace(/ featuring /i, ' ft. ')
  artist = artist.replace(/ f(ea)?t\.? /i, ' ft. ')

  artist = moveArticles(artist, articles)
  title = moveArticles(title, articles)

  return {
    artist,
    artistNorm: normalizeString(artist, articles),
    title,
    titleNorm: normalizeString(title, articles),
  }
}

function normalizeForSearch (str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeId (path) {
  return path.replace(/\\/g, '/').toLowerCase()
}

function makeTrack (fields) {
  const track = {
    duration: null,
    ...fields,
    id: fields.id ?? makeId(fields.path),
  }

  track.artistKey = track.artistNorm.toLowerCase()
  track.titleKey = track.titleNorm.toLowerCase()
  track.searchText = normalizeForSearch(`${track.artist} ${track.title}`)
  track.artistSearch = normalizeForSearch(track.artist)
  track.titleSearch = normalizeForSearch(track.title)

  return track
}

function companionKey (path) {
  return `${dirName(path)}/${getBaseName(fileName(path)).toLowerCase()}`
}

function findCompanion (index, audioPath) {
  return index.get(companionKey(audioPath)) ?? null
}

async function elrcFileHasLyrics (file) {
  try {
    return parseLyrics({ elrcText: await file.text() }).lines.length > 0
  } catch {
    return false
  }
}

async function zipElrcHasLyrics (archiveFile, entry) {
  try {
    const bytes = await readZipEntry(archiveFile, entry)
    return parseLyrics({ elrcText: new TextDecoder().decode(bytes) }).lines.length > 0
  } catch {
    return false
  }
}

function findZipCompanion (entries, audioEntry, used, allowFallback) {
  const base = getBaseName(fileName(audioEntry.name)).toLowerCase()
  const directory = dirName(audioEntry.name)
  const available = entries.filter(entry => !used.has(entry))
  const sameName = available.filter(entry =>
    getBaseName(fileName(entry.name)).toLowerCase() === base,
  )
  const match = sameName.find(entry => dirName(entry.name) === directory) ?? sameName[0]
  if (match) return match
  if (allowFallback && entries.length === 1 && !used.has(entries[0])) return entries[0]
  return null
}

/**
 * Match audio with lyrics and/or CD+G companions in an archive. CD+G wins when
 * both are present, matching the standalone folder behavior. Companion names
 * are case-insensitive; a lone mismatched audio/companion pair is accepted.
 */
async function findZipTracks (entries, archiveName, archiveFile) {
  const usable = entries.filter(entry =>
    !entry.isDirectory
    && !entry.name.startsWith('__MACOSX/')
    && !entry.name.endsWith('.DS_Store'),
  )
  const audio = usable.filter(entry => CDG_AUDIO_EXTENSIONS.includes(getExtension(entry.name)))
  const cdg = usable.filter(entry => getExtension(entry.name) === '.cdg')
  const lrc = usable.filter(entry => getExtension(entry.name) === '.lrc')
  const elrc = usable.filter(entry => getExtension(entry.name) === '.elrc')

  if (audio.length === 0) throw new Error('archive contains no supported audio file')

  const allowFallback = audio.length === 1
  const usedCdg = new Set()
  const usedLrc = new Set()
  const usedElrc = new Set()
  const tracks = []
  const unmatchedAudio = []

  for (const audioEntry of audio) {
    const cdgEntry = findZipCompanion(cdg, audioEntry, usedCdg, allowFallback)
    if (cdgEntry) {
      usedCdg.add(cdgEntry)
      tracks.push({ kind: 'zip', audioEntry, cdgEntry })
      continue
    }

    const lrcEntry = findZipCompanion(lrc, audioEntry, usedLrc, allowFallback)
    let elrcEntry = findZipCompanion(elrc, audioEntry, usedElrc, allowFallback)

    if (lrcEntry) usedLrc.add(lrcEntry)
    if (elrcEntry) {
      usedElrc.add(elrcEntry)
      if (!lrcEntry && !await zipElrcHasLyrics(archiveFile, elrcEntry)) {
        elrcEntry = null
      }
    }

    if (lrcEntry || elrcEntry) {
      tracks.push({ kind: 'zip-lrc', audioEntry, lrcEntry, elrcEntry })
    } else {
      unmatchedAudio.push(audioEntry)
    }
  }

  return { tracks, unmatchedAudio }
}

/**
 * Candidate names for a ZIP entry, most specific first. Karaoke archives are
 * often organized as `Artist/Title.mp3`, so a folder name can supply the artist
 * when the internal filename has no delimiter. The archive name is the last
 * resort for flat archives named `Artist - Title.zip`.
 */
function zipEntryCandidates (entry, archiveName) {
  const base = getBaseName(fileName(entry.name))
  const folder = dirName(entry.name).split('/').filter(Boolean).pop()
  const archiveBase = getBaseName(archiveName)

  return folder
    ? [base, `${folder} - ${base}`, archiveBase]
    : [base, archiveBase]
}

function parseOrWarn (candidates, warnings, path) {
  for (const candidate of candidates) {
    try {
      return parseTrackName(candidate)
    } catch {
      // Try the next, less specific name.
    }
  }

  warnings.push({ path, reason: 'could not determine artist and title from filename' })
  return null
}

/**
 * Pair files into playable tracks. `records` are `{ file, path }` where path is
 * relative and uses forward slashes.
 */
export async function buildLibrary (records, { onProgress } = {}) {
  const warnings = []
  const tracks = []
  const indexes = { cdg: new Map(), lrc: new Map(), elrc: new Map() }
  const seen = new Set()
  const candidates = records.filter((record) => {
    if (!SUPPORTED_EXTENSIONS.includes(getExtension(record.file.name))) return false
    if (seen.has(record.path)) return false
    seen.add(record.path)
    return true
  })

  for (const record of candidates) {
    const extension = getExtension(record.file.name)
    if (extension === '.cdg' || extension === '.lrc' || extension === '.elrc') {
      indexes[extension.slice(1)].set(companionKey(record.path), record)
    }
  }

  let processed = 0
  const report = (phase) => {
    onProgress?.({ done: processed, total: candidates.length, phase })
  }

  for (const record of candidates) {
    processed++
    const extension = getExtension(record.file.name)
    if (extension === '.cdg' || extension === '.lrc' || extension === '.elrc') continue

    if (processed % 25 === 0) report('Scanning files')

    try {
      if (extension === '.zip') {
        const directory = await readZipDirectory(record.file)
        const { tracks: archiveTracks, unmatchedAudio } = await findZipTracks(
          directory.entries,
          record.file.name,
          record.file,
        )

        for (const entry of unmatchedAudio) {
          warnings.push({
            path: `${record.path}!/${entry.name}`,
            reason: 'missing .cdg or .lrc file',
          })
        }

        for (const pair of archiveTracks) {
          const parsed = parseOrWarn(
            zipEntryCandidates(pair.audioEntry, record.file.name),
            warnings,
            record.path,
          )
          if (!parsed) continue

          tracks.push(makeTrack({
            ...parsed,
            kind: pair.kind,
            path: record.path,
            file: record.file,
            zipEntries: pair.kind === 'zip'
              ? { audioEntry: pair.audioEntry, cdgEntry: pair.cdgEntry }
              : { audioEntry: pair.audioEntry, lrcEntry: pair.lrcEntry, elrcEntry: pair.elrcEntry },
            sourceName: pair.audioEntry.name,
            size: pair.audioEntry.size,
            // Archives with several songs get one track per pair.
            id: archiveTracks.length > 1
              ? `${makeId(record.path)}#${makeId(pair.audioEntry.name)}`
              : undefined,
          }))
        }
      } else if (VIDEO_EXTENSIONS.includes(extension)) {
        const parsed = parseOrWarn(
          [getBaseName(record.file.name)],
          warnings,
          record.path,
        )
        if (!parsed) continue

        tracks.push(makeTrack({
          ...parsed,
          kind: 'mp4',
          path: record.path,
          file: record.file,
          sourceName: record.file.name,
          size: record.file.size,
        }))
      } else if (CDG_AUDIO_EXTENSIONS.includes(extension)) {
        const cdg = findCompanion(indexes.cdg, record.path)
        const lrc = cdg ? null : findCompanion(indexes.lrc, record.path)
        let elrc = cdg ? null : findCompanion(indexes.elrc, record.path)

        if (!cdg && !lrc && elrc && !await elrcFileHasLyrics(elrc.file)) elrc = null

        if (!cdg && !lrc && !elrc) {
          warnings.push({ path: record.path, reason: 'missing .cdg or .lrc file' })
          continue
        }

        const parsed = parseOrWarn(
          [getBaseName(record.file.name)],
          warnings,
          record.path,
        )
        if (!parsed) continue

        const lyricsSize = (lrc?.file.size ?? 0) + (elrc?.file.size ?? 0)
        tracks.push(makeTrack({
          ...parsed,
          kind: cdg ? 'cdg' : 'lrc',
          path: record.path,
          file: record.file,
          cdgFile: cdg?.file ?? null,
          lrcFile: lrc?.file ?? null,
          elrcFile: elrc?.file ?? null,
          sourceName: record.file.name,
          size: record.file.size + (cdg?.file.size ?? 0) + lyricsSize,
        }))
      }
    } catch (error) {
      warnings.push({ path: record.path, reason: error.message })
    }
  }

  tracks.sort((a, b) =>
    collator.compare(a.artistNorm, b.artistNorm)
    || collator.compare(a.titleNorm, b.titleNorm)
    || collator.compare(a.path, b.path),
  )

  report('Done')
  return { tracks, warnings }
}

/**
 * Recursively collect supported media files from a directory handle
 * (File System Access API). Errors are contained per entry so one unreadable
 * file or folder cannot abort the whole scan (upstream issue #91); they are
 * reported through `warnings` instead. Returns `{ records, warnings }` where
 * records are `{ file, path }` with forward-slash relative paths.
 */
export async function collectDirectoryRecords (directory, { onEntry } = {}) {
  const records = []
  const warnings = []
  let scanned = 0

  const walk = async (dir, prefix) => {
    let entries
    try {
      entries = []
      for await (const entry of dir.values()) entries.push(entry)
    } catch (error) {
      let path = prefix
      while (path.endsWith('/')) path = path.slice(0, -1)
      path = path || '.'
      warnings.push({ path, reason: `could not read folder (${error.message || 'unknown error'})` })
      return
    }

    for (const entry of entries) {
      const path = `${prefix}${entry.name}`

      if (entry.kind === 'directory') {
        if (entry.name.startsWith('.') || entry.name === '__MACOSX') continue
        await walk(entry, `${path}/`)
      } else if (entry.kind === 'file') {
        if (!SUPPORTED_EXTENSIONS.includes(getExtension(entry.name))) continue
        scanned++
        try {
          records.push({ file: await entry.getFile(), path })
        } catch (error) {
          warnings.push({ path, reason: `could not read file (${error.message || 'unknown error'})` })
        }
        onEntry?.({ scanned, path })
      }
    }
  }

  await walk(directory, '')
  return { records, warnings }
}

function scoreToken (track, token) {
  let score = 0

  const titleIndex = track.titleSearch.indexOf(token)
  if (titleIndex !== -1) {
    score += titleIndex === 0 ? 45 : 30
    if (titleIndex === 0 || track.titleSearch[titleIndex - 1] === ' ') score += 12
  }

  const artistIndex = track.artistSearch.indexOf(token)
  if (artistIndex !== -1) {
    score += artistIndex === 0 ? 25 : 15
    if (artistIndex === 0 || track.artistSearch[artistIndex - 1] === ' ') score += 8
  }

  if (score === 0 && track.searchText.includes(token)) score = 10
  return score
}

/** Multi-token AND search across artist + title, ranked by relevance. */
export function searchTracks (tracks, query, favorites = null) {
  const tokens = normalizeForSearch(query).split(' ').filter(Boolean)

  if (tokens.length === 0) {
    return favorites ? tracks.filter(track => favorites.has(track.id)) : tracks
  }

  const results = []

  for (const track of tracks) {
    if (favorites && !favorites.has(track.id)) continue

    let score = 0
    let matches = true
    for (const token of tokens) {
      const tokenScore = scoreToken(track, token)
      if (tokenScore === 0 && !track.searchText.includes(token)) {
        matches = false
        break
      }
      score += tokenScore
    }

    if (matches) results.push({ track, score })
  }

  results.sort((a, b) =>
    b.score - a.score
    || collator.compare(a.track.titleNorm, b.track.titleNorm)
    || collator.compare(a.track.artistNorm, b.track.artistNorm),
  )

  return results.map(result => result.track)
}

export function groupByArtist (tracks) {
  const artists = new Map()

  for (const track of tracks) {
    if (!artists.has(track.artist)) artists.set(track.artist, [])
    artists.get(track.artist).push(track)
  }

  return artists
}

export function formatDuration (seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function formatSize (bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
