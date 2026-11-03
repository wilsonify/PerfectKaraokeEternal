# Interface Specification

## Purpose

Describe how the user browses the library and controls the app: keyboard navigation and shortcuts, search and favourites feedback, the idle stage, and transient notifications.

## Requirements

### Requirement: One tab stop for the song list

The song list SHALL use a single roving tab stop. `↑`/`↓` move through visible rows, `Home`/`End` jump to the first/last row, `↓` from the search field enters the results, `Enter` queues the focused song, and `Shift+Enter` plays it now.

#### Scenario: Arrow navigation

- **GIVEN** the song list has focus on its single tab stop
- **WHEN** the user presses `↓`
- **THEN** focus moves to the next visible row
- **AND** the selected row is visually distinct from the current and next rows

### Requirement: Global keyboard shortcuts

The shortcuts `Space` (play/pause), `←`/`→` (seek 5 s), `N` (next), `P` (previous), `M` (mute), `F` (fullscreen), `/` (focus search) and `Esc` (clear search) SHALL work whenever the document has focus, including after a button, slider or link has been clicked.

#### Scenario: Shortcut after clicking a button

- **GIVEN** the user has clicked the Play button so it holds focus
- **WHEN** the user presses `Space`
- **THEN** the browser's default button activation AND the global shortcut are both handled correctly without double-toggling playback
- **AND** typing in the search field is never intercepted

#### Scenario: Keys owned by the focused control are left alone

- **GIVEN** a slider or select has focus
- **WHEN** the user presses an arrow key
- **THEN** the control adjusts its value
- **AND** no playback seek occurs

#### Scenario: Modifier combinations are ignored

- **GIVEN** any focused element
- **WHEN** the user presses a shortcut key together with Ctrl/Alt/Meta
- **THEN** no playback shortcut fires

### Requirement: Search feedback

Search results SHALL report how many songs are shown, and an empty result SHALL explain the cause (no matches, a media filter excluding everything, or an empty favourites list).

#### Scenario: Empty result explained

- **GIVEN** a media filter excludes every song
- **WHEN** the user searches or filters
- **THEN** the empty state names the reason rather than showing a blank list

### Requirement: Favourites

Any song SHALL be markable as a favourite; the mark SHALL persist between visits, and a favourites-only view SHALL filter the library to favourited songs.

#### Scenario: Favourite persists

- **GIVEN** the user marks a song as favourite
- **WHEN** the page is reloaded
- **THEN** the song is still marked

### Requirement: Idle stage information

When nothing is playing, the stage SHALL show the number of loaded songs and keyboard hints, and SHALL name the next queued song when one exists.

#### Scenario: Idle stage with a queue

- **GIVEN** songs are loaded and one is queued
- **WHEN** no song is playing
- **THEN** the stage shows the loaded count and the next queued song's title

### Requirement: Toast notifications

Confirmations (queueing, play-now, warnings) SHALL appear in a toast positioned so it does not cover the transport controls.

#### Scenario: Toast clear of transport

- **GIVEN** the user queues a song
- **WHEN** the confirmation toast appears
- **THEN** the play/pause and seek controls remain visible and clickable
