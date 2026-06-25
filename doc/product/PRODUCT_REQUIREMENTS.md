# Product Requirements

## Feature: Floating Codex Session Monitor

### Goal

Provide a lightweight desktop window that shows local Codex execution status across projects and sessions.

### User Value

The user can leave multiple Codex sessions running and glance at one compact panel to see what is still active and what may be done.

### Scope

- Read local Codex state from `%USERPROFILE%\.codex`.
- Show projects grouped by workspace.
- Show recent sessions under each project.
- Display status counts for `working`, `done`, `recent`, and `idle`.
- Support text filtering and status filtering.
- Notify when a session transitions from `working` to `done`.
- Provide a double-click `.bat` launcher for Windows.

### Rules

- The app must treat Codex state as read-only.
- The MVP may infer status from local files and process records rather than requiring a private Codex API.
- The app should stay small and quick to start.
- Startup failures should be visible through logs or a paused launcher window instead of silently disappearing.

### Acceptance Criteria

- `npm run check` can read local Codex state and report project/session counts.
- `npm start` opens the floating window.
- `start-codex-airbar.bat` starts the app from Explorer.
- The app logs startup and snapshot errors to the Electron userData log file.

### Non-goals

- Session control commands such as pause, resume, send message, archive, or fork.
- Perfect authoritative status from Codex internals.
- Cross-machine or cloud monitoring.
