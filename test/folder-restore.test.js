import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FOLDER_SOURCE_FALLBACK,
  FOLDER_SOURCE_HANDLE,
  describeReopen,
  ensureReadPermission,
  folderNameFromRecords,
  folderPickerNote,
  folderReadFailed,
  normalizeScanPath,
  permissionMessage,
  resolveFolderSource,
  stripFolderRoot,
} from '../js/folder-restore.js'

function fakeHandle ({ query = 'granted', request = 'granted', error = null } = {}) {
  const calls = { query: 0, request: 0 }
  const handle = {
    async queryPermission () {
      calls.query++
      if (error) throw error
      return query
    },
    async requestPermission () {
      calls.request++
      if (error) throw error
      return request
    },
  }
  return { handle, calls }
}

test('resolveFolderSource prefers the directory picker only when fully supported', () => {
  assert.deepEqual(
    resolveFolderSource({ hasDirectoryPicker: true, isSecureContext: true, userAgent: 'Mozilla/5.0 Chrome/126' }),
    { source: FOLDER_SOURCE_HANDLE, reason: null },
  )

  assert.deepEqual(
    resolveFolderSource({ hasDirectoryPicker: false, isSecureContext: true }),
    { source: FOLDER_SOURCE_FALLBACK, reason: 'missing-directory-picker' },
  )

  assert.deepEqual(
    resolveFolderSource({ hasDirectoryPicker: true, isSecureContext: false }),
    { source: FOLDER_SOURCE_FALLBACK, reason: 'insecure-context' },
  )

  assert.deepEqual(
    resolveFolderSource({
      hasDirectoryPicker: true,
      isSecureContext: true,
      userAgent: 'Mozilla/5.0 Electron/31.0.0',
    }),
    { source: FOLDER_SOURCE_FALLBACK, reason: 'embedded-browser' },
  )
})

test('folderPickerNote explains only the fallback path', () => {
  assert.equal(folderPickerNote({ source: FOLDER_SOURCE_HANDLE, reason: null }), '')
  assert.match(folderPickerNote({ source: FOLDER_SOURCE_FALLBACK, reason: 'insecure-context' }), /not secure/)
  assert.match(folderPickerNote({ source: FOLDER_SOURCE_FALLBACK, reason: 'missing-directory-picker' }), /folder picker/)
  assert.match(folderPickerNote({ source: FOLDER_SOURCE_FALLBACK, reason: 'embedded-browser' }), /embedded/)
})

test('normalizeScanPath uses forward slashes and drops empty segments', () => {
  assert.equal(normalizeScanPath('Music\\Rock\\Song.mp3'), 'Music/Rock/Song.mp3')
  assert.equal(normalizeScanPath('./Music//Song.mp3'), 'Music/Song.mp3')
  assert.equal(normalizeScanPath(''), '')
  assert.equal(normalizeScanPath(undefined), '')
})

test('stripFolderRoot removes the shared top folder of a directory selection', () => {
  const records = [
    { path: 'Music/Artist - Song.mp3' },
    { path: 'Music/Artist - Song.cdg' },
  ]

  assert.deepEqual(
    stripFolderRoot(records).map(record => record.path),
    ['Artist - Song.mp3', 'Artist - Song.cdg'],
  )
})

test('stripFolderRoot leaves flat and multi-root selections alone', () => {
  assert.deepEqual(
    stripFolderRoot([{ path: 'Artist - Song.mp3' }]).map(record => record.path),
    ['Artist - Song.mp3'],
  )

  assert.deepEqual(
    stripFolderRoot([{ path: 'One/a.mp3' }, { path: 'Two/b.mp3' }]).map(record => record.path),
    ['One/a.mp3', 'Two/b.mp3'],
  )

  assert.deepEqual(stripFolderRoot([]), [])
})

