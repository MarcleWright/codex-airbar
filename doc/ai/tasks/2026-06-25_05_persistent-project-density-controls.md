# Task

## ID

2026-06-25_05

## Title

Persistent Project Density Controls

## Status

Done

## Goal

Make the Airbar project list behave more like a persistent monitoring surface by remembering project collapse modes and reducing visible chrome.

## Scope

- Persist per-project collapse modes in local storage.
- Remove the search input from the toolbar.
- Remove the project-header session count display.
- Remove visible button borders from active and secondary controls.
- Switch project visibility control between `EyeOff` and `Eye` icons.
- Remove persistent button fill colors so buttons only show color during click feedback.
- Preserve session-row `Open` as Codex navigation and project-header folder as Explorer navigation.

## Non-goals

- Persist status filters.
- Add deep links to specific Codex sessions.
- Change Codex status inference.

## Plan

- Store project collapse mode by workspace key in `localStorage`.
- Keep only the status filter in the toolbar.
- Remove project title count text and avoid visible border classes on buttons.
- Validate renderer build, status-reader check, and Electron startup.

## Acceptance Criteria

- Project collapse and hide-idle state survive app reloads.
- Search is no longer shown.
- Project headers do not show a session count after the title/actions.
- Buttons do not show explicit border outlines.
- Visibility state is represented by icon switching, not only color switching.
- Buttons do not show persistent internal color fills.
- Existing Codex `Open` and Explorer folder actions keep their separate meanings.

## Execution Report

### Implementation Contributor(s)

- Codex implementation agent.

### Implementation Notes

- Added `PROJECT_COLLAPSE_STORAGE_KEY` and lifted collapse state to `App`.
- Removed search state, search icon import, input import, and search filtering.
- Removed project-header count rendering.
- Removed explicit border classes from the pin, hide-idle, folder, and session action buttons.
- Updated button primitives so normal button states are transparent and active press states provide the color feedback.
- Changed the hide-idle control to switch between `EyeOff` and `Eye` icons.
- Kept session-row action behavior unchanged so open/resume work can remain owned by its separate task path.

### Validation

- `npm run build:renderer` succeeded.
- `npm run check` succeeded.
- Electron startup completed successfully.

### Planner/Reviewer Follow-up Fixes

None.

## Reviewer Notes

- Collapse persistence is local UI memory only and does not affect Codex session data.

## Context Delta

### Keep

- Session-row `Open` is Codex navigation.
- Project-header folder is Explorer navigation.
- Project density choices persist locally.
- Open/resume behavior is intentionally outside this task.

### Changed

- Search was removed from the monitor toolbar.
- Project headers no longer show session counts.
- Button visuals now rely on icon state and press feedback rather than persistent fills.

### Avoid

- Avoid mixing workspace Explorer actions with session/Codex actions.

### Follow-up

- Consider persisting the always-on-top state if it proves useful during daily use.

## Final Result

Project density controls persist, the toolbar is simpler, and project headers are cleaner.

## Links

- `src/renderer/src/App.tsx`
- `doc/design/UI_GUIDE.md`
- `doc/design/INTERACTION_RULES.md`
