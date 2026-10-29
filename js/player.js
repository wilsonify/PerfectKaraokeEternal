import CDGDecoder from './cdg.js'
import { parseReplayGain, replayGainFactor } from './audio-tags.js'
import { enableAudioTrack, listAudioTracks } from './audio-tracks.js'
import { parseLyrics } from './lrc.js'
import { audioMimeType } from './library.js'
import { readZipEntry } from './zip.js'

const ERROR_MESSAGES = {
  1: 'Playback was aborted',
  2: 'A network error occurred while loading the media',
  3: 'The media could not be decoded',
  4: 'This media format is not supported by your browser',
}

function errorMessage (media, track) {
  const code = media.error?.code
  const detail = ERROR_MESSAGES[code] ?? 'Unknown media error'
  return `${track?.sourceName ?? 'Media'}: ${detail}${code ? ` (code ${code})` : ''}`
}

export default class KaraokePlayer {
  constructor (elements, { onChange, onEnded }) {
    this.els = elements
    this.onChange = onChange
    this.onEnded = onEnded

    this.track = null
    this.media = null
    this.mode = null
    this.decoder = null
    this.lastFrame = null
    this.lyrics = null
    this.duration = 0
    this.volume = 1
    this.isPlaying = false
    this.isBuffering = false
    this.replayGain = null
    this.replayGainEnabled = false
    this.options = {
      cdgAlpha: 0.5,
      cdgSize: 0.65,
      visualizer: true,
      sensitivity: 1,
    }

    this.generation = 0
    this.frameId = null
    this.urls = []
    this.audioCtx = null
    this.gainNode = null
    this.analyser = null
    this.frequencyData = null
    this.connectedElements = new WeakSet()
    this.visualizerSize = { width: 0, height: 0, dpr: 1 }

    this.els.canvas.width = 300
    this.els.canvas.height = 216

    for (const element of [this.els.audio, this.els.video]) {
      element.preload = 'auto'
      element.addEventListener('play', () => this.handlePlay(element))
      element.addEventListener('pause', () => this.handlePause(element))
      element.addEventListener('ended', () => this.handleEnded(element))
      element.addEventListener('timeupdate', () => this.emitTime())
      element.addEventListener('durationchange', () => this.handleDuration(element))
      element.addEventListener('seeked', () => this.handleSeeked(element))
      element.addEventListener('waiting', () => this.setBuffering(true, element))
      element.addEventListener('playing', () => this.setBuffering(false, element))
      element.addEventListener('error', () => this.handleError(element))
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeVisualizer()
      if (this.mode === 'cdg' && this.lastFrame) this.drawFrame(this.lastFrame, true)
      if (this.mode === 'cdg' && this.isPlaying) this.drawVisualizer()
    })
    this.resizeObserver.observe(this.els.stage)

