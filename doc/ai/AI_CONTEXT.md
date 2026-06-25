# AI Context

## Current Priorities

- Keep Codex Airbar as a lightweight local Electron floating monitor.
- Improve status accuracy and user ergonomics before adding direct Codex control.
- Preserve read-only access to `%USERPROFILE%\.codex` unless the user explicitly asks for write/control features.

## Current Constraints

- The project is a new MVP, not yet packaged.
- Renderer uses static HTML/CSS/JS with no build pipeline.
- Codex status is inferred from local state files and process-manager records.
- Documentation files must be UTF-8.

## Current Important Decisions

- `src/status-reader.js` is the single owner for Codex local state parsing and status inference.
- Main process owns filesystem access and notifications; renderer owns polling and presentation.
- `start-codex-airbar.bat` is the current user-facing launcher.

## Suggested Read Order

1. `doc/README.md`
2. `doc/product/PRODUCT_BRIEF.md`
3. `doc/architecture/ARCHITECTURE_OVERVIEW.md`
4. `doc/engineering/DEV_SETUP.md`
5. `doc/ai/DEV_LOG.md`
6. Latest file under `doc/ai/tasks/`
