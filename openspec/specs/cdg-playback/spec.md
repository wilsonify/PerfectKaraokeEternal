# CD+G Playback Specification

## Purpose

Describe decoding and rendering of CD+G graphics alongside audio: frame timing, background keying for the visualizer, the lyric text backdrop, and the display size/dimming options.

## Requirements

### Requirement: CD+G mode selection

A track whose library entry pairs audio with a `.cdg` companion SHALL play in CD+G mode, rendering decoded graphics synchronized to playback position, including after seeks.

#### Scenario: Graphics follow seeking

- **GIVEN** a CD+G track is playing
- **WHEN** the user seeks backward to an earlier time
- **THEN** the rendered frame matches that time
- **AND** no stale graphics from the later time remain

### Requirement: Background keying on every frame

The CD+G background colour SHALL be keyed to transparent on every rendered frame, not only the first, so the selected background visualizer remains visible behind the graphics and the background-dimming control has an effect regardless of the stream's background colour.

#### Scenario: Visualizer visible behind graphics

- **GIVEN** a CD+G stream whose background colour differs from its transparent key
- **WHEN** frames are rendered while the visualizer is on
- **THEN** background pixels are fully transparent
- **AND** lyric content pixels are opaque above the visualizer

### Requirement: Text backdrop matches content bounds

The translucent backdrop behind lyric text SHALL be derived from the rendered content bounds plus a fixed padding (10 px), growing, shrinking and resetting as the graphics change, including when seeking backward to an earlier, smaller layout.

#### Scenario: Backdrop tracks growing text

- **GIVEN** a CD+G whose lyric area grows over time
- **WHEN** frames at 1 s, 3 s and 5 s are rendered in order
- **THEN** the backdrop rectangle grows with the content bounds plus padding
- **AND** seeking back to 1 s restores the original small bounds and backdrop

### Requirement: Display size and dimming

The user SHALL be able to adjust CD+G lyric size and background dimming (defaults: size 65%, dim 50%); resizing the display SHALL keep the backdrop aligned with content, and the dimming control SHALL affect the backdrop opacity.

#### Scenario: Resize keeps alignment

- **GIVEN** a CD+G track at 65% size
- **WHEN** the size is changed to 90% and back to 40%
- **THEN** the backdrop stays exactly content bounds plus padding at each size

### Requirement: Invalid streams are rejected safely

Invalid CD+G input SHALL be rejected without throwing uncaught errors into the UI.

#### Scenario: Corrupt packet stream

- **GIVEN** a file with malformed CD+G packet data
- **WHEN** it is decoded
- **THEN** decoding reports failure rather than crashing the player
