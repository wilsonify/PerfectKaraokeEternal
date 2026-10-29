import assert from 'node:assert/strict'
import test from 'node:test'
import KaraokePlayer from '../js/player.js'

// KaraokePlayer targets the browser; provide only the APIs its constructor and
// visualizer path use.
globalThis.window = { devicePixelRatio: 1 }
globalThis.ResizeObserver = class {
  observe () {}
  disconnect () {}
}
let frameRequests = 0
globalThis.requestAnimationFrame = () => {
  frameRequests++
  return 1
}
globalThis.cancelAnimationFrame = () => {}

function createRecordingContext () {
  const calls = []
  const gradient = () => ({
    addColorStop (offset, color) {
      calls.push(['addColorStop', offset, color])
    },
  })
  const base = {
    calls,
    createLinearGradient (...args) {
      calls.push(['createLinearGradient', ...args])
      return gradient()
    },
    createRadialGradient (...args) {
      calls.push(['createRadialGradient', ...args])
      return gradient()
    },
  }

  return new Proxy(base, {
    get (target, property) {
      if (Reflect.has(target, property)) return target[property]
      if (typeof property === 'symbol') return undefined
      return (...args) => calls.push([property, ...args])
    },
    set (target, property, value) {
      target[property] = value
      return true
    },
  })
}

function createCanvas () {
  const ctx = createRecordingContext()
  return {
    canvas: {
      width: 0,
      height: 0,
      style: {},
      hidden: false,
      getContext: () => ctx,
    },
    ctx,
  }
}

function createMedia () {
  return {
    preload: '',
    listenerCount: 0,
    addEventListener () {
      this.listenerCount++
    },
    pause () {},
    removeAttribute () {},
    load () {},
    src: '',
  }
}

function createAnalyser () {
  return {
    fftSize: 256,
    getByteFrequencyData (array) {
      for (let i = 0; i < array.length; i++) array[i] = 120
    },
    getByteTimeDomainData (array) {
      for (let i = 0; i < array.length; i++) array[i] = 128 + Math.round(Math.sin(i / 8) * 50)
    },
  }
}

function createPlayer () {
  const cdg = createCanvas()
  const visualizer = createCanvas()
  const audio = createMedia()
  const video = createMedia()
  const elements = {
    stage: { clientWidth: 640, clientHeight: 360, dataset: {} },
    cdgLayer: { style: {}, hidden: true },
    backdrop: { style: {}, hidden: true },
    canvas: cdg.canvas,
    lyricsLayer: { hidden: true },
    visualizer: visualizer.canvas,
    video,
    audio,
  }

  const player = new KaraokePlayer(elements, { onChange () {}, onEnded () {} })
  return { player, elements, audio, video, visualizerCtx: visualizer.ctx }
}

test('switching visual styles during playback keeps media and loops untouched', () => {
  const { player, elements, audio, video, visualizerCtx } = createPlayer()
  const media = { src: 'blob:track', currentTime: 42.5 }

  player.mode = 'lrc'
  player.media = media
  player.isPlaying = true
  player.analyser = createAnalyser()
  player.frequencyData = new Uint8Array(128)
  player.visualizerSize = { width: 320, height: 200, dpr: 1 }

  const listenersBefore = audio.listenerCount + video.listenerCount
  frameRequests = 0

  player.setOptions({ visualStyle: 'waveform' })
  assert.equal(player.options.visualStyle, 'waveform')
  assert.equal(elements.visualizer.hidden, false)
  assert.ok(visualizerCtx.calls.length > 0, 'the new style did not draw immediately')

  // Switching styles must not touch playback state or start another loop.
  assert.equal(player.media, media)
  assert.equal(media.currentTime, 42.5)
  assert.equal(player.isPlaying, true)
  assert.equal(player.frameId, null)
  assert.equal(frameRequests, 0)
  assert.equal(audio.listenerCount + video.listenerCount, listenersBefore)

  for (const style of ['classic', 'hot-pink', 'spectrum', 'aurora', 'pulse', 'starfield', 'minimal']) {
    player.setOptions({ visualStyle: style })
    assert.equal(player.options.visualStyle, style)
    assert.equal(media.currentTime, 42.5)
  }

  player.setOptions({ visualStyle: 'off' })
  assert.equal(elements.visualizer.hidden, true)
  assert.equal(media.currentTime, 42.5)

  player.setOptions({ visualStyle: 'classic' })
  assert.equal(elements.visualizer.hidden, false)
  assert.equal(frameRequests, 0)
  assert.equal(player.frameId, null)
})

test('style changes release per-style animation state', () => {
  const { player } = createPlayer()
  player.mode = 'lrc'
  player.analyser = createAnalyser()
  player.frequencyData = new Uint8Array(128)
  player.visualizerSize = { width: 320, height: 200, dpr: 1 }

  player.setOptions({ visualStyle: 'starfield' })
  assert.equal(player.visualState.stars.length, 90)

  player.setOptions({ visualStyle: 'minimal' })
  assert.equal(player.visualState.stars, undefined)
})

test('a missing audio graph does not break style changes', () => {
  const { player, elements } = createPlayer()
  player.mode = 'lrc'
  player.media = { src: 'blob:track', currentTime: 1 }

  assert.doesNotThrow(() => player.setOptions({ visualStyle: 'pulse' }))
  assert.equal(elements.visualizer.hidden, false)
  assert.equal(player.media.currentTime, 1)
})
