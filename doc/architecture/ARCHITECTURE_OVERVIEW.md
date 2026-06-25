# Architecture Overview

## System Purpose

Codex Airbar is a local Electron app that watches Codex session metadata and displays a derived monitoring view.

## Main Modules

- `src/main.js`: Electron main process, window creation, IPC handlers, logging, notifications.
- `src/preload.js`: safe renderer bridge exposed as `window.airbar`.
- `src/status-reader.js`: read-only Codex state reader and session status derivation.
- `src/renderer/index.html`: renderer shell.
- `src/renderer/renderer.js`: polling, filtering, notification transition detection, DOM rendering.
- `src/renderer/styles.css`: floating-window visual style.
- `scripts/check.js`: command-line validation for the status reader.
- `start-codex-airbar.bat`: Windows double-click launcher.

## Responsibility Boundaries

- Main process owns filesystem access, Electron window behavior, system notifications, and app logs.
- Renderer owns presentation, filtering, polling cadence, and detecting status transitions between snapshots.
- `status-reader.js` owns all knowledge of Codex local file formats and status inference.

## Data Flow

1. Renderer calls `window.airbar.getSnapshot()`.
2. Preload forwards the request through IPC.
3. Main process calls `readCodexSnapshot()`.
4. Status reader reads local Codex state under `%USERPROFILE%\.codex`.
5. Snapshot returns grouped projects and sessions.
6. Renderer updates counts, project lists, and notifications.

## Key Technical Decisions

- Use Electron with static HTML/CSS/JS to keep the MVP simple.
- Avoid a build pipeline until packaging or richer UI needs justify it.
- Use read-only filesystem inspection instead of writing to Codex state.
- Keep status inference centralized in `src/status-reader.js`.
