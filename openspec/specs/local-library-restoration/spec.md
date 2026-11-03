# local-library-restoration Specification

## Purpose
Define how the player chooses a local music source, remembers it between visits, handles read
permission, and restores the library and queue without duplicating songs or losing entries.

## Requirements

### Requirement: Folder source selection

The player SHALL use the native directory picker only when the browser exposes a directory
picker, the page is a secure context, and the browser is not an embedded Electron shell. In every
other case it SHALL use the directory file input (`webkitdirectory`) fallback, and the Open
folder control SHALL explain that the browser uses its own folder picker. Cancelling the picker
SHALL leave the current library and queue untouched.

#### Scenario: Supported browser uses the native picker

- **GIVEN** a secure context whose browser exposes a directory picker and is not an embedded shell
- **WHEN** the user chooses Open music folder
- **THEN** the native directory picker opens
- **AND** no directory file input is triggered

#### Scenario: Browser without the directory picker

- **GIVEN** a browser that does not expose a directory picker
- **WHEN** the user chooses Open music folder
- **THEN** the directory file input opens
- **AND** the folder loads through the fallback path

#### Scenario: Insecure context

- **GIVEN** the page is served from an insecure origin
- **WHEN** the user chooses Open music folder
- **THEN** the directory file input opens even if the directory picker exists

#### Scenario: Embedded browser

- **GIVEN** an embedded Electron browser that exposes a directory picker
- **WHEN** the user chooses Open music folder
- **THEN** the directory file input opens instead

#### Scenario: Picker cancelled

- **GIVEN** a loaded library
- **WHEN** the user cancels the native picker
- **THEN** the library, queue and current track are unchanged

### Requirement: Remembering the folder between visits

After a successful folder load in either mode the player SHALL remember the folder's display name
and source mode. When no folder is remembered, or the remembered record cannot be read, the reopen
control SHALL stay hidden and startup SHALL continue normally.

#### Scenario: No remembered folder

- **GIVEN** no folder reference was ever stored
- **WHEN** the app starts
- **THEN** the reopen control stays hidden
- **AND** the app is usable normally

#### Scenario: Storage unavailable

- **GIVEN** IndexedDB is unavailable, blocked or returns a corrupt record
- **WHEN** the app starts
- **THEN** startup continues without an error message
- **AND** the folder name remembered separately still offers `Reopen “<name>”` through the directory input

### Requirement: Reopening the remembered folder

The next visit SHALL offer a control labelled `Reopen “<name>”`. With a reopenable directory handle
the control SHALL open that folder again without a browse dialog; otherwise it SHALL open the
directory input and explain that this browser asks for the folder again.

#### Scenario: Handle remembered

- **GIVEN** a folder was loaded through the native picker and its handle was stored
- **WHEN** the app is opened again
- **THEN** `Reopen “<name>”` is shown
- **AND** activating it scans that folder without a browse dialog

#### Scenario: Fallback folder remembered

- **GIVEN** a folder was loaded through the directory file input
- **WHEN** the app is opened again
- **THEN** `Reopen “<name>”` is shown
- **AND** activating it opens the directory file input with an explanation

### Requirement: Read permission outcomes

Before scanning a remembered directory handle the player SHALL check read permission and request
it only when needed. It SHALL distinguish already granted, newly granted, denied, blocked and
no-longer-available outcomes. A refused or unavailable folder SHALL NOT change the loaded library,
queue or current track, and the message SHALL say what the user can do next.

#### Scenario: Permission already granted

- **GIVEN** a remembered handle whose read permission is granted
- **WHEN** the user reopens it
- **THEN** the folder is scanned
- **AND** no permission request is made

#### Scenario: Permission requested again

- **GIVEN** a remembered handle whose read permission is in the prompt state
- **WHEN** the user reopens it
- **THEN** the browser asks for read access
- **AND** the folder is scanned when access is granted

#### Scenario: Permission denied

- **GIVEN** the user refuses read access
- **WHEN** the reopen attempt completes
- **THEN** the current library stays as it was
- **AND** a message explains that access was not granted and the folder can be chosen again

#### Scenario: Remembered folder no longer accessible

- **GIVEN** a remembered handle whose folder was deleted, moved or blocked
- **WHEN** the user reopens it
- **THEN** the current library stays as it was
- **AND** a message explains that the folder is no longer available

### Requirement: Stable track paths across folder sources

Paths from a directory file-input selection SHALL be made relative to the selected folder root, so
the same folder produces the same track ids whether it was opened through the native picker or the
fallback. Reopening a folder through either source SHALL NOT produce duplicate rows, and queue and
history entries for songs that still exist SHALL survive.

#### Scenario: Fallback paths match handle paths

- **GIVEN** a folder `Music` containing `Artist - Song.mp3` and a `.cdg` companion
- **WHEN** it is opened through the directory file input
- **THEN** the track's path is `Artist - Song.mp3`
- **AND** it matches the id produced by opening the same folder through the native picker

#### Scenario: Reopening the same folder

- **GIVEN** a loaded library with a queued song
- **WHEN** the same folder is opened again through either source
- **THEN** the library contains one row per song, with no duplicates
- **AND** the queued song is still queued

### Requirement: Unreadable selection keeps the current library

When a folder selection produces no media records and the folder itself could not be read, the
player SHALL keep the current library and report that the folder could not be read. An empty but
readable folder SHALL still replace the library with the normal no-songs message.

#### Scenario: Folder cannot be read

- **GIVEN** a loaded library
- **WHEN** the user selects a folder whose root cannot be read
- **THEN** the loaded library is unchanged
- **AND** a message names the failure

#### Scenario: Folder is empty but readable

- **GIVEN** a loaded library
- **WHEN** the user selects an empty readable folder
- **THEN** the library is replaced and the no-songs message is shown
