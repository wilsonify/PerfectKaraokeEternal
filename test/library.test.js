import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'
import {
  buildLibrary,
  collectDirectoryRecords,
  formatDuration,
  formatSize,
  groupByArtist,
  parseTrackName,
  searchTracks,
} from '../js/library.js'
import { readZipDirectory, readZipEntry } from '../js/zip.js'
import { trackNameCases } from './fixtures/track-names.js'

/** Build a ZIP archive, stored or deflated; the reader ignores CRCs. */
function makeZip (entries, { deflate = false } = {}) {
  const encoder = new TextEncoder()
  const locals = []
  const centrals = []
  const method = deflate ? 8 : 0
  let offset = 0

  for (const [name, bytes] of entries) {
    const nameBytes = encoder.encode(name)
    const raw = new Uint8Array(bytes)
    const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw

    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, method, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, raw.length, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, method, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, raw.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint32(42, offset, true)
    central.set(nameBytes, 46)

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0)
  const eocd = new Uint8Array(22)
  const view = new DataView(eocd.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, entries.length, true)
  view.setUint16(10, entries.length, true)
  view.setUint32(12, centralSize, true)
  view.setUint32(16, offset, true)

  return new Blob([...locals, ...centrals, eocd])
}

const audioBytes = new Uint8Array(100).fill(1)
const cdgBytes = new Uint8Array(50).fill(2)

function file (name, bytes = audioBytes) {
  return new File([bytes], name)
}

test('parseTrackName matches every legacy MetaParser case', () => {
  for (const { input, output } of trackNameCases) {
    const parsed = parseTrackName(input)
    assert.deepEqual(
      {
        artist: parsed.artist,
        artistNorm: parsed.artistNorm,
        title: parsed.title,
        titleNorm: parsed.titleNorm,
      },
      output,
      input,
    )
  }
})

test('parseTrackName rejects names without an artist/title delimiter', () => {
  assert.throws(() => parseTrackName('untitled'), /delimiter/)
})

test('buildLibrary pairs audio with .cdg files in the same directory', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: file('Queen - Bohemian Rhapsody.mp3'), path: 'Queen - Bohemian Rhapsody.mp3' },
    { file: file('Queen - Bohemian Rhapsody.cdg', cdgBytes), path: 'Queen - Bohemian Rhapsody.cdg' },
    { file: file('Nobody - No CDG.mp3'), path: 'Nobody - No CDG.mp3' },
  ])

  assert.equal(tracks.length, 1)
  assert.equal(warnings.length, 1)

  const [track] = tracks
  assert.equal(track.kind, 'cdg')
  assert.equal(track.artist, 'Queen')
  assert.equal(track.title, 'Bohemian Rhapsody')
  assert.equal(track.size, 150)
  assert.equal(track.id, 'queen - bohemian rhapsody.mp3')

  assert.deepEqual(warnings[0], {
    path: 'Nobody - No CDG.mp3',
    reason: 'missing .cdg or .lrc file',
  })
})

test('buildLibrary matches pairs case-insensitively and per directory', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: file('Live/Queen - Live Song.MP3'), path: 'Live/Queen - Live Song.MP3' },
    { file: file('Live/queen - live song.cdg', cdgBytes), path: 'Live/queen - live song.cdg' },
    { file: file('Studio/Queen - Live Song.cdg', cdgBytes), path: 'Studio/Queen - Live Song.cdg' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].path, 'Live/Queen - Live Song.MP3')
})

test('buildLibrary accepts MP4 videos and skips unsupported files', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: file('Artist - Video.mp4'), path: 'Artist - Video.mp4' },
    { file: file('Artist - Notes.txt'), path: 'Artist - Notes.txt' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'mp4')
  assert.equal(tracks[0].artist, 'Artist')
})

