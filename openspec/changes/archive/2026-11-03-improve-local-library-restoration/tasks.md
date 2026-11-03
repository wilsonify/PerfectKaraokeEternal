# Tasks

## 1. Capability rules

- [x] 1.1 Add `js/folder-restore.js` with folder-source resolution (picker, secure context, embedded browser), picker notes, path normalisation, permission outcomes, reopen labelling and unreadable-folder detection. Verify with `node --test test/folder-restore.test.js`.

## 2. Wire the app

- [x] 2.1 Use the resolved folder source in `openFolder`, falling back to the directory input when the picker is unavailable or fails, and keep cancel silent. Verify by inspection plus the fallback scenarios in `test/folder-restore.test.js` (manual picker check listed below).
- [x] 2.2 Apply permission outcomes in `scanDirectoryHandle`: scan on granted, clear messages on denied/blocked/unavailable, and never clear the library on refusal. Verify by inspection and the permission unit tests.
- [x] 2.3 Remember the folder name and mode after a successful folder load in both sources, render `Reopen “<name>”` from that record on startup, and route the reopen control through the handle when one exists or the directory input otherwise. Verify with the reopen unit tests and a manual reload.
- [x] 2.4 Normalise directory file-input paths relative to the selected folder root so fallback and handle scans share track ids, and keep the loaded library when a folder cannot be read. Verify with the path and unreadable-folder unit tests.

## 3. Tests and docs

- [x] 3.1 Add `test/folder-restore.test.js` covering picker choice per environment, picker notes, permission granted/prompt/denied/blocked/unavailable, path normalisation (nested, flat and multi-root selections), reopen labels, and unreadable-folder detection. Verify with `npm test`.
- [x] 3.2 Update the queue delta into the main spec at archive time and add `[Unreleased]` changelog bullets. Verify with `npx openspec validate --all --strict`.

## 4. Verification

- [x] 4.1 Run `npm test`, `npm run lint` and `npx openspec validate --all --strict`. Verify all pass.
- [x] 4.2 Record the manual browser checks that automation cannot cover: native picker grant/deny/reopen, revoked permission, moved folder, fallback directory input on a browser without `showDirectoryPicker`, and an insecure-origin session. Verify each is listed in the summary rather than claimed as passing.
