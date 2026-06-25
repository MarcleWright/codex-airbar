# Task

## ID

2026-06-25_04

## Title

Project Header Explorer And Collapse Modes

## Status

Done

## Goal

Make project cards denser and clearer by moving folder-opening to the project header, keeping session `Open` tied to Codex navigation, and adding per-project compact/collapse controls.

## Scope

- Remove workspace-path subtitle text from the project header.
- Add a project-header button that opens the workspace in Explorer.
- Preserve session-row `Open` as the Codex navigation action.
- Add `hide-idle` and full-collapse modes per project.
- Update design and AI documentation.

## Non-goals

- Change the meaning of session-row `Open`.
- Add persistent saved collapse state.
- Add deep linking to a specific Codex session.

## Plan

- Restore separate IPC actions for Codex navigation and Explorer folder opening.
- Update project header layout and session-row action placement.
- Add two per-project compacting behaviors.
- Validate build and startup, then update docs and push.

## Acceptance Criteria

- Project headers no longer show the workspace path as subtitle text.
- Project headers include a folder button that opens Explorer.
- Session-row `Open` still opens the project in Codex.
- Each project can hide only idle sessions or collapse completely.

## Execution Report

### Implementation Contributor(s)

- Codex implementation agent.

### Implementation Notes

- Restored `codex:openProject` for session-row Codex navigation.
- Added `app:openProjectFolder` for Explorer folder opening from the project header.
- Updated project-card UI to remove the workspace subtitle and add two compacting controls.
- Kept collapse state local to each project card.

### Validation

- `npm run build:renderer` succeeded.
- `npm run check` succeeded.
- Electron startup completed successfully after the UI changes.

### Planner/Reviewer Follow-up Fixes

- Corrected an intermediate misread where Explorer behavior briefly replaced the session-level Codex open behavior before finalizing the requested split.

## Reviewer Notes

- This keeps the mental model clean: session action is for Codex, project-header action is for filesystem navigation.

## Context Delta

### Keep

- Session-row `Open` means open in Codex.
- Project-header folder action means open the workspace in Explorer.

### Changed

- Project cards now support `hide-idle` and full collapse modes.
- Project headers no longer display workspace path text inline.

### Avoid

- Avoid reusing one action label for both Codex navigation and Explorer navigation.

### Follow-up

- Persist per-project collapse state if long-running daily use makes that worthwhile.

## Final Result

Project cards are denser and now separate Codex navigation from Explorer navigation while supporting two levels of collapse.

## Links

- `src/main.js`
- `src/preload.js`
- `src/renderer/src/App.tsx`
