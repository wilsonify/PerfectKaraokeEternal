import assert from 'node:assert/strict'
import test from 'node:test'
import {
  describeAudioTrack,
  enableAudioTrack,
  listAudioTracks,
} from '../js/audio-tracks.js'

function makeTrack (id, enabled = false, label = '', language = '') {
  return { id, enabled, label, language }
}

function makeMedia (tracks) {
  const list = { length: tracks.length }
  tracks.forEach((track, index) => {
    list[index] = track
  })
  return { audioTracks: list }
}

test('listAudioTracks summarizes duck-typed audio track lists', () => {
  const media = makeMedia([
    makeTrack('v1', true, 'Vocal'),
    makeTrack('i1', false, '', 'eng'),
    makeTrack('b1'),
  ])

  assert.deepEqual(listAudioTracks(media), [
    { index: 0, id: 'v1', label: 'Vocal', language: '', enabled: true },
    { index: 1, id: 'i1', label: '', language: 'eng', enabled: false },
    { index: 2, id: 'b1', label: '', language: '', enabled: false },
  ])
})

test('listAudioTracks returns [] when the API is unavailable', () => {
  assert.deepEqual(listAudioTracks({}), [])
  assert.deepEqual(listAudioTracks(null), [])
  assert.deepEqual(listAudioTracks({ audioTracks: undefined }), [])
})

test('listAudioTracks falls back to stable indexes for empty ids', () => {
  const media = makeMedia([
    makeTrack('', false, 'Vocal'),
    makeTrack('', true, 'Instrumental'),
  ])

  assert.deepEqual(listAudioTracks(media).map(track => track.id), ['0', '1'])
  assert.equal(enableAudioTrack(media, '0'), true)
  assert.equal(media.audioTracks[0].enabled, true)
  assert.equal(media.audioTracks[1].enabled, false)
})

test('describeAudioTrack falls back to position and language', () => {
  assert.equal(describeAudioTrack({ label: ' Vocal ', language: '', index: 0 }), 'Vocal')
  assert.equal(describeAudioTrack({ label: '', language: 'eng', index: 1 }), 'Track 2 (eng)')
  assert.equal(describeAudioTrack({ label: '', language: '', index: 2 }), 'Track 3')
})

test('enableAudioTrack enables exactly one track by id', () => {
  const first = makeTrack('0', true)
  const second = makeTrack('1')
  const media = makeMedia([first, second])

  assert.equal(enableAudioTrack(media, '1'), true)
  assert.equal(first.enabled, false)
  assert.equal(second.enabled, true)

  assert.equal(enableAudioTrack(media, '0'), true)
  assert.equal(first.enabled, true)
  assert.equal(second.enabled, false)
})

test('enableAudioTrack leaves state unchanged for unknown ids', () => {
  const first = makeTrack('0', true)
  const media = makeMedia([first])

  assert.equal(enableAudioTrack(media, 'nope'), false)
  assert.equal(first.enabled, true)
  assert.equal(enableAudioTrack({}, '0'), false)
})
