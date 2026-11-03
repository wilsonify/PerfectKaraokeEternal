# Design

## Context

`js/app.js` wires the folder picker, permission request, scan and reopen control inline. The
directory-input fallback keeps `webkitRelativePath` (`Music/Artist - Song.mp3`), while a handle scan
keeps paths relative to the chosen folder (`Artist - Song.mp3`). Track ids are lower-cased paths, so
switching sources changes identity: rows duplicate and the saved queue is filtered out.

## Decisions

### Put the capability rules in a pure module

`js/folder-restore.js` holds folder-source resolution, picker notes, path normalisation, permission
outcomes, reopen labelling and unreadable-folder detection. The app keeps DOM, toasts and scanning.
These rules are then testable with `node:test` without a browser, matching the existing split in
`library.js`, `lrc.js` and `shortcuts.js`.

### Remember name and mode in localStorage

The directory handle stays in IndexedDB (`pke-files/handles`), which only Chromium-class browsers
support. The folder name and source mode go in `pke.folder.v1`, so a fallback browser still sees
`Reopen “<name>”` and is told the browser asks for the folder again. When the record says the last
load used the directory input, startup ignores a stale handle instead of reopening a different
folder.

### Check permission before requesting it

`queryPermission` first, then `requestPermission` only when needed. Each outcome maps to a distinct
message, and a refusal returns before any state or scan change so the loaded library survives.

### Normalise directory-input paths by stripping the shared root

Only selections where every path is nested under one common first segment are stripped, and only for
the directory input. Flat file lists and multi-root selections are untouched, so Add files and
drag-and-drop keep their names.

### Treat an unreadable folder as a failed load, an empty folder as a load

`collectDirectoryRecords` already contains per-entry errors and reports an unreadable root as a
`could not read folder` warning with no records. That case returns before `scanRecords`, so the old
library stays. A readable empty folder still produces the normal no-songs message.

## Risks

- Handle-mode behaviour depends on browser permission semantics that unit tests cannot exercise; the
  manual matrix stays in the QA report.
- Stripping the shared root relies on `webkitRelativePath` including the chosen folder, which is how
  `webkitdirectory` is specified.

## Out of scope

Server-side indexing, cloud sync, persisting a serialised library across visits, and changes to media
pairing rules.