test('buildLibrary reads zipped MP3+G pairs', async () => {
  const zip = makeZip([
    ['Zip Artist - Zipped Song.mp3', [1, 2, 3]],
    ['Zip Artist - Zipped Song.cdg', [4, 5]],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Zip Artist - Zipped Song.zip'), path: 'Zip Artist - Zipped Song.zip' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'zip')
  assert.equal(tracks[0].artist, 'Zip Artist')
  assert.equal(tracks[0].title, 'Zipped Song')
  assert.equal(tracks[0].size, 3)

  const directory = await readZipDirectory(zip)
  const audioEntry = directory.entries.find(entry => entry.name.endsWith('.mp3'))
  assert.deepEqual([...await readZipEntry(zip, audioEntry)], [1, 2, 3])
})

test('buildLibrary reads deflated zipped MP3+G pairs', async () => {
  const audio = new Uint8Array(100).fill(1)
  const cdg = new Uint8Array(50).fill(2)
  const zip = makeZip([
    ['Deflate Artist - Deflated Song.mp3', audio],
    ['Deflate Artist - Deflated Song.cdg', cdg],
  ], { deflate: true })

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Deflate Artist - Deflated Song.zip'), path: 'Deflate Artist - Deflated Song.zip' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].artist, 'Deflate Artist')
  assert.equal(tracks[0].title, 'Deflated Song')

  const directory = await readZipDirectory(zip)
  const audioEntry = directory.entries.find(entry => entry.name.endsWith('.mp3'))
  assert.deepEqual([...(await readZipEntry(zip, audioEntry))], [...audio])
})

test('buildLibrary sorts by artist then title and deduplicates paths', async () => {
  const { tracks } = await buildLibrary([
    { file: file('The Beatles - Hey Jude.mp3'), path: 'The Beatles - Hey Jude.mp3' },
    { file: file('The Beatles - Hey Jude.cdg', cdgBytes), path: 'The Beatles - Hey Jude.cdg' },
    { file: file('The Beatles - Hey Jude.mp3'), path: 'The Beatles - Hey Jude.mp3' },
    { file: file('ABBA - Dancing Queen.mp3'), path: 'ABBA - Dancing Queen.mp3' },
    { file: file('ABBA - Dancing Queen.cdg', cdgBytes), path: 'ABBA - Dancing Queen.cdg' },
  ])

  assert.deepEqual(tracks.map(track => track.title), ['Dancing Queen', 'Hey Jude'])
  assert.deepEqual(tracks.map(track => track.artist), ['ABBA', 'Beatles, The'])
})

test('searchTracks ranks title matches and requires every token', async () => {
  const { tracks } = await buildLibrary([
    { file: file('Queen - Bohemian Rhapsody.mp3'), path: 'Queen - Bohemian Rhapsody.mp3' },
    { file: file('Queen - Bohemian Rhapsody.cdg', cdgBytes), path: 'Queen - Bohemian Rhapsody.cdg' },
    { file: file('The Beatles - Hey Jude.mp3'), path: 'The Beatles - Hey Jude.mp3' },
    { file: file('The Beatles - Hey Jude.cdg', cdgBytes), path: 'The Beatles - Hey Jude.cdg' },
  ])

  assert.deepEqual(searchTracks(tracks, 'hey jude').map(track => track.title), ['Hey Jude'])
  assert.deepEqual(searchTracks(tracks, 'queen bohemian').map(track => track.title), ['Bohemian Rhapsody'])
  assert.deepEqual(searchTracks(tracks, 'beatles nope'), [])
  assert.deepEqual(searchTracks(tracks, 'the').map(track => track.title), ['Hey Jude'])
})

test('searchTracks can restrict results to favourites', async () => {
  const { tracks } = await buildLibrary([
    { file: file('Queen - Bohemian Rhapsody.mp3'), path: 'Queen - Bohemian Rhapsody.mp3' },
    { file: file('Queen - Bohemian Rhapsody.cdg', cdgBytes), path: 'Queen - Bohemian Rhapsody.cdg' },
    { file: file('The Beatles - Hey Jude.mp3'), path: 'The Beatles - Hey Jude.mp3' },
    { file: file('The Beatles - Hey Jude.cdg', cdgBytes), path: 'The Beatles - Hey Jude.cdg' },
  ])

  const queen = tracks.find(track => track.artist === 'Queen')
  const favourites = new Set([queen.id])
  assert.deepEqual(searchTracks(tracks, '', favourites).map(track => track.title), ['Bohemian Rhapsody'])
  assert.deepEqual(searchTracks(tracks, 'hey', favourites), [])
})

test('groupByArtist groups tracks by display artist', async () => {
  const { tracks } = await buildLibrary([
    { file: file('ABBA - Dancing Queen.mp3'), path: 'ABBA - Dancing Queen.mp3' },
    { file: file('ABBA - Dancing Queen.cdg', cdgBytes), path: 'ABBA - Dancing Queen.cdg' },
    { file: file('ABBA - Waterloo.mp3'), path: 'ABBA - Waterloo.mp3' },
    { file: file('ABBA - Waterloo.cdg', cdgBytes), path: 'ABBA - Waterloo.cdg' },
  ])

  const artists = groupByArtist(tracks)
  assert.deepEqual([...artists.keys()], ['ABBA'])
  assert.equal(artists.get('ABBA').length, 2)
})

test('formatDuration and formatSize render display values', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(125.4), '2:05')
  assert.equal(formatDuration(Number.NaN), '—')
  assert.equal(formatDuration(-1), '—')

  assert.equal(formatSize(0), '')
  assert.equal(formatSize(1536), '2 KB')
  assert.equal(formatSize(5 * 1024 * 1024), '5.0 MB')
})

