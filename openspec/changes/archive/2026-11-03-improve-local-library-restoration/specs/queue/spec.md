# Spec Delta

## MODIFIED Requirements

### Requirement: Queue persistence

Queue, history and the current track SHALL be remembered across reloads in browser local storage (key `pke.session.v1`) and restored on the next visit, with history bounded to the most recent 200 entries. Until a folder is loaded, restored entries whose media is not available SHALL be shown as unavailable rather than dropped. After a folder scan, entries whose media is not in the scanned folder SHALL be removed, the order of the remaining entries SHALL be preserved, and a toast SHALL report that some saved queue entries were not found.

#### Scenario: Queue survives a reload

- **GIVEN** a queue with three songs
- **WHEN** the page is reloaded
- **THEN** the same queue, history and current track are restored

#### Scenario: Restored entries before a folder loads

- **GIVEN** a saved queue and no library loaded yet
- **WHEN** the queue is shown
- **THEN** each saved entry appears as unavailable with guidance to reopen the folder
- **AND** the entries are still saved

#### Scenario: Scan without the queued media

- **GIVEN** a saved queue referencing songs in another folder
- **WHEN** a folder containing none of them is scanned
- **THEN** those entries are removed from the queue and history
- **AND** a toast reports that some saved queue entries were not found
