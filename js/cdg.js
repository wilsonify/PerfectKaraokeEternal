/*
 * CD+G decoder/renderer.
 *
 * Adapted from cdgraphics 7.0.0 by Ben Hilburn (ISC License):
 * https://github.com/bhj/cdgraphics
 *
 * The implementation is intentionally kept close to the original so that
 * packet handling, palette updates, scrolling, transparency, and background
 * reporting behave exactly like the application's previous player.
 */
const WIDTH = 300
const HEIGHT = 216
const DISPLAY_BOUNDS = [6, 12, 294, 204]
const TILE_WIDTH = 6
const TILE_HEIGHT = 12

const COMMAND_MASK = 0x3f
const CDG_COMMAND = 0x09

export class CDGFrameBuffer {
  constructor () {
    this.hOffset = 0
    this.vOffset = 0
    this.keyColor = null
    this.bgColor = null
    this.borderColor = null
    this.clut = Array.from({ length: 16 }, () => [0, 0, 0])
    this.pixels = new Uint8ClampedArray(WIDTH * HEIGHT)
    this.buffer = new Uint8ClampedArray(WIDTH * HEIGHT)
    this.imageData = new ImageData(WIDTH, HEIGHT)
    this.backgroundRGBA = [0, 0, 0, 0]
    this.contentBounds = [0, 0, 0, 0]
  }

  reset () {
    this.hOffset = 0
    this.vOffset = 0
    this.keyColor = null
    this.bgColor = null
    this.borderColor = null
    this.clut = Array.from({ length: 16 }, () => [0, 0, 0])
    this.pixels = new Uint8ClampedArray(WIDTH * HEIGHT)
    this.buffer = new Uint8ClampedArray(WIDTH * HEIGHT)
    this.imageData = new ImageData(WIDTH, HEIGHT)
    this.backgroundRGBA = [0, 0, 0, 0]
    this.contentBounds = [0, 0, 0, 0]
  }

  setClutEntry (index, r, g, b) {
    this.clut[index] = [r * 17, g * 17, b * 17]
  }

  render (forceKey) {
    let [minX, minY, maxX, maxY] = [WIDTH, HEIGHT, 0, 0]
    let hasContent = false

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        let colorIndex

        if (
          this.borderColor !== null
          && (x < DISPLAY_BOUNDS[0] || y < DISPLAY_BOUNDS[1]
            || x >= DISPLAY_BOUNDS[2] || y >= DISPLAY_BOUNDS[3])
        ) {
          colorIndex = this.borderColor
        } else {
          const sourceX = x + this.hOffset
          const sourceY = y + this.vOffset
          colorIndex = this.pixels[sourceX + sourceY * WIDTH]
        }

        const [r, g, b] = this.clut[colorIndex]
        const isTransparent = colorIndex === this.keyColor
          || (forceKey && (colorIndex === this.bgColor || this.bgColor === null))
        const offset = (x + y * WIDTH) * 4

        this.imageData.data[offset] = r
        this.imageData.data[offset + 1] = g
        this.imageData.data[offset + 2] = b
        this.imageData.data[offset + 3] = isTransparent ? 0 : 255

        if (!isTransparent) {
          hasContent = true
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }

    this.contentBounds = hasContent || !forceKey
      ? [minX, minY, maxX + 1, maxY + 1]
      : [0, 0, 0, 0]

    this.backgroundRGBA = this.bgColor === null
      ? [0, 0, 0, forceKey ? 0 : 1]
      : [...this.clut[this.bgColor], this.bgColor === this.keyColor || forceKey ? 0 : 1]
  }
}

class MemoryPreset {
  constructor (packet) {
    this.color = packet[4] & 0x0f
  }

  execute (frame) {
    frame.pixels.fill(this.color)
    frame.bgColor = this.color
    frame.borderColor = null
    frame.hOffset = 0
    frame.vOffset = 0
  }
}

class BorderPreset {
  constructor (packet) {
    this.color = packet[4] & 0x0f
  }

  execute (frame) {
    frame.borderColor = this.color
  }
}

class TileBlock {
  constructor (packet) {
    this.colors = [packet[4] & 0x0f, packet[5] & 0x0f]
    this.row = packet[6] & 0x1f
    this.column = packet[7] & 0x3f
    this.pixels = packet.slice(8, 20)
  }

  execute (frame) {
    const startX = this.column * TILE_WIDTH
    const startY = this.row * TILE_HEIGHT

    if (startX + TILE_WIDTH > WIDTH || startY + TILE_HEIGHT > HEIGHT) return

    for (let y = 0; y < TILE_HEIGHT; y++) {
      const rowBits = this.pixels[y]
      for (let x = 0; x < TILE_WIDTH; x++) {
        const color = this.colors[(rowBits >> (5 - x)) & 1]
        this.setPixel(frame, startX + x + (startY + y) * WIDTH, color)
      }
    }
  }

  setPixel (frame, offset, color) {
    frame.pixels[offset] = color
  }
}

