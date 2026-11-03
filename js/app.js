import {
  buildLibrary,
  collectDirectoryRecords,
  diagnoseWarnings,
  formatDuration,
  formatQueueDuration,
  formatSize,
  getExtension,
  groupByArtist,
  matchesMediaFilter,
  mergeTracks,
  mergeWarnings,
  searchTracks,
  summarizeDurations,
  SUPPORTED_EXTENSIONS,
  trackMedia,
} from './library.js'
import { estimateAudioDuration } from './audio-duration.js'
import { describeAudioTrack } from './audio-tracks.js'
import KaraokePlayer from './player.js'
import { resolveShortcut } from './shortcuts.js'
import {
  FOLDER_SOURCE_FALLBACK,
  FOLDER_SOURCE_HANDLE,
  describeReopen,
  ensureReadPermission,
  folderNameFromRecords,
  folderPickerNote,
  folderReadFailed,
  permissionMessage,
  resolveFolderSource,
  stripFolderRoot,
} from './folder-restore.js'
import {
  DEFAULT_VISUAL_STYLE,
  normalizeVisualStyle,
  resolveSavedVisualStyle,
  VISUAL_STYLES,
} from './visualizer.js'

const PREFS_KEY = 'pke.prefs.v1'
const SESSION_KEY = 'pke.session.v1'
const FOLDER_KEY = 'pke.folder.v1'
const DB_NAME = 'pke-files'
const DB_STORE = 'handles'
const AUDIO_TRACK_MEMORY = 50
const DEFAULT_PREFS = {
  volume: 0.85,
  replayGain: false,
  cdgAlpha: 0.5,
  cdgSize: 0.65,
  visualStyle: DEFAULT_VISUAL_STYLE,
  sensitivity: 1,
  favorites: [],
  audioTracks: {},
}

const $ = id => document.getElementById(id)

function element (tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (typeof text === 'string') node.textContent = text
  return node
}

function iconButton (icon, label, className = '') {
  const button = element('button', `row-btn ${className}`.trim())
  button.type = 'button'
  button.setAttribute('aria-label', label)
  button.title = label
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'icon')
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
  use.setAttribute('href', `#i-${icon}`)
  svg.append(use)
  button.append(svg)
  return button
}

function setIcon (button, icon) {
  button?.querySelector('use')?.setAttribute('href', `#i-${icon}`)
}

function readJson (key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function writeJson (key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable (private mode); playback still works.
  }
}

const savedPrefs = readJson(PREFS_KEY) ?? {}
const { visualizer: legacyVisualizer, ...savedPrefsWithoutLegacy } = savedPrefs
const prefs = {
  ...DEFAULT_PREFS,
  ...savedPrefsWithoutLegacy,
  visualStyle: resolveSavedVisualStyle(savedPrefs.visualStyle, legacyVisualizer),
  favorites: Array.isArray(savedPrefs.favorites) ? savedPrefs.favorites : [],
  audioTracks: savedPrefs.audioTracks && typeof savedPrefs.audioTracks === 'object'
    ? savedPrefs.audioTracks
    : {},
}

const state = {
  tracks: [],
  trackMap: new Map(),
  warnings: [],
  lyrics: null,
  lyricLineEls: [],
  lyricIndex: -1,
  queue: [],
  currentId: null,
  history: [],
  favorites: new Set(prefs.favorites),
  filter: '',
  favoritesOnly: false,
  mediaFilter: 'all',
  focusedId: null,
  tab: 'library',
  openArtists: new Set(),
  visibleArtists: 60,
  visibleResults: 200,
  scanning: false,
  finished: false,
  error: null,
  folderHandle: null,
  folderRecord: null,
  dragIndex: null,
  seeking: false,
  lastVolume: prefs.volume || 0.85,
  media: {
    position: 0,
    duration: 0,
    isPlaying: false,
    buffering: false,
  },
}

const els = {
  stagePanel: $('stage-panel'),
  stage: $('stage'),
  cdgLayer: $('cdg-layer'),
  backdrop: $('cdg-backdrop'),
  canvas: $('cdg-canvas'),
  lyricsLayer: $('lyrics-layer'),
  lyricsScroll: $('lyrics-scroll'),
  lyricsLines: $('lyrics-lines'),
  visualizer: $('visualizer'),
  video: $('video'),
  audio: $('audio'),
  message: $('stage-message'),
  messageKicker: $('message-kicker'),
  messageTitle: $('message-title'),
  messageText: $('message-text'),
  messagePlay: $('message-play'),
  messagePlayLabel: $('message-play-label'),
  messageSkip: $('message-skip'),
  nowPlaying: $('now-playing'),
  nowTitle: $('now-title'),
  nowArtist: $('now-artist'),
  upNext: $('up-next'),
  upNextTitle: $('up-next-title'),
  buffering: $('buffering'),
  playpause: $('playpause'),
  prev: $('prev'),
  next: $('next'),
  seek: $('seek'),
  currentTime: $('current-time'),
  duration: $('duration'),
  mute: $('mute'),
  volume: $('volume'),
  audioTrack: $('audio-track'),
  fullscreen: $('fullscreen'),
  displayOptions: $('display-options'),
  scanStatus: $('scan-status'),
  openFolder: $('open-folder'),
  reopenFolder: $('reopen-folder'),
  reopenLabel: $('reopen-label'),
  addFiles: $('add-files'),
  folderInput: $('folder-input'),
  filesInput: $('files-input'),
  tabLibrary: $('tab-library'),
  tabQueue: $('tab-queue'),
  libraryPanel: $('library-panel'),
  queuePanel: $('queue-panel'),
  libraryCount: $('library-count'),
  queueCount: $('queue-count'),
  search: $('search'),
  favoritesToggle: $('favorites-toggle'),
  mediaFilters: $('media-filters'),
  librarySummary: $('library-summary'),
  warnings: $('warnings'),
  alphaPicker: $('alpha-picker'),
  libraryList: $('library-list'),
  queueList: $('queue-list'),
  currentCard: $('current-card'),
  queueSummary: $('queue-summary'),
  queueEmpty: $('queue-empty'),
  clearQueue: $('clear-queue'),
  historySection: $('history-section'),
  historyList: $('history-list'),
  footerStatus: $('footer-status'),
  optionsDialog: $('options-dialog'),
  cdgSize: $('cdg-size'),
  cdgSizeValue: $('cdg-size-value'),
  cdgAlpha: $('cdg-alpha'),
  cdgAlphaValue: $('cdg-alpha-value'),
  visualStyle: $('visual-style'),
  sensitivity: $('sensitivity'),
  sensitivityValue: $('sensitivity-value'),
  replayGain: $('replaygain-enabled'),
  resetOptions: $('reset-options'),
  toast: $('toast'),
}

let player
let toastTimer = null
let saveTimer = null
let nowPlayingTimer = null
let searchTimer = null

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

function savePrefs () {
  prefs.favorites = [...state.favorites]
  writeJson(PREFS_KEY, prefs)
}

function saveSessionSoon () {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveSession, 250)
}

function saveSession () {
  writeJson(SESSION_KEY, {
    queue: state.queue,
    currentId: state.currentId,
    history: state.history.slice(-200),
  })
}

function loadSession () {
  const session = readJson(SESSION_KEY)
  if (!session) return

  if (Array.isArray(session.queue)) {
    state.queue = session.queue.filter(id => typeof id === 'string')
  }
  if (Array.isArray(session.history)) {
    state.history = session.history.filter(id => typeof id === 'string').slice(-200)
  }
  if (typeof session.currentId === 'string') state.currentId = session.currentId
}

function openDatabase () {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable'))
      return
    }

    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveFolderHandle (handle) {
  try {
    const db = await openDatabase()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).put(handle, 'musicFolder')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Persisting the handle is a convenience, not a requirement.
  }
}

