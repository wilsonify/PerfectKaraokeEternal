import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLibrary,
  formatDuration,
  formatSize,
  groupByArtist,
  parseTrackName,
  searchTracks,
} from '../js/library.js'
import { readZipDirectory, readZipEntry } from '../js/zip.js'
import { trackNameCases } from './fixtures/track-names.js'

/** Build an uncompressed (method 0) ZIP archive; the reader ignores CRCs. */
function makeZip (entries) {
  const encoder = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0

  for (const [name, bytes] of entries) {
    const nameBytes = encoder.encode(name)
    const data = new Uint8Array(bytes)

    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
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
    reason: 'missing .cdg file',
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
