# Media Library Specification

## Purpose

Describe how songs are discovered from local folders and ZIPs, how files are paired and named, how the library is searched and filtered, and how unusable files are reported to the user.

## Requirements

### Requirement: Loading sources and merge semantics

Opening a folder through the File System Access API SHALL replace the current library. **Add files** and drag-and-drop SHALL add to the existing library instead of replacing it, and re-adding a track that already exists SHALL replace its earlier entry rather than creating a duplicate row.

#### Scenario: Folder open replaces the library

- **GIVEN** the library contains songs loaded earlier
- **WHEN** the user opens a different folder
- **THEN** the library contains only the songs from the new folder
- **AND** an unavailable current track is cleared

#### Scenario: Add files merges

- **GIVEN** a library with one track
- **WHEN** the user adds a file or drops files onto the page
- **THEN** the new tracks are appended to the existing library
- **AND** a track whose file was rebuilt replaces its previous entry
- **AND** repeated identical scan warnings appear only once

### Requirement: Pairing loose files

Audio files (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`) SHALL become playable tracks when a companion `.cdg`, `.lrc`, or optional `.elrc` file of the same base name exists in the same directory, matched case-insensitively. MP4 files SHALL become playable tracks on their own. Files without a usable companion SHALL be reported as skipped, and standalone `.lrc`/`.elrc` files SHALL never become tracks.

#### Scenario: Audio with CD+G

- **GIVEN** a folder contains `Artist - Song.mp3` and `Artist - Song.cdg`
- **WHEN** the folder is scanned
- **THEN** one track is created in CD+G mode

#### Scenario: Both CD+G and LRC companions exist

- **GIVEN** an audio file with both `.cdg` and `.lrc` companions
- **WHEN** the folder is scanned
- **THEN** the CD+G version is used and the LRC companion is not a separate track

#### Scenario: Audio without lyrics is skipped

- **GIVEN** an audio file with no `.cdg`, `.lrc`, or `.elrc` companion
- **WHEN** the folder is scanned
- **THEN** no track is created for it
- **AND** it is counted in the skipped-files notice

### Requirement: ZIP archive discovery

The library SHALL read ZIP archives containing stored or deflated audio/companion pairs, including archives with several songs. Each pair SHALL be parsed with its own artist and title, falling back to the archive's folder name when a track name has no delimiter. macOS AppleDouble (`._*`, `__MACOSX/`) and `.DS_Store` entries SHALL be ignored. A corrupt archive SHALL be reported as a warning without aborting the scan.

#### Scenario: Multi-song archive

- **GIVEN** a ZIP containing two audio/companion pairs in separate folders
- **WHEN** the library is built
- **THEN** two tracks are created with distinct titles
- **AND** each uses its own folder as the artist fallback when needed

#### Scenario: Corrupt archive does not abort the scan

- **GIVEN** a folder with one corrupt ZIP and one valid pair
- **WHEN** the library is built
- **THEN** the valid track is loaded
- **AND** the corrupt archive is reported with its path and reason

### Requirement: Filename parsing

Track names SHALL be parsed with the legacy karaoke conventions: an `Artist - Title` delimiter is required; `The`-article handling (`Beatles, The`), track-number prefixes, `ft.`/`feat.` variants, `[Karaoke]`-style suffixes and `in the style of ...` titles are understood. A name that reduces to an empty artist or title SHALL be reported as skipped instead of producing a blank row.

#### Scenario: Karaoke suffix leaves no title

- **GIVEN** a file named `The Beatles - [Karaoke].mp3` with a companion
- **WHEN** the library is built
- **THEN** the file is reported as skipped with an unreadable-filename reason
- **AND** no blank song row appears

### Requirement: Library ordering and grouping

Tracks SHALL be sorted by artist then title. The library view SHALL group tracks by display artist, merging alternate spellings of the same artist (for example `The Beatles` and `Beatles, The`) into one group.

#### Scenario: Alternate spellings merge

- **GIVEN** tracks credited to `Beatles, The` and `The Beatles`
- **WHEN** the library is grouped
- **THEN** both appear under a single artist group

### Requirement: Search and filters

Search SHALL match keyword tokens spanning both artist and title, requiring every token, with title matches ranked first. The media-type filter chips (All, CD+G, LRC, MP4, ZIP) SHALL restrict results to tracks the player can use for that type, and the favourites filter SHALL restrict results to favourited tracks.

#### Scenario: Cross-field search

- **GIVEN** a library containing `The Beatles - All Together Now`
- **WHEN** the user searches `beatles all together now`
- **THEN** the track is returned

#### Scenario: Filter with no matches

- **GIVEN** a library with no MP4 tracks
- **WHEN** the user selects the MP4 filter
- **THEN** the results explain that no MP4 songs exist in this library

### Requirement: Media capability badges

Every song row, queue row and current-song card SHALL show the formats the track can actually play: audio format plus CD+G, LRC, ELRC, ZIP or MP4 as applicable.

#### Scenario: Badge reflects companions

- **GIVEN** an MP3 track with a CD+G companion loaded from a ZIP
- **WHEN** the row is rendered
- **THEN** it shows the audio format, CD+G and ZIP indicators

### Requirement: Skipped-file diagnostics

Files that cannot be used SHALL be counted in a notice above the library. The notice SHALL group problems by cause (missing lyrics, unreadable filename, empty or damaged archive, unreadable folder, unreadable file), show the affected paths (including paths inside ZIPs as `Archive.zip → entry`), and explain how to fix each cause. The scan SHALL continue after per-file and per-folder errors.

#### Scenario: Grouped causes with fixes

- **GIVEN** a scan that skipped one audio file without lyrics and one corrupt ZIP
- **WHEN** the skipped-files notice is opened
- **THEN** the problems appear under separate causes with paths and a suggested fix for each
- **AND** identical repeated warnings are listed once

### Requirement: Duration estimates

Library rows SHALL show MP3 durations read from the Xing/Info frame count when present, otherwise estimated from the first frame's bitrate, prefixed with `~` to mark estimates. Formats the fast reader cannot handle SHALL show `—` until the song is played. Estimation SHALL run in the background and be capped per render pass so large libraries stay responsive.

#### Scenario: Estimated duration display

- **GIVEN** a library of MP3s not yet played
- **WHEN** background estimation completes
- **THEN** their rows show a `~`-prefixed duration
- **AND** unsupported formats show `—`