async function getFolderHandle () {
  try {
    const db = await openDatabase()
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly')
      const request = tx.objectStore(DB_STORE).get('musicFolder')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return handle ?? null
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Folder restoration                                                         */
/* -------------------------------------------------------------------------- */

function currentFolderEnvironment () {
  return {
    hasDirectoryPicker: typeof window.showDirectoryPicker === 'function',
    isSecureContext: Boolean(window.isSecureContext),
    userAgent: navigator.userAgent,
  }
}

/** Remember the last loaded folder so the next visit can offer it again. */
function rememberFolder (record) {
  state.folderRecord = record
  writeJson(FOLDER_KEY, record)
  renderReopen()
}

function renderReopen () {
  const info = describeReopen({
    ...state.folderRecord,
    hasHandle: state.folderRecord?.source === FOLDER_SOURCE_HANDLE && Boolean(state.folderHandle),
  })
  els.reopenFolder.hidden = info.hidden
  els.reopenLabel.textContent = info.label
  els.reopenFolder.title = info.title
}

/* -------------------------------------------------------------------------- */
/* Player                                                                     */
/* -------------------------------------------------------------------------- */

function getTrack (id) {
  return id === null ? null : state.trackMap.get(id) ?? null
}

/* -------------------------------------------------------------------------- */
/* Duration estimates                                                         */
/* -------------------------------------------------------------------------- */

const durationJobs = new Map()
const durationTried = new Set()
const DURATION_LIBRARY_LIMIT = 300
let libraryDurationsRequested = false

function canEstimateDuration (track) {
  if (!track?.file || track.duration) return false
  if (durationTried.has(track.id)) return false
  if (track.kind === 'zip' || track.kind === 'zip-lrc' || track.kind === 'mp4') return false
  return /\.mp3$/i.test(track.sourceName ?? track.path ?? '')
}

function estimateTrackDuration (track) {
  if (durationJobs.has(track.id)) return durationJobs.get(track.id)

  durationTried.add(track.id)
  const job = estimateAudioDuration(track.file)
    .then((result) => {
      if (!result) return false
      track.duration = result.seconds
      track.durationEstimated = result.estimated
      return true
    })
    .catch(() => false)
    .finally(() => durationJobs.delete(track.id))

  durationJobs.set(track.id, job)
  return job
}

/**
 * Fill in missing MP3 durations four at a time. The first frame is enough for
 * queue estimates, and updates are batched so the list does not flicker.
 */
async function hydrateDurations (tracks) {
  const pending = tracks.filter(track =>
    canEstimateDuration(track) && !durationJobs.has(track.id),
  )
  if (pending.length === 0) return

  let changed = false
  for (let i = 0; i < pending.length; i += 4) {
    const results = await Promise.all(pending.slice(i, i + 4).map(estimateTrackDuration))
    if (results.includes(true)) changed = true
  }

  if (changed) {
    renderLibrary()
    renderQueue()
  }
}

function initPlayer () {
  player = new KaraokePlayer(
    {
      stage: els.stage,
      cdgLayer: els.cdgLayer,
      backdrop: els.backdrop,
      canvas: els.canvas,
      lyricsLayer: els.lyricsLayer,
      visualizer: els.visualizer,
      video: els.video,
      audio: els.audio,
    },
    {
      onChange: handlePlayerEvent,
      onEnded: handleEnded,
    },
  )

  player.setVolume(prefs.volume)
  player.setReplayGainEnabled(prefs.replayGain)
  player.setOptions({
    cdgAlpha: prefs.cdgAlpha,
    cdgSize: prefs.cdgSize,
    visualizer: prefs.visualStyle !== 'off',
    visualStyle: prefs.visualStyle,
    sensitivity: prefs.sensitivity,
  })
  updateLyricsStyle()
}

function handlePlayerEvent (event) {
  switch (event.type) {
    case 'track':
      state.error = null
      state.media.position = 0
      state.media.duration = 0
      state.media.isPlaying = false
      els.audioTrack.hidden = true
      clearLyrics()
      setStageMessage({
        kicker: 'Loading',
        title: event.track.title,
        text: event.track.artist,
      })
      updateTransport()
      break

    case 'loaded':
      state.media.duration = event.duration || 0
      state.error = null
      els.message.hidden = true
      showNowPlaying(event.track)
      updateAudioTrackUI(event.track)
      showLyrics(event.lyrics)
      updateTransport()
      refreshSongStates()
      break

    case 'time':
      updateTimeUI(event.position, event.duration)
      updateLyrics(event.position)
      break

    case 'play':
      state.media.isPlaying = true
      state.finished = false
      state.error = null
      els.message.hidden = true
      updateTransport()
      refreshSongStates()
      break

    case 'pause':
      state.media.isPlaying = false
      updateTransport()
      break

    case 'buffering':
      state.media.buffering = event.value
      els.buffering.hidden = !event.value
      break

    case 'blocked':
      showToast(event.message)
      break

    case 'unloaded':
      clearLyrics()
      break

    case 'error':
      state.error = event.message
      state.media.isPlaying = false
      showStageMessage({
        kicker: 'Playback error',
        title: 'Could not play this song',
        text: event.message,
        play: true,
        playLabel: 'Retry',
        skip: state.queue.length > 0,
        hasMedia: true,
      })
      updateTransport()
      renderQueue()
      break
  }
}

function showNowPlaying (track) {
  els.nowTitle.textContent = track.title
  els.nowArtist.textContent = track.artist
  els.nowPlaying.hidden = false
  els.nowPlaying.classList.remove('fade')
  clearTimeout(nowPlayingTimer)
  nowPlayingTimer = setTimeout(() => {
    els.nowPlaying.classList.add('fade')
    nowPlayingTimer = setTimeout(() => {
      els.nowPlaying.hidden = true
    }, 500)
  }, 5000)
}

/* -------------------------------------------------------------------------- */
/* Synchronized LRC lyrics                                                    */
/* -------------------------------------------------------------------------- */

function updateLyricsStyle () {
  const scale = prefs.cdgSize / DEFAULT_PREFS.cdgSize
  els.lyricsLayer.style.setProperty('--lyrics-scale', scale.toFixed(2))
  els.lyricsLayer.style.setProperty('--lyrics-alpha', (prefs.cdgAlpha * 0.85).toFixed(2))
}

function clearLyrics () {
  state.lyrics = null
  state.lyricLineEls = []
  state.lyricIndex = -1
  els.lyricsLines.replaceChildren()
  els.lyricsScroll.scrollTop = 0
}

function buildLyricLine (line, index) {
  const item = element('li', 'lyric-item')
  const button = element('button', 'lyric-line')
  button.type = 'button'
  button.dataset.index = String(index)
  button.title = `Seek to ${formatDuration(line.time)}`
  button.setAttribute('aria-label', `Seek to: ${line.text}`)
  button.addEventListener('click', () => seekToLyric(index))

  const tokens = line.text.split(/(\s+)/u)
  let wordIndex = 0

  for (const token of tokens) {
    if (!token) continue
    if (/^\s+$/u.test(token)) {
      button.append(document.createTextNode(token))
      continue
    }

    const word = line.words[wordIndex]
    if (word && word.text === token) {
      const span = element('span', 'lyric-word', token)
      span.dataset.time = String(word.time)
      button.append(span)
      wordIndex++
    } else {
      button.append(document.createTextNode(token))
    }
  }

  item.append(button)
  return item
}

function scrollActiveLyric (line) {
  const container = els.lyricsScroll
  const top = line.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
  const target = top - container.clientHeight / 2 + line.offsetHeight / 2
  container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

function updateLyrics (time) {
  const lyrics = state.lyrics
  if (!lyrics || !Number.isFinite(time)) return

  let index = -1
  for (let i = 0; i < lyrics.lines.length; i++) {
    if (lyrics.lines[i].time <= time + 0.05) index = i
    else break
  }

  if (index !== state.lyricIndex) {
    state.lyricIndex = index

    state.lyricLineEls.forEach((line, lineIndex) => {
      line.classList.toggle('is-active', lineIndex === index)
      line.classList.toggle('is-past', lineIndex < index)
      if (lineIndex === index) line.setAttribute('aria-current', 'true')
      else line.removeAttribute('aria-current')
    })

    if (index >= 0) scrollActiveLyric(state.lyricLineEls[index])
  }

  if (index < 0) return
  const activeLine = state.lyricLineEls[index]
  for (const word of activeLine.querySelectorAll('.lyric-word')) {
    word.classList.toggle('is-sung', Number(word.dataset.time) <= time + 0.05)
  }
}

function seekToLyric (index) {
  const line = state.lyrics?.lines[index]
  if (!line) return
  player.seek(line.time)
  updateLyrics(line.time)
}

function showLyrics (lyrics) {
  clearLyrics()
  if (!lyrics?.lines?.length) return

  const fragment = document.createDocumentFragment()
  const lineEls = []

  lyrics.lines.forEach((line, index) => {
    const item = buildLyricLine(line, index)
    fragment.append(item)
    lineEls.push(item.querySelector('.lyric-line'))
  })

  els.lyricsLines.append(fragment)
  state.lyrics = lyrics
  state.lyricLineEls = lineEls
  state.lyricIndex = -1
  updateLyricsStyle()
  updateLyrics(state.media.position || 0)
}

function loadTrack (id, autoplay = true) {
  const track = getTrack(id)
  if (!track) {
    showToast('This song is no longer in the library. Reopen your music folder.')
    return
  }

  state.currentId = id
  state.error = null
  state.finished = false
  state.media.position = 0
  saveSessionSoon()
  updateTransport()
  refreshSongStates()
  renderQueue()
  player.load(track, { autoplay })
}

function handleEnded () {
  if (!state.currentId) return

  state.history.push(state.currentId)
  if (state.history.length > 200) state.history.shift()

  if (state.queue.length > 0) {
    const nextId = state.queue.shift()
    saveSessionSoon()
    renderQueue()
    refreshSongStates()
    loadTrack(nextId, true)
    return
  }

  state.finished = true
  state.media.isPlaying = false
  saveSessionSoon()
  updateTransport()
  renderQueue()
  refreshSongStates()
  showStageMessage({
    kicker: 'Queue complete',
    title: 'That was the last song',
    text: 'Add more songs from the library, or play this one again.',
    play: true,
    playLabel: 'Replay',
    hasMedia: true,
  })
}

function playNext () {
  if (!state.currentId && state.queue.length === 0) {
    showToast('Queue a song first.')
    return
  }

  // Once a song has ended (or a previous Next already recorded it), the same
  // play must not be appended to the history again.
  if (state.currentId && !state.finished) {
    state.history.push(state.currentId)
    if (state.history.length > 200) state.history.shift()
  }

  if (state.queue.length > 0) {
    state.finished = false
    state.currentId = state.queue.shift()
    saveSessionSoon()
    renderQueue()
    refreshSongStates()
    loadTrack(state.currentId, true)
    return
  }

  state.finished = true
  player.pause()
  state.media.isPlaying = false
  saveSessionSoon()
  updateTransport()
  renderQueue()
  refreshSongStates()
  showStageMessage({
    kicker: 'Queue complete',
    title: 'Nothing else queued',
    text: 'Pick another song from the library.',
    hasMedia: true,
  })
}

function previous () {
  if (!state.currentId) return
  if (state.media.position > 3) {
    player.seek(0)
    return
  }

  if (state.history.length > 0) {
    state.queue.unshift(state.currentId)
    state.currentId = state.history.pop()
    state.finished = false
    saveSessionSoon()
    renderQueue()
    refreshSongStates()
    loadTrack(state.currentId, true)
    return
  }

  player.seek(0)
}

function handlePlayPause () {
  if (state.tracks.length === 0) {
    showToast('Open your music folder first.')
    return
  }

  if (state.error) {
    const track = getTrack(state.currentId)
    if (track) {
      player.load(track, { autoplay: true })
      return
    }
  }

  if (state.finished) {
    if (state.queue.length > 0) {
      state.currentId = state.queue.shift()
      state.finished = false
      saveSessionSoon()
      renderQueue()
      loadTrack(state.currentId, true)
      return
    }

    if (state.currentId) {
      state.finished = false
      player.seek(0)
      player.play()
      return
    }
  }

  if (state.currentId && player.track?.id === state.currentId) {
    player.toggle()
    return
  }

  if (state.currentId) {
    loadTrack(state.currentId, true)
    return
  }

  if (state.queue.length > 0) {
    state.currentId = state.queue.shift()
    saveSessionSoon()
    renderQueue()
    loadTrack(state.currentId, true)
    return
  }

  showToast('Pick a song from the library to get started.')
}

function seekBy (seconds) {
  if (!state.media.duration) return
  player.seek(state.media.position + seconds)
}

/* -------------------------------------------------------------------------- */
/* Queue                                                                      */
/* -------------------------------------------------------------------------- */

function queueTrack (id, { next = false } = {}) {
  const track = getTrack(id)
  if (!track) return

  // Duplicate queue entries stay allowed: upstream deliberately supports
  // queueing the same song more than once, and the toast confirms each add.
  if (next) state.queue.unshift(id)
  else state.queue.push(id)

  saveSessionSoon()
  renderQueue()
  refreshSongStates()
  updateCounts()

  const copies = state.queue.filter(queuedId => queuedId === id).length
  if (next) showToast(`Up next: ${track.title}`)
  else if (copies > 1) showToast(`Queued again: ${track.title} (${copies} in queue)`)
  else showToast(`Queued: ${track.title}`)

  if (!state.currentId) refreshInitialMessage()

  if (state.finished && state.queue.length === 1) {
    showStageMessage({
      kicker: 'Ready',
      title: 'A song is queued',
      text: 'Press play to continue.',
      play: true,
      hasMedia: true,
    })
  }
}

function playNow (id, { consumeQueue = true } = {}) {
  const track = getTrack(id)
  if (!track) return

  if (state.currentId && state.currentId !== id && !state.finished) {
    state.history.push(state.currentId)
    if (state.history.length > 200) state.history.shift()
  }

  // Playing an upcoming song now consumes one queue entry; otherwise it would
  // play a second time when the queue reaches it. Queue rows remove their own
  // exact entry first, so other duplicates are left untouched.
  if (consumeQueue) {
    const queuedIndex = state.queue.indexOf(id)
    if (queuedIndex !== -1) state.queue.splice(queuedIndex, 1)
  }

  state.finished = false
  state.currentId = id
  saveSessionSoon()
  renderQueue()
  refreshSongStates()
  loadTrack(id, true)
}

function playQueueItem (index) {
  const [id] = state.queue.splice(index, 1)
  if (!id) return
  playNow(id, { consumeQueue: false })
}

function removeQueueItem (index) {
  state.queue.splice(index, 1)
  saveSessionSoon()
  renderQueue()
  refreshSongStates()
  updateCounts()
  if (!state.currentId) refreshInitialMessage()
}

function moveQueueItem (from, to) {
  if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return
  const [id] = state.queue.splice(from, 1)
  state.queue.splice(to, 0, id)
  saveSessionSoon()
  renderQueue()
  refreshSongStates()
}

function replayHistory (index) {
  const id = state.history[index]
  if (!id) return

  const remainder = [
    ...state.history.slice(index + 1),
    ...(state.currentId ? [state.currentId] : []),
    ...state.queue,
  ]

  state.history = state.history.slice(0, index)
  state.queue = remainder
  state.finished = false
  state.currentId = id
  saveSessionSoon()
  renderQueue()
  refreshSongStates()
  loadTrack(id, true)
}

function clearQueue () {
  if (state.queue.length === 0) return
  if (!window.confirm(`Remove all ${state.queue.length} upcoming songs from the queue?`)) return
  state.queue = []
  saveSessionSoon()
  renderQueue()
  refreshSongStates()
  updateCounts()
  showToast('Queue cleared.')
  if (!state.currentId) refreshInitialMessage()
}

function toggleFavorite (id) {
  if (state.favorites.has(id)) state.favorites.delete(id)
  else state.favorites.add(id)
  savePrefs()
  renderLibrary()
  refreshSongStates()
}

/* -------------------------------------------------------------------------- */
/* Library rendering                                                          */
/* -------------------------------------------------------------------------- */

function currentFilterTokens () {
  return state.filter.trim().split(/\s+/).filter(Boolean)
}

function highlightText (text, tokens) {
  if (tokens.length === 0) return document.createTextNode(text)

  const pattern = new RegExp(`(${tokens.map(token =>
    token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  ).join('|')})`, 'gi')
  const fragment = document.createDocumentFragment()
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, match.index)))
    }
    fragment.append(element('mark', null, match[0]))
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)))
  return fragment
}

