# Background Visuals Specification

## Purpose

Describe the selectable audio-reactive background visuals shown behind the lyrics: the available styles, their persistence, and how they interact with playback and the CD+G stage.

## Requirements

### Requirement: Style selection

The settings SHALL offer the background styles Classic, Hot Pink, Spectrum, Waveform, Aurora, Pulse, Starfield, Minimal and Off, with Classic first as the default. An unknown saved style value SHALL normalize to the default, and the legacy preference name SHALL migrate to the new one.

#### Scenario: Style list and default

- **GIVEN** a fresh visit with no saved preferences
- **WHEN** the settings open
- **THEN** all nine options are listed
- **AND** Classic is selected

#### Scenario: Unknown saved style

- **GIVEN** a saved preference naming a style that no longer exists
- **WHEN** the app loads
- **THEN** the default style is used without errors

### Requirement: Styles render from the playing audio

Every style except Off SHALL render continuously and react to the playing audio's analysis data. A style SHALL not throw when no audio analysis data is available yet (for example before playback starts).

#### Scenario: Style without audio data

- **GIVEN** no song is playing
- **WHEN** a visual style is selected
- **THEN** the style renders without console errors

### Requirement: Off draws nothing

The Off style SHALL draw no visuals, leaving the plain stage background.

#### Scenario: Off during playback

- **GIVEN** Off is selected while a song plays
- **WHEN** frames are drawn
- **THEN** the canvas contains no drawn style content

### Requirement: Switching styles does not disturb playback

Changing the style during playback SHALL NOT touch the playhead, the audio/video element, or the lyrics; per-style animation state from the previous style SHALL be released.

#### Scenario: Switch mid-song

- **GIVEN** a song is playing with the Classic style
- **WHEN** the user selects Aurora
- **THEN** playback position continues uninterrupted
- **AND** the lyrics remain visible and synchronized
- **AND** the new style starts from clean animation state

### Requirement: Palette stays legible behind lyrics

Style output SHALL stay dark and low-opacity behind the lyric area so CD+G and LRC text remain readable over it.

#### Scenario: Contrast behind lyrics

- **GIVEN** any active style while lyrics are displayed
- **WHEN** pixels behind the lyric band are sampled
- **THEN** they remain dark/low-alpha rather than bright enough to reduce text contrast

### Requirement: Sensitivity control

The settings SHALL provide a sensitivity slider from 0% to 200% (default 100%) that scales audio-reactive style output, persisted between visits.

#### Scenario: Sensitivity applied

- **GIVEN** sensitivity is set to 200%
- **WHEN** an audio-reactive style renders
- **THEN** its audio-driven amplitude is scaled by the sensitivity factor (clamped 0–2)
