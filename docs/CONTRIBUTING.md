# Contributing

Concise rules for changing this project without letting behavior, specs and
docs drift apart. The app stays dependency-free: no runtime dependencies, no
build step. Validation is always `npm test` + `npm run lint`.

## When an OpenSpec change is required

Create an OpenSpec change for: new features, behavioral changes, architectural
changes, and bug fixes that change observable behavior.

Skip OpenSpec for: CSS tweaks, typos, test-only or refactor changes that do not
change observable behavior, and changelog wording. If you are unsure, write the
spec delta first — if there is nothing observable to specify, there is nothing
to spec.

## How to propose a change

```bash
npx openspec new change <kebab-case-name>   # scaffold in openspec/changes/<name>/
npx openspec status --change <name> --json  # artifact build order
npx openspec instructions <artifact> --change <name>  # template + rules per artifact
```

A change contains `proposal.md` (why/what/out-of-scope), delta specs under
`specs/<capability>/spec.md` (`## ADDED/MODIFIED/REMOVED Requirements` with
`#### Scenario:` blocks), optional `design.md`, and `tasks.md` with `- [ ]`
checklists. Agent-driven flows can use the skills in
[../.agents/skills/](../.agents/skills/) (`openspec-propose`, `openspec-apply-change`,
`openspec-archive-change`). Official reference: <https://github.com/Fission-AI/OpenSpec>.

## How to update specifications

- Main specs live in `openspec/specs/<capability>/spec.md` and describe only
  behavior that exists today, using `SHALL` requirements and Given/When/Then
  scenarios.
- A change proposes edits as deltas inside its own folder; they are merged into
  the main specs only when the change is archived.
- Behavior that is implemented but unverified (see the gap notes in `lyrics`
  and `mp4-playback`) must stay marked as a gap rather than described as
  working.

## How to validate against acceptance criteria

1. Implement the tasks; tick `- [x]` in `tasks.md` only when verified.
2. `npm test` and `npm run lint` must pass (config rule: state how each task is
   verified).
3. `npx openspec validate --all --strict` must pass.

## How to archive a completed change

```bash
npx openspec archive <name> --yes
```

Archive only after tasks are checked and tests/lint pass (the archive command
validates this). The folder moves to `openspec/changes/archive/YYYY-MM-DD-<name>/`
and its deltas merge into `openspec/specs/`.

## How to update the changelog

- Add bullets to the `[Unreleased]` section of [CHANGELOG.md](CHANGELOG.md),
  newest work first; group into Added/Changed/Fixed once the section grows.
- Never rewrite released entries. The pre-fork upstream history stays verbatim
  behind its scope note.

## How to keep documentation synchronized

- A behavior change updates its spec **in the same change**, not later.
- Historical reports ([QA_REPORT_2026-10-29.md](QA_REPORT_2026-10-29.md),
  [UX_IMPROVEMENT_REPORT.md](UX_IMPROVEMENT_REPORT.md),
  [UPSTREAM_ISSUE_ROADMAP.md](UPSTREAM_ISSUE_ROADMAP.md)) are dated records:
  correct factual errors with an inline dated "superseded/noted" note; do not
  rewrite them to look current.
- When the test suite size changes, update the count in
  [README.md](README.md)'s index entry (Testing and QA) — historical reports
  keep their own counts.
- Keep internal links relative and valid; a new top-level document gets an
  entry in [README.md](README.md).
