# Roadmap

## Current Stage

MVP is running as a local Electron app. It reads local Codex files, groups sessions by project, displays derived status, and can be started with a `.bat` launcher.

## Near-Term Priorities

- Add an explicit conversation-kind boundary before considering any source beyond rollout-backed Codex sessions.
- Improve status accuracy by identifying better Codex completion or turn-ended signals if available.
- Add a compact/collapsed mode for leaving the window on-screen all day.
- Add click actions to open related workspace paths or logs.
- Add user settings for polling interval, window position, and notification behavior.
- Add an explicit background-resident mode built around the Windows tray so the monitor can keep polling and notifying without occupying taskbar space.

## Medium-Term Priorities

- Package as a standalone Windows app, with `portable` as the first-class distribution target.
- Add installer packaging only after portable usage proves stable and startup behavior is settled.
- Persist user filters and window bounds.
- Add a clearer "needs attention" category if Codex is blocked or waiting for user input.
- Explore a user-confirmed session relay mode that sends prompts between selected planner and coder sessions through `codex exec resume`.

## Deferred Areas

- Direct Codex session control through unsupported local-state writes.
- Ordinary ChatGPT Chat/Work monitoring until a supported source exposes both conversation kind and turn lifecycle.
- Remote monitoring.
- Multi-user dashboard features.
