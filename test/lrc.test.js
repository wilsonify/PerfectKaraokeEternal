import assert from 'node:assert/strict'
import test from 'node:test'
import { parseElrc, parseLrc, parseLyrics } from '../js/lrc.js'

test('parseLrc reads metadata and multiple timestamps per line', () => {
  const result = parseLrc([
    '[ar:Example Artist]',
    '[ti:Example Song]',
    '[length:1:05]',
    '[00:05.250][00:01.50]Hello',
    '[00:03.00]World',
  ].join('\n'))

  assert.equal(result.meta.ar, 'Example Artist')
  assert.equal(result.meta.ti, 'Example Song')
  assert.deepEqual(result.lines.map(line => [line.time, line.text]), [
    [1.5, 'Hello'],
    [3, 'World'],
    [5.25, 'Hello'],
  ])
})

test('parseLrc strips inline tags and ignores empty timed lines', () => {
  const result = parseLrc([
    '[00:01.00] [Chorus] Sing [00:01.50]along',
    '[00:02.00]',
    'not a timed line',
  ].join('\r\n'))

  assert.equal(result.lines.length, 1)
  assert.equal(result.lines[0].text, 'Sing along')
})

test('parseLyrics attaches ELRC word timings to LRC lines', () => {
  const lrc = [
    '[00:01.00]Hello brave new world',
    '[00:05.00]Second line',
  ].join('\n')
  const elrc = [
    '[00:01.00]Hello brave new world',
    '[00:01.00]Hello',
    '[00:01.40]brave',
    '[00:01.80]new',
    '[00:02.20]world',
    '[00:05.00]Second line',
  ].join('\n')

  const result = parseLyrics({ lrcText: lrc, elrcText: elrc })

  assert.equal(result.lines.length, 2)
  assert.deepEqual(result.lines[0].words, [
    { text: 'Hello', time: 1 },
    { text: 'brave', time: 1.4 },
    { text: 'new', time: 1.8 },
    { text: 'world', time: 2.2 },
  ])
  assert.deepEqual(result.lines[1].words, [])
})

test('parseElrc infers lines when there is no LRC companion', () => {
  const elrc = [
    '[ar:Example Artist]',
    '[00:01.00]Hello brave world',
    '[00:01.00]Hello',
    '[00:01.50]brave',
    '[00:02.00]world',
    '[00:03.00]Next line',
    '[00:03.00]Next',
    '[00:03.50]line',
  ].join('\n')

  const result = parseElrc(elrc)

  assert.equal(result.meta.ar, 'Example Artist')
  assert.deepEqual(result.lines.map(line => [line.time, line.text]), [
    [1, 'Hello brave world'],
    [3, 'Next line'],
  ])
  assert.deepEqual(result.lines[0].words.map(word => [word.time, word.text]), [
    [1, 'Hello'],
    [1.5, 'brave'],
    [2, 'world'],
  ])
})

test('parseElrc keeps word timing on single-word line headers', () => {
  const result = parseElrc([
    '[00:01.00]Oooooooooh',
    '[00:01.00]Oooooooooh',
    '[00:03.00]Next line',
    '[00:03.00]Next',
    '[00:03.40]line',
  ].join('\n'))

  assert.deepEqual(result.lines[0].words, [{ text: 'Oooooooooh', time: 1 }])
  assert.deepEqual(result.lines[1].words.map(word => word.text), ['Next', 'line'])
})

test('parseLyrics falls back to standalone ELRC line headers', () => {
  const result = parseLyrics({
    lrcText: '[ar:Example Artist]\n',
    elrcText: [
      '[00:01.00]One line only',
      '[00:01.00]One',
      '[00:01.40]line',
      '[00:01.80]only',
      '[00:04.00]A second line',
      '[00:04.50]A',
      '[00:04.80]second',
      '[00:05.10]line',
    ].join('\n'),
  })

  assert.equal(result.meta.ar, 'Example Artist')
  assert.deepEqual(result.lines.map(line => line.text), ['One line only', 'A second line'])
  assert.equal(result.lines[1].words.length, 3)
})

test('ELRC word matching tolerates punctuation and curly apostrophes', () => {
  const result = parseLyrics({
    lrcText: '[00:01.00]Don’t stop, believing!',
    elrcText: [
      '[00:01.00]Don’t stop, believing!',
      '[00:01.00]Don\'t',
      '[00:01.60]stop',
      '[00:02.10]believing',
    ].join('\n'),
  })

  assert.deepEqual(result.lines[0].words.map(word => [word.text, word.time]), [
    ['Don’t', 1],
    ['stop,', 1.6],
    ['believing!', 2.1],
  ])
})

test('ELRC-only files without usable line headers produce no lyrics', () => {
  assert.deepEqual(parseElrc('').lines, [])
  assert.deepEqual(parseElrc('[ar:No Lyrics]').lines, [])
  assert.deepEqual(parseLyrics({ lrcText: '', elrcText: '' }).lines, [])
})
