# MP4 Playback Specification

## Purpose

Describe MP4 karaoke video playback and the optional multi-audio-track selector, including browser availability constraints.

## Requirements

### Requirement: MP4 files are playable tracks

MP4 files SHALL be accepted into the library as playable video tracks without requiring a lyrics companion.

#### Scenario: MP4 in a scanned folder

- **GIVEN** a folder containing an `.mp4` file
- **WHEN** the folder is scanned
- **THEN** one playable track is created in MP4 mode

### Requirement: Video transport

MP4 tracks SHALL use the shared transport: play/pause, seeking, auto-advance, and progress display, with video rendered in the stage area.

#### Scenario: Seek within video

- **GIVEN** a 10-second MP4 is playing at 2 s
- **WHEN** the user seeks to 5 s
- **THEN** video and audio resume from 5 s

### Requirement: Audio-track selector when the browser supports it

When the media element exposes `HTMLMediaElement.audioTracks` and the file has at least two audio tracks, a selector SHALL list the tracks by label (falling back to position/language), and selecting one SHALL enable exactly that track and leave playback position unchanged. Unknown ids SHALL leave state unchanged, and tracks without ids SHALL get stable index-based ids.

#### Scenario: Switch tracks during playback

- **GIVEN** a two-track MP4 ("Vocal", "Instrumental") in a supporting browser
- **WHEN** the user selects the other track mid-playback
- **THEN** exactly one track is enabled
- **AND** the playback position does not move

### Requirement: Selection memory per file

The chosen audio track SHALL be remembered per media file (bounded to the 50 most recent entries) and restored when that file is played again.

#### Scenario: Selection restored after reload

- **GIVEN** the user selected the "Instrumental" track for a file
- **WHEN** the page is reloaded and the same file is played
- **THEN** "Instrumental" is selected again

### Requirement: Selector hidden when unsupported

If the browser does not expose the audio-track API (Chromium and Firefox ship it disabled), the selector SHALL be hidden and the default track SHALL play without any broken control.

#### Scenario: Chromium plays default track

- **GIVEN** a multi-track MP4 in a browser without the audioTracks API
- **WHEN** the track plays
- **THEN** the default audio track plays
- **AND** no audio-track selector is rendered

#### Scenario: Selector appears only with multiple tracks

- **GIVEN** a single-audio-track MP4 in a supporting browser
- **WHEN** the track loads
- **THEN** no selector is shown

*(Known gap: native switching with a real multi-audio-track MP4 has been verified only through a simulated API; Safari validation is pending — see docs/QA_REPORT_2026-10-29.md §7.)*
