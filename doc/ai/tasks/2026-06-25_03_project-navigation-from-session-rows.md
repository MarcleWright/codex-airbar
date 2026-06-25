# Task

## ID

2026-06-25_03

## Title

Project Navigation From Session Rows

## Status

Done

## Goal

Let the user jump from a monitored session row back into the corresponding Codex Desktop project without turning Airbar into a session-control surface.

## Scope

- Add a session-level `Open` action in the renderer.
- Add a main-process IPC handler that launches `codex app <workspace>`.
- Surface navigation errors in the Airbar UI.
- Update documentation for the navigation behavior.

## Non-goals

- Session deep-link navigation into a specific Codex thread.
- `resume`, `fork`, or other session-control actions.
- Any write path into Codex local state.

## Plan

- Confirm whether Codex exposes deep link or CLI navigation options.
- Use `codex app <workspace>` as the reliable project navigation primitive.
- Add renderer and preload wiring.
- Validate build, status-reader behavior, and workspace open behavior.

## Acceptance Criteria

- Session rows display an `Open` action.
- Clicking `Open` launches the related Codex Desktop project.
- Sessions without a workspace disable the action and avoid crashes.
- Existing monitoring behavior remains intact.

## Execution Report

### Implementation Contributor(s)

- Codex implementation agent.

### Implementation Notes

- Added `codex:openProject` IPC handler in `src/main.js`.
- Added `openProject` to the preload bridge.
- Added session-row `Open` buttons and action-error messaging in the React renderer.
- Validated the underlying command with `codex app "D:\00_Projects_WSY\AI\Codex_Projects\codex_airbar"`.

### Validation

- `npm run build:renderer` succeeded.
- `npm run check` succeeded.
- `codex app <workspace>` successfully opened Codex Desktop for the tested workspace.

### Planner/Reviewer Follow-up Fixes

None.

## Reviewer Notes

- This is intentionally project navigation only. Session-specific deep-link navigation remains an open future investigation.

## Context Delta

### Keep

- Airbar is a monitoring and navigation surface, not a session editing surface.
- `Open` should map to workspace navigation, not session resume.

### Changed

- Session rows now provide project navigation back into Codex Desktop.

### Avoid

- Avoid using `codex resume` for this flow, since it changes the semantics from navigation to continuing a conversation.

### Follow-up

- Revisit session-level deep-link navigation only if Codex exposes a stable official entry point.

## Final Result

Airbar can now send the user from a monitored session row back to the matching Codex Desktop project.

## Links

- `src/main.js`
- `src/preload.js`
- `src/renderer/src/App.tsx`
