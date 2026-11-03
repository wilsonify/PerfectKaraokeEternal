# Spec Delta

## Purpose

Describe how an audio track's artist and title are resolved when its own name and tags do not
identify it, so rendered karaoke variants inherit them from their source file.

## ADDED Requirements

### Requirement: Artist and title resolution

A track's artist and title SHALL be resolved from its filename first, then from its own MP3 ID3
tags, then from a file in the same directory whose base name matches once a trailing `(Karaoke)` or
` Karaoke` is ignored. A track that none of these identify SHALL be reported as skipped with an
unreadable-filename reason rather than shown with a blank or invented artist.

#### Scenario: Karaoke variant without tags

- **GIVEN** `01 - Inside Out.mp3` carries ID3 artist `Eve 6` and title `Inside Out`
- **AND** `01 - Inside Out - Karaoke.mp3` has no tags and has a companion `.lrc`
- **WHEN** the folder is scanned
- **THEN** the karaoke variant is added as `Eve 6` / `Inside Out`
- **AND** it is not reported as an unreadable filename
- **AND** the tagged source is not added as a second copy

#### Scenario: No file identifies the song

- **GIVEN** `01 - Song - Karaoke.mp3` has no tags and its same-name source has no tags either
- **WHEN** the folder is scanned
- **THEN** the karaoke variant is reported as skipped with an unreadable-filename reason
- **AND** no track is created for it