function trackIsCurrent (id) {
  return state.currentId === id && !state.finished
}

function trackIsNext (id) {
  return state.queue[0] === id
}

function queueCountFor (id) {
  return state.queue.filter(queuedId => queuedId === id).length
}

function applyTrackState (row, id) {
  const current = trackIsCurrent(id)
  const next = trackIsNext(id)
  row.classList.toggle('is-current', current)
  row.classList.toggle('is-next', next)
  row.classList.toggle('is-upcoming', state.queue.includes(id))
  row.classList.toggle('is-played', state.history.includes(id) && !current)
  row.classList.toggle('is-focused', state.focusedId === id)
  if (current) row.setAttribute('aria-current', 'true')
  else row.removeAttribute('aria-current')

  const queueCount = queueCountFor(id)
  const countBadge = row.querySelector('.queue-count')
  if (countBadge) {
    countBadge.textContent = queueCount > 1 ? `×${queueCount}` : ''
    countBadge.hidden = queueCount < 2
  }
}

function describeMedia (track) {
  return trackMedia(track).map(item => item.title).join(', ')
}

function buildSongRow (track, { showArtist = false, tokens = [] } = {}) {
  const row = element('li', 'song-row')
  row.dataset.trackId = track.id
  applyTrackState(row, track.id)

  const main = element('button', 'song-main')
  main.type = 'button'
  main.dataset.trackId = track.id
  main.title = `${track.path}\n${formatSize(track.size)}\n${describeMedia(track)}`
  main.setAttribute('aria-label', `Queue ${track.title} by ${track.artist}. ${describeMedia(track)}`)

  const title = element('span', 'song-title')
  title.append(highlightText(track.title, tokens))
  main.append(title)

  const meta = element('span', 'song-meta')
  if (showArtist) {
    const artist = element('span', 'song-artist')
    artist.append(highlightText(track.artist, tokens))
    meta.append(artist)
  }

  const media = trackMedia(track)
  if (media.length > 0) {
    const badges = element('span', 'badges')
    for (const item of media) {
      const badge = element('span', `badge badge-${item.tone}`, item.label)
      badge.title = item.title
      badges.append(badge)
    }
    meta.append(badges)
  }

  const count = element('span', 'queue-count')
  count.hidden = queueCountFor(track.id) < 2
  meta.append(count)

  main.append(meta)
  main.addEventListener('click', () => {
    state.focusedId = track.id
    queueTrack(track.id)
  })
  main.addEventListener('focus', () => {
    if (state.focusedId === track.id) return
    state.focusedId = track.id
    for (const other of els.libraryList.querySelectorAll('.song-row')) {
      other.classList.toggle('is-focused', other.dataset.trackId === track.id)
    }
    const active = els.libraryList.querySelector('.song-main[tabindex="0"]')
    if (active && active !== main) active.tabIndex = -1
    main.tabIndex = 0
  })
  row.append(main)

  const duration = element(
    'span',
    track.durationEstimated ? 'duration is-estimated' : 'duration',
    track.durationEstimated ? `~${formatDuration(track.duration)}` : formatDuration(track.duration),
  )
  if (track.durationEstimated) duration.title = 'Estimated duration'
  row.append(duration)

  const next = iconButton('next', `Play ${track.title} next`, 'queue-next')
  next.addEventListener('click', () => queueTrack(track.id, { next: true }))
  row.append(next)

  const star = iconButton('star', state.favorites.has(track.id) ? 'Remove from favorites' : 'Add to favorites', 'star')
  star.classList.toggle('is-on', state.favorites.has(track.id))
  star.setAttribute('aria-pressed', String(state.favorites.has(track.id)))
  star.addEventListener('click', () => toggleFavorite(track.id))
  row.append(star)

  const play = iconButton('play', `Play ${track.title} now`, 'play-now')
  play.addEventListener('click', () => playNow(track.id))
  row.append(play)

  return row
}

