# Known Issues

| ID | Area | Severity | Status | Summary | Related Task |
|---|---|---|---|---|---|
| KI-0001 | Status inference | Medium | Open | Session status is inferred from local file modified times, event tail data, and process-manager recency. It is useful for monitoring but not an authoritative Codex API state. | `ai/tasks/2026-06-25_01_bootstrap-codex-airbar-mvp.md` |
| KI-0002 | Dependency install | Low | Mitigated | Electron installation may be left incomplete if `npm install` times out. The launcher checks for Electron and can reinstall dependencies. | `ai/tasks/2026-06-25_01_bootstrap-codex-airbar-mvp.md` |
