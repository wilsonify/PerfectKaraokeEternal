# Proposal

## Why

A karaoke collection keeps one song per folder, commonly named `<track> - <artist> - <title>`. The
audio inside is often a rendered backing track with no ID3 tags and a numbered name
(`01 - Inside Out - Karaoke.mp3`), so the folder is the only place that names the artist. Today the
scan reads that folder name for ZIP entries but not for loose files, so renaming the folder does
not fix the unreadable-filename warning.

## What Changes

- A track whose filename has no usable artist takes it from its song folder when the folder is
  named `<track> - <artist> - <title>` and the folder's title matches the file's own title.
- A numbered folder whose title does not match the file — for example an album folder such as
  `01 - Various - 90s Hits` holding `01 - Song.mp3` — SHALL NOT supply an artist, and the file keeps
  the existing skip.
- MP3 album-artist (`TPE2`) tags keep counting as an artist source, alongside the artist tag.

Out of scope: renaming or retagging files for the user, new folder conventions beyond the numbered
one, and changes to ZIP or MP4 resolution.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `media-library`: the artist and title resolution requirement gains the numbered song-folder
  source and the title-match guard.

## Impact

- `js/library.js`: a folder-name candidate derived from the same parser, added to the folder-audio
  candidate list.
- `test/library.test.js`: regression coverage for a folder-derived artist and for a mismatched
  numbered folder.
- No new dependencies, no interface, storage, or format changes.

## Known gaps

Folders that are not yet renamed to the convention, and files whose own name and folder both lack
an artist, still need tags or renaming. Verified against the reference library by a scripted scan,
not in a browser.
