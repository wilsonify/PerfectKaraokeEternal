# Lyrics Specification

## Purpose

Describe discovery, parsing and synchronized display of LRC and Enhanced LRC (ELRC) lyrics, including word-level timing, the global offset tag, and click-to-seek.

## Requirements

### Requirement: Lyric companion discovery

Audio files SHALL pair with a same-named `.lrc` and optional `.elrc` companion in the same folder or inside a ZIP, matched case-insensitively. When a CD+G companion also exists, CD+G wins and the LRC files are not separate tracks. An audio file MAY rely on only an `.elrc` companion (no `.lrc`), but only when that `.elrc` has usable line headers; an `.elrc` with no usable headers SHALL NOT be paired and SHALL be counted as skipped. A lyric file never becomes a track on its own.

#### Scenario: LRC with optional ELRC

- **GIVEN** `Artist - Song.mp3`, `Artist - Song.lrc` and `Artist - Song.elrc`
- **WHEN** the library is built
- **THEN** one track exists that will show lyrics with word timing

#### Scenario: Unusable ELRC-only file

- **GIVEN** an `.elrc` file with no usable line headers
- **WHEN** the library is built
- **THEN** no track is created for it
- **AND** it is counted as skipped

### Requirement: LRC parsing

The parser SHALL read metadata tags, multiple timestamps per line, and CRLF files, SHALL strip inline tags from displayed text, and SHALL ignore timed lines with no text.

#### Scenario: Multiple timestamps on one line

- **GIVEN** an LRC line with two timestamps and one text body
- **WHEN** the lyrics are parsed
- **THEN** both timestamps reference the same displayed line

### Requirement: Global offset tag

An LRC `[offset:±ms]` tag SHALL shift all timings in the documented direction: a positive value makes lyrics appear sooner (timings are reduced). The offset SHALL apply to word timings as well, and SHALL apply even when the tag appears after the lyric lines.

#### Scenario: Positive offset applies

- **GIVEN** an LRC file with `[offset:+500]`
- **WHEN** lyrics are parsed
- **THEN** each line's effective time is 500 ms earlier than its timestamp

### Requirement: Word-level timing

Enhanced LRC inline `<mm:ss.xx>` word timings SHALL drive word-by-word highlighting. Word timings SHALL also come from an `.elrc` companion when present, matching words tolerantly across punctuation and curly apostrophes. Inline word tags SHALL be removed from displayed text when no words align.

#### Scenario: ELRC words highlight during playback

- **GIVEN** a track with ELRC word timings
- **WHEN** playback reaches the middle of a line
- **THEN** words before the current time are highlighted as sung and later words are not

### Requirement: Synchronized display

Lyrics SHALL highlight the active line, dim past lines, auto-scroll to keep the active line visible, and support click-to-seek on any line. Pausing, resuming and seeking backward SHALL recompute highlights correctly.

#### Scenario: Click-to-seek

- **GIVEN** lyrics with a line timestamped at 6.0 s
- **WHEN** the user clicks that line
- **THEN** playback position moves to 6.0 s and that line becomes active

### Requirement: Malformed lyrics fail visibly and non-fatally

Choosing a track whose `.lrc` contains no timestamped usable lines SHALL show a clear error (for example "no usable lyric lines in the .lrc or .elrc file") without crashing. This validation happens at play time, not at scan time: malformed LRC files still appear in the library. *(Known gap: scan-time validation or an unplayable badge is deferred; see docs/archive/QA_REPORT_2026-10-29.md F5.)*

#### Scenario: Empty LRC at play time

- **GIVEN** a track paired with an LRC file that has no timestamped lines
- **WHEN** the user plays it
- **THEN** a clear non-fatal error is shown
- **AND** the rest of the app remains usable