test('buildLibrary creates one track per song in multi-song zips', async () => {
  const zip = makeZip([
    ['Album/Song One.mp3', [1]],
    ['Album/Song One.cdg', [2]],
    ['Album/Song Two.mp3', [3, 4]],
    ['Album/Song Two.cdg', [5]],
    ['Album/cover.jpg', [6]],
    ['__MACOSX/._junk', [7]],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Artist - Karaoke Album.zip'), path: 'Artist - Karaoke Album.zip' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 2)
  // The entry folder supplies the artist when internal names have no delimiter.
  assert.deepEqual(tracks.map(track => track.artist), ['Album', 'Album'])
  assert.deepEqual(tracks.map(track => track.title).sort(), ['Song One', 'Song Two'])
  assert.equal(new Set(tracks.map(track => track.id)).size, 2)
  assert.ok(tracks.every(track => track.kind === 'zip'))
  assert.deepEqual(tracks.map(track => track.size).sort(), [1, 2])
})

test('buildLibrary warns about zip audio files without a .cdg', async () => {
  const zip = makeZip([
    ['A - One.mp3', [1]],
    ['A - One.cdg', [2]],
    ['A - Broken.mp3', [3]],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Archive.zip'), path: 'Archive.zip' },
  ])

  assert.equal(tracks.length, 1)
  assert.deepEqual(warnings, [
    { path: 'Archive.zip!/A - Broken.mp3', reason: 'missing .cdg or .lrc file' },
  ])
})

test('buildLibrary keeps scanning after a corrupt archive', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: new File([new Uint8Array(64)], 'Broken - Archive.zip'), path: 'Broken - Archive.zip' },
    { file: file('Fine - Song.mp3'), path: 'Fine - Song.mp3' },
    { file: file('Fine - Song.cdg', cdgBytes), path: 'Fine - Song.cdg' },
    { file: file('Readme.txt'), path: 'Readme.txt' },
  ])

  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].artist, 'Fine')
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].path, 'Broken - Archive.zip')
  assert.match(warnings[0].reason, /ZIP/)
})

test('buildLibrary pairs a lone mismatched audio/.cdg inside a zip', async () => {
  const zip = makeZip([
    ['track.mp3', [1, 2, 3]],
    ['song.cdg', [4]],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Queen - Live.zip'), path: 'Queen - Live.zip' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].artist, 'Queen')
  assert.equal(tracks[0].title, 'Live')
  assert.equal(tracks[0].size, 3)
})

/* -------------------------------------------------------------------------- */
/* LRC / ELRC pairing                                                         */
/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder()
const lrcText = '[00:01.00]Hello brave world\n[00:05.00]Second line\n'
const elrcText = [
  '[00:01.00]Hello brave world',
  '[00:01.00]Hello',
  '[00:01.40]brave',
  '[00:01.80]world',
  '[00:05.00]Second line',
  '[00:05.00]Second',
  '[00:05.50]line',
].join('\n')

function textFile (name, text) {
  return new File([encoder.encode(text)], name)
}

test('buildLibrary pairs audio with LRC and optional ELRC in a folder', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: file('Lyric Artist - Lyric Song.mp3'), path: 'Lyric Artist - Lyric Song.mp3' },
    { file: textFile('Lyric Artist - Lyric Song.lrc', lrcText), path: 'Lyric Artist - Lyric Song.lrc' },
    { file: textFile('Lyric Artist - Lyric Song.elrc', elrcText), path: 'Lyric Artist - Lyric Song.elrc' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'lrc')
  assert.equal(tracks[0].lrcFile.name, 'Lyric Artist - Lyric Song.lrc')
  assert.equal(tracks[0].elrcFile.name, 'Lyric Artist - Lyric Song.elrc')
  assert.equal(tracks[0].size, 100 + lrcText.length + elrcText.length)
})

