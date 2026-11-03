# PerfectKaraokeEternal developer guide

This guide explains how the app is built, how to run and test it, and where to change what. The
behavior contract lives in [`openspec/specs/`](../openspec/specs/); this document explains the code
that implements it.

## 1. Design constraints

- **Local-first:** no backend, accounts, uploads, or network features. `serve.js` only serves the
  app's own static files.
- **No build step:** plain ES modules and CSS, loaded directly by the browser.
- **No runtime dependencies:** everything in `package.json` is a development tool.
- **Small, testable modules:** behavior that can be reasoned about without a DOM lives in pure
  modules and is covered by `node:test`.

These constraints are deliberate; a change that adds a runtime dependency, a bundler, or a server
API needs a strong justification and an OpenSpec change.

## 2. Repository layout

| Path | Contents |
| --- | --- |
| `index.html` | Markup, dialog, and the inline SVG icon sprite |
| `css/app.css` | Layout, theme, components, responsive rules, reduced motion |
| `js/` | Application modules (table below) |
| `serve.js` | Static file server used for local development and local hosting |
| `test/` | `node:test` suites plus media fixtures |
| `openspec/` | Specifications (`specs/`) and change proposals (`changes/`) |
| `docs/` | User, administrator, developer, and contribution documentation |
| `.agents/skills/` | Agent skills for the OpenSpec propose/apply/archive workflow |

## 3. Architecture

```text
index.html
  └─ js/app.js        boot, state, DOM rendering, events, persistence
       ├─ js/library.js         scanning, pairing, parsing, search, diagnostics
       ├─ js/player.js          media element, CD+G, lyrics, visualizer loop
       ├─ js/folder-restore.js  folder-source choice, permissions, path identity
       ├─ js/shortcuts.js       key resolution and focus ownership
       ├─ js/visualizer.js      background styles
       ├─ js/lrc.js             LRC/ELRC parsing and word alignment
       ├─ js/cdg.js             CD+G decoder and renderer
       ├─ js/zip.js             minimal ZIP reader
       ├─ js/audio-duration.js  fast MP3 duration estimates
       ├─ js/audio-tags.js      ReplayGain tag parsing
       └─ js/audio-tracks.js    multi-track MP4 switching
serve.js             static file server (no application logic)
```

### Layers

1. **Pure behavior modules** (`library`, `lrc`, `cdg`, `zip`, `audio-duration`, `audio-tags`,
   `audio-tracks`, `shortcuts`, `folder-restore`, `visualizer`) have no DOM dependency and are unit
   tested directly.
2. **`js/player.js`** owns the media elements, the CD+G canvas, LRC presentation, visualizer
   animation, ReplayGain application, and audio-track selection. It reports state changes through
   callbacks.
3. **`js/app.js`** owns application state, rendering, event wiring, persistence, and the user-facing
   messages. It is the only module that touches the page structure.
4. **`serve.js`** is transport only: it resolves a URL, checks the allowlist, and streams a file.

### Data flow