function visibleSongMains () {
  return [...els.libraryList.querySelectorAll('.song-main')]
}

/**
 * One tab stop for the whole song list. Arrow keys move between songs, so
 * keyboard users can browse a large library without tabbing through every row.
 */
function applyRovingTabindex (preferredId = state.focusedId) {
  const mains = visibleSongMains()
  if (mains.length === 0) return

  const preferred = preferredId
    ? mains.find(main => main.dataset.trackId === preferredId)
    : null
  const active = preferred ?? mains[0]

  for (const main of mains) main.tabIndex = main === active ? 0 : -1
  state.focusedId = active.dataset.trackId
  for (const row of els.libraryList.querySelectorAll('.song-row')) {
    row.classList.toggle('is-focused', row.dataset.trackId === state.focusedId)
  }
}

function moveLibraryFocus (direction) {
  const mains = visibleSongMains()
  if (mains.length === 0) return
  const currentIndex = mains.findIndex(main => main.dataset.trackId === state.focusedId)
  const fallback = direction > 0 ? 0 : mains.length - 1
  const nextIndex = currentIndex === -1
    ? fallback
    : Math.max(0, Math.min(mains.length - 1, currentIndex + direction))
  mains[nextIndex].focus()
}

function renderArtistGroups (artists) {
  const tokens = currentFilterTokens()
  const names = [...artists.keys()]
  const visible = names.slice(0, state.visibleArtists)

  for (const name of visible) {
    const tracks = artists.get(name)
    const details = element('details', 'artist-group')
    details.dataset.artist = name
    details.dataset.artistKey = tracks[0]?.artistKey ?? name.toLowerCase()
    details.dataset.letter = /^[a-z]/i.test(name) ? name[0].toUpperCase() : '#'
    details.open = state.openArtists.has(name)
    if (tracks.some(track => trackIsCurrent(track.id))) details.classList.add('has-current')

    const summary = element('summary')
    const artistName = element('span', 'artist-name', name)
    const count = element('span', 'artist-count', String(tracks.length))
    summary.append(artistName, count)
    summary.addEventListener('click', () => {
      // The browser toggles `open` after this handler; defer the bookkeeping.
      queueMicrotask(() => {
        if (details.open) state.openArtists.add(name)
        else state.openArtists.delete(name)
      })
    })

    const list = element('ul', 'song-list')
    for (const track of tracks) list.append(buildSongRow(track, { tokens }))

    details.append(summary, list)
    els.libraryList.append(details)
  }

  if (names.length > state.visibleArtists) {
    const more = element(
      'button',
      'load-more',
      `Show more artists (${names.length - state.visibleArtists} remaining)`,
    )
    more.type = 'button'
    more.addEventListener('click', () => {
      state.visibleArtists += 60
      renderLibrary()
    })
    els.libraryList.append(more)
  }
}

function renderSearchResults (tracks) {
  const tokens = currentFilterTokens()

  if (tracks.length === 0) {
    const label = { cdg: 'CD+G', lyrics: 'LRC', video: 'MP4', zip: 'ZIP' }[state.mediaFilter]
    let message = 'No songs match that search.'
    if (!state.filter) {
      if (state.favoritesOnly) message = 'No favorite songs yet. Use the star on a song to add one.'
      else if (label) message = `No ${label} songs in this library.`
    }
    els.libraryList.append(element('p', 'list-note', message))
    return
  }

  const list = element('ul', 'song-list search-list')
  const visible = tracks.slice(0, state.visibleResults)
  for (const track of visible) {
    list.append(buildSongRow(track, { showArtist: true, tokens }))
  }
  els.libraryList.append(list)

  if (tracks.length > state.visibleResults) {
    const more = element(
      'button',
      'load-more',
      `Show more results (${tracks.length - state.visibleResults} remaining)`,
    )
    more.type = 'button'
    more.addEventListener('click', () => {
      state.visibleResults += 200
      renderLibrary()
    })
    els.libraryList.append(more)
  }
}

function renderWarnings () {
  if (state.warnings.length === 0) {
    els.warnings.hidden = true
    els.warnings.replaceChildren()
    return
  }

  const report = diagnoseWarnings(state.warnings)
  els.warnings.hidden = false

  const details = element('details')
  const summary = element(
    'summary',
    null,
    `${report.total} file${report.total === 1 ? '' : 's'} skipped during the scan · see how to fix`,
  )

  const groups = element('div', 'warning-groups')
  for (const group of report.groups) {
    const section = element('section', 'warning-group')
    const heading = element('h3', null, `${group.category} (${group.items.length})`)
    section.append(heading, element('p', 'warning-hint', group.hint))

    const list = element('ul')
    for (const item of group.items) {
      const entry = element('li')
      entry.append(element('code', null, item.displayPath))
      entry.append(document.createTextNode(` — ${item.reason}`))
      list.append(entry)
    }
    section.append(list)
    groups.append(section)
  }

  details.append(summary, groups)
  els.warnings.replaceChildren(details)
}

