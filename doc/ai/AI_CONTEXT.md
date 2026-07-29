# AI Context

## Current Priorities

- Keep Codex Airbar as a lightweight local Electron floating monitor.
- Improve workspace attribution and monitoring ergonomics before adding broader direct Codex control.
- Preserve read-only access to `%USERPROFILE%\.codex` unless the user explicitly asks for write/control features.

## Current Constraints

- The project is a new MVP, not yet packaged.
- Renderer uses Vite + React + Tailwind with shadcn-style local UI primitives.
- Codex status is inferred from local state files and process-manager records.
- Sessions should first recover workspace from session-file head metadata; fallback heuristics only apply when `session_meta` and early `turn_context` do not expose a usable path.
- Completed local sessions retain richer event history than the current Airbar UI uses, including `reasoning`, tool-call, `turn_context`, `final_answer`, and `task_complete` signals.
- User-stopped turns can also expose a terminal `turn_aborted` event, which should be treated as a completion-like signal rather than as a waiting-for-user state.
- Sessions older than the 18-hour done window should fall back to `idle` on reload unless a fresh process-manager signal proves they are actively running again.
- Session relay is technically plausible through `codex exec resume <SESSION_ID> <PROMPT>`, but Airbar should not directly mutate Codex session JSONL files.
- The unified ChatGPT desktop application contains separate Chat/Work and Codex experiences. Airbar currently covers rollout-backed local Codex threads only; ordinary Recent chats have no supported Airbar source or Codex-style completion contract.
- Documentation files must be UTF-8.

## Current Important Decisions

- `src/status-reader.js` is the single owner for Codex local state parsing and status inference.
- Main process owns filesystem access and notifications; renderer owns polling and presentation.
- Theme switching is centralized in `src/renderer/src/theme-provider.tsx` and CSS variables in `src/renderer/src/styles.css`.
- Session actions are registry-based. The current options are `openWorkspace` and `resumeSession`.
- `resumeSession` is the current default session action and launches `codex resume <sessionId>` in an interactive terminal window.
- Project UI memory is per-workspace and stores two independent booleans: `collapsed` and `hideIdle`.
- Idle sessions are hidden by default until a project-specific user toggle says otherwise.
- The window opens as a wider floating panel without automatic edge-docking; the magnet button explicitly snaps it to top-center and reflects snapped state with a filled icon.
- Stateful buttons should display the current state in the icon, not the state that clicking will switch to.
- Status color semantics are user-facing only: violet means `working`, blue means `done`, but both are still inferred from local recency and event/output signals rather than authoritative Codex state.
- Status lifecycle is now `working` / `done` / `idle`; `done` persists up to 18 hours unless the user clears it locally, and stale older sessions should not revive as `working` after restart without a current process signal.
- A fresh user message after a completed turn is a `working` signal until later assistant activity appears; metadata events such as `session_meta` and `turn_context` do not cancel that pending state.
- `turn_aborted` should take precedence over pending-user detection, so an intentional user stop is shown as `done` within the same 18-hour window.
- Future status improvements can use event-sequence signals from completed sessions without adding direct Codex control yet.
- Future planner/coder connection should be modeled as a user-confirmed relay using `codex exec resume`, not as direct writes to `%USERPROFILE%\.codex\sessions`.
- Never infer conversation kind from `Projectless`, title text, message text, or inactivity. Unknown kinds cannot emit done notifications or enter automatic recovery.
- `start-codex-airbar.bat` is the current user-facing launcher.

## Suggested Read Order

1. `doc/README.md`
2. `doc/product/PRODUCT_BRIEF.md`
3. `doc/architecture/ARCHITECTURE_OVERVIEW.md`
4. `doc/engineering/DEV_SETUP.md`
5. `doc/ai/DEV_LOG.md`
6. Latest file under `doc/ai/tasks/`
