/*
 * LRC / ELRC lyric parsing.
 *
 * LRC supplies one or more `[mm:ss.xx]` timestamps per lyric line. ELRC uses
 * the same line headers followed by one timestamped entry per word. The
 * functions here are pure so they can be tested without a browser, and so the
 * player can parse folder files and ZIP entries through the same path.
 */

const LINE_PREFIX = /^((?:\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\])+)(.*)$/
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const METADATA = /^\[([a-zA-Z]+):(.*)\]$/

function timeToSeconds (match) {
  const minutes = Number.parseInt(match[1], 10)
  const seconds = Number.parseInt(match[2], 10)
  const fraction = match[3] ?? ''
  const milliseconds = fraction.length === 1
    ? Number.parseInt(fraction, 10) * 100
    : fraction.length === 2
      ? Number.parseInt(fraction, 10) * 10
      : fraction.length === 3
        ? Number.parseInt(fraction, 10)
        : 0

  return minutes * 60 + seconds + milliseconds / 1000
}

/** Remove remaining `[tag]` blocks without the backtracking of a regex. */
function stripBracketTags (text) {
  let output = ''
  let index = 0

  while (index < text.length) {
    if (text[index] !== '[') {
      output += text[index]
      index++
      continue
    }

    const close = text.indexOf(']', index + 1)
    if (close === -1) {
      output += text.slice(index)
      break
    }

    output += ' '
    index = close + 1
    while (index < text.length && /\s/u.test(text[index])) index++
  }

  return output
}

function parseMetadata (line, meta) {
  const match = line.match(METADATA)
  if (!match) return false

  const key = match[1].toLowerCase()
  if (key === 'length' || /^\d+$/.test(key)) return false

  meta[key] = match[2].trim()
  return true
}

/**
 * Read timestamped entries. A line may carry more than one timestamp (common
 * in LRC), in which case one entry is produced per timestamp.
 */
function parseEntries (text) {
  const entries = []
  const meta = {}

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (parseMetadata(line, meta)) continue

    const prefix = line.match(LINE_PREFIX)
    if (!prefix) continue

    const tags = [...prefix[1].matchAll(TIME_TAG)]
    const lyric = stripBracketTags(prefix[2]).replace(/\s+/gu, ' ').trim()
    if (!lyric || tags.length === 0) continue

    for (const tag of tags) {
      entries.push({ time: timeToSeconds(tag), text: lyric })
    }
  }

  entries.sort((a, b) => a.time - b.time)
  return { entries, meta }
}

/** Parse an LRC file into timed lyric lines. */
export function parseLrc (text) {
  const { entries, meta } = parseEntries(text)
  return {
    lines: entries.map(entry => ({ time: entry.time, text: entry.text, words: [] })),
    meta,
  }
}

function normalizeLetters (text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * Match timestamped ELRC entries to the tokens of one lyric line. The full
 * line header is skipped, then each word advances through the line's letters,
 * so punctuation and curly quotes never shift a timing onto the wrong token.
 */
function alignWordsToLine (text, entries) {
  const tokens = text.split(/\s+/u).filter(Boolean)
  const spans = []
  let flat = ''

  for (const token of tokens) {
    const letters = normalizeLetters(token)
    spans.push({ start: flat.length, end: flat.length + letters.length })
    flat += letters
  }

  if (!flat) return []

  const times = tokens.map(() => null)
  let cursor = 0
  let headerSkipped = false

  for (const entry of entries) {
    const word = normalizeLetters(entry.text)
    if (!word) continue
    if (word === flat && !headerSkipped) {
      headerSkipped = true
      continue
    }
    if (flat.indexOf(word, cursor) !== cursor) continue

    for (let tokenIndex = 0; tokenIndex < spans.length; tokenIndex++) {
      const span = spans[tokenIndex]
      if (times[tokenIndex] === null && span.end > cursor && span.start < cursor + word.length) {
        times[tokenIndex] = entry.time
      }
    }

    cursor += word.length
    if (cursor >= flat.length) break
  }

  return tokens
    .map((token, tokenIndex) => times[tokenIndex] === null
      ? null
      : { text: token, time: times[tokenIndex] })
    .filter(Boolean)
}

/** Attach ELRC word timings to lines supplied by an LRC file. */
function attachWordTimings (lines, entries) {
  const lineEntries = lines.map(() => [])
  let lineIndex = 0

  for (const entry of entries) {
    while (lineIndex < lines.length - 1 && lines[lineIndex + 1].time <= entry.time) {
      lineIndex++
    }
    lineEntries[lineIndex].push(entry)
  }

  for (let index = 0; index < lines.length; index++) {
    lines[index].words = alignWordsToLine(lines[index].text, lineEntries[index])
  }

  return lines
}

/**
 * Infer lines from an ELRC file that has no LRC companion. A line header is an
 * entry followed by entries whose letters concatenate to the header's own
 * letters. Headers without word entries remain valid single lines.
 */
function inferElrcLines (entries) {
  const lines = []
  let index = 0

  while (index < entries.length) {
    const header = entries[index]
    const expected = normalizeLetters(header.text)
    if (!expected) {
      index++
      continue
    }

    let consumed = ''
    let cursor = index + 1
    while (cursor < entries.length) {
      const word = normalizeLetters(entries[cursor].text)
      if (!word) {
        cursor++
        continue
      }
      if (!expected.startsWith(consumed + word)) break
      consumed += word
      cursor++
      if (consumed === expected) break
    }

    if (consumed === expected) {
      const wordEntries = entries.slice(index + 1, cursor).filter(entry => normalizeLetters(entry.text))
      lines.push({
        time: header.time,
        text: header.text,
        words: alignWordsToLine(header.text, [header, ...wordEntries]),
      })
      index = cursor
    } else {
      lines.push({ time: header.time, text: header.text, words: [] })
      index++
    }
  }

  return lines
}

/** Parse an ELRC file on its own, using line headers for the lyric text. */
export function parseElrc (text) {
  const { entries, meta } = parseEntries(text)
  return { lines: inferElrcLines(entries), meta }
}

/**
 * Parse the lyric companions of a track. Both files are optional, but at least
 * one must produce lines. Invalid or empty files yield an empty line list.
 */
export function parseLyrics ({ lrcText = null, elrcText = null } = {}) {
  const lrc = lrcText ? parseLrc(lrcText) : { lines: [], meta: {} }
  const elrc = elrcText ? parseElrc(elrcText) : { lines: [], meta: {} }
  const meta = { ...elrc.meta, ...lrc.meta }

  if (lrc.lines.length > 0) {
    const lines = lrc.lines.map(line => ({ ...line, words: [] }))
    if (elrcText) {
      const { entries } = parseEntries(elrcText)
      attachWordTimings(lines, entries)
    }
    return { lines, meta }
  }

  return { lines: elrc.lines, meta }
}
