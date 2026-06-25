# AI Context

## Current Priorities

- Keep Codex Airbar as a lightweight local Electron floating monitor.
- Improve status accuracy and user ergonomics before adding direct Codex control.
- Keep navigation scoped to opening the related project in Codex Desktop unless a reliable session deep link is discovered.
- Preserve read-only access to `%USERPROFILE%\.codex` unless the user explicitly asks for write/control features.

## Current Constraints

- The project is a new MVP, not yet packaged.
- Renderer uses Vite + React + Tailwind with shadcn-style local UI primitives.
- Codex status is inferred from local state files and process-manager records.
- Documentation files must be UTF-8.

## Current Important Decisions

- `src/status-reader.js` is the single owner for Codex local state parsing and status inference.
- Main process owns filesystem access and notifications; renderer owns polling and presentation.
- Theme switching is centralized in `src/renderer/src/theme-provider.tsx` and CSS variables in `src/renderer/src/styles.css`.
- Session `Open` uses `codex app <workspace>` and is intentionally project-scoped rather than session-resume behavior.
- `start-codex-airbar.bat` is the current user-facing launcher.

## Suggested Read Order

1. `doc/README.md`
2. `doc/product/PRODUCT_BRIEF.md`
3. `doc/architecture/ARCHITECTURE_OVERVIEW.md`
4. `doc/engineering/DEV_SETUP.md`
5. `doc/ai/DEV_LOG.md`
6. Latest file under `doc/ai/tasks/`