    this.layoutCDG(false)
    this.resizeVisualizer()
  }

  emit (event) {
    this.onChange?.(event)
  }

  emitTime () {
    if (!this.media) return
    this.emit({
      type: 'time',
      position: Number.isFinite(this.media.currentTime) ? this.media.currentTime : 0,
      duration: Number.isFinite(this.duration) ? this.duration : 0,
    })
  }

  setOptions (options) {
    this.options = { ...this.options, ...options }
    const visualizerMode = this.mode === 'cdg' || this.mode === 'lrc'
    this.els.visualizer.hidden = !this.options.visualizer || !visualizerMode
    if (!this.options.visualizer) this.clearVisualizer()

    if (this.mode === 'cdg') {
      this.layoutCDG(true)
    }
  }

  setVolume (volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    this.applyGain()
  }

  setReplayGainEnabled (enabled) {
    this.replayGainEnabled = enabled
    this.applyGain()
  }

  /** Audio tracks exposed by the current media, or [] when unsupported. */
  getAudioTracks () {
    return listAudioTracks(this.media)
  }

  /** Switch to an audio track by id. False when the track is not found. */
  selectAudioTrack (id) {
    return this.media ? enableAudioTrack(this.media, id) : false
  }

  ensureAudioGraph () {
    if (this.audioCtx) return true
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return false

    try {
      this.audioCtx = new AudioContextClass()
      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.82
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.gainNode = this.audioCtx.createGain()
      this.analyser.connect(this.gainNode)
      this.gainNode.connect(this.audioCtx.destination)
      this.applyGain()
      return true
    } catch {
      this.audioCtx = null
      this.analyser = null
      this.gainNode = null
      return false
    }
  }

  connectMediaElement (element) {
    if (!this.ensureAudioGraph() || !element) return
    if (this.connectedElements.has(element)) return

    try {
      const source = this.audioCtx.createMediaElementSource(element)
      source.connect(this.analyser)
      this.connectedElements.add(element)
    } catch {
      // The element is already connected (or the graph is unavailable).
    }
  }

  applyGain () {
    let factor = 1
    if (this.replayGainEnabled && this.replayGain) {
      factor = replayGainFactor(this.replayGain.gainDb, this.replayGain.peak)
    }

    const effective = this.volume * factor

    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(effective, this.audioCtx.currentTime)
      if (this.media) this.media.volume = 1
    } else if (this.media) {
      this.media.volume = Math.min(1, effective)
    }
  }

  resetVisualizer () {
    const canvas = this.els.visualizer
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }

  resizeVisualizer () {
    const canvas = this.els.visualizer
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(this.els.stage.clientWidth * dpr))
    const height = Math.max(1, Math.round(this.els.stage.clientHeight * dpr))
    if (canvas.width === width && canvas.height === height) return
    canvas.width = width
    canvas.height = height
    this.visualizerSize = { width, height, dpr }
  }

  clearVisualizer () {
    const canvas = this.els.visualizer
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }

  async load (track, { autoplay = false } = {}) {
    const generation = ++this.generation
    this.unloadMedia()
    this.track = track
    this.decoder = null
    this.lastFrame = null
    this.lyrics = null
    this.duration = 0
    this.replayGain = null
    this.isPlaying = false
    this.isBuffering = false
    this.emit({ type: 'track', track })

    try {
      if (track.kind === 'mp4') {
        await this.loadVideo(track, generation)
      } else if (track.kind === 'lrc' || track.kind === 'zip-lrc') {
        await this.loadLrc(track, generation)
      } else {
        await this.loadCDG(track, generation)
      }

      if (generation !== this.generation) return

      const visualizerMode = this.mode === 'cdg' || this.mode === 'lrc'
      this.els.stage.dataset.mode = this.mode
      this.els.cdgLayer.hidden = this.mode !== 'cdg'
      this.els.video.hidden = this.mode !== 'mp4'
      this.els.backdrop.hidden = this.mode !== 'cdg'
      this.els.lyricsLayer.hidden = this.mode !== 'lrc'
      this.els.visualizer.hidden = !visualizerMode || !this.options.visualizer

      if (this.mode === 'cdg') {
        this.layoutCDG(true)
        this.renderFrame()
      }

      this.applyGain()
      this.emit({
        type: 'loaded',
        track,
        duration: Number.isFinite(this.duration) ? this.duration : 0,
        replayGain: this.replayGain,
        lyrics: this.lyrics,
      })

      if (autoplay) await this.play()
    } catch (error) {
      if (generation !== this.generation) return
      this.pause()
      this.emit({ type: 'error', message: error.message, track })
    }
  }

  async loadCDG (track, generation) {
    let audioBlob
    let audioBytesForTags
    let cdgBuffer

    if (track.kind === 'zip') {
      const { audioEntry, cdgEntry } = track.zipEntries
      const [audioBytes, cdgBytes] = await Promise.all([
        readZipEntry(track.file, audioEntry),
        readZipEntry(track.file, cdgEntry),
      ])
      if (generation !== this.generation) return
      audioBlob = new Blob([audioBytes], { type: audioMimeType(audioEntry.name) })
      audioBytesForTags = audioBytes.subarray(0, 1024 * 1024)
      cdgBuffer = cdgBytes.buffer.slice(cdgBytes.byteOffset, cdgBytes.byteOffset + cdgBytes.byteLength)
    } else {
      const [tagsBuffer, decodedCdg] = await Promise.all([
        track.file.slice(0, 1024 * 1024).arrayBuffer().catch(() => null),
        track.cdgFile.arrayBuffer(),
      ])
      if (generation !== this.generation) return
      audioBlob = track.file
      audioBytesForTags = tagsBuffer ? new Uint8Array(tagsBuffer) : null
      cdgBuffer = decodedCdg
    }

    try {
      this.decoder = new CDGDecoder(cdgBuffer)
    } catch (error) {
      throw new Error(`${track.sourceName}: could not decode the .cdg file (${error.message})`)
    }

    if (audioBytesForTags) {
      try {
        this.replayGain = parseReplayGain(audioBytesForTags)
      } catch {
        this.replayGain = null
      }
    }

    this.mode = 'cdg'
    this.media = this.els.audio
    this.connectMediaElement(this.media)

    const url = URL.createObjectURL(audioBlob)
    this.urls.push(url)
    this.media.src = url
    this.media.type = audioBlob.type

    await this.waitForMetadata(this.media, track)
    if (generation !== this.generation) return
    this.media.volume = 1
  }

  async loadVideo (track, generation) {
    this.mode = 'mp4'
    this.media = this.els.video
    this.connectMediaElement(this.media)

    const url = URL.createObjectURL(track.file)
    this.urls.push(url)
    this.media.src = url
    this.media.type = track.file.type || 'video/mp4'

    await this.waitForMetadata(this.media, track)
    if (generation !== this.generation) return
    this.media.volume = 1
  }

  waitForMetadata (media, track) {
    return new Promise((resolve, reject) => {
      if (media.readyState >= 1) {
        this.duration = media.duration
        resolve()
        return
      }

      const cleanup = () => {
        media.removeEventListener('loadedmetadata', handleLoaded)
        media.removeEventListener('error', handleError)
      }
      const handleLoaded = () => {
        cleanup()
        this.duration = media.duration
        resolve()
      }
      const handleError = () => {
        cleanup()
        reject(new Error(errorMessage(media, track)))
      }

      media.addEventListener('loadedmetadata', handleLoaded, { once: true })
      media.addEventListener('error', handleError, { once: true })
      media.load()
    })
  }

  unloadMedia () {
    this.pause()
    cancelAnimationFrame(this.frameId)
    this.frameId = null

    for (const url of this.urls) URL.revokeObjectURL(url)
    this.urls = []

    for (const media of [this.els.audio, this.els.video]) {
      media.pause()
      media.removeAttribute('src')
      media.removeAttribute('type')
      media.load()
    }

    this.media = null
    this.mode = null
    this.decoder = null
    this.lastFrame = null
    this.duration = 0
    this.replayGain = null
    this.isPlaying = false
    this.isBuffering = false
    this.clearVisualizer()

    const ctx = this.els.canvas.getContext('2d')
    ctx?.clearRect(0, 0, 300, 216)
    this.els.backdrop.hidden = true
    this.els.cdgLayer.hidden = true
    this.els.video.hidden = true
  }

  async play () {
    if (!this.media?.src) return

    this.ensureAudioGraph()

    try {
      await this.audioCtx?.resume()
      await this.media.play()
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        this.emit({
          type: 'blocked',
          message: 'Your browser blocked playback. Press Play to start.',
        })
      } else if (error.name !== 'AbortError') {
        this.fail(error.message)
      }
    }
  }

  pause () {
    this.media?.pause()
    this.isPlaying = false
    cancelAnimationFrame(this.frameId)
    this.frameId = null
  }

  toggle () {
    if (!this.media?.src) return
    if (this.media.paused) this.play()
    else this.pause()
  }

  seek (seconds) {
    if (!this.media || !Number.isFinite(this.duration)) return
    this.media.currentTime = Math.max(0, Math.min(this.duration, seconds))
    this.emitTime()
  }

  stop () {
    if (!this.media) return
    this.pause()
    this.media.currentTime = 0
    if (this.mode === 'cdg') this.renderFrame()
    this.emitTime()
  }

  handlePlay (element) {
    if (element !== this.media) return
    this.isPlaying = true
    this.emit({ type: 'play' })
    this.startLoop()
  }

  handlePause (element) {
    if (element !== this.media) return
    this.isPlaying = false
    cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.emit({ type: 'pause' })
  }

  handleEnded (element) {
    if (element !== this.media) return
    this.isPlaying = false
    cancelAnimationFrame(this.frameId)
    this.frameId = null
    this.onEnded?.()
  }

  handleDuration (element) {
    if (element !== this.media) return
    if (Number.isFinite(element.duration) && element.duration > 0) {
      this.duration = element.duration
      this.emitTime()
    }
  }

  handleSeeked (element) {
    if (element !== this.media) return
    if (this.mode === 'cdg') this.renderFrame()
    this.emitTime()
  }

  handleError (element) {
    if (element !== this.media) return
    if (!element.getAttribute('src')) return
    this.fail(errorMessage(element, this.track))
  }

  fail (message) {
    this.pause()
    this.emit({ type: 'error', message, track: this.track })
  }

  setBuffering (value, element) {
    if (element !== this.media || this.isBuffering === value) return
    this.isBuffering = value
    this.emit({ type: 'buffering', value })
  }

  startLoop () {
    if (this.frameId !== null) return

    const tick = () => {
      this.frameId = requestAnimationFrame(tick)

      if (this.mode === 'cdg') {
        try {
          this.renderFrame()
        } catch (error) {
          this.fail(`${this.track?.sourceName ?? 'CDG'}: ${error.message}`)
          return
        }

        if (this.options.visualizer) this.drawVisualizer()
      }
    }

    this.frameId = requestAnimationFrame(tick)
  }

  renderFrame () {
    if (!this.decoder || !this.media) return

    // Upstream keyed the CDG background out on every frame so the visualizer
    // and stage show through. The lyric panel is drawn separately from
    // `contentBounds`, so the CDG background should never be painted opaque.
    const frame = this.decoder.render(this.media.currentTime || 0, { forceKey: true })
    if (!frame.isChanged) return
    this.lastFrame = frame
    this.drawFrame(frame, true)
  }

  drawFrame (frame, updateBackdrop = true) {
    const ctx = this.els.canvas.getContext('2d')
    ctx.putImageData(frame.imageData, 0, 0)

    if (!updateBackdrop) return
    const scale = this.layoutCDG(false)
    const [x1, y1, x2, y2] = frame.contentBounds
    const [r, g, b] = frame.backgroundRGBA
    const hasContent = x2 > x1 && y2 > y1
    const pad = hasContent ? 10 : 0
    const alpha = this.options.cdgAlpha

    this.els.backdrop.hidden = false
    this.els.backdrop.style.left = `${(x1 - pad) * scale}px`
    this.els.backdrop.style.top = `${(y1 - pad) * scale}px`
    this.els.backdrop.style.width = `${((x2 - x1) + pad * 2) * scale}px`
    this.els.backdrop.style.height = `${((y2 - y1) + pad * 2) * scale}px`
    this.els.backdrop.style.background = `rgba(${r}, ${g}, ${b}, ${alpha})`
    this.els.backdrop.style.borderRadius = `${8 * scale}px`
    this.els.backdrop.style.filter = alpha < 0.98 ? `blur(${Math.min(24, 30 * alpha * scale)}px)` : 'none'
  }

  layoutCDG (redraw) {
    const width = this.els.stage.clientWidth
    const height = this.els.stage.clientHeight
    if (!width || !height) return 1

    const wScale = (width - 20) / 300
    const hScale = ((height - 20) * this.options.cdgSize) / 216
    const scale = Math.max(0.01, Math.min(wScale, hScale))

    this.els.cdgLayer.style.width = `${300 * scale}px`
    this.els.cdgLayer.style.height = `${216 * scale}px`
    this.els.canvas.style.width = '100%'
    this.els.canvas.style.height = '100%'

    if (redraw && this.lastFrame) this.drawFrame(this.lastFrame, true)
    return scale
  }

  drawVisualizer () {
    if (!this.analyser || !this.frequencyData || !this.options.visualizer) return

    const canvas = this.els.visualizer
    const ctx = canvas.getContext('2d')
    const { width, height, dpr } = this.visualizerSize
    if (!width || !height) return

    this.analyser.getByteFrequencyData(this.frequencyData)
    ctx.clearRect(0, 0, width, height)

    const bars = 40
    const gap = 3 * dpr
    const barWidth = (width - gap * (bars - 1)) / bars
    const sensitivity = this.options.sensitivity
    const baseline = height * 0.42
    const maxHeight = height * 0.5

    const gradient = ctx.createLinearGradient(0, baseline - maxHeight, 0, baseline)
    gradient.addColorStop(0, 'rgba(76, 201, 240, 0.85)')
    gradient.addColorStop(0.55, 'rgba(123, 44, 191, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 62, 165, 0.9)')
    ctx.fillStyle = gradient

    for (let i = 0; i < bars; i++) {
      const sample = Math.floor((i / bars) * (this.frequencyData.length * 0.7))
      const value = this.frequencyData[sample] / 255
      const barHeight = Math.max(2 * dpr, value * maxHeight * sensitivity)
      const x = i * (barWidth + gap)
      ctx.fillRect(x, baseline - barHeight / 2, barWidth, barHeight)

      ctx.globalAlpha = 0.2
      ctx.fillRect(x, baseline + barHeight / 2, barWidth, barHeight * 0.35)
      ctx.globalAlpha = 1
    }

    // Soft glow that responds to overall level.
    let total = 0
    for (let i = 0; i < 32; i++) total += this.frequencyData[i]
    const glow = Math.min(1, (total / (32 * 255)) * sensitivity)
    const radial = ctx.createRadialGradient(
      width / 2, height * 0.75, 0,
      width / 2, height * 0.75, width * 0.55,
    )
    radial.addColorStop(0, `rgba(255, 62, 165, ${0.16 * glow})`)
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = radial
    ctx.fillRect(0, 0, width, height)
  }

  destroy () {
    this.resizeObserver.disconnect()
    this.unloadMedia()
    this.audioCtx?.close()
  }

  unload () {
    this.generation++
    this.unloadMedia()
    this.track = null
    this.emit({ type: 'unloaded' })
  }
}
