# Queue Specification

## Purpose

Describe how songs are selected into the queue, reordered, played, and remembered, including duplicate entries, the played history, and queue time estimates.

## Requirements

### Requirement: Adding songs to the queue

`Enter` on a focused song SHALL queue it; `Shift+Enter` SHALL play it now. Queueing the same song more than once SHALL be allowed, each add SHALL show a confirmation toast, and duplicate entries SHALL be counted in the row (for example `×2 in queue`).

#### Scenario: Duplicate entries are allowed

- **GIVEN** a song is already in the queue
- **WHEN** the user queues it again
- **THEN** a second entry is added
- **AND** a toast confirms the add

### Requirement: Queue state markers

The first upcoming song SHALL be marked **Next** in the queue and in the library. The currently playing row, the selected row and played rows SHALL have distinct visual states, and the current row SHALL expose `aria-current`.

#### Scenario: Next marker moves after play

- **GIVEN** a queue with three upcoming songs
- **WHEN** the first upcoming song starts playing
- **THEN** the next upcoming song is marked **Next**

### Requirement: Reordering and removing

The queue SHALL support drag-and-drop reordering, per-row move up/down, **move to front**, remove, and clear. Clear SHALL be disabled when the queue is empty. Playing a specific queued occurrence SHALL remove only that row, leaving other duplicates queued.

#### Scenario: Remove one duplicate occurrence

- **GIVEN** the queue `[First, Second, Second]`
- **WHEN** the user plays the second `Second` row
- **THEN** only that row is removed
- **AND** the remaining `Second` entry stays queued

### Requirement: Play now consumes one queue entry

Choosing **Play now** for an upcoming song SHALL start it immediately and remove exactly one matching entry from the upcoming queue, so the song cannot play a second time later, while other duplicate entries remain.

#### Scenario: Play now removes one entry

- **GIVEN** the queue is `[First, Second, First]`
- **WHEN** the user chooses **Play now** on the first `First` entry
- **THEN** the song starts playing
- **AND** the queue becomes `[Second, First]`

### Requirement: Advancement and history

When a track ends naturally, playback SHALL advance to the next queued song and the finished track SHALL be recorded in history exactly once. Pressing **Next** after a track has already finished SHALL NOT append it to history again. History SHALL restart playback from a previously played song.

#### Scenario: No duplicate history entry on Next

- **GIVEN** a track has ended and was recorded in history
- **WHEN** the user presses **Next** with an empty queue
- **THEN** the history length does not change

#### Scenario: Restart from history

- **GIVEN** a history of played songs
- **WHEN** the user restarts from an earlier history entry
- **THEN** playback resumes from that song

### Requirement: Queue totals

The queue heading SHALL report the number of upcoming songs, an estimated total duration computed from known durations, and how many entries still have an unknown duration. Estimated totals SHALL be formatted with a `~` prefix.

#### Scenario: Total with unknown durations

- **GIVEN** a queue where two songs have durations and one does not
- **WHEN** the queue heading is rendered
- **THEN** it shows the estimated total with `~`
- **AND** states how many entries have unknown durations

### Requirement: Queue persistence

Queue, history and the current track SHALL be remembered across reloads in local session storage and restored on the next visit, bounded to a reasonable history size (200 entries).

#### Scenario: Queue survives a reload

- **GIVEN** a queue with three songs
- **WHEN** the page is reloaded
- **THEN** the same queue, history and current track are restored
