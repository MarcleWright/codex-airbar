# Product Requirements

## Feature: Floating Codex Session Monitor

### Goal

Provide a lightweight desktop window that shows local rollout-backed Codex execution status across projects and sessions in the unified ChatGPT desktop environment.

### User Value

The user can leave multiple Codex sessions running and glance at one compact panel to see what is still active and what may be done.

### Scope

- Read local Codex state from `%USERPROFILE%\.codex`.
- Show projects grouped by workspace.
- Show recent rollout-backed Codex sessions under each project.
- Display derived `working`, `done`, and `idle` states plus failure/recovery detail where available.
- Allow opening the related project in the ChatGPT desktop application's Codex view from a session row.
- Notify when a session transitions from `working` to `done`.
- Detect the allowlisted recent stream-interruption failure and expose opt-in recovery through the standalone Codex CLI.
- Show CLI availability and recovery state without treating recovery as a write interface to Codex-owned files.
- Provide a double-click `.bat` launcher for Windows.

### Rules

- The app must treat Codex state as read-only.
- The MVP may infer status from local files and process records rather than requiring a private Codex API.
- Only a session with supported Codex provenance and completion-like rollout events may produce `done` notifications or automatic recovery.
- `Projectless`, title text, and message content are not valid conversation-kind classifiers.
- Ordinary ChatGPT Chat/Work conversations in Recent remain outside the current monitoring scope. If added later, they require an authoritative source and chat-specific lifecycle semantics.
- Unknown conversation kinds must remain visible only as unclassified activity if they are ever ingested; they must not be marked done or resumed automatically.
- The app should stay small and quick to start.
- Startup failures should be visible through logs or a paused launcher window instead of silently disappearing.

### Acceptance Criteria

- `npm run check` can read local Codex state and report project/session counts.
- `npm start` opens the floating window.
- `start-codex-airbar.bat` starts the app from Explorer.
- The app logs startup and snapshot errors to the Electron userData log file.
- Automatic recovery defaults to off and cannot be enabled when a compatible standalone Codex CLI is unavailable.
- A normal ChatGPT Recent conversation is not misrepresented as a completed Codex task.

### Non-goals

- General ChatGPT Recent monitoring or cross-surface inbox replacement.
- Broad session control commands such as pause, archive, or fork.
- Perfect authoritative status from Codex internals.
- Cross-machine or cloud monitoring.
