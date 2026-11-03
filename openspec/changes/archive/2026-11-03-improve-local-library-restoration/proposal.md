# Proposal

## Why

Returning to the player should not mean hunting for the same music folder again. Today only
File System Access browsers get a remembered folder, permission is requested without first
checking it, and a fallback (`webkitdirectory`) scan produces different track paths than a
handle scan — so the same folder can load as duplicates and drop the restored queue.

## What Changes

- Choose the folder source from capability (picker present, secure context, not an embedded
  Electron browser) and tell the user which path is active.
- Remember the last folder's name and source mode after a successful load, so both handle and
  fallback browsers show `Reopen “<name>”`. Fallback browsers re-open the directory picker with
  an explanation instead of pretending the old selection can be reused.
- Check read permission first and distinguish already granted, re-prompted, denied, blocked and
  no-longer-available outcomes, each with an actionable message. A failed permission never wipes
  the loaded library.
- Normalise folder-scan paths to be relative to the selected folder root so a handle scan and a
  `webkitdirectory` scan of the same folder yield identical track ids (no duplicates, queue and
  history survive a reopen).
- Keep the current library intact when the selected folder cannot be read at all, instead of
  replacing it with an empty library.

Out of scope: cloud/server sync, new dependencies, changes to media pairing or naming rules,
playback changes, and any rewrite of folder scanning.

## Capabilities

### New Capabilities

- `local-library-restoration`: choosing and remembering the folder source, handling read
  permission, keeping track identity stable across folder sources, and failing safely when the
  remembered folder is unavailable.

### Modified Capabilities

- `queue`: persistence wording now states that restored entries are shown as unavailable before a
  folder is loaded, and removed with a toast after a scan that does not contain them.

## Impact

- New pure module `js/folder-restore.js` (capability rules, permission outcomes, path
  normalisation, reopen labelling, unreadable-folder detection).
- `js/app.js`: folder picker, permission, reopen, folder-input scan and initial restore wiring.
- New `test/folder-restore.test.js`; native picker and permission prompts remain manual browser
  checks and are not claimed as automated coverage.
- No new runtime dependencies, no server or storage changes; IndexedDB and localStorage behaviour
  is preserved.

## Known gaps

Native directory pickers and permission prompts cannot be driven in automated tests. Picker choice,
permission outcomes, path normalisation and reopen labelling are unit tested; granting, denying or
revoking access in a real browser remains a manual check (`docs/archive/QA_REPORT_2026-10-29.md` §8 item 2).
No browser compatibility is claimed beyond the capability rules in the spec.
