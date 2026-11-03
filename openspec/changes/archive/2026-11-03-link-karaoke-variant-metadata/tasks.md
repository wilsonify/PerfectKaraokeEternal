# Tasks

## 1. Resolution order

- [x] 1.1 Split filename and ID3-tag resolution in `js/library.js` and add a same-name sibling fallback that reuses a source file's artist and title. Verify with `node --test test/library.test.js`.
- [x] 1.2 Index audio files per directory and pass the matching siblings only to folder audio, leaving ZIP and MP4 resolution unchanged. Verify by inspection and the existing ZIP/MP4 tests.

## 2. Tests and docs

- [x] 2.1 Add regression tests for a karaoke variant resolved from its tagged source and one that stays skipped because nothing identifies it. Verify with `npm test`.
- [x] 2.2 Update the `[Unreleased]` changelog, the user guide's naming section, the troubleshooting entry, and the tracked test count. Verify with `npx openspec validate --all --strict`.

## 3. Verification

- [x] 3.1 Run `npm test`, `npm run lint` and `npx openspec validate --all --strict`. Verify all pass.
- [x] 3.2 Rescan the reference library folder with the built library to confirm the variants whose source carries tags are no longer reported as unreadable. Verify with a scripted `buildLibrary` run over `chord-vault/Tom-and-the-Back-Roads/covers`: the unreadable count fell from 122 to 42, and the remainder are files whose source MP3 carries no ID3 artist or title (ffmpeg `major_brand`/`TSSE` frames only).
