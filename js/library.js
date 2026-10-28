import { readZipDirectory } from './zip.js'

export const CDG_AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.flac']
export const VIDEO_EXTENSIONS = ['.mp4']
export const SUPPORTED_EXTENSIONS = [...CDG_AUDIO_EXTENSIONS, '.cdg', ...VIDEO_EXTENSIONS, '.zip']

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
      const parens = /[([{].*$/.exec(str)
      if (parens) {
        return `${str.substring(search.length, parens.index).trim()}, ${article} ${parens[0]}`.trim()
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
    id: makeId(fields.path),
    duration: null,
    ...fields,
  }

  track.artistKey = track.artistNorm.toLowerCase()
  track.titleKey = track.titleNorm.toLowerCase()
  track.searchText = normalizeForSearch(`${track.artist} ${track.title}`)
  track.artistSearch = normalizeForSearch(track.artist)
  track.titleSearch = normalizeForSearch(track.title)

  return track
}

function findCompanionCdg (audioPath, cdgIndex) {
  const base = getBaseName(fileName(audioPath)).toLowerCase()
  return cdgIndex.get(`${dirName(audioPath)}/${base}`) ?? null
}

function findZipPair (entries, archiveName) {
  const usable = entries.filter(entry =>
    !entry.isDirectory
    && !entry.name.startsWith('__MACOSX/')
    && !entry.name.endsWith('.DS_Store'),
  )
  const audio = usable.filter(entry => CDG_AUDIO_EXTENSIONS.includes(getExtension(entry.name)))
  const cdg = usable.filter(entry => getExtension(entry.name) === '.cdg')

  if (audio.length === 0) throw new Error('archive contains no supported audio file')
  if (cdg.length === 0) throw new Error('archive contains no .cdg file')

  for (const audioEntry of audio) {
    const audioBase = getBaseName(fileName(audioEntry.name)).toLowerCase()
    const matchingCdg = cdg.find(entry =>
      getBaseName(fileName(entry.name)).toLowerCase() === audioBase,
    )
    if (matchingCdg) return { audioEntry, cdgEntry: matchingCdg }
  }

  if (audio.length === 1 && cdg.length === 1) {
    return { audioEntry: audio[0], cdgEntry: cdg[0] }
  }

  throw new Error(`could not match audio and .cdg files in ${archiveName}`)
}

function parseOrWarn (name, fallbackName, warnings, path) {
  for (const candidate of [name, fallbackName]) {
    try {
      return parseTrackName(candidate)
    } catch {
      // try the archive name next
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
  const cdgIndex = new Map()
  const seen = new Set()
  const candidates = records.filter((record) => {
    if (!SUPPORTED_EXTENSIONS.includes(getExtension(record.file.name))) return false
    if (seen.has(record.path)) return false
    seen.add(record.path)
    return true
  })

  for (const record of candidates) {
    if (getExtension(record.file.name) === '.cdg') {
      const key = `${dirName(record.path)}/${getBaseName(fileName(record.path)).toLowerCase()}`
      cdgIndex.set(key, record)
    }
  }

  let processed = 0
  const report = (phase) => {
    onProgress?.({ done: processed, total: candidates.length, phase })
  }

  for (const record of candidates) {
    processed++
    const extension = getExtension(record.file.name)
    if (extension === '.cdg') continue

    if (processed % 25 === 0) report('Scanning files')

    try {
      if (extension === '.zip') {
        const directory = await readZipDirectory(record.file)
        const pair = findZipPair(directory.entries, record.file.name)
        const parsed = parseOrWarn(
          getBaseName(fileName(pair.audioEntry.name)),
          getBaseName(record.file.name),
          warnings,
          record.path,
        )
        if (!parsed) continue

        tracks.push(makeTrack({
          ...parsed,
          kind: 'zip',
          path: record.path,
          file: record.file,
          zipEntries: pair,
          sourceName: pair.audioEntry.name,
          size: pair.audioEntry.size,
        }))
      } else if (VIDEO_EXTENSIONS.includes(extension)) {
        const parsed = parseOrWarn(
          getBaseName(record.file.name),
          getBaseName(record.file.name),
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
        const cdg = findCompanionCdg(record.path, cdgIndex)
        if (!cdg) {
          warnings.push({ path: record.path, reason: 'missing .cdg file' })
          continue
        }

        const parsed = parseOrWarn(
          getBaseName(record.file.name),
          getBaseName(record.file.name),
          warnings,
          record.path,
        )
        if (!parsed) continue

        tracks.push(makeTrack({
          ...parsed,
          kind: 'cdg',
          path: record.path,
          file: record.file,
          cdgFile: cdg.file,
          sourceName: record.file.name,
          size: record.file.size + cdg.file.size,
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
