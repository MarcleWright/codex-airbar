# Dev Log

## Recent

### 2026-06-26 Compact Monitor Density, Workspace Recovery, And Window Behavior

Status: Done

Summary:

- Refined the Airbar into a denser monitoring surface with slimmer headers, tighter session rows, icon-only actions, hidden idle sessions by default, and collapsed-project working/done count capsules.
- Improved workspace recovery in `status-reader.js` by reading more `cwd` shapes, parsing `-C/--cd` command arguments, and inferring repo roots from message paths while avoiding false parent-directory matches.
- Removed top-edge auto-snapping, widened the default window, restyled scrollbars/range inputs, and kept always-on-top as a manual toggle.
- Clarified status semantics so `working` reads as violet and `done` reads as Codex-style blue, while keeping the underlying inference heuristics local and best-effort.
- Simplified session lifecycle to `working` / `done` / `idle`, kept `done` visible for up to 18 hours, added manual clear-done memory, and prevented stale pre-restart sessions older than that window from reviving as `working` without a fresh process signal.
- Fixed a resumed-session edge case where a fresh user message after a completed turn could be incorrectly shown as `done`; pending user messages now immediately show `working` until assistant activity appears.
- Added an explicit magnet control that snaps the window to top-center using the current size and reflects snapped state with a filled icon.
- Normalized stateful button semantics so icons represent the current state for theme, idle visibility, pin, and magnet controls.
- Improved workspace attribution by reading session-file head metadata such as `session_meta.payload.cwd`, `turn_context.payload.workspace_roots`, and early `turn_context.payload.cwd`.
- Confirmed that completed local sessions still expose process signals such as `reasoning`, tool-call events, `turn_context`, `agent_message`, `final_answer`, and `task_complete`, which may support future richer Airbar interaction states even though they are not yet surfaced in the UI.

Primary task links:

- `ai/tasks/2026-06-26_01_compact-monitor-density-and-workspace-recovery.md`

### 2026-06-25 Switchable Session Open Actions

Status: Done

Summary:

- Converted the session action into a switchable action set.
- Kept `openWorkspace` as the default behavior.
- Added `resumeSession` as a second action that launches Codex resume in an interactive terminal.

Primary task links:

- `ai/tasks/2026-06-25_06_switchable-session-open-actions.md`

### 2026-06-25 Persistent Project Density Controls

Status: Done

Summary:

- Persisted per-project collapse modes in local storage.
- Removed the text search control and project-header session count display.
- Removed persistent button fill/border chrome and changed the project visibility control to switch icons.

Primary task links:

- `ai/tasks/2026-06-25_05_persistent-project-density-controls.md`

### 2026-06-25 Project Header Explorer And Collapse Modes

Status: Done

Summary:

- Added a project-header folder button that opens the workspace in Explorer.
- Preserved session-row `Open` as the Codex navigation action.
- Added per-project `hide-idle` and full collapse modes for denser monitoring.

Primary task links:

- `ai/tasks/2026-06-25_04_project-header-explorer-and-collapse-modes.md`

### 2026-06-25 Project Navigation From Session Rows

Status: Done

Summary:

- Added session-level `Open` actions that send the user back to the related Codex Desktop project.
- Kept navigation project-scoped instead of using `resume`, so Airbar stays a monitor rather than a control surface.
- Added error handling for sessions without a known workspace.

Primary task links:

- `ai/tasks/2026-06-25_03_project-navigation-from-session-rows.md`

### 2026-06-25 React Theme Foundation

Status: Done

Summary:

- Migrated the renderer from static HTML/CSS/JS to Vite + React.
- Added Tailwind and shadcn-style local UI primitives.
- Added CSS variable light/dark theme tokens and a title-bar theme toggle.
- Preserved existing Codex status reader, Electron IPC, notifications, and launcher behavior.

Primary task links:

- `ai/tasks/2026-06-25_02_react-shadcn-theme-foundation.md`

### 2026-06-25 Codex Airbar MVP Bootstrap

Status: Done

Summary:

- Created a local Electron floating monitor for Codex projects and sessions.
- Added read-only local Codex state parsing from `%USERPROFILE%\.codex`.
- Added status counts, filtering, grouped project/session display, and done notifications.
- Added a Windows `.bat` launcher and startup/error logging.
- Bootstrapped the project documentation system.

Primary task links:

- `ai/tasks/2026-06-25_01_bootstrap-codex-airbar-mvp.md`

## Archive

No archived logs yet.
