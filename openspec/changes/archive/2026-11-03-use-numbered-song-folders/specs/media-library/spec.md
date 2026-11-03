# Spec Delta

## Purpose

Describe how an audio track's artist and title are resolved when its own name and tags do not
identify it, including numbered song folders.

## MODIFIED Requirements

### Requirement: Artist and title resolution

A track's artist and title SHALL be resolved from its filename first, then from its own MP3 ID3
artist (or album artist) and title tags, then from a numbered song folder named
`<track> - <artist> - <title>` whose title matches the file's own, then from a file in the same
directory whose base name matches once a trailing `(Karaoke)` or ` Karaoke` is ignored. A folder
whose name is not track-numbered, or whose title does not match the file, SHALL NOT supply an
artist. A track that none of these identify SHALL be reported as skipped with an
unreadable-filename reason rather than shown with a blank or invented artist.

#### Scenario: Karaoke variant without tags

- **GIVEN** `01 - Inside Out.mp3` carries ID3 artist `Eve 6` and title `Inside Out`
- **AND** `01 - Inside Out - Karaoke.mp3` has no tags and has a companion `.lrc`
- **WHEN** the folder is scanned
- **THEN** the karaoke variant is added as `Eve 6` / `Inside Out`
- **AND** it is not reported as an unreadable filename
- **AND** the tagged source is not added as a second copy

#### Scenario: Artist from a numbered song folder

- **GIVEN** an untagged `01 - Inside Out - Karaoke.mp3` with a companion `.lrc` sits in a folder
  named `01 - Eve 6 - Inside Out`
- **WHEN** the folder is scanned
- **THEN** the track is added as `Eve 6` / `Inside Out`
- **AND** it is not reported as an unreadable filename

#### Scenario: Numbered folder with a different title

- **GIVEN** `01 - Song.mp3` sits in a folder named `01 - Various - 90s Hits`
- **WHEN** the folder is scanned
- **THEN** the folder name is not used as the artist
- **AND** the file is reported as skipped with an unreadable-filename reason

#### Scenario: No file identifies the song

- **GIVEN** `01 - Song - Karaoke.mp3` has no tags, its same-name source has no tags, and its folder
  is not named after the song
- **WHEN** the folder is scanned
- **THEN** the karaoke variant is reported as skipped with an unreadable-filename reason
- **AND** no track is created for it
