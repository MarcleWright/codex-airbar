# Task

## ID

2026-06-26_01

## Title

Compact Monitor Density And Workspace Recovery

## Status

Done

## Goal

Turn Airbar into a denser, calmer floating monitor while improving project attribution for sessions that were incorrectly grouped under `Projectless`.

## Scope

- Refine renderer density across title bar, project headers, session rows, badges, scrollbars, and range-input styling.
- Separate project `collapsed` and `hideIdle` behavior into independent persisted UI state.
- Hide idle sessions by default while preserving user overrides per project.
- Add collapsed-project working/done count capsules in the project header.
- Improve workspace recovery in `src/status-reader.js` using additional `cwd` formats, command parsing, and conservative path inference.
- Adjust the main window to use a wider default width and remove automatic top-edge snapping.

## Non-goals

- Add new product surfaces beyond the existing monitor window.
- Replace local filesystem status inference with a remote or official Codex API.
- Add new direct-control actions beyond the current session action registry.

## Plan

- Compress the monitoring UI into a thinner single-window layout.
- Split project UI persistence into explicit `collapsed` and `hideIdle` booleans.
- Improve `Projectless` recovery only with conservative, inspectable heuristics.
- Validate with renderer builds and status-reader checks after each cluster of changes.

## Acceptance Criteria

- Session rows are materially denser and keep title, time, and context on one compact line.
- Idle sessions are hidden by default, and each project's hide/show choice persists.
- Project collapse no longer changes idle visibility state.
- Collapsed project headers show working/done counts only.
- Workspace inference reduces false `Projectless` grouping without inventing obviously wrong project roots such as install folders or broad parent directories.
- The window no longer auto-snaps to the top edge and opens wider by default.

## Execution Report

### Implementation Contributor(s)

- Codex implementation agent.

### Implementation Notes

- Reworked renderer spacing, button/icon sizing, and session-row layout for a compact monitor-first presentation.
- Removed session status text badges from rows and replaced the left marker with a longer vertical state bar.
- Added per-project UI persistence keyed by workspace with independent `collapsed` and `hideIdle` flags, defaulting `hideIdle` to `true`.
- Added collapsed-only project header count capsules for `working` and `done`.
- Restyled scrollbars globally and added a slim custom `input[type="range"]` theme for future controls.
- Expanded workspace inference by reading top-level event `cwd`, parsing `-C/--cd` arguments, and inferring repo roots from message paths with a conservative `Codex_Projects/<repo>` fallback.
- Removed the temporary auto-snap behavior and widened the default Electron window from 420px to 630px.

### Validation

- `npm run build:renderer` succeeded repeatedly through the UI refinement passes.
- `npm run check` succeeded after workspace-inference updates and after the final window/layout updates.

### Planner/Reviewer Follow-up Fixes

- Tightened message-path inference after an initial pass created false projects such as `bin` and `AI`.
- Removed the top summary color strip after it proved visually unnecessary for the compact monitor layout.

## Reviewer Notes

- `Projectless` still exists for sessions whose local Codex metadata does not expose a recoverable workspace path.
- Message-path inference is intentionally conservative to avoid mislabeling unrelated directories as projects.

## Context Delta

### Keep

- `src/status-reader.js` remains the only owner of workspace and status inference logic.
- Session-row action defaults to `resumeSession`.
- Project-level Explorer access and per-project UI memory remain part of the monitoring workflow.

### Changed

- Project `collapsed` and `hideIdle` state are no longer encoded as a shared mode value.
- Idle sessions default to hidden.
- The monitor window is now a wider free-floating panel rather than a top-snapping strip.
- Compact presentation now favors a single-line session summary with inline context.

### Avoid

- Avoid broad path guessing that promotes install directories or parent folders into fake projects.
- Avoid re-coupling project collapse behavior with idle-session visibility.

### Follow-up

- Consider a future user-visible explanation or affordance for `Projectless` sessions if workspace inference remains incomplete.
- Consider further normalizing nested repo paths such as `apps/web` when a subdirectory rather than repo root is the only available signal.

## Final Result

Airbar now behaves more like a dense monitoring strip, preserves project visibility preferences more cleanly, and recovers more real projects from local Codex metadata without aggressive misclassification.

## Links

- `src/status-reader.js`
- `src/main.js`
- `src/renderer/src/App.tsx`
- `src/renderer/src/styles.css`
- `doc/design/UI_GUIDE.md`
- `doc/engineering/KNOWN_ISSUES.md`
