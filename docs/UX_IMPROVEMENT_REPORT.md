# UX improvement report — November 2026

Scope: live karaoke operation in the existing two-panel dark UI. The Classic
slate-blue background visualizer, MP3+G/CD+G, ZIP, MP4, LRC and ELRC playback,
the queue and all saved preferences are unchanged.

## Baseline

- `npm test`: 100 tests passing.
- `npm run lint`: clean.
- Browser walkthrough at 1440 × 900 and 620 × 900 using the checked-in MP3+G,
  LRC and ZIP fixtures.

## Problems found

1. **The library had no fast way to narrow a large song book.** Search worked,
   but there was no filter for songs that actually have CD+G, LRC, MP4 or ZIP
   support.
2. **Every song row was a separate tab stop.** Keyboard users had to tab through
   three buttons per song, which is impractical for a real library.
3. **Skipped files were a flat list.** The notice said "missing .cdg or .lrc" but
   did not separate that from a bad filename or a damaged archive, and did not
   say what to do.
4. **Media support was ambiguous.** One badge collapsed ZIP + CD+G, ZIP + LRC
   and plain audio into vague labels, and LRC/ELRC were indistinguishable.
5. **Playback states overlapped.** Selected, current and next were all rendered
   with similar emphasis; the queue did not mark which song was actually next.
6. **Queue work was slower than it needed to be.** There was no move-to-front,
   no duplicate count, and no estimate of how long the queue would run.
7. **Durations were mostly unknown.** Songs showed "—" until they had been
   played once, so queue time estimates were impossible.
8. **The idle stage was passive**, showing only a headline even when songs and a
   queue were already loaded.
9. **Several targets and labels were too small.** Row actions were 27 px, faint
   text was below comfortable contrast, and the toast could cover the transport
   controls.

## Changes

### Library browsing and selection

- Added media filter chips: **All / CD+G / LRC / MP4 / ZIP** (`index.html`,
  `css/app.css`, `js/library.js`, `js/app.js`).
- Replaced per-row tab stops with one roving tab stop. `↑`/`↓` move through the
  visible rows, `Home`/`End` jump to the ends, `Enter` queues, `Shift+Enter`
  plays now, and `↓` from the search field enters the results.
- The selected row, currently playing row and first queued row now have distinct
  colours and markers. The current row is also exposed with `aria-current`.
- Search results report the number shown and explain an empty result caused by a
  media filter or an empty favourites list.

### Media indicators

- `trackMedia()` now returns the formats the player will actually use: audio
  format, CD+G, LRC, ELRC, ZIP and MP4. Badges appear in the library, queue and
  current-song card, with explanatory tooltips.

### Diagnostics

- `diagnoseWarnings()` groups scan warnings into causes: missing lyrics/CD+G,
  unreadable filename, empty archive, damaged archive, unreadable folder and
  unreadable file.
- Each group shows a concrete fix, and paths inside ZIPs render as
  `Archive.zip → Song.mp3`.

### Queue

- The first upcoming song is marked **Next** in both the queue and the library.
- Duplicate entries show `×2 in queue`; the toast confirms repeat adds.
- Added a **move to front** action next to the existing play, up, down and remove
  actions.
- Queue rows now include media badges and known durations.
- The queue heading reports upcoming count, estimated total time and how many
  durations are still unknown.

### Duration estimates

- Added `js/audio-duration.js`, a dependency-free MP3 reader. It reads the
  Xing/Info frame count when present and otherwise estimates from the first
  frame's bitrate. It never loads a media element per file.
- Estimates run four at a time in the background, starting with the queue.
  Estimated values are prefixed with `~`; unknown formats remain `—`.
- Library estimates are capped at the first 300 MP3s per render pass so very
  large folders stay responsive.

### Idle stage and accessibility

- The idle stage now names the next queued song when one exists, and otherwise
  shows the loaded song count and the browse/queue shortcuts.
- The toast moved below the top bar so it no longer covers playback controls.
- Song rows are 44 px tall and row actions are 32 px (transport controls remain
  42 px). Faint text contrast was raised without changing the palette.
- Filter chips, rows and list navigation have visible focus rings.

## Verification

- `npm test`: **110 tests passing** (10 new tests for media capabilities,
  filters, diagnostics, duration summaries and MP3 duration estimation).
- `npm run lint`: clean.
- Browser checks on the checked-in fixtures:
  - 1440 × 900: library badges, filters, selected/current/next states, queue
    duplicates, queue total and the up-next card.
  - 620 × 900: single-column layout, wrapped transport, queue rows and toast
    position.
  - Scripted DOM checks confirmed: two warning groups with fixes, one keyboard
    tab stop for two songs, `↑`/`↓` moving focus between songs, MP4 filter
    returning "No MP4 songs in this library", and search returning the expected
    song with `MP3` and `CD+G` badges.

## Remaining opportunities

- Duration estimates currently cover MP3 only. MP4 and OGG/M4A durations still
  appear after the song loads.
- Queue keyboard reordering is still button-based; a dedicated grab mode could
  reduce the number of key presses.
- The library could remember the last selected song across reloads.
- Full accessibility automation (axe/Lighthouse) is not part of the test suite,
  so future changes should continue to include manual keyboard checks.
