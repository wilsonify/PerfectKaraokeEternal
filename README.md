# Perfect Karaoke

A local karaoke player for MP3+G (CD+G) and MP4 files. Open a folder of songs in
your browser, build a queue, and sing. Everything runs in the browser: there is no
server component, no accounts, no uploads, and no build step.

![Perfect Karaoke player](assets/screenshot.png)

## Features

- MP3+G tracks (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac` with a matching `.cdg`)
- Zipped MP3+G archives, including archives with several songs or extra files
- MP4 karaoke videos
- CD+G lyrics rendering with adjustable size and background dimming
- Optional audio-reactive visualizer behind the lyrics
- Library grouped by artist with alphabet jump, favourites and search
- Queue with drag-and-drop reordering, history and "play now"
- Optional ReplayGain volume leveling
- Keyboard shortcuts, fullscreen, and remembered volume/display settings
- Your library never leaves the computer - files are read locally by the browser

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer, used only to serve the static files
- A modern browser. Chrome or Edge are recommended because they support the
  File System Access API, which lets the player remember your music folder between
  visits. Other browsers can still load songs with **Add files** or drag-and-drop.

## Running

```bash
npm start
```

Then open <http://localhost:3000>. No `npm install` is needed: the app has no
runtime dependencies, and `serve.js` uses only Node's standard library.

To use another port:

```bash
node serve.js --port 8080
# or
PORT=8080 npm start
```

Opening `index.html` straight from disk does not work, because browsers refuse to
load ES modules over `file://`.

## Song files

Name audio and lyrics files the same way in the same folder:

```text
Queen - Bohemian Rhapsody.mp3
Queen - Bohemian Rhapsody.cdg
```

Zipped tracks work too, as long as the audio and `.cdg` inside share a name:

```text
Queen - BoRhap.zip
  Queen - BoRhap.mp3
  Queen - BoRhap.cdg
```

The filename parser understands the naming conventions karaoke libraries tend to
use: `The`-article handling (`Beatles, The`), track numbers (`AZ1234-01 - ...`),
`ft.`/`feat.` variants, `[Karaoke]`-style suffixes, and `in the style of ...` titles.

Files that cannot be used are not silently dropped: anything without a matching
`.cdg`, or without an `Artist - Title` separator in the name, is counted in the
"files skipped during the scan" notice above the library.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek 5 seconds |
| `N` | Next song |
| `P` | Previous song |
| `M` | Mute |
| `F` | Fullscreen |
| `/` | Focus search |

## Development

```bash
npm install    # dev tools only (ESLint)
npm test       # node:test suite
npm run lint   # ESLint
```

The app is plain ES modules and CSS with no build or transpile step:

| Path | Contents |
| --- | --- |
| `index.html` | Markup and icon sprite |
| `css/app.css` | Layout, theme and responsive rules |
| `js/app.js` | UI state, library browsing, queue, persistence |
| `js/player.js` | Audio/video playback, CD+G sync, visualizer |
| `js/cdg.js` | CD+G decoder and renderer |
| `js/library.js` | Filename parsing, file pairing, search |
| `js/zip.js` | Minimal ZIP reader (stored + deflate) |
| `js/audio-tags.js` | ReplayGain tag parsing |
| `serve.js` | Static file server for development and local use |
| `test/` | Unit tests for the parser, pairing, search and CD+G decoder |

## Licence

ISC. The CD+G decoder is adapted from [cdgraphics](https://github.com/bhj/cdgraphics)
by Ben Hilburn (ISC).