- **Loading:** a folder handle or file list becomes `{ file, path }` records
  (`collectDirectoryRecords` or the app's file-list scan), then `buildLibrary()` pairs audio with
  companions, parses names, reads ZIPs, and returns `{ tracks, warnings }`.
- **Display:** `groupByArtist()`, `searchTracks()`, `matchesMediaFilter()`, `trackMedia()`, and
  `diagnoseWarnings()` turn tracks and warnings into what the library and queue render.
- **Playback:** `loadTrack()` hands a track to `KaraokePlayer`, which chooses CD+G, LRC, or MP4 mode
  and emits time/play/pause/error events back to the app.
- **Persistence:** preferences, session, and folder name go to `localStorage`; the folder handle
  goes to IndexedDB. Session writes are debounced.

### Storage keys

| Key | Owner | Contents |
| --- | --- | --- |
| `pke.prefs.v1` | `js/app.js` | Volume, ReplayGain, CD+G size/alpha, visual style, sensitivity, favourites, audio-track choices |
| `pke.session.v1` | `js/app.js` | Queue, current id, history (last 200) |
| `pke.folder.v1` | `js/app.js` | Last folder name and source (`handle` or `fallback`) |
| `pke-files` / `handles` | `js/app.js` | IndexedDB store for the File System Access handle |

Storage access is wrapped so private mode or quota failures degrade to defaults instead of errors.

## 4. Development setup

Requirements: Node.js 20+.

```bash
npm install    # development tools only: ESLint and the OpenSpec CLI
npm start      # serve at http://localhost:3000
npm test       # node --test "test/*.test.js"
npm run lint   # eslint .
npm run lint:fix
```

`npm install` is not needed to run the player, only to test, lint, or use OpenSpec.

Useful variants:

```bash
node --test test/library.test.js
node --test test/library.test.js --test-name-pattern "AppleDouble"
```

## 5. Tests

The suite uses Node's built-in test runner and assertions; there is no test framework dependency.

| Test file | Focus |
| --- | --- |
| `test/library.test.js` | Name parsing, pairing, ZIP discovery, merging, search, grouping, diagnostics, duration summaries |
| `test/lrc.test.js` | LRC/ELRC parsing, offsets, word alignment |
| `test/cdg.test.js` | CD+G decoding, keying, backdrop bounds |
| `test/audio-duration.test.js` | MP3 Xing/frame duration estimation |
| `test/audio-tags.test.js` | ReplayGain tag parsing and gain factors |
| `test/audio-tracks.test.js` | Track enumeration, ids, enabling one track |
| `test/shortcuts.test.js` | Key resolution and focus ownership |
| `test/folder-restore.test.js` | Folder-source choice, permission outcomes, path normalisation, reopen labels |
| `test/visualizer.test.js` | Style normalisation, Off, sensitivity, render safety |
| `test/player-visualizer.test.js` | Player visualizer dispatch and style switching |
| `test/media-fixtures.test.js` | Real MP3+G excerpts and ZIP fixture |
| `test/serve.test.js` | Allowlist, traversal, methods, MIME types, host/port parsing |

Fixtures in `test/fixtures/media/` are short real karaoke excerpts with checksums recorded in
`fixtures.json`; `generate.js` documents how to rebuild them and is not part of `npm test`.

### What the suite does not cover

Browser-only paths have no automated tests: the native folder picker and permission prompts,
fullscreen, real multi-audio-track MP4 playback, drag-and-drop, and responsive layout. The pure
decision logic behind several of these (folder-source choice, permission messages, path
normalisation, reopen labels) *is* unit tested, so only the browser interaction remains manual.

Never claim a browser behavior as verified based on a mocked test. Record manual checks, including
the browser used, when they matter.

## 6. Code conventions

- ES modules, no semicolons, two-space indentation, single quotes.
- `space-before-function-paren: always` (`function name ()`).
- `js/**` is linted with browser globals; root scripts and `test/**` with Node globals.
- Keep pure logic out of `js/app.js`; if it can be tested without a DOM, it belongs in a module.
- Prefer small DOM helpers (`element`, `iconButton`) over HTML strings.
- Keep interactive elements real buttons, preserve keyboard access, and update `aria-*` state when
  a visual state changes.
- No inline event handlers and no `innerHTML` with user-provided names.
- Do not add runtime dependencies or a build step.

## 7. Debugging

| Problem | What to check |
| --- | --- |
| App does not boot | Console for module load errors; confirm the page is served over HTTP, not `file://` |
| Styles missing | Server allowlist and the request path; restart the old server process |
| Folder scanning fails | The skipped-files notice, then `buildLibrary()` warnings for the path/reason |
| Picker behavior | `window.isSecureContext`, `typeof window.showDirectoryPicker`, user agent; fallback is expected in Firefox/Safari/Electron |
| Permission behavior | `queryPermission`/`requestPermission` outcomes; test in a normal Chromium window, not automation |
| Playback errors | The media element's `error.code`; messages map 1–4 to abort/network/decode/unsupported |
| Visualizer blank | Style is not `off`, mode is CD+G or LRC, sensitivity above 0 |
| Queue looks wrong | `pke.session.v1` in DevTools → Application → Local Storage |
| Saved state missing | Origin changed (port/host), private window, or site data cleared |
| Test failure | Run the single file first; pure modules should fail with a concrete input/output difference |

For library bugs, reproducing with drag-and-drop avoids the picker entirely. For folder-restore
bugs, exercise the pure helpers in `test/folder-restore.test.js` and then confirm the browser flow
manually.

## 8. Making a change

1. Decide whether behavior changes. If it does, write an OpenSpec change first; if it is a typo,
   styling, test-only, or refactor with no observable change, skip it.
2. Implement the smallest coherent change and keep unrelated cleanup out.
3. Add or update tests for the behavior you changed; run `npm test` and `npm run lint`.
4. Run `npx openspec validate --all --strict`.
5. Update the changelog and any affected guide or spec in the same change.
6. Archive the OpenSpec change once its tasks are verified.

The full workflow, including commands and documentation rules, is in
[CONTRIBUTING.md](CONTRIBUTING.md). Specifications are authoritative for behavior; see
[`openspec/config.yaml`](../openspec/config.yaml) for project-wide artifact rules.

## 9. Browser APIs and fallbacks

| API | Used for | When unavailable |
| --- | --- | --- |
| File System Access (`showDirectoryPicker`, handles, IndexedDB handle storage) | Native folder choice and remembered folder | Directory input or **Add files** |
| `webkitdirectory` input | Folder selection fallback | File-only **Add files** |
| `localStorage` | Preferences and session | Defaults; app keeps working |
| IndexedDB | Remembered folder handle | Reopen falls back to choosing the folder |
| Canvas 2D | CD+G and visualizer | Stage stays plain; no crash |
| Web Audio `AnalyserNode` | Audio-reactive visuals | Visuals render without audio data |
| Fullscreen API | Stage fullscreen | Toast explains the failure |
| `HTMLMediaElement.audioTracks` | Multi-track MP4 selector | Selector hidden; default track plays |
| `<dialog>` | Display options | — (required) |

## 10. Known gaps

These are recorded in the specs and remain manual or unverified:

- Malformed LRC files are validated at play time, not scan time (`lyrics`).
- Native multi-track MP4 switching is verified only with a simulated API; real Safari validation is
  pending (`mp4-playback`).
- The native folder picker and permission prompts cannot be driven by the automated suite
  (`local-library-restoration`).
- Fullscreen in embedded/headless contexts and touch drag-reordering are manual checks.

## 11. Performance notes

- Library duration estimates are capped at 300 tracks per pass; queue durations are prioritised.
- Artist groups render 60 at a time; search results render 200 at a time.
- Search is debounced by 100 ms.
- Session writes are debounced by 250 ms; history is capped at 200 entries.
- Audio-track memory is capped at 50 files.
- Scans report progress from the file walker and `buildLibrary()`; ZIP reads happen per archive.

## 12. Related documents

- [CONTRIBUTING.md](CONTRIBUTING.md) — OpenSpec workflow, verification, changelog, docs sync.
- [USER_GUIDE.md](USER_GUIDE.md) — behavior from a singer's point of view.
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) — server, exposure, security, backup.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — symptom-based help.
- [`openspec/specs/`](../openspec/specs/) — authoritative behavior contracts.
