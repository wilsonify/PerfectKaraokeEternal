/*
 * Local library restoration.
 *
 * Returning users should get back to their library quickly, including in
 * browsers without the File System Access API. These helpers are pure so the
 * capability rules, permission outcomes and path normalisation can be tested
 * without a browser: the app decides what to render, this module decides what
 * the situation is.
 */

export const FOLDER_SOURCE_HANDLE = 'handle'
export const FOLDER_SOURCE_FALLBACK = 'fallback'

// VS Code's embedded browser runs on Electron, where the directory picker can
// exist but does not reliably complete the selection flow.
const EMBEDDED_BROWSER = /\bElectron\//

/** Choose the folder source for this browser environment. */
export function resolveFolderSource ({
  hasDirectoryPicker = false,
  isSecureContext = false,
  userAgent = '',
} = {}) {
  if (EMBEDDED_BROWSER.test(String(userAgent))) {
    return { source: FOLDER_SOURCE_FALLBACK, reason: 'embedded-browser' }
  }
  if (!isSecureContext) {
    return { source: FOLDER_SOURCE_FALLBACK, reason: 'insecure-context' }
  }
  if (!hasDirectoryPicker) {
    return { source: FOLDER_SOURCE_FALLBACK, reason: 'missing-directory-picker' }
  }
  return { source: FOLDER_SOURCE_HANDLE, reason: null }
}

/** Explain why Open music folder uses the browser's own directory input. */
export function folderPickerNote ({ source, reason } = {}) {
  if (source === FOLDER_SOURCE_HANDLE) return ''

  switch (reason) {
    case 'insecure-context':
      return 'This address is not secure, so the folder picker is unavailable; Open music folder uses the browser’s directory input.'
    case 'embedded-browser':
      return 'This embedded browser uses its own folder picker.'
    default:
      return 'This browser uses its own folder picker for Open music folder.'
  }
}

/** Normalise a scanned path to forward slashes without empty segments. */
export function normalizeScanPath (path) {
  const parts = String(path ?? '').replace(/\\/g, '/').split('/')
  const kept = []

  for (const part of parts) {
    if (!part || part === '.') continue
    kept.push(part)
  }

  return kept.join('/')
}

/**
 * Remove the shared top folder from a directory-input selection.
 * `webkitdirectory` reports `Music/Artist - Song.mp3`, while a directory
 * handle scan reports `Artist - Song.mp3`. Stripping the root keeps track ids
 * (and therefore the saved queue) stable across both sources. Selections
 * without one shared nested root are left alone.
 */
export function stripFolderRoot (records) {
  const list = Array.isArray(records) ? records : []
  if (list.length === 0) return []

  const paths = list.map(record => normalizeScanPath(
    record.path ?? record.file?.webkitRelativePath ?? record.file?.name ?? '',
  ))
  const nested = paths.every(path => path.includes('/'))
  const roots = new Set(paths.map(path => path.slice(0, path.indexOf('/'))))
  const root = nested && roots.size === 1 ? [...roots][0] : ''

  return list.map((record, index) => ({
    ...record,
    path: root ? paths[index].slice(root.length + 1) : paths[index],
  }))
}

/** Name of the folder shared by a directory-input selection, if any. */
export function folderNameFromRecords (records) {
  for (const record of records ?? []) {
    const path = normalizeScanPath(record.path ?? record.file?.webkitRelativePath ?? '')
    const [root, ...rest] = path.split('/')
    if (root && rest.length > 0) return root
  }

  return ''
}

/**
 * Check read permission before asking for it. Returns the outcome so the app
 * can explain it: granted (prompted or not), denied, blocked, or unavailable
 * because the handle is missing or its folder is gone.
 */
export async function ensureReadPermission (handle) {
  if (!handle) return { status: 'unavailable', reason: 'no-handle' }

  try {
    if (typeof handle.queryPermission === 'function') {
      const current = await handle.queryPermission({ mode: 'read' })
      if (current === 'granted') return { status: 'granted', prompted: false }
    }

    if (typeof handle.requestPermission !== 'function') {
      return { status: 'unavailable', reason: 'no-permission-api' }
    }

    const result = await handle.requestPermission({ mode: 'read' })
    if (result === 'granted') return { status: 'granted', prompted: true }
    return { status: result === 'denied' ? 'denied' : 'blocked', prompted: true }
  } catch (error) {
    return { status: 'unavailable', reason: error?.name ?? 'error' }
  }
}

/** Actionable message for a permission outcome; empty when it was granted. */
export function permissionMessage (outcome) {
  switch (outcome?.status) {
    case 'denied':
      return 'Folder access was not granted. Choose the folder again to retry.'
    case 'blocked':
      return 'Folder access is blocked for this site. Allow read access in the browser settings, then reopen the folder.'
    case 'unavailable':
      return 'That folder is no longer available. Choose it again.'
    default:
      return ''
  }
}

/** Label and tooltip for the reopen control. */
export function describeReopen (record) {
  const name = typeof record?.name === 'string' ? record.name.trim() : ''
  if (!name) return { hidden: true, label: 'Reopen last folder', title: '', reopenable: false }

  const reopenable = record?.source === FOLDER_SOURCE_HANDLE && record?.hasHandle !== false
  return {
    hidden: false,
    label: `Reopen “${name}”`,
    title: reopenable
      ? `Reopen “${name}” (the browser may ask for read access)`
      : `Reopen “${name}” — this browser asks for the folder again`,
    reopenable,
  }
}

/**
 * True when a selection produced nothing because the folder itself could not
 * be read. An empty but readable folder is a normal no-songs result.
 */
export function folderReadFailed ({ records = [], warnings = [] } = {}) {
  if (records.length > 0) return false
  return warnings.some(warning => /could not read folder/i.test(String(warning?.reason ?? '')))
}
