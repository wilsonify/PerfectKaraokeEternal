# PerfectKaraokeEternal documentation

PerfectKaraokeEternal is a local, browser-only karaoke player. This page is the map: pick the guide
that matches what you are trying to do.

## Start here

| I want to… | Read |
| --- | --- |
| Install and use the player, organize a song library, and sing | [User guide](USER_GUIDE.md) |
| Run the player for others, expose it on a network, or maintain it | [Administrator guide](ADMIN_GUIDE.md) |
| Understand the code, run tests, or contribute a change | [Developer guide](DEVELOPER_GUIDE.md) and [CONTRIBUTING.md](CONTRIBUTING.md) |
| Fix a problem | [Troubleshooting](TROUBLESHOOTING.md) |
| Know exactly what the app is specified to do | [`openspec/specs/`](../openspec/specs/) |
| See what changed | [Changelog](CHANGELOG.md) |
| Read past QA, UX, and upstream-issue reports | [Archive](archive/README.md) |

New to the project? Read the [user guide's first three sections](USER_GUIDE.md#1-before-you-start),
then come back here when you need administration or development detail.

## Guides

| Document | Audience | Covers |
| --- | --- | --- |
| [USER_GUIDE.md](USER_GUIDE.md) | Singers and library owners | Supported formats, starting the app, folder selection, file naming and pairing, searching, queueing, playback, lyrics, visuals, shortcuts, mobile use, privacy |
| [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Whoever runs the server | Requirements, install and start, port/host, local vs LAN vs internet exposure, server behavior, security, storage and backup, updates, browser support, maintenance |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Contributors | Constraints, repository layout, architecture and data flow, setup, test suite, conventions, debugging, browser APIs, known gaps, performance |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Everyone | Symptom-based fixes for serving, folder access, library contents, playback, lyrics, layout, and saved state |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributors | When a change proposal is required, the OpenSpec workflow, specification rules, verification, changelog, and documentation synchronization |
| [CHANGELOG.md](CHANGELOG.md) | Everyone | Newest entries under `[Unreleased]`; released entries; inherited upstream history behind a scope note |

The repository [README](../README.md) is the project's front page and quick start. Detailed
instructions belong in these guides, not there.

## Specifications are authoritative

[`openspec/specs/`](../openspec/specs/) contains one specification per capability, describing only
behavior that exists today with `SHALL` requirements and Given/When/Then scenarios:

`media-library`, `playback`, `queue`, `lyrics`, `cdg-playback`, `mp4-playback`, `visuals`,
`interface`, `display`, `local-library-restoration`, `local-server`.

Order of authority:

1. **Specifications** define observable behavior.
2. **Tests and source** prove what is implemented.
3. **Guides** explain how to use and run it.
4. **Historical reports** record what was true on their date.

If a guide and a spec disagree, the spec wins. If a spec and verified behavior disagree, the spec is
the defect and is corrected directly (see [CONTRIBUTING.md](CONTRIBUTING.md)). If a specification
cannot describe something yet — for example native Safari multi-track playback — the spec marks it
as a known gap instead of claiming it works.

Project-wide artifact rules for OpenSpec changes live in
[`openspec/config.yaml`](../openspec/config.yaml).

## Testing status

Run the live suite rather than trusting a number in prose:

```bash
npm test       # 130 tests as of 2026-11-03
npm run lint
```

This index is the one place where the current test count is tracked. Historical reports keep the
count from their own date.

## Historical archive

Dated reports are preserved in [archive/](archive/README.md) for their evidence and research:
the 2026-10-29 QA review, the November 2026 UX improvement report, and the 2026-10-28 upstream
issue audit. They are snapshots, not current guidance.

## Project facts

| Fact | Value |
| --- | --- |
| Runtime | Browser only; no backend, accounts, database, or uploads |
| Application code | Vanilla ES modules and CSS, no build step |
| Runtime dependencies | None |
| Server | `serve.js`, Node.js 20+, static files only, loopback by default |
| Supported media | MP3+G (CD+G), audio with LRC/ELRC, zipped pairs, MP4 video |
| Tests | `node:test`; fixtures include real short MP3+G excerpts |
| Behavior contract | OpenSpec specifications in `openspec/specs/` |
| License | ISC (CD+G decoder adapted from cdgraphics, ISC) |
