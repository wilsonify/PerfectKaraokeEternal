# Documentation index

PerfectKaraokeEternal is a local, browser-only karaoke player. This index maps
the documentation by purpose so nothing is looked up in the wrong file.

## Getting started and user guide

- [../README.md](../README.md) — features, requirements, running the app, song
  file naming, keyboard shortcuts.

## Developer guide

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to propose a change with OpenSpec,
  update specifications, validate, archive, and keep docs synchronized.
- [../README.md](../README.md#development) — commands (`npm test`,
  `npm run lint`) and the module map.

## Specifications (authoritative for current behavior)

- [../openspec/specs/](../openspec/specs/) — OpenSpec specifications of
  observable behavior, one folder per capability:
  `media-library`, `playback`, `queue`, `lyrics`, `cdg-playback`,
  `mp4-playback`, `visuals`, `interface`, `display`,
  `local-library-restoration`, `local-server`.
- [../openspec/config.yaml](../openspec/config.yaml) — project context and
  artifact rules applied to every OpenSpec change.

Specifications describe **what the app does today**; the README describes **how
to use it**; the source is authoritative for **how it is implemented**. When
those disagree, fix the stale side — see CONTRIBUTING.md.

## Testing and QA

- Live suite: run `npm test` (124 tests as of 2026-11-03) and `npm run lint`.
  This index is where the current count is tracked; historical reports keep
  their own dated counts.
- [QA_REPORT_2026-10-29.md](QA_REPORT_2026-10-29.md) — **historical** QA review
  of the tree at `6524803c` (72 tests that day). Findings later resolved carry
  a dated "superseded" note; the report is not rewritten.

## Changelog

- [CHANGELOG.md](CHANGELOG.md) — newest entries first under `[Unreleased]`.
  Entries from v2.0.2 downward are inherited upstream KaraokeEternal history
  (their scope is called out in the note above that section).

## Upstream compatibility and issue tracking

- [UPSTREAM_ISSUE_ROADMAP.md](UPSTREAM_ISSUE_ROADMAP.md) — audit of the upstream
  KaraokeEternal issue tracker as of 2026-10-28. Upstream state is frozen at
  that date; the **Local status** column and the phased plan are maintained as
  work lands.

## UX history

- [UX_IMPROVEMENT_REPORT.md](UX_IMPROVEMENT_REPORT.md) — **historical**
  November 2026 usability review: problems found, changes made, verification
  (100 → 110 tests that day).
