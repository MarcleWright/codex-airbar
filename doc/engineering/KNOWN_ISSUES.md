# Known Issues

| ID | Area | Severity | Status | Summary | Related Task |
|---|---|---|---|---|---|
| KI-0001 | Status inference | Medium | Open | Session status is inferred from local file modified times, event tail data, process-manager recency, and optional `[airbar]` markers. `working` currently means fresh process activity or very recent event/file activity; `done` persists for up to 18 hours after completion-like signals; stale sessions older than that window should fall back to `idle` unless a current process signal revives them. This is useful for monitoring but not an authoritative Codex API state. | `ai/tasks/2026-06-25_01_bootstrap-codex-airbar-mvp.md` |
| KI-0002 | Dependency install | Low | Mitigated | Electron installation may be left incomplete if `npm install` times out. The launcher checks for Electron and can reinstall dependencies. | `ai/tasks/2026-06-25_01_bootstrap-codex-airbar-mvp.md` |
| KI-0003 | Workspace recovery | Low | Open | `Projectless` grouping has been reduced by reading session-file head metadata before fallback heuristics. Some sessions may still expose no reliable workspace signal in local Codex metadata. | `ai/tasks/2026-06-26_01_compact-monitor-density-and-workspace-recovery.md` |
| KI-0004 | Process-state UX | Medium | Open | Local completed sessions expose richer event signals such as `reasoning`, tool-call events, `final_answer`, and `task_complete`, but Airbar does not yet turn them into intermediate UI states like “thinking” or “running tools”. | `ai/tasks/2026-06-26_01_compact-monitor-density-and-workspace-recovery.md` |
