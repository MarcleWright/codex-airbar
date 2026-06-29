# Roadmap

## Current Stage

MVP is running as a local Electron app. It reads local Codex files, groups sessions by project, displays derived status, and can be started with a `.bat` launcher.

## Near-Term Priorities

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

## Deferred Areas

- Direct Codex session control.
- Remote monitoring.
- Multi-user dashboard features.
