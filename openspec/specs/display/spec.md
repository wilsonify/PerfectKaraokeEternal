# Display and Persistence Specification

## Purpose

Describe the user-adjustable display options, responsive layout behavior, fullscreen, and how preferences survive reloads.

## Requirements

### Requirement: Display options

The settings SHALL provide adjustable lyric/CD+G size (default 65%), background dimming (default 50%), visualizer sensitivity (default 100%), volume (default 85%), ReplayGain opt-in, and background style selection. Options SHALL take effect immediately without reloading.

#### Scenario: Immediate effect

- **GIVEN** a CD+G song is playing
- **WHEN** the user changes lyric size or dimming
- **THEN** the stage reflects the new value on the next frame without restarting playback

### Requirement: Fullscreen

The fullscreen control (`F`) SHALL request fullscreen on the stage panel, update its icon/label to reflect state, and show a toast if the browser does not support or refuses fullscreen, rather than failing silently.

#### Scenario: Fullscreen refused

- **GIVEN** a browser that rejects the fullscreen request
- **WHEN** the user presses `F`
- **THEN** a toast explains the failure
- **AND** the app continues normally

### Requirement: Responsive layout

The layout SHALL use breakpoints at 1040, 860, 620 and 480 px: at 1040 px the side panel narrows and the scan status is hidden; at or below 860 px the two panels stack in a single column and the footer shortcut bar is hidden; at 620 px and 480 px the transport and queue rows wrap instead of overflowing. Search, transport and queue rows SHALL remain reachable at the narrowest breakpoint.

#### Scenario: Narrow viewport

- **GIVEN** the viewport is 620 × 900
- **WHEN** the app renders
- **THEN** panels stack in a single column
- **AND** the document has no horizontal scrollbar

### Requirement: Reduced motion respect

Animations SHALL honor the `prefers-reduced-motion` media query.

#### Scenario: Reduced motion enabled

- **GIVEN** the user's system requests reduced motion
- **WHEN** the app renders transitions and animations
- **THEN** motion is reduced per the stylesheet rules

### Requirement: Preferences persist across visits

Volume, ReplayGain setting, CD+G size and dimming, background style, sensitivity, favourites, remembered audio-track choices, queue, history and the current track SHALL be restored on the next visit. Storage failures (private browsing, quota) SHALL be tolerated: the app keeps working with defaults.

#### Scenario: Storage unavailable

- **GIVEN** localStorage throws on write (private mode)
- **WHEN** the user changes settings or queues songs
- **THEN** the app continues to operate without errors

#### Scenario: Restore on next visit

- **GIVEN** the user customized display options and built a queue
- **WHEN** the page is reloaded
- **THEN** both the options and the queue are restored