function renderAlphaPicker (artists) {
  if (state.filter || state.favoritesOnly || state.mediaFilter !== 'all' || artists.size === 0) {
    els.alphaPicker.hidden = true
    els.alphaPicker.replaceChildren()
    return
  }

  const letters = new Set([...artists.keys()].map(name => /^[a-z]/i.test(name) ? name[0].toUpperCase() : '#'))
  els.alphaPicker.hidden = false
  els.alphaPicker.replaceChildren()

  for (const letter of [...letters].sort((a, b) => a.localeCompare(b))) {
    const button = element('button', null, letter)
    button.type = 'button'
    button.setAttribute('aria-label', `Jump to artists starting with ${letter}`)
    button.addEventListener('click', () => {
      const target = els.libraryList.querySelector(`.artist-group[data-letter="${CSS.escape(letter)}"]`)
      if (!target) {
        showToast(`No visible artist starts with ${letter}.`)
        return
      }
      state.openArtists.add(target.dataset.artist)
      target.open = true
      target.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
    els.alphaPicker.append(button)
  }
}

function renderLibrary () {
  const scrollTop = els.libraryList.scrollTop
  els.libraryList.replaceChildren()

  const artists = groupByArtist(state.tracks)
  const filtering = Boolean(state.filter || state.favoritesOnly || state.mediaFilter !== 'all')
  const matched = filtering
    ? searchTracks(state.tracks, state.filter, state.favoritesOnly ? state.favorites : null)
    : []
  const filtered = filtering
    ? matched.filter(track => matchesMediaFilter(track, state.mediaFilter))
    : null

  const totals = summarizeDurations(state.tracks)
  const totalTime = formatQueueDuration(totals.seconds)
  const summaryParts = [
    `${state.tracks.length} song${state.tracks.length === 1 ? '' : 's'}`,
    `${artists.size} artist${artists.size === 1 ? '' : 's'}`,
    totalTime ? `${totalTime} total` : null,
    state.favoritesOnly ? `${state.favorites.size} favorite${state.favorites.size === 1 ? '' : 's'}` : null,
    filtered ? `${filtered.length} shown` : null,
  ]

  els.librarySummary.textContent = state.tracks.length === 0
    ? 'No songs loaded yet.'
    : summaryParts.filter(Boolean).join(' · ')

  updateCounts()
  renderWarnings()

  if (state.scanning && state.tracks.length === 0) {
    els.libraryList.append(element('p', 'list-note', 'Scanning your music folder…'))
    els.alphaPicker.hidden = true
    return
  }

  if (state.tracks.length === 0) {
    els.libraryList.append(element(
      'p',
      'list-note',
      'Open a folder containing MP3+G, LRC, or MP4 karaoke files. Audio can use a matching “Artist - Title.cdg”, “Artist - Title.lrc”, or “Artist - Title.elrc”.',
    ))
    els.alphaPicker.hidden = true
    return
  }

  if (filtered) {
    els.alphaPicker.hidden = true
    renderSearchResults(filtered)
  } else {
    renderAlphaPicker(artists)
    renderArtistGroups(artists)
  }

  applyRovingTabindex()
  els.libraryList.scrollTop = scrollTop
  if (!libraryDurationsRequested) {
    libraryDurationsRequested = true
    void hydrateDurations(state.tracks.slice(0, DURATION_LIBRARY_LIMIT))
  }
}

function refreshSongStates () {
  for (const row of els.libraryList.querySelectorAll('[data-track-id]')) {
    applyTrackState(row, row.dataset.trackId)
  }

  for (const details of els.libraryList.querySelectorAll('.artist-group')) {
    const current = state.currentId ? getTrack(state.currentId) : null
    details.classList.toggle(
      'has-current',
      Boolean(current && current.artistKey === details.dataset.artistKey && !state.finished),
    )
  }

  updateCounts()
}

function updateCounts () {
  els.libraryCount.textContent = String(state.tracks.length)
  els.queueCount.textContent = String(state.queue.length)
}

/* -------------------------------------------------------------------------- */
/* Queue rendering                                                            */
/* -------------------------------------------------------------------------- */

function queueTrackForRow (id) {
  return getTrack(id)
}

function buildQueueRow (id, index, { history = false } = {}) {
  const track = queueTrackForRow(id)
  const row = element('li', 'queue-item')
  row.dataset.index = String(index)
  row.dataset.queueId = id
  if (!history) {
    row.classList.toggle('is-next', index === 0 && !trackIsCurrent(id))
    row.draggable = true
    row.addEventListener('dragstart', (event) => {
      state.dragIndex = index
      row.classList.add('dragging')
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
    })
    row.addEventListener('dragend', () => {
      state.dragIndex = null
      row.classList.remove('dragging')
      clearDropTargets()
    })
    row.addEventListener('dragover', (event) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      clearDropTargets()
      row.classList.add('drop-target')
    })
    row.addEventListener('drop', (event) => {
      event.preventDefault()
      if (state.dragIndex === null) return
      moveQueueItem(state.dragIndex, index)
    })
  }

  if (!history) {
    row.append(element('span', 'queue-position', String(index + 1)))
    if (index === 0) row.append(element('span', 'queue-flag', 'Next'))
    else row.append(element('span', 'queue-flag-spacer', ''))
    const handle = element('span', 'drag-handle')
    handle.title = 'Drag to reorder'
    handle.setAttribute('aria-hidden', 'true')
    const handleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    handleIcon.setAttribute('class', 'icon')
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    use.setAttribute('href', '#i-grip')
    handleIcon.append(use)
    handle.append(handleIcon)
    row.append(handle)
  }

  const info = element('div', 'song-info')
  info.append(element('strong', null, track?.title ?? 'Unavailable song'))
  info.append(element('span', null, track?.artist ?? 'Reopen the original music folder to restore this entry'))
  if (track) {
    const badges = element('span', 'queue-media')
    for (const item of trackMedia(track)) {
      const badge = element('span', `badge badge-${item.tone}`, item.label)
      badge.title = item.title
      badges.append(badge)
    }
    const copies = history ? 0 : queueCountFor(id)
    if (copies > 1) badges.append(element('span', 'queue-count', `×${copies} in queue`))
    if (track.duration) {
      badges.append(element(
        'span',
        track.durationEstimated ? 'queue-duration is-estimated' : 'queue-duration',
        track.durationEstimated ? `~${formatDuration(track.duration)}` : formatDuration(track.duration),
      ))
    }
    if (badges.childElementCount > 0) info.append(badges)
  }
  row.append(info)

  const actions = element('div', 'queue-actions')
  if (history) {
    const restart = iconButton('restart', 'Restart the queue from this song')
    restart.addEventListener('click', () => replayHistory(index))
    actions.append(restart)
  } else {
    const play = iconButton('play', 'Play this song now')
    play.addEventListener('click', () => playQueueItem(index))
    actions.append(play)

    const toFront = iconButton('next', 'Move to the front of the queue')
    toFront.disabled = index === 0
    toFront.addEventListener('click', () => moveQueueItem(index, 0))
    actions.append(toFront)

    const up = iconButton('up', 'Move up')
    up.disabled = index === 0
    up.addEventListener('click', () => moveQueueItem(index, index - 1))
    actions.append(up)

    const down = iconButton('down', 'Move down')
    down.disabled = index === state.queue.length - 1
    down.addEventListener('click', () => moveQueueItem(index, index + 1))
    actions.append(down)

    const remove = iconButton('trash', 'Remove from queue')
    remove.addEventListener('click', () => removeQueueItem(index))
    actions.append(remove)
  }

  row.append(actions)
  return row
}

function clearDropTargets () {
  for (const row of els.queueList.querySelectorAll('.drop-target')) {
    row.classList.remove('drop-target')
  }
}

function renderQueue () {
  updateCounts()
  els.queueList.replaceChildren()

  const current = getTrack(state.currentId)
  if (state.currentId) {
    els.currentCard.hidden = false
    els.currentCard.replaceChildren()

    const label = element('span', 'label', state.error ? 'Playback error' : state.finished ? 'Last played' : 'Current song')
    els.currentCard.append(label)
    if (current) {
      els.currentCard.append(element('strong', null, current.title))
      const meta = element('p', null, `${current.artist} · ${trackMedia(current).map(item => item.label).join(' · ')}`)
      els.currentCard.append(meta)
    } else {
      els.currentCard.append(element('strong', null, 'Unavailable song'))
      els.currentCard.append(element('p', null, 'Reopen the original music folder to restore it.'))
    }
    if (state.error) els.currentCard.append(element('p', 'error', state.error))
  } else {
    els.currentCard.hidden = true
    els.currentCard.replaceChildren()
  }

  for (let i = 0; i < state.queue.length; i++) {
    els.queueList.append(buildQueueRow(state.queue[i], i))
  }

  const queueTracks = state.queue.map(getTrack).filter(Boolean)
  const totals = summarizeDurations(queueTracks)
  void hydrateDurations(queueTracks)
  if (state.queue.length === 0) {
    els.queueSummary.hidden = true
    els.queueSummary.textContent = ''
  } else {
    const parts = [`${state.queue.length} upcoming`]
    const time = formatQueueDuration(totals.seconds)
    if (time) parts.push(time)
    if (totals.unknown > 0) parts.push(`${totals.unknown} duration${totals.unknown === 1 ? '' : 's'} unknown`)
    els.queueSummary.hidden = false
    els.queueSummary.textContent = parts.join(' · ')
  }

  if (state.queue.length === 0) {
    const missing = state.tracks.length === 0 && state.currentId
    els.queueEmpty.hidden = false
    els.queueEmpty.textContent = missing
      ? 'Open your music folder to restore the saved queue.'
      : state.finished
        ? 'The queue is complete. Add another song to keep singing.'
        : 'Nothing queued yet. Pick a song from the library.'
  } else {
    els.queueEmpty.hidden = true
  }

  els.clearQueue.disabled = state.queue.length === 0

  els.historySection.hidden = state.history.length === 0
  els.historyList.replaceChildren()
  for (let i = state.history.length - 1; i >= 0; i--) {
    els.historyList.append(buildQueueRow(state.history[i], i, { history: true }))
  }

  const nextTrack = getTrack(state.queue[0])
  if (nextTrack) {
    els.upNext.hidden = false
    const nextDuration = nextTrack.duration
      ? ` · ${nextTrack.durationEstimated ? '~' : ''}${formatDuration(nextTrack.duration)}`
      : ''
    els.upNextTitle.textContent = `${nextTrack.title} — ${nextTrack.artist}${nextDuration}`
  } else {
    els.upNext.hidden = true
    els.upNextTitle.textContent = ''
  }
}

/* -------------------------------------------------------------------------- */
/* Transport & messages                                                       */
/* -------------------------------------------------------------------------- */

function updateSeekFill (input, percent) {
  input.style.setProperty('--fill', `${Math.max(0, Math.min(100, percent))}%`)
}

function updateTimeUI (position, duration) {
  state.media.position = Number.isFinite(position) ? position : 0
  state.media.duration = Number.isFinite(duration) && duration > 0 ? duration : state.media.duration

  if (!state.seeking) {
    const percent = state.media.duration ? (state.media.position / state.media.duration) * 100 : 0
    els.seek.value = String(Math.round(percent * 10))
    updateSeekFill(els.seek, percent)
    els.currentTime.textContent = formatDuration(state.media.position)
  }

  els.duration.textContent = formatDuration(state.media.duration)
  els.seek.disabled = !state.media.duration
}

function updateTransport () {
  const playing = state.media.isPlaying
  setIcon(els.playpause, playing ? 'pause' : 'play')
  els.playpause.setAttribute('aria-label', playing ? 'Pause' : 'Play')
  els.playpause.title = playing ? 'Pause (Space)' : 'Play (Space)'

  els.prev.disabled = !state.currentId
  els.next.disabled = !state.currentId && state.queue.length === 0
  els.seek.disabled = !state.media.duration

  const percent = state.media.duration ? (state.media.position / state.media.duration) * 100 : 0
  els.currentTime.textContent = formatDuration(state.media.position)
  els.duration.textContent = formatDuration(state.media.duration)
  if (!state.seeking) {
    els.seek.value = String(Math.round(percent * 10))
    updateSeekFill(els.seek, percent)
  }

  setIcon(els.mute, prefs.volume === 0 ? 'mute' : 'volume')
  els.mute.setAttribute('aria-label', prefs.volume === 0 ? 'Unmute' : 'Mute')
  els.volume.value = String(prefs.volume)
  updateSeekFill(els.volume, prefs.volume * 100)
  els.buffering.hidden = !state.media.buffering

  els.footerStatus.textContent = state.tracks.length > 0
    ? `${state.tracks.length} songs · ${state.currentId ? (state.media.isPlaying ? 'playing' : 'paused') : 'ready'}`
    : 'Local library · no uploads'
}

function setStageMessage ({ kicker, title, text, play = false, playLabel = 'Play', skip = false, hasMedia = false }) {
  els.message.hidden = false
  els.message.classList.toggle('has-media', hasMedia)
  els.messageKicker.textContent = kicker
  els.messageTitle.textContent = title
  els.messageText.textContent = text
  els.messagePlay.hidden = !play
  els.messagePlayLabel.textContent = playLabel
  els.messageSkip.hidden = !skip
}

function showStageMessage (options) {
  setStageMessage(options)
}

function showToast (message) {
  els.toast.textContent = message
  els.toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800)
}

