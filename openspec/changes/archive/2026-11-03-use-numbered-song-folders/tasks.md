# Tasks

## 1. Folder source

- [x] 1.1 Derive a numbered song-folder candidate in `js/library.js`, accepting it only when the folder's parsed title matches the file's own title, and add it to the folder-audio candidate list. Verify with `node --test test/library.test.js`.

## 2. Tests and docs

- [x] 2.1 Add regression tests for a folder-derived artist and for a numbered folder whose title does not match the file. Verify with `npm test`.
- [x] 2.2 Update the `[Unreleased]` changelog, the user guide naming rules, the troubleshooting entry, and the tracked test count. Verify with `npx openspec validate --all --strict`.

## 3. Verification

- [x] 3.1 Run `npm test`, `npm run lint` and `npx openspec validate --all --strict`. Verify all pass.
- [x] 3.2 Rescan the reference library folder and confirm the renamed song folders now load, with no folder-derived mislabelling. Verify with a scripted `buildLibrary` run over `chord-vault/Tom-and-the-Back-Roads/covers`: tracks 2 → 83, unreadable filenames 122 → 41 (81 fixed, 0 newly unreadable).