class TileBlockXor extends TileBlock {
  setPixel (frame, offset, color) {
    frame.pixels[offset] ^= color
  }
}

class ScrollPreset {
  constructor (packet) {
    this.color = packet[4] & 0x0f
    const h = packet[5] & 0x3f
    this.hCommand = (h & 0x30) >> 4
    this.hOffset = h & 0x07
    const v = packet[6] & 0x3f
    this.vCommand = (v & 0x30) >> 4
    this.vOffset = v & 0x0f
  }

  execute (frame) {
    frame.hOffset = Math.min(this.hOffset, 5)
    frame.vOffset = Math.min(this.vOffset, 11)

    let dx = 0
    if (this.hCommand === 2) dx = TILE_WIDTH
    else if (this.hCommand === 1) dx = -TILE_WIDTH

    let dy = 0
    if (this.vCommand === 2) dy = TILE_HEIGHT
    else if (this.vCommand === 1) dy = -TILE_HEIGHT

    if (dx === 0 && dy === 0) return

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        frame.buffer[x + y * WIDTH] = this.getPixel(frame, x + dx, y + dy)
      }
    }

    const previous = frame.pixels
    frame.pixels = frame.buffer
    frame.buffer = previous
  }

  getPixel (frame, x, y) {
    // Preserve cdgraphics' edge behavior: row/column zero comes from the
    // scroll fill color when scrolling.
    return x > 0 && x < WIDTH && y > 0 && y < HEIGHT
      ? frame.pixels[x + y * WIDTH]
      : this.color
  }
}

class ScrollCopy extends ScrollPreset {
  getPixel (frame, x, y) {
    const wrappedX = (x + WIDTH) % WIDTH
    const wrappedY = (y + HEIGHT) % HEIGHT
    return frame.pixels[wrappedX + wrappedY * WIDTH]
  }
}

class DefineTransparentColor {
  constructor (packet) {
    this.color = packet[4] & 0x0f
  }

  execute (frame) {
    frame.keyColor = this.color
  }
}

class LoadClutLow {
  constructor (packet) {
    this.colors = Array(8)
    for (let i = 0; i < 8; i++) {
      const offset = 4 + i * 2
      let value = (packet[offset] & 0x3f) << 6
      value += packet[offset + 1] & 0x3f
      this.colors[i] = [(value >> 8) & 0x0f, (value >> 4) & 0x0f, value & 0x0f]
    }
  }

  execute (frame) {
    for (let i = 0; i < 8; i++) {
      frame.setClutEntry(i + this.offset, ...this.colors[i])
    }
  }

  get offset () {
    return 0
  }
}

class LoadClutHigh extends LoadClutLow {
  get offset () {
    return 8
  }
}

const CDG_COMMANDS = {
  1: MemoryPreset,
  2: BorderPreset,
  6: TileBlock,
  20: ScrollPreset,
  24: ScrollCopy,
  28: DefineTransparentColor,
  30: LoadClutLow,
  31: LoadClutHigh,
  38: TileBlockXor,
}

class CDGParser {
  constructor (buffer) {
    this.bytes = new Uint8Array(buffer)
    this.numPackets = Math.floor(this.bytes.byteLength / 24)
    this.pc = -1
  }

  parseThrough (time) {
    const target = Math.floor(300 * time)
    const packets = []

    if (this.pc > target) {
      this.pc = -1
      packets.isRestarting = true
    }

    while (this.pc < target && this.pc < this.numPackets - 1) {
      this.pc++
      const packet = this.parse(this.bytes.subarray(this.pc * 24, this.pc * 24 + 24))
      if (packet) packets.push(packet)
    }

    return packets
  }

  parse (packet) {
    if ((packet[0] & COMMAND_MASK) !== CDG_COMMAND) return false

    const Command = CDG_COMMANDS[packet[1] & COMMAND_MASK]
    return Command ? new Command(packet) : false
  }
}

export default class CDGDecoder {
  constructor (buffer) {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new TypeError('CDG data must be an ArrayBuffer')
    }

    this.frame = new CDGFrameBuffer()
    this.parser = new CDGParser(buffer)
    this.forceKey = undefined
  }

  /**
   * Render the frame at `time` (seconds). Rendering must be monotonic unless
   * forceKey is requested; seeking backwards automatically restarts the
   * decoder, which matches the original player's behavior.
   */
  render (time, { forceKey = false } = {}) {
    if (Number.isNaN(time) || time < 0) {
      throw new Error(`Invalid CDG time: ${time}`)
    }

    const packets = this.parser.parseThrough(time)
    const isChanged = packets.length > 0
      || Boolean(packets.isRestarting)
      || forceKey !== this.forceKey

    this.forceKey = forceKey

    if (packets.isRestarting) this.frame.reset()
    for (const packet of packets) packet.execute(this.frame)

    if (isChanged) this.frame.render(forceKey)

    return {
      imageData: this.frame.imageData,
      isChanged,
      backgroundRGBA: this.frame.backgroundRGBA,
      contentBounds: this.frame.contentBounds,
    }
  }
}