function refreshInitialMessage () {
  if (state.scanning && state.tracks.length === 0) {
    setStageMessage({
      kicker: 'Scanning',
      title: 'Reading your music folder',
      text: 'Looking for audio with .cdg, .lrc, or .elrc companions, plus MP4 videos…',
    })
    return
  }

  if (state.tracks.length === 0) {
    setStageMessage({
      kicker: 'Ready',
      title: 'Open your karaoke folder',
      text: 'MP3+G, audio with LRC/ELRC lyrics, zipped songs, and MP4 files are supported. Everything stays on this computer.',
    })
    return
  }

  if (state.currentId && player.track?.id !== state.currentId) {
    const track = getTrack(state.currentId)
    const next = getTrack(state.queue[0])
    setStageMessage({
      kicker: 'Ready',
      title: track ? `${track.title} — ${track.artist}` : 'Saved queue restored',
      text: next
        ? `Press play to resume. Up next: ${next.title} — ${next.artist}.`
        : 'Press play to continue where you left off.',
      play: true,
    })
    return
  }

  if (state.currentId && player.track?.id === state.currentId) {
    els.message.hidden = true
    return
  }

  const next = getTrack(state.queue[0])
  setStageMessage({
    kicker: 'Library ready',
    title: next ? 'Ready for the first song' : 'Pick a song to start singing',
    text: next
      ? `${next.title} — ${next.artist} is up first. Press Play or Space, or pick another song.`
      : `${state.tracks.length} song${state.tracks.length === 1 ? '' : 's'} ready. Search with /, use the up/down arrow keys to browse, then Enter to queue.`,
    play: Boolean(next),
    hasMedia: Boolean(next),
  })
}

/* -------------------------------------------------------------------------- */
/* File scanning                                                              */
/* -------------------------------------------------------------------------- */

function setScanStatus (text) {
  els.scanStatus.textContent = text
}

function setScanning (value) {
  state.scanning = value
  els.openFolder.disabled = value
  els.addFiles.disabled = value
  els.reopenFolder.disabled = value
}

async function scanDirectoryHandle (handle) {
  const permission = await ensureReadPermission(handle)
  if (permission.status !== 'granted') {
    showToast(permissionMessage(permission))
    return
  }

  state.folderHandle = handle
  void saveFolderHandle(handle)
  rememberFolder({ name: handle.name, source: FOLDER_SOURCE_HANDLE })

  setScanning(true)
  setScanStatus(`Scanning “${handle.name}”…`)
  refreshInitialMessage()

  try {
    const { records, warnings } = await collectDirectoryRecords(handle, {
      onEntry: ({ scanned }) => {
        if (scanned % 40 === 0) {
          setScanStatus(`Scanning “${handle.name}”… ${scanned} media files found`)
        }
      },
    })
    // A folder that cannot be read at all must not replace the loaded library.
    if (folderReadFailed({ records, warnings })) {
      setScanning(false)
      setScanStatus('Folder scan failed.')
      refreshInitialMessage()
      showToast(`Could not read “${handle.name}”. The current library was left unchanged.`)
      return
    }

    await scanRecords(records, `“${handle.name}”`, warnings)
  } catch (error) {
    setScanning(false)
    setScanStatus('Folder scan failed.')
    refreshInitialMessage()
    showToast(`Could not scan that folder: ${error.message}`)
  }
}