test('buildLibrary supports ELRC-only lyrics with usable line headers', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: file('ELRC Artist - Header Song.mp3'), path: 'ELRC Artist - Header Song.mp3' },
    { file: textFile('ELRC Artist - Header Song.elrc', elrcText), path: 'ELRC Artist - Header Song.elrc' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'lrc')
  assert.equal(tracks[0].lrcFile, null)
  assert.equal(tracks[0].elrcFile.name, 'ELRC Artist - Header Song.elrc')
})

test('buildLibrary does not create a track for unusable ELRC-only lyrics', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: file('No Lyrics - Song.mp3'), path: 'No Lyrics - Song.mp3' },
    { file: textFile('No Lyrics - Song.elrc', '[ar:No lyric headers]\n'), path: 'No Lyrics - Song.elrc' },
  ])

  assert.equal(tracks.length, 0)
  assert.deepEqual(warnings, [
    { path: 'No Lyrics - Song.mp3', reason: 'missing .cdg or .lrc file' },
  ])
})

test('standalone lyric files are never playable tracks', async () => {
  const { tracks, warnings } = await buildLibrary([
    { file: textFile('Solo - Lyrics.lrc', lrcText), path: 'Solo - Lyrics.lrc' },
    { file: textFile('Solo - Extended.elrc', elrcText), path: 'Solo - Extended.elrc' },
  ])

  assert.equal(tracks.length, 0)
  assert.equal(warnings.length, 0)
})

test('CD+G wins when an audio file has both CDG and LRC companions', async () => {
  const { tracks } = await buildLibrary([
    { file: file('Both - Song.mp3'), path: 'Both - Song.mp3' },
    { file: file('Both - Song.cdg', cdgBytes), path: 'Both - Song.cdg' },
    { file: textFile('Both - Song.lrc', lrcText), path: 'Both - Song.lrc' },
  ])

  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'cdg')
  assert.equal(tracks[0].cdgFile.name, 'Both - Song.cdg')
  assert.equal(tracks[0].lrcFile, null)
})

test('buildLibrary pairs audio with LRC and optional ELRC inside a ZIP', async () => {
  const zip = makeZip([
    ['Zip Artist - Lyric Song.mp3', [1, 2, 3]],
    ['Zip Artist - Lyric Song.lrc', encoder.encode(lrcText)],
    ['Zip Artist - Lyric Song.elrc', encoder.encode(elrcText)],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Zip Artist - Lyric Song.zip'), path: 'Zip Artist - Lyric Song.zip' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'zip-lrc')
  assert.equal(tracks[0].zipEntries.audioEntry.name, 'Zip Artist - Lyric Song.mp3')
  assert.equal(tracks[0].zipEntries.lrcEntry.name, 'Zip Artist - Lyric Song.lrc')
  assert.equal(tracks[0].zipEntries.elrcEntry.name, 'Zip Artist - Lyric Song.elrc')
  assert.equal(tracks[0].zipEntries.cdgEntry, undefined)
})

test('buildLibrary supports ELRC-only ZIP tracks and rejects unusable ones', async () => {
  const valid = makeZip([
    ['Valid - Song.mp3', [1]],
    ['Valid - Song.elrc', encoder.encode(elrcText)],
  ])
  const invalid = makeZip([
    ['Invalid - Song.mp3', [1]],
    ['Invalid - Song.elrc', encoder.encode('[ar:No lines]')],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([valid], 'Valid.zip'), path: 'Valid.zip' },
    { file: new File([invalid], 'Invalid.zip'), path: 'Invalid.zip' },
  ])

  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].kind, 'zip-lrc')
  assert.equal(tracks[0].zipEntries.lrcEntry, null)
  assert.equal(tracks[0].zipEntries.elrcEntry.name, 'Valid - Song.elrc')
  assert.deepEqual(warnings, [
    { path: 'Invalid.zip!/Invalid - Song.mp3', reason: 'missing .cdg or .lrc file' },
  ])
})

