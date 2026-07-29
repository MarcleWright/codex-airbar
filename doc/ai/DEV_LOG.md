# Dev Log

## Recent

### 2026-07-29 Global Done Clear And Error Indicator

Status: Done

Summary:

- Added a top-bar brush action that clears ordinary blue `done` sessions across all project cards while preserving red failures.
- Kept the per-project check action as an explicit acknowledgement that can clear both ordinary completions and red failures in that project.
- Changed the session indicator to red whenever a current failure remains, including scheduled retry waits and exhausted recovery, and purple only while the CLI is actively running a continuation.
- Returned successful recovery to the ordinary blue `done` color; recovery provenance does not introduce a separate green lifecycle state.
- Propagated red failure and purple active-recovery signals into both project-card and whole-Airbar collapsed summaries.

### 2026-07-29 Model Capacity Recovery

Status: Done

Summary:

- Added structured `server_overloaded` failures and the explicit "Selected model is at capacity" compatibility message to the automatic-recovery allowlist.
- Added a capacity-specific continuation prompt, a 30-second grace period, and retry delays of 60 and 180 seconds for a maximum of three attempts.
- Kept authentication, generic API, and unclassified errors outside automatic recovery.

### 2026-07-29 Git Worktree Project Identity

Status: Done

Summary:

- Kept main and linked Git worktrees as separate project cards while resolving their shared repository through `.git` pointer files and `commondir`.
- Read the desktop-assigned worktree name from `local-projects` and `thread-project-assignments` instead of deriving it from the duplicated checkout directory name.
- Preserved each session's concrete workspace for open and resume actions.
- Added a compact branch label for linked-worktree sessions and a regression fixture for Git worktree metadata.

### 2026-07-29 Session Status False-Positive Fix

Status: Done

Summary:

- Replaced the fixed 64 KB session tail read with a backward 64 KB chunk scan that stops after 40 complete lines and is capped at 4 MB.
- Kept current `task_complete` and `final_answer` signals visible when large passive `session_meta` records follow them.
- Stopped treating process-manager command history as active for the full 18-hour done window; only a confirmed live PID can now force `working`.
- Added regressions for large trailing metadata, stale null-PID records, and long-running confirmed processes.

### 2026-07-29 Unified Desktop Conversation Boundary

Status: Product and architecture definition updated

Summary:

- Reframed Airbar as a monitor for rollout-backed local Codex execution threads inside the unified ChatGPT desktop application, not as a monitor for every Recent conversation.
- Established that Codex `done` semantics do not transfer to ordinary ChatGPT chats, where a response can finish while the conversation remains open.
- Required authoritative conversation kind before future multi-source ingestion and made `unknown` ineligible for completion notifications or automatic recovery.
- Recorded the durable boundary in `ai/decisions/ADR-0003_conversation-kind-and-lifecycle-boundary.md`.

### 2026-07-05 Session Relay Feasibility Note

Status: Research recorded

Summary:

- Confirmed that Airbar's current read path only inspects Codex-owned local state and should remain read-only for session files.
- Identified `codex exec resume <SESSION_ID> <PROMPT>` and stdin-based `codex exec resume <SESSION_ID> -` as the safer future path for sending a message into an existing session.
- Recorded a possible planner/coder relay flow where Airbar reads planner output, asks for user confirmation, sends a task prompt to a coder session, monitors completion, and can send a summary back to the planner.
- Explicitly ruled out direct writes to `%USERPROFILE%\.codex\sessions\**\*.jsonl` as a reliable control mechanism.

### 2026-07-02 Taskbar Restore Fix

Status: Done

Summary:

- Fixed a Windows taskbar restore edge case where clicking the taskbar icon could hide the Airbar window and leave it unavailable from the taskbar.
- Tightened the main-process window state machine so only intentional tray hiding can hide the window, while taskbar minimize/hide paths restore the visible floating window.

Release note:

- `v0.1.2` packages the taskbar restore fix.