async function scanFileList (fileList, { append = false, folder = false } = {}) {
  let records = []

  for (const file of fileList) {
    if (!SUPPORTED_EXTENSIONS.includes(getExtension(file.name))) continue
    records.push({
      file,
      path: (file.webkitRelativePath || file.name).replace(/\\/g, '/'),
    })
  }

  if (records.length === 0) {
    showToast('No MP3+G, LRC/ELRC, ZIP, or MP4 files were found in that selection.')
    return
  }

  let sourceLabel = 'selected files'

  if (folder) {
    const name = folderNameFromRecords(records)
    if (name) {
      // The directory input reports the folder name as the first path segment.
      // Strip it so track ids match a directory-handle scan of the same folder.
      records = stripFolderRoot(records)
      sourceLabel = `“${name}”`
      // A directory input cannot be reopened programmatically, so only the name
      // is remembered and the next visit asks for the folder again.
      rememberFolder({ name, source: FOLDER_SOURCE_FALLBACK })
    }
  }

  await scanRecords(records, sourceLabel, [], { append })
}

async function scanRecords (records, sourceLabel, scanWarnings = [], { append = false } = {}) {
  setScanning(true)
  setScanStatus(`Scanning ${sourceLabel}…`)
  if (!append) state.warnings = [...scanWarnings]
  els.libraryList.replaceChildren()
  refreshInitialMessage()

  try {
    const result = await buildLibrary(records, {
      onProgress: ({ done, total, phase }) => {
        setScanStatus(`${phase ?? 'Scanning'} ${done}/${total}…`)
      },
    })

    // A folder scan replaces the library, but files dropped onto a populated
    // library add to it instead of wiping what is already loaded.
    state.tracks = append ? mergeTracks(state.tracks, result.tracks) : result.tracks
    state.trackMap = new Map(state.tracks.map(track => [track.id, track]))
    libraryDurationsRequested = false
    for (const track of result.tracks) durationTried.delete(track.id)
    const warnings = [...scanWarnings, ...result.warnings]
    state.warnings = append ? mergeWarnings(state.warnings, warnings) : warnings
    state.visibleArtists = 60
    state.visibleResults = 200

    const available = new Set(state.trackMap.keys())
    const missingQueue = state.queue.some(id => !available.has(id))
    const missingHistory = state.history.some(id => !available.has(id))
    state.queue = state.queue.filter(id => available.has(id))
    state.history = state.history.filter(id => available.has(id))

    if (state.currentId && !available.has(state.currentId)) {
      player.unload()
      state.currentId = null
      state.finished = false
      state.error = null
      state.media.duration = 0
      state.media.position = 0
      state.media.isPlaying = false
    }

    if (missingQueue || missingHistory) {
      showToast('Some saved queue entries were not found in this folder.')
    }

    saveSessionSoon()
    setScanStatus(
      `${state.tracks.length} song${state.tracks.length === 1 ? '' : 's'} loaded`
      + (state.warnings.length ? ` · ${state.warnings.length} skipped` : ''),
    )
    setScanning(false)
    renderLibrary()
    renderQueue()
    refreshSongStates()
    updateTransport()
    refreshInitialMessage()

    if (state.tracks.length) {
      const skipped = warnings.length ? ` (${warnings.length} skipped)` : ''
      if (append) {
        const added = result.tracks.length
        showToast(added
          ? `Added ${added} song${added === 1 ? '' : 's'} (${state.tracks.length} total)${skipped}.`
          : `No new songs were found${skipped}.`)
      } else {
        showToast(`Loaded ${state.tracks.length} songs${skipped}.`)
      }
    } else {
      showStageMessage({
        kicker: 'No songs found',
        title: 'That folder had no playable karaoke files',
        text: 'Audio needs a matching .cdg, .lrc, or .elrc file. Name companions like “Artist - Title.mp3” and “Artist - Title.lrc”.',
      })
    }
  } catch (error) {
    setScanning(false)
    setScanStatus('Scan failed.')
    // The list was cleared for the scan; restore the tracks that are still in
    // state so a failed add does not leave the library panel blank.
    renderLibrary()
    refreshInitialMessage()
    showToast(`Could not scan files: ${error.message}`)
  }
}

async function openFolder () {
  const picker = resolveFolderSource(currentFolderEnvironment())

  if (picker.source !== FOLDER_SOURCE_HANDLE) {
    els.folderInput.click()
    return
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' })
    await scanDirectoryHandle(handle)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      // If the native picker path fails, fall back to the broadest-compatible
      // directory input so users can still load their library.
      els.folderInput.click()
    }
  }
}

async function reopenFolder () {
  const record = state.folderRecord
  const canReuseHandle = Boolean(state.folderHandle) && record?.source !== FOLDER_SOURCE_FALLBACK

  if (canReuseHandle) {
    try {
      await scanDirectoryHandle(state.folderHandle)
    } catch (error) {
      showToast(`Could not reopen that folder: ${error.message}`)
    }
    return
  }

  if (!record?.name) return

  showToast(`Choose “${record.name}” again — this browser asks for the folder each visit.`)
  els.folderInput.click()
}

/* -------------------------------------------------------------------------- */
/* Tabs, options, fullscreen                                                  */
/* -------------------------------------------------------------------------- */

function setTab (tab) {
  state.tab = tab
  const isLibrary = tab === 'library'
  els.tabLibrary.setAttribute('aria-selected', String(isLibrary))
  els.tabQueue.setAttribute('aria-selected', String(!isLibrary))
  els.libraryPanel.hidden = !isLibrary
  els.queuePanel.hidden = isLibrary
  if (isLibrary) els.libraryList.focus({ preventScroll: true })
}

function populateVisualStyles () {
  for (const style of VISUAL_STYLES) {
    els.visualStyle.add(new Option(style.label, style.id))
  }
}

function updateOptionsUI () {
  els.cdgSize.value = String(prefs.cdgSize)
  els.cdgSizeValue.textContent = `${Math.round(prefs.cdgSize * 100)}%`
  els.cdgAlpha.value = String(prefs.cdgAlpha)
  els.cdgAlphaValue.textContent = `${Math.round(prefs.cdgAlpha * 100)}%`
  els.visualStyle.value = prefs.visualStyle
  els.sensitivity.value = String(prefs.sensitivity)
  els.sensitivityValue.textContent = `${Math.round(prefs.sensitivity * 100)}%`
  els.replayGain.checked = prefs.replayGain
}

function applyOptions () {
  player.setOptions({
    cdgAlpha: prefs.cdgAlpha,
    cdgSize: prefs.cdgSize,
    visualizer: prefs.visualStyle !== 'off',
    visualStyle: prefs.visualStyle,
    sensitivity: prefs.sensitivity,
  })
  updateLyricsStyle()
  player.setReplayGainEnabled(prefs.replayGain)
  savePrefs()
  updateOptionsUI()
}

function resetOptions () {
  prefs.cdgAlpha = DEFAULT_PREFS.cdgAlpha
  prefs.cdgSize = DEFAULT_PREFS.cdgSize
  prefs.visualStyle = DEFAULT_PREFS.visualStyle
  prefs.sensitivity = DEFAULT_PREFS.sensitivity
  prefs.replayGain = DEFAULT_PREFS.replayGain
  applyOptions()
}

async function toggleFullscreen () {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else if (els.stagePanel.requestFullscreen) {
      await els.stagePanel.requestFullscreen()
    } else {
      showToast('Fullscreen is not supported by this browser.')
    }
  } catch (error) {
    showToast(`Fullscreen failed: ${error.message}`)
  }
}

function updateFullscreenButton () {
  const isFullscreen = Boolean(document.fullscreenElement)
  setIcon(els.fullscreen, isFullscreen ? 'close' : 'fullscreen')
  els.fullscreen.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen')
  els.fullscreen.title = isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'
}

/* -------------------------------------------------------------------------- */
/* Audio tracks (multi-track MP4 files)                                       */
/* -------------------------------------------------------------------------- */

function rememberAudioTrack (trackId, audioTrackId) {
  const memory = prefs.audioTracks
  // Re-insert so Object.keys order reflects least-recently-used first.
  delete memory[trackId]
  memory[trackId] = audioTrackId

  // Bound the memory so it cannot grow forever.
  const keys = Object.keys(memory)
  for (const key of keys.slice(0, Math.max(0, keys.length - AUDIO_TRACK_MEMORY))) {
    delete memory[key]
  }
  savePrefs()
}

