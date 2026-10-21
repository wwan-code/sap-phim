---
trigger: model_decision
description: "Apply when implementing or reviewing cross-layer features, refactoring, renaming files, adding dependencies, running checks, or finalizing changes. Quality, safety and delivery gates."
---
# Quality Gates — Agentic Delivery

## Stage A — Discover

- Read relevant instructions and the smallest relevant part of the codebase. Identify entrypoints, scripts, interfaces, feature flags and tests.
- Determine if task is a bug fix, feature, refactor, performance change, visual redesign or migration; avoid combining categories without need.
- Record behavior invariants, risky writes and affected dependencies. No invented file paths, installed tools, test commands or finished behavior.

## Stage B — Design and implement

- For tasks spanning layers, define data flow: **UI → hook/store → frontend API service → HTTP boundary → controller → domain service → repository**. Not every feature needs every layer.
- Prefer the smallest correct diff with no unrelated changes. Preserve accessibility, responsive behavior, public APIs, DB schema and existing UX unless requirements say otherwise.
- If a file moves, rename/refactor all imports, aliases, exports, routes, dynamic imports, tests, snapshots, docs and SCSS paths that reference it.
- Keep changes reversible. Ask for authorization before destructive or externally impactful operations (deletion, production data changes, deployment, secret handling, dependency upgrades with breaking effects).

## Stage C — Verify with evidence

1. Run formatter/linter if configured.
2. Run typecheck if applicable.
3. Run targeted tests and then broader suites when feasible.
4. Run build and browser/manual UI inspection if those tools are available and the task touches the interface.
5. Assess error paths, disabled states, keyboard and reduced motion if changing UI; validation/auth/error mapping if changing API.
6. Inspect `git diff` (or equivalent) for unrelated edits, accidental secrets and orphaned references.

> Do not claim that a task "passes" checks that were never executed. Clearly distinguish `PASSED`, `FAILED`, and `NOT RUN` and give the reason for `NOT RUN`.

## Stage D — Report contract

Final delivery should be concise and factual:

- **Implemented:** what changed and where.
- **Validation:** exact commands/checks, observed results and remaining failures.
- **Risks/limitations:** only genuine outstanding issues, never hidden by confident wording.
- **Next action:** only if needed to move the work forward.

## Definition of done

- [ ] Functionality meets the task's acceptance criteria.
- [ ] No unexpected runtime/type errors from changes; relevant checks attempted.
- [ ] Design language consistent, responsiveness and accessibility preserved where relevant.
- [ ] Data privacy and permission boundaries intact.
- [ ] Modified names, imports, styles, tests and docs remain consistent.
- [ ] Report includes evidence and does not overstate testing.
