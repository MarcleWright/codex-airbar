# Task

## ID

2026-06-25_06

## Title

Switchable Session Open Actions

## Status

Done

## Goal

Make the session `Open` action configurable so Airbar can keep project navigation while also offering a session resume action.

## Scope

- Add a renderer-level open action selector.
- Preserve `openWorkspace` as the default action.
- Add `resumeSession` as a second action.
- Add main/preload IPC for the resume action.
- Route session button clicks through an action registry.

## Non-goals

- Direct session deep-link navigation in Codex Desktop.
- Removing workspace navigation.
- Writing to Codex local state.

## Plan

- Store selected open action in `localStorage`.
- Use `codex app <workspace>` for workspace navigation.
- Use `codex resume <sessionId>` for session resume.
- Launch resume through an interactive terminal on Windows because `codex resume` requires terminal stdin.

## Acceptance Criteria

- The user can switch between `Open workspace` and `Resume session`.
- Existing workspace navigation remains available and remains the default.
- `Resume session` is available without replacing workspace navigation behavior.
- Renderer build and status reader checks pass.

## Execution Report

### Implementation Contributor(s)

- Codex implementation agent.

### Implementation Notes

- Added `OpenActionKey` and action registry logic in `src/renderer/src/App.tsx`.
- Added `resumeSession` to the preload bridge.
- Added `codex:resumeSession` IPC handler in `src/main.js`.
- Implemented Windows resume by opening a `cmd.exe` window that runs `codex resume <sessionId>`.

### Validation

- `npm run build:renderer` passed.
- `npm run check` passed.
- Direct non-interactive `codex resume <sessionId>` was observed to fail with `stdin is not a terminal`, so the implementation uses an interactive terminal window.

### Planner/Reviewer Follow-up Fixes

None.

## Reviewer Notes

- `Resume session` is intentionally not session navigation. It continues the selected session in Codex CLI.
- If Codex later exposes a real session deep link, add it as another action key rather than replacing these actions.

## Context Delta

### Keep

- `openWorkspace` remains the default and safest action.
- Session actions should stay registry-based as more actions are added.

### Changed

- Session row actions are now configurable.

### Avoid

- Avoid running `codex resume` in a hidden/background process because it requires an interactive terminal.

### Follow-up

- Add a real session deep-link action only after a stable Codex Desktop entry point is found.

## Final Result

Airbar now supports a switchable session action set with workspace navigation and session resume.

## Links

- `src/main.js`
- `src/preload.js`
- `src/renderer/src/App.tsx`
