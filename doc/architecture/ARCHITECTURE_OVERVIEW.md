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
- `scripts/protect-build.js`: release-time obfuscation step for Electron core files.
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

## Source Coverage Boundary

- The current collector reads local rollout-backed Codex sessions under `%USERPROFILE%\.codex`; it does not ingest the full Recent list from the unified ChatGPT desktop application.
- `session_index.jsonl` provides ids, titles, and update times but no conversation kind. Rollout metadata on this machine identifies the collected records as Codex Desktop sessions, but that local format remains implementation-owned.
- The unified desktop shell does not imply a unified storage or lifecycle contract. Official product guidance keeps Chat/Work conversations and Codex developer history as distinct experiences even though they share one application.
- General ChatGPT conversations must not enter the Codex status pipeline until a supported integration provides both an authoritative kind and per-turn lifecycle evidence.
- If a future source introduces `chat` or `unknown`, `status-reader.js` must route them through kind-specific inference rather than applying Codex `task_complete`, `done`, or recovery rules.

## Future Session Relay Direction

Airbar can plausibly grow from a monitor into a lightweight session relay, but the relay should use Codex CLI entry points rather than mutating Codex-owned local state.

Observed local CLI capability:

```powershell
codex exec resume <SESSION_ID> "<PROMPT>"
```

or, for larger prompts:

```powershell
"prompt text" | codex exec resume <SESSION_ID> -
```

Potential planner/coder flow:

1. Airbar reads planner and coder sessions through the existing read-only snapshot path.
2. The user marks one session as `planner` and another as `coder`.
3. Airbar extracts or lets the user compose a task prompt from the planner session.
4. Main process sends that prompt to the coder session with `codex exec resume <coderSessionId>`.
5. Airbar monitors the coder session until it reaches a completion-like state.
6. The user can send a summary back to the planner with `codex exec resume <plannerSessionId>`.

Important boundaries:

- Do not write directly to `%USERPROFILE%\.codex\sessions\**\*.jsonl`; those files are Codex-owned logs/state, not a stable write API.
- Avoid resuming the same session concurrently from multiple processes.
- Prefer explicit user confirmation before sending planner output to a coder session or returning coder output to a planner session.
- Keep interactive `codex resume` separate from non-interactive relay behavior. For relay work, prefer `codex exec resume` because it accepts a prompt and can run without a TUI.

## Key Technical Decisions

- Use Electron main/preload with a Vite + React renderer.
- Use shadcn-style source-owned UI primitives rather than a large external UI runtime.
- Use CSS variable theme tokens so light/dark theme switching stays centralized.
- Use read-only filesystem inspection instead of writing to Codex state.
- Keep status inference centralized in `src/status-reader.js`.
- Recover workspaces conservatively from multiple local signals: session-file head metadata, persisted hints, writable roots, process `cwd`, event `cwd`, explicit `-C/--cd` command arguments, and repo-root inference from message paths.
- Keep project UI memory renderer-local and persist it by workspace key in `localStorage`.
- Keep the monitor window as a wider frameless floating panel without automatic edge-docking behavior; top-center placement is an explicit IPC action behind the magnet button.
- The preferred first background-resident architecture is window-hiding plus tray residency, not a full headless rewrite: renderer polling and transition detection can remain alive while the hidden window stays mounted.
- If a later phase needs true no-window monitoring, move polling and done-transition detection into the main process before allowing the renderer window to be destroyed.
- Packaged releases do not include the raw Electron core files directly. `electron-builder` points the packaged app entry to generated `.protected-src/main.js`, while normal development continues to run from `src/main.js`.
- Current status inference is heuristic and tiered: `working` is driven by fresh process activity plus very recent event/file signals, `done` is driven by completion-like signals within an 18-hour window, and `idle` covers older sessions unless a current process signal revives them.
- Local completed sessions expose richer event-sequence signals than Airbar currently uses, including `reasoning`, tool-call start/output events, `final_answer`, and `task_complete`; these are the preferred next path for stronger status inference.
