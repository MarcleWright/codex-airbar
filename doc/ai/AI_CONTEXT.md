# AI Context

## Current Priorities

- Keep Codex Airbar as a lightweight local Electron floating monitor.
- Improve workspace attribution and monitoring ergonomics before adding broader direct Codex control.
- Preserve read-only access to `%USERPROFILE%\.codex` unless the user explicitly asks for write/control features.

## Current Constraints

- The project is a new MVP, not yet packaged.
- Renderer uses Vite + React + Tailwind with shadcn-style local UI primitives.
- Codex status is inferred from local state files and process-manager records.
- Some sessions still fall back to `Projectless` when local Codex metadata does not expose a recoverable workspace path.
- Completed local sessions retain richer event history than the current Airbar UI uses, including `reasoning`, tool-call, `turn_context`, `final_answer`, and `task_complete` signals.
- Documentation files must be UTF-8.

## Current Important Decisions

- `src/status-reader.js` is the single owner for Codex local state parsing and status inference.
- Main process owns filesystem access and notifications; renderer owns polling and presentation.
- Theme switching is centralized in `src/renderer/src/theme-provider.tsx` and CSS variables in `src/renderer/src/styles.css`.
- Session actions are registry-based. The current options are `openWorkspace` and `resumeSession`.
- `resumeSession` is the current default session action and launches `codex resume <sessionId>` in an interactive terminal window.
- Project UI memory is per-workspace and stores two independent booleans: `collapsed` and `hideIdle`.
- Idle sessions are hidden by default until a project-specific user toggle says otherwise.
- The window now opens as a wider floating panel without automatic top-edge snap behavior.
- Status color semantics are user-facing only: blue means `working`, green means `done`, but both are still inferred from local recency and event/output signals rather than authoritative Codex state.
- Future status improvements can use event-sequence signals from completed sessions without adding direct Codex control yet.
- `start-codex-airbar.bat` is the current user-facing launcher.

## Suggested Read Order

1. `doc/README.md`
2. `doc/product/PRODUCT_BRIEF.md`
3. `doc/architecture/ARCHITECTURE_OVERVIEW.md`
4. `doc/engineering/DEV_SETUP.md`
5. `doc/ai/DEV_LOG.md`
6. Latest file under `doc/ai/tasks/`
