# Playback Specification

## Purpose

Describe the transport behavior common to all media: starting, pausing, seeking, moving between songs, error handling, volume, and optional ReplayGain leveling.

## Requirements

### Requirement: Transport controls

The transport SHALL provide play/pause, previous and next, seek forward and back (5 seconds per key press), mute, and a seekable progress display. Audio SHALL be the timing source for playback position.

#### Scenario: Pause and resume

- **GIVEN** a song is playing
- **WHEN** the user pauses and then resumes
- **THEN** playback continues from the paused position

#### Scenario: Backward seek

- **GIVEN** a song is playing past 6 seconds
- **WHEN** the user seeks backward
- **THEN** position, lyrics and CD+G graphics all reflect the earlier time with no stale content

### Requirement: Previous restarts the current song

Pressing **Previous** SHALL restart the current song when playback is more than 3 seconds in; otherwise it SHALL move to the previous song in history.

#### Scenario: Previous restarts mid-song

- **GIVEN** the current song is at 6.5 seconds
- **WHEN** the user presses **Previous**
- **THEN** the same song restarts from 0 seconds

### Requirement: Automatic advancement

When a track ends, playback SHALL automatically start the next queued song, if any. When nothing is queued, the app SHALL show the idle/finished state rather than silently stopping mid-UI.

#### Scenario: End of track advances

- **GIVEN** a queue with one upcoming song
- **WHEN** the current track ends
- **THEN** the upcoming song starts playing

### Requirement: Playback errors are visible

A media file that cannot be read or decoded (missing after scan, damaged) SHALL surface a visible, non-fatal playback error that names the problem; playback of other tracks SHALL remain possible.

#### Scenario: Unreadable file at play time

- **GIVEN** a scanned track whose file has since become unreadable
- **WHEN** the user plays it
- **THEN** a visible error explains the failure
- **AND** the app does not crash or abort playback state entirely

### Requirement: Volume and mute

Volume and mute state SHALL be adjustable in the UI and remembered between visits. Muting SHALL be reversible without losing the previous volume level.

#### Scenario: Volume is remembered

- **GIVEN** the user sets volume to a new level
- **WHEN** the page is reloaded
- **THEN** the volume is restored to that level

### Requirement: Optional ReplayGain leveling

ReplayGain SHALL be off by default and opt-in via a preference. When enabled, the player SHALL read `replaygain_track_gain` (and peak when present) from ID3v2 TXXX tags and apply a clip-safe linear gain factor; files without tags play unchanged.

#### Scenario: Enabled with tagged file

- **GIVEN** ReplayGain is enabled and the file carries `-6.00 dB` track gain
- **WHEN** the track plays
- **THEN** the linear ReplayGain factor (about 0.501) is applied to volume

#### Scenario: Untagged file unaffected

- **GIVEN** ReplayGain is enabled and the file has no ReplayGain tags
- **WHEN** the track plays
- **THEN** no additional gain is applied

### Requirement: Multi-format transport

The same transport SHALL operate over MP3/other audio, CD+G pairs (with graphics in sync), lyric-only audio, and MP4 video, with mode-specific visuals appearing only for the active mode.

#### Scenario: Track change clears stale overlays

- **GIVEN** a CD+G track with visible lyrics
- **WHEN** the user switches to an LRC track
- **THEN** the CD+G graphics are cleared and the LRC lyrics for the new track are shown
