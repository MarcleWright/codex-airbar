# Architecture Overview

## System Purpose

Codex Airbar is a local Electron app that watches Codex session metadata and displays a derived monitoring view.

## Main Modules

- `src/main.js`: Electron main process, window creation, IPC handlers, logging, notifications.
- `src/preload.js`: safe renderer bridge exposed as `window.airbar`.
- `src/status-reader.js`: read-only Codex state reader and session status derivation.
- `src/renderer/index.html`: Vite renderer HTML shell.
- `src/renderer/src/main.tsx`: React renderer entry.
- `src/renderer/src/App.tsx`: polling, filtering, notification transition detection, and UI composition.
- `src/renderer/src/theme-provider.tsx`: light/dark/system theme state and document class management.
- `src/renderer/src/components/ui/`: shadcn-style local UI primitives.
- `src/renderer/src/styles.css`: Tailwind entry and CSS variable theme tokens.
- `scripts/check.js`: command-line validation for the status reader.
- `start-codex-airbar.bat`: Windows double-click launcher.

## Responsibility Boundaries

- Main process owns filesystem access, Electron window behavior, system notifications, and app logs.
- Renderer owns presentation, polling cadence, detecting status transitions between snapshots, local UI memory, and theme switching.
- `status-reader.js` owns all knowledge of Codex local file formats, workspace recovery heuristics, and status inference.

## Data Flow

1. Renderer calls `window.airbar.getSnapshot()`.
2. Preload forwards the request through IPC.
3. Main process calls `readCodexSnapshot()`.
4. Status reader reads local Codex state under `%USERPROFILE%\.codex`.
5. Snapshot returns grouped projects and sessions.
6. Renderer updates counts, project lists, and notifications.

## Key Technical Decisions

- Use Electron main/preload with a Vite + React renderer.
- Use shadcn-style source-owned UI primitives rather than a large external UI runtime.
- Use CSS variable theme tokens so light/dark theme switching stays centralized.
- Use read-only filesystem inspection instead of writing to Codex state.
- Keep status inference centralized in `src/status-reader.js`.
- Recover workspaces conservatively from multiple local signals: persisted hints, writable roots, process `cwd`, event `cwd`, explicit `-C/--cd` command arguments, and repo-root inference from message paths.
- Keep project UI memory renderer-local and persist it by workspace key in `localStorage`.
- Keep the monitor window as a wider frameless floating panel without automatic edge-docking behavior.
- Current status inference is heuristic and tiered: `working` is driven by very recent process/file activity, `done` is driven by recent file activity plus observed tool output, `recent` is a fallback recent-write bucket, and `idle` covers older sessions.
- Local completed sessions expose richer event-sequence signals than Airbar currently uses, including `reasoning`, tool-call start/output events, `final_answer`, and `task_complete`; these are the preferred next path for stronger status inference.
