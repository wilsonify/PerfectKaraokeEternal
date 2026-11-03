# Contributing

How to change this project without letting behavior, specifications, tests, and documentation drift
apart. The app stays local-first, dependency-free at runtime, and build-free.

Start with the [developer guide](DEVELOPER_GUIDE.md) for setup, architecture, and debugging.

## Ground rules

- No runtime dependencies, no build step, no backend, no accounts, no network features.
- Keep changes focused; unrelated refactors and cleanup belong in their own change.
- Behavior is specified with OpenSpec **before** it is implemented.
- `npm test` and `npm run lint` must pass before a change is called done.
- Documentation is part of the change, not a follow-up.

## Setup

```bash
npm install    # development tools only (ESLint, OpenSpec CLI)
npm start      # serve the app at http://localhost:3000
npm test
npm run lint
```

## When an OpenSpec change is required

| Change | Proposal required? |
| --- | --- |
| New feature or user-visible behavior | Yes |
| Changed behavior of an existing feature | Yes |
| Architectural change that affects observable behavior | Yes |
| Bug fix that changes observable behavior | Yes |
| Typo, wording, CSS-only polish, test-only change, internal refactor with no behavior change | No |
| Correcting a spec that misdescribes verified behavior | No — fix the spec directly and note it in the changelog |
| Moving or rewriting documentation | No |

If you are unsure, write the spec delta first. If there is nothing observable to specify, there is
nothing to propose.

## The workflow

### 1. Create the change

```bash
npx openspec new change <kebab-case-name>
npx openspec status --change <name>
npx openspec instructions <artifact> --change <name>
```

Allowed artifacts are `proposal`, `specs`, `design`, and `tasks`; `design` is conditional and may
be skipped when the approach is obvious. Use the templates and rules the CLI prints rather than
inventing a format.

### 2. Write the artifacts

- `proposal.md` — why the change is needed, what it does, what is out of scope, and how it will be
  verified.
- `specs/<capability>/spec.md` — deltas using `## ADDED Requirements`,
  `## MODIFIED Requirements`, or `## REMOVED Requirements`, with `### Requirement:` text and
  `#### Scenario:` blocks. Copy the full existing requirement when modifying it.
- `design.md` — only when a decision needs a durable record (architecture, storage, trade-offs).
- `tasks.md` — small, ordered tasks, each stating how it will be verified.

Choose the capability that owns the behavior. Do not duplicate a rule that another capability
already owns; reference it instead.

### 3. Implement and verify

Implement only what the approved change specifies. Tick `- [x]` in `tasks.md` only after the task's
verification has actually run.

Required checks:

```bash
npm test
npm run lint
npx openspec validate --all --strict
```

For browser-only behavior, add the manual checks you performed to the change or the final report,
including the browser used. A mocked unit test does not verify a browser capability.

### 4. Update specs, changelog, and docs

- Behavior changes update their spec delta in the same change; the delta merges into the main specs
  at archive time.
- Main specs describe only behavior that exists today. Mark unverified behavior as a known gap.
- Add user-visible changes to the `[Unreleased]` section of [CHANGELOG.md](CHANGELOG.md), newest
  first; group into Added/Changed/Fixed once the section grows.
- Update the guide affected by the change: [user](USER_GUIDE.md), [administrator](ADMIN_GUIDE.md),
  [developer](DEVELOPER_GUIDE.md), or [troubleshooting](TROUBLESHOOTING.md).
- When the test suite size changes, update the count in [the documentation index](README.md). That
  is the only place the live count is tracked.

### 5. Archive

```bash
npx openspec archive <name> --yes
```

Archive only after tasks are ticked and the checks above pass; the command verifies tasks but does
not run the suite. The change folder moves to
`openspec/changes/archive/YYYY-MM-DD-<name>/` and its deltas merge into `openspec/specs/`.

A tooling- or documentation-only change with no behavior to specify archives with:

```bash
npx openspec archive <name> --yes --skip-specs
```

### 6. Confirm the merged result

```bash
npx openspec validate --all --strict
npx openspec list --specs
```

Check that the main spec reads as current behavior: no delta headers, no duplicated requirements,
no stale references.

## Specification rules

- Use `SHALL` for requirements and Given/When/Then for scenarios.
- One requirement per behavior; move edge cases into scenarios instead of long paragraphs.
- Specify observable behavior, not implementation. Do not list modules or functions.
- Do not duplicate `README.md`'s quick start or the guides' instructions.
- If verified behavior contradicts a main spec, correct the main spec and note the correction in the
  changelog. A change proposal is for behavior that is changing, not for a spec that is wrong.
- Requirements flagged as known gaps must stay flagged until evidence exists.

## Documentation rules

- One obvious place per topic: quick start in the repository README; usage in the user guide; hosting
  and security in the administrator guide; architecture and workflow in the developer guide;
  symptoms in troubleshooting.
- Relative links only, and they must resolve.
- Dated reports go to [`docs/archive/`](archive/README.md); do not present them as current guidance.
- Prefer concrete commands and examples over abstract description, and state the browser when a
  behavior depends on it.

## Code conventions

- ES modules, no semicolons, two-space indentation, single quotes.
- Keep pure logic in modules outside `js/app.js` so it can be tested without a DOM.
- No runtime dependencies, no bundler, no framework.
- Preserve keyboard access and ARIA state when changing interactive UI.
- Do not add type or lint suppressions to make a check pass; fix the cause.

## Agent skills

Agent-driven workflows can use the OpenSpec skills in
[`../.agents/skills/`](../.agents/skills/): `openspec-propose`, `openspec-apply-change`,
`openspec-archive-change`, `openspec-explore`, `openspec-sync-specs`, and `openspec-update-change`.
They follow the same rules as this document. The official OpenSpec reference is
<https://github.com/Fission-AI/OpenSpec>.

## Review checklist

- [ ] The change is scoped and matches its proposal.
- [ ] Unit tests cover the new pure behavior; browser-only paths have recorded manual checks.
- [ ] `npm test`, `npm run lint`, and `npx openspec validate --all --strict` pass.
- [ ] Specs describe current behavior and known gaps are marked.
- [ ] Changelog and the relevant guide are updated.
- [ ] Links resolve and no obsolete paths remain.
- [ ] No runtime dependencies, build step, or unrelated cleanup were introduced.
