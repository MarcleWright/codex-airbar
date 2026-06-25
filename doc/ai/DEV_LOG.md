# Dev Log

## Recent

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