function updateAudioTrackUI (track) {
  const select = els.audioTrack
  const tracks = player.getAudioTracks()
  select.replaceChildren()

  if (tracks.length < 2) {
    select.hidden = true
    return
  }

  for (const info of tracks) {
    const option = element('option', null, describeAudioTrack(info))
    option.value = info.id
    select.append(option)
  }
  select.hidden = false

  const remembered = track ? prefs.audioTracks[track.id] : null
  if (remembered !== null && remembered !== undefined
    && player.selectAudioTrack(remembered)) {
    select.value = remembered
    return
  }

  const enabled = tracks.find(info => info.enabled) ?? tracks[0]
  select.value = enabled.id
}

/* -------------------------------------------------------------------------- */
/* Volume                                                                     */
/* -------------------------------------------------------------------------- */

function setVolume (volume, { save = true } = {}) {
  prefs.volume = Math.max(0, Math.min(1, volume))
  player.setVolume(prefs.volume)
  els.volume.value = String(prefs.volume)
  updateSeekFill(els.volume, prefs.volume * 100)
  setIcon(els.mute, prefs.volume === 0 ? 'mute' : 'volume')
  if (save) savePrefs()
}

function clearSearch () {
  clearTimeout(searchTimer)
  searchTimer = null
  els.search.value = ''
  state.filter = ''
  state.visibleResults = 200
  state.visibleArtists = 60
  renderLibrary()
}

function toggleMute () {
  if (prefs.volume > 0) {
    state.lastVolume = prefs.volume
    setVolume(0)
  } else {
    setVolume(state.lastVolume || 0.85)
  }
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

function bindEvents () {
  els.openFolder.addEventListener('click', openFolder)
  els.reopenFolder.addEventListener('click', reopenFolder)
  els.addFiles.addEventListener('click', () => els.filesInput.click())

  els.folderInput.addEventListener('change', async () => {
    if (els.folderInput.files?.length) await scanFileList(els.folderInput.files, { folder: true })
    els.folderInput.value = ''
  })

  els.filesInput.addEventListener('change', async () => {
    if (els.filesInput.files?.length) await scanFileList(els.filesInput.files, { append: true })
    els.filesInput.value = ''
  })

  els.playpause.addEventListener('click', handlePlayPause)
  els.next.addEventListener('click', playNext)
  els.prev.addEventListener('click', previous)
  els.mute.addEventListener('click', toggleMute)
  els.fullscreen.addEventListener('click', toggleFullscreen)
  els.displayOptions.addEventListener('click', () => {
    updateOptionsUI()
    els.optionsDialog.showModal()
  })

  els.volume.addEventListener('input', () => {
    state.lastVolume = Number(els.volume.value) || state.lastVolume
    setVolume(Number(els.volume.value))
  })

  els.audioTrack.addEventListener('change', () => {
    if (!player.selectAudioTrack(els.audioTrack.value)) {
      showToast('Could not switch audio track.')
      return
    }
    if (state.currentId) rememberAudioTrack(state.currentId, els.audioTrack.value)
  })

  els.seek.addEventListener('input', () => {
    state.seeking = true
    const percent = Number(els.seek.value) / 10
    updateSeekFill(els.seek, percent)
    els.currentTime.textContent = formatDuration((state.media.duration * percent) / 100)
  })
  els.seek.addEventListener('change', () => {
    const percent = Number(els.seek.value) / 10
    player.seek((state.media.duration * percent) / 100)
    state.seeking = false
  })

  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.filter = els.search.value
      state.visibleResults = 200
      state.visibleArtists = 60
      renderLibrary()
    }, 100)
  })

  els.favoritesToggle.addEventListener('click', () => {
    state.favoritesOnly = !state.favoritesOnly
    els.favoritesToggle.setAttribute('aria-pressed', String(state.favoritesOnly))
    renderLibrary()
  })

  els.mediaFilters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-media]')
    if (!button) return
    state.mediaFilter = button.dataset.media
    state.visibleResults = 200
    state.visibleArtists = 60
    for (const chip of els.mediaFilters.querySelectorAll('button[data-media]')) {
      chip.setAttribute('aria-pressed', String(chip === button))
    }
    renderLibrary()
  })

  els.search.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return
    event.preventDefault()
    moveLibraryFocus(1)
  })

  els.libraryList.addEventListener('keydown', (event) => {
    const main = event.target.closest('.song-main')
    if (!main) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      moveLibraryFocus(event.key === 'ArrowDown' ? 1 : -1)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      const mains = visibleSongMains()
      const target = event.key === 'Home' ? mains[0] : mains[mains.length - 1]
      target?.focus()
      return
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      playNow(main.dataset.trackId)
    }
  })

  els.tabLibrary.addEventListener('click', () => setTab('library'))
  els.tabQueue.addEventListener('click', () => setTab('queue'))
  els.clearQueue.addEventListener('click', clearQueue)

  els.messagePlay.addEventListener('click', handlePlayPause)
  els.messageSkip.addEventListener('click', playNext)

  els.cdgSize.addEventListener('input', () => {
    prefs.cdgSize = Number(els.cdgSize.value)
    applyOptions()
  })
  els.cdgAlpha.addEventListener('input', () => {
    prefs.cdgAlpha = Number(els.cdgAlpha.value)
    applyOptions()
  })
  els.sensitivity.addEventListener('input', () => {
    prefs.sensitivity = Number(els.sensitivity.value)
    applyOptions()
  })
  els.visualStyle.addEventListener('change', () => {
    prefs.visualStyle = normalizeVisualStyle(els.visualStyle.value)
    applyOptions()
  })
  els.replayGain.addEventListener('change', () => {
    prefs.replayGain = els.replayGain.checked
    applyOptions()
  })
  els.resetOptions.addEventListener('click', resetOptions)

  document.addEventListener('fullscreenchange', updateFullscreenButton)

  document.addEventListener('keydown', (event) => {
    const action = resolveShortcut(event)
    if (!action) return

    // Escape only clears a search that actually has something in it; otherwise
    // it is left to the browser (for example to leave fullscreen).
    if (action === 'clear-search') {
      if (!els.search.value && !state.filter) return
      event.preventDefault()
      clearSearch()
      return
    }

    event.preventDefault()
    switch (action) {
      case 'playpause':
        handlePlayPause()
        break
      case 'seek-forward':
        seekBy(5)
        break
      case 'seek-back':
        seekBy(-5)
        break
      case 'next':
        playNext()
        break
      case 'previous':
        previous()
        break
      case 'mute':
        toggleMute()
        break
      case 'fullscreen':
        void toggleFullscreen()
        break
      case 'focus-search':
        els.search.focus()
        break
    }
  })

  for (const target of [els.stagePanel, els.libraryPanel, els.queuePanel]) {
    target.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types.includes('Files')) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }
    })
    target.addEventListener('drop', async (event) => {
      if (!event.dataTransfer?.files?.length) return
      event.preventDefault()
      await scanFileList(event.dataTransfer.files, { append: true })
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

async function init () {
  loadSession()
  els.volume.value = String(prefs.volume)
  populateVisualStyles()
  updateOptionsUI()
  initPlayer()
  bindEvents()

  if (state.favorites.size > 0) {
    els.favoritesToggle.setAttribute('aria-pressed', 'false')
  }

  renderLibrary()
  renderQueue()
  updateTransport()
  refreshInitialMessage()

  state.folderRecord = readJson(FOLDER_KEY)
  const handle = state.folderRecord?.source === FOLDER_SOURCE_FALLBACK
    ? null
    : await getFolderHandle()

  if (handle) {
    state.folderHandle = handle
    if (!state.folderRecord?.name) {
      state.folderRecord = { name: handle.name, source: FOLDER_SOURCE_HANDLE }
      writeJson(FOLDER_KEY, state.folderRecord)
    }
  }

  renderReopen()

  // Explain why Open music folder may use the browser's own directory input.
  els.openFolder.title = folderPickerNote(resolveFolderSource(currentFolderEnvironment()))
    || 'Choose your karaoke folder.'

  if (state.currentId && state.queue.length) {
    showToast('Saved queue restored. Reopen your folder to play.')
  }
}

init().catch((error) => {
  showToast(`Could not start the player: ${error.message}`)
})