test('folderNameFromRecords reports the directory selection root', () => {
  assert.equal(folderNameFromRecords([{ path: 'Music/Artist - Song.mp3' }]), 'Music')
  assert.equal(folderNameFromRecords([{ path: 'Artist - Song.mp3' }]), '')
  assert.equal(folderNameFromRecords([]), '')
})

test('ensureReadPermission skips requesting an already granted handle', async () => {
  const { handle, calls } = fakeHandle({ query: 'granted' })
  const outcome = await ensureReadPermission(handle)

  assert.deepEqual(outcome, { status: 'granted', prompted: false })
  assert.equal(calls.query, 1)
  assert.equal(calls.request, 0)
})

test('ensureReadPermission requests permission when it is still needed', async () => {
  const { handle, calls } = fakeHandle({ query: 'prompt', request: 'granted' })
  const outcome = await ensureReadPermission(handle)

  assert.deepEqual(outcome, { status: 'granted', prompted: true })
  assert.equal(calls.request, 1)
})

test('ensureReadPermission reports denied and blocked outcomes', async () => {
  const denied = fakeHandle({ query: 'prompt', request: 'denied' })
  assert.equal((await ensureReadPermission(denied.handle)).status, 'denied')

  const blocked = fakeHandle({ query: 'prompt', request: 'prompt' })
  assert.equal((await ensureReadPermission(blocked.handle)).status, 'blocked')
})

test('ensureReadPermission reports a missing, gone or unsupported handle', async () => {
  assert.deepEqual(await ensureReadPermission(null), { status: 'unavailable', reason: 'no-handle' })

  const gone = fakeHandle({ error: Object.assign(new Error('folder is gone'), { name: 'NotFoundError' }) })
  assert.deepEqual(await ensureReadPermission(gone.handle), { status: 'unavailable', reason: 'NotFoundError' })

  const unsupported = await ensureReadPermission({})
  assert.equal(unsupported.status, 'unavailable')
})

test('permissionMessage is actionable for refusals and empty on success', async () => {
  assert.equal(permissionMessage({ status: 'granted' }), '')
  assert.match(permissionMessage({ status: 'denied' }), /not granted/)
  assert.match(permissionMessage({ status: 'blocked' }), /blocked/)
  assert.match(permissionMessage({ status: 'unavailable' }), /no longer available/)
})

test('describeReopen labels a reopenable handle and a fallback folder differently', () => {
  assert.deepEqual(describeReopen(null), {
    hidden: true,
    label: 'Reopen last folder',
    title: '',
    reopenable: false,
  })

  const handle = describeReopen({ name: 'Music', source: FOLDER_SOURCE_HANDLE, hasHandle: true })
  assert.equal(handle.hidden, false)
  assert.equal(handle.label, 'Reopen “Music”')
  assert.equal(handle.reopenable, true)

  const fallback = describeReopen({ name: 'Music', source: FOLDER_SOURCE_FALLBACK })
  assert.equal(fallback.reopenable, false)
  assert.match(fallback.title, /asks for the folder again/)
})

test('describeReopen still offers a name when the handle is missing', () => {
  const info = describeReopen({ name: 'Music', source: FOLDER_SOURCE_HANDLE, hasHandle: false })
  assert.equal(info.hidden, false)
  assert.equal(info.reopenable, false)
  assert.match(info.title, /asks for the folder again/)
})

test('folderReadFailed only fires for an unreadable empty selection', () => {
  const unreadable = { path: '.', reason: 'could not read folder (NotAllowedError)' }

  assert.equal(folderReadFailed({ records: [], warnings: [unreadable] }), true)
  assert.equal(folderReadFailed({ records: [], warnings: [] }), false)
  assert.equal(folderReadFailed({ records: [], warnings: [{ path: 'x.mp3', reason: 'missing .cdg or .lrc file' }] }), false)
  assert.equal(folderReadFailed({ records: [{ path: 'song.mp3' }], warnings: [unreadable] }), false)
})