### 2026-06-30 Settings View And Glass Surface

Status: Done

Summary:

- Added a title-bar settings view that swaps the main project list into compact app settings without opening a second window.
- Added persistent settings for surface family, window width, and project-count basis for automatic height calculation.
- Kept `classic` / `glass` as the surface-family layer only; light/dark mode remains controlled by the existing title-bar theme toggle.
- Refactored the renderer shell so `classic` and `glass` are real switchable surface classes instead of ad hoc style branches.
- Added a glass surface with transparent Electron window support, Windows acrylic background material where available, and CSS fallback layering for shell, title bar, project cards, session rows, and button feedback.
- Preserved the full project list; the project-count setting only affects automatic window-height calculation.

Release note:

- `v0.1.1` packages the settings surface switcher, adjustable width, height-basis control, and enhanced glass theme.

### 2026-06-26 Compact Monitor Density, Workspace Recovery, And Window Behavior

Status: Done

Summary:

- Refined the Airbar into a denser monitoring surface with slimmer headers, tighter session rows, icon-only actions, hidden idle sessions by default, and collapsed-project working/done count capsules.
- Improved workspace recovery in `status-reader.js` by reading more `cwd` shapes, parsing `-C/--cd` command arguments, and inferring repo roots from message paths while avoiding false parent-directory matches.
- Removed top-edge auto-snapping, widened the default window, restyled scrollbars/range inputs, and kept always-on-top as a manual toggle.
- Clarified status semantics so `working` reads as violet and `done` reads as Codex-style blue, while keeping the underlying inference heuristics local and best-effort.
- Simplified session lifecycle to `working` / `done` / `idle`, kept `done` visible for up to 18 hours, added manual clear-done memory, and prevented stale pre-restart sessions older than that window from reviving as `working` without a fresh process signal.
- Fixed a resumed-session edge case where a fresh user message after a completed turn could be incorrectly shown as `done`; pending user messages now immediately show `working` until assistant activity appears.
- Mapped `turn_aborted` to the same terminal window as `done`, so sessions the user stops on purpose can still surface as completed work until the normal 18-hour idle fallback.
- Added an explicit magnet control that snaps the window to top-center using the current size and reflects snapped state with a filled icon.
- Normalized stateful button semantics so icons represent the current state for theme, idle visibility, pin, and magnet controls.
- Improved workspace attribution by reading session-file head metadata such as `session_meta.payload.cwd`, `turn_context.payload.workspace_roots`, and early `turn_context.payload.cwd`.
- Confirmed that completed local sessions still expose process signals such as `reasoning`, tool-call events, `turn_context`, `agent_message`, `final_answer`, and `task_complete`, which may support future richer Airbar interaction states even though they are not yet surfaced in the UI.
- Recorded separate durable plans for Windows tray-based background residency and `portable`-first packaging so future implementation can reuse the same product, design, architecture, and engineering framing instead of rediscovering it in chat.
- Added a release protection step that obfuscates Electron core files into `.protected-src/` before portable packaging, with docs noting that this raises casual inspection/tampering cost but is not true client-side secrecy.

Primary task links:

- `ai/tasks/2026-06-26_01_compact-monitor-density-and-workspace-recovery.md`

### 2026-06-25 Switchable Session Open Actions

Status: Done

Summary:

- Converted the session action into a switchable action set.
- Kept `openWorkspace` as the default behavior.
- Added `resumeSession` as a second action that launches Codex resume in an interactive terminal.

Primary task links:

- `ai/tasks/2026-06-25_06_switchable-session-open-actions.md`

### 2026-06-25 Persistent Project Density Controls

Status: Done

Summary:

- Persisted per-project collapse modes in local storage.
- Removed the text search control and project-header session count display.
- Removed persistent button fill/border chrome and changed the project visibility control to switch icons.

Primary task links:

- `ai/tasks/2026-06-25_05_persistent-project-density-controls.md`

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