test('buildLibrary creates one LRC track per song in a multi-song ZIP', async () => {
  const zip = makeZip([
    ['Album/Lyric One.mp3', [1]],
    ['Album/Lyric One.lrc', encoder.encode(lrcText)],
    ['Album/Lyric Two.mp3', [2, 3]],
    ['Album/Lyric Two.lrc', encoder.encode(lrcText)],
  ])

  const { tracks, warnings } = await buildLibrary([
    { file: new File([zip], 'Album Artist - Album Title.zip'), path: 'Album Artist - Album Title.zip' },
  ])

  assert.equal(warnings.length, 0)
  assert.equal(tracks.length, 2)
  assert.ok(tracks.every(track => track.kind === 'zip-lrc'))
  assert.deepEqual(tracks.map(track => track.title).sort(), ['Lyric One', 'Lyric Two'])
  assert.equal(new Set(tracks.map(track => track.id)).size, 2)
})

/* -------------------------------------------------------------------------- */
/* collectDirectoryRecords (resilient scanning, upstream issue #91)           */
/* -------------------------------------------------------------------------- */

function fakeFileEntry (name, { fail = false } = {}) {
  return {
    kind: 'file',
    name,
    getFile: async () => {
      if (fail) throw new Error('permission denied')
      return file(name)
    },
  }
}

function fakeDirEntry (name, children, { fail = false } = {}) {
  return {
    kind: 'directory',
    name,
    values: async function* () {
      if (fail) throw new Error('folder unavailable')
      for (const child of children) yield child
    },
  }
}

test('collectDirectoryRecords walks folders and skips unsupported files', async () => {
  const root = fakeDirEntry('', [
    fakeFileEntry('Queen - Song.mp3'),
    fakeFileEntry('Queen - Song.cdg'),
    fakeFileEntry('Queen - Song.lrc'),
    fakeFileEntry('Queen - Song.elrc'),
    fakeFileEntry('notes.txt'),
    fakeDirEntry('.hidden', [fakeFileEntry('Hidden - Song.mp3')]),
    fakeDirEntry('__MACOSX', [fakeFileEntry('Junk - Song.mp3')]),
    fakeDirEntry('Disc 2', [
      fakeFileEntry('ABBA - Waterloo.mp3'),
      fakeFileEntry('ABBA - Waterloo.cdg'),
      fakeDirEntry('deep', [fakeFileEntry('ABBA - SOS.flac')]),
    ]),
  ])

  const { records, warnings } = await collectDirectoryRecords(root)

  assert.equal(warnings.length, 0)
  assert.deepEqual(records.map(record => record.path), [
    'Queen - Song.mp3',
    'Queen - Song.cdg',
    'Queen - Song.lrc',
    'Queen - Song.elrc',
    'Disc 2/ABBA - Waterloo.mp3',
    'Disc 2/ABBA - Waterloo.cdg',
    'Disc 2/deep/ABBA - SOS.flac',
  ])
})

test('collectDirectoryRecords continues after unreadable files and folders', async () => {
  const root = fakeDirEntry('', [
    fakeFileEntry('Good - Song.mp3'),
    fakeFileEntry('Locked - Song.mp3', { fail: true }),
    fakeDirEntry('Broken Folder', [], { fail: true }),
    fakeDirEntry('Fine Folder', [fakeFileEntry('Fine - Song.mp3')]),
  ])

  const progress = []
  const { records, warnings } = await collectDirectoryRecords(root, {
    onEntry: ({ scanned }) => progress.push(scanned),
  })

  assert.deepEqual(records.map(record => record.path), [
    'Good - Song.mp3',
    'Fine Folder/Fine - Song.mp3',
  ])
  assert.equal(warnings.length, 2)
  assert.deepEqual(warnings[0], {
    path: 'Locked - Song.mp3',
    reason: 'could not read file (permission denied)',
  })
  assert.deepEqual(warnings[1], {
    path: 'Broken Folder',
    reason: 'could not read folder (folder unavailable)',
  })
  assert.deepEqual(progress, [1, 2, 3])
})
