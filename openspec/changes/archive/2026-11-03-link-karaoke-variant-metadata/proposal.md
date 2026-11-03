# Proposal

## Why

Karaoke libraries usually keep the original song beside the backing track rendered from it
(`01 - Inside Out.mp3` and `01 - Inside Out - Karaoke.mp3`). The rendered variant is written
without ID3 tags, and its numbered name leaves no artist once the track-number prefix and the
karaoke suffix are removed, so a folder of those variants loads as `Unreadable filename` even
though the artist and title are present in the source file in the same folder. In the reference
library this hid 122 of 133 backing tracks.

## What Changes

- When a track's filename and its own ID3 tags do not identify an artist and title, the scan
  reuses them from a file in the same folder whose base name matches once a trailing
  `(Karaoke)`/` Karaoke` is ignored — the same same-name idea already used to pair lyrics.
- A track that still cannot be identified keeps the existing unreadable-filename skip and
  diagnostic, so no blank artist or invented name appears.

Out of scope: renaming or retagging files, reading tags from formats other than MP3, new pairing
rules, and changes to which duplicate copy of a song is preferred.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `media-library`: artist and title resolution gains a same-name sibling fallback, and the existing
  skip reason remains for tracks that nothing identifies.

## Impact

- `js/library.js`: name and tag resolution split into helpers, plus a per-directory audio index
  consulted only after a track fails to identify itself.
- `test/library.test.js`: regression coverage for a karaoke variant that resolves from its source
  and one that has nothing to copy from.
- No new runtime dependencies, no file-format, storage, or interface changes.

## Known gaps

Only files that are still without lyrics reach name resolution, so the reported count also depends
on pairing. A source file with no ID3 tags cannot identify its karaoke variant; that case keeps the
unreadable-filename diagnostic and is verified by unit test, not by the reference library.
