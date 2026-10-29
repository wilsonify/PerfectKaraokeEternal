import {
  buildLibrary,
  collectDirectoryRecords,
  formatDuration,
  formatSize,
  getExtension,
  groupByArtist,
  searchTracks,
  SUPPORTED_EXTENSIONS,
} from './library.js'
import { describeAudioTrack } from './audio-tracks.js'
import KaraokePlayer from './player.js'

const PREFS_KEY = 'pke.prefs.v1'
const SESSION_KEY = 'pke.session.v1'
const DB_NAME = 'pke-files'
const DB_STORE = 'handles'
const AUDIO_TRACK_MEMORY = 50
const DEFAULT_PREFS = {
  volume: 0.85,
  replayGain: false,
  cdgAlpha: 0.5,
  cdgSize: 0.65,
  visualizer: true,
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
const prefs = {
  ...DEFAULT_PREFS,
  ...savedPrefs,
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
  tab: 'library',
  openArtists: new Set(),
  visibleArtists: 60,
  visibleResults: 200,
  scanning: false,
  finished: false,
  error: null,
  folderHandle: null,
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
  librarySummary: $('library-summary'),
  warnings: $('warnings'),
  alphaPicker: $('alpha-picker'),
  libraryList: $('library-list'),
  queueList: $('queue-list'),
  currentCard: $('current-card'),
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
  visualizerEnabled: $('visualizer-enabled'),
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
/* Player                                                                     */
/* -------------------------------------------------------------------------- */

function getTrack (id) {
  return id === null ? null : state.trackMap.get(id) ?? null
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
    visualizer: prefs.visualizer,
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

  if (state.currentId) {
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
  showToast(next ? `Up next: ${track.title}` : `Queued: ${track.title}`)

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

function applyTrackState (row, id) {
  row.classList.toggle('is-current', trackIsCurrent(id))
  row.classList.toggle('is-upcoming', state.queue.includes(id))
  row.classList.toggle('is-played', state.history.includes(id) && !trackIsCurrent(id))
}

function buildSongRow (track, { showArtist = false, tokens = [] } = {}) {
  const row = element('li', 'song-row')
  row.dataset.trackId = track.id
  applyTrackState(row, track.id)

  const main = element('button', 'song-main')
  main.type = 'button'
  main.title = `${track.path}\n${formatSize(track.size)}`
  main.setAttribute('aria-label', `Queue ${track.title} by ${track.artist}`)

  const title = element('span', 'song-title')
  title.append(highlightText(track.title, tokens))
  main.append(title)

  const meta = element('span', 'song-meta')
  if (showArtist) {
    const artist = element('span', 'song-artist')
    artist.append(highlightText(track.artist, tokens))
    meta.append(artist)
  }

  const kinds = { 'cdg': 'CDG', 'zip': 'ZIP', 'mp4': 'MP4', 'lrc': 'LRC', 'zip-lrc': 'ZIP LRC' }
  const badge = element('span', 'badge')
  const badgeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  badgeIcon.setAttribute('class', 'icon')
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
  use.setAttribute('href', `#i-${track.kind === 'mp4' ? 'video' : track.kind === 'zip' || track.kind === 'zip-lrc' ? 'zip' : 'music'}`)
  badgeIcon.append(use)
  badge.append(badgeIcon, document.createTextNode(kinds[track.kind] ?? track.kind))
  meta.append(badge)

  main.append(meta)
  main.addEventListener('click', () => queueTrack(track.id))
  row.append(main)

  const duration = element('span', 'duration', formatDuration(track.duration))
  row.append(duration)

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

function renderArtistGroups (artists) {
  const tokens = currentFilterTokens()
  const names = [...artists.keys()]
  const visible = names.slice(0, state.visibleArtists)

  for (const name of visible) {
    const tracks = artists.get(name)
    const details = element('details', 'artist-group')
    details.dataset.artist = name
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
    els.libraryList.append(element('p', 'list-note', 'No songs match that search.'))
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

  els.warnings.hidden = false
  const details = element('details')
  const summary = element('summary', null, `${state.warnings.length} file${state.warnings.length === 1 ? '' : 's'} skipped during the scan`)
  const list = element('ul')
  for (const warning of state.warnings) {
    list.append(element('li', null, `${warning.path} — ${warning.reason}`))
  }
  details.append(summary, list)
  els.warnings.replaceChildren(details)
}

function renderAlphaPicker (artists) {
  if (state.filter || state.favoritesOnly || artists.size === 0) {
    els.alphaPicker.hidden = true
    els.alphaPicker.replaceChildren()
    return
  }

  const letters = new Set([...artists.keys()].map(name => /^[a-z]/i.test(name) ? name[0].toUpperCase() : '#'))
  els.alphaPicker.hidden = false
  els.alphaPicker.replaceChildren()

  for (const letter of [...letters].sort()) {
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
  const filtered = state.filter || state.favoritesOnly
    ? searchTracks(state.tracks, state.filter, state.favoritesOnly ? state.favorites : null)
    : null

  els.librarySummary.textContent = state.tracks.length === 0
    ? 'No songs loaded yet.'
    : `${state.tracks.length} song${state.tracks.length === 1 ? '' : 's'} · ${artists.size} artist${artists.size === 1 ? '' : 's'}${state.favoritesOnly ? ` · ${state.favorites.size} favorite${state.favorites.size === 1 ? '' : 's'}` : ''}`

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

  els.libraryList.scrollTop = scrollTop
}

function refreshSongStates () {
  for (const row of els.libraryList.querySelectorAll('[data-track-id]')) {
    applyTrackState(row, row.dataset.trackId)
  }

  for (const details of els.libraryList.querySelectorAll('.artist-group')) {
    const artist = details.dataset.artist
    details.classList.toggle(
      'has-current',
      Boolean(state.currentId && getTrack(state.currentId)?.artist === artist && !state.finished),
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
      els.currentCard.append(element('p', null, `${current.artist} · ${current.kind.toUpperCase()}`))
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
    els.upNextTitle.textContent = `${nextTrack.title} — ${nextTrack.artist}`
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
    setStageMessage({
      kicker: 'Ready',
      title: track ? `${track.title} — ${track.artist}` : 'Saved queue restored',
      text: 'Press play to continue where you left off.',
      play: true,
    })
    return
  }

  if (state.currentId && player.track?.id === state.currentId) {
    els.message.hidden = true
    return
  }

  setStageMessage({
    kicker: 'Library ready',
    title: 'Pick a song to start singing',
    text: 'Choose a song from the library, or queue several and let them play.',
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
  if (state.folderHandle) els.reopenFolder.disabled = value
}

async function scanDirectoryHandle (handle) {
  const permission = await handle.requestPermission({ mode: 'read' })
  if (permission !== 'granted') {
    showToast('Folder access was not granted.')
    return
  }

  state.folderHandle = handle
  saveFolderHandle(handle)
  els.reopenFolder.hidden = false
  els.reopenLabel.textContent = `Reopen “${handle.name}”`

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
    await scanRecords(records, `“${handle.name}”`, warnings)
  } catch (error) {
    setScanning(false)
    setScanStatus('Folder scan failed.')
    refreshInitialMessage()
    showToast(`Could not scan that folder: ${error.message}`)
  }
}

async function scanFileList (fileList) {
  const records = []

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

  await scanRecords(records, 'selected files')
}

async function scanRecords (records, sourceLabel, scanWarnings = []) {
  setScanning(true)
  setScanStatus(`Scanning ${sourceLabel}…`)
  state.warnings = [...scanWarnings]
  els.libraryList.replaceChildren()
  refreshInitialMessage()

  try {
    const result = await buildLibrary(records, {
      onProgress: ({ done, total, phase }) => {
        setScanStatus(`${phase ?? 'Scanning'} ${done}/${total}…`)
      },
    })

    state.tracks = result.tracks
    state.trackMap = new Map(result.tracks.map(track => [track.id, track]))
    state.warnings = [...scanWarnings, ...result.warnings]
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
      showToast(`Loaded ${state.tracks.length} songs${state.warnings.length ? ` (${state.warnings.length} skipped)` : ''}.`)
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
    refreshInitialMessage()
    showToast(`Could not scan files: ${error.message}`)
  }
}

async function openFolder () {
  if (!window.showDirectoryPicker || !window.isSecureContext) {
    els.folderInput.click()
    return
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' })
    await scanDirectoryHandle(handle)
  } catch (error) {
    if (error.name !== 'AbortError') showToast(`Could not open that folder: ${error.message}`)
  }
}

async function reopenFolder () {
  if (!state.folderHandle) return
  try {
    await scanDirectoryHandle(state.folderHandle)
  } catch (error) {
    showToast(`Could not reopen that folder: ${error.message}`)
  }
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

function updateOptionsUI () {
  els.cdgSize.value = String(prefs.cdgSize)
  els.cdgSizeValue.textContent = `${Math.round(prefs.cdgSize * 100)}%`
  els.cdgAlpha.value = String(prefs.cdgAlpha)
  els.cdgAlphaValue.textContent = `${Math.round(prefs.cdgAlpha * 100)}%`
  els.visualizerEnabled.checked = prefs.visualizer
  els.sensitivity.value = String(prefs.sensitivity)
  els.sensitivityValue.textContent = `${Math.round(prefs.sensitivity * 100)}%`
  els.replayGain.checked = prefs.replayGain
}

function applyOptions () {
  player.setOptions({
    cdgAlpha: prefs.cdgAlpha,
    cdgSize: prefs.cdgSize,
    visualizer: prefs.visualizer,
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
  prefs.visualizer = DEFAULT_PREFS.visualizer
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
    if (els.folderInput.files?.length) await scanFileList(els.folderInput.files)
    els.folderInput.value = ''
  })

  els.filesInput.addEventListener('change', async () => {
    if (els.filesInput.files?.length) await scanFileList(els.filesInput.files)
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
  els.visualizerEnabled.addEventListener('change', () => {
    prefs.visualizer = els.visualizerEnabled.checked
    applyOptions()
  })
  els.replayGain.addEventListener('change', () => {
    prefs.replayGain = els.replayGain.checked
    applyOptions()
  })
  els.resetOptions.addEventListener('click', resetOptions)

  document.addEventListener('fullscreenchange', updateFullscreenButton)

  document.addEventListener('keydown', (event) => {
    const target = event.target
    if (target.closest?.('input, textarea, select, button, a, [contenteditable="true"]')) {
      if (event.key === '/' && target.id !== 'search') {
        event.preventDefault()
        els.search.focus()
      }
      return
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return

    switch (event.key) {
      case ' ':
      case 'Spacebar':
        event.preventDefault()
        handlePlayPause()
        break
      case 'ArrowRight':
        event.preventDefault()
        seekBy(5)
        break
      case 'ArrowLeft':
        event.preventDefault()
        seekBy(-5)
        break
      case 'n':
      case 'N':
        event.preventDefault()
        playNext()
        break
      case 'p':
      case 'P':
        event.preventDefault()
        previous()
        break
      case 'm':
      case 'M':
        event.preventDefault()
        toggleMute()
        break
      case 'f':
      case 'F':
        event.preventDefault()
        toggleFullscreen()
        break
      case '/':
        event.preventDefault()
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
      await scanFileList(event.dataTransfer.files)
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

async function init () {
  loadSession()
  els.volume.value = String(prefs.volume)
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

  const handle = await getFolderHandle()
  if (handle) {
    state.folderHandle = handle
    els.reopenFolder.hidden = false
    els.reopenLabel.textContent = `Reopen “${handle.name}”`
  } else if (!window.showDirectoryPicker || !window.isSecureContext) {
    // Let people know why the folder button opens a file picker.
    els.openFolder.title = 'Choose a folder (browser file picker)'
  }

  if (state.currentId && state.queue.length) {
    showToast('Saved queue restored. Reopen your folder to play.')
  }
}

init()
