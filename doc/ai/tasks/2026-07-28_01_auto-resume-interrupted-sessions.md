# Task

## ID

2026-07-28_01

## Title

Auto Resume Interrupted Codex Sessions

## Status

Done

## Goal

Allow Codex Airbar to detect selected recoverable session failures and safely continue the same local Codex session through the installed Codex CLI without modifying Codex-owned state files.

## Background

Codex desktop and the local Codex CLI share session state under the same `CODEX_HOME`. A failed turn is recorded in the session JSONL as a `task_complete` event whose payload can contain an error such as:

```text
stream disconnected before completion: error sending request for url (https://api.openai-hk.com/v1/responses)
```

The installed standalone CLI exposes the supported non-interactive continuation entry point:

```powershell
codex exec resume <SESSION_ID> "Continue the interrupted task." --json
```

Airbar currently detects `task_complete` but treats it as a normal `done` signal without retaining its error payload. Airbar also prefers a Codex desktop-managed executable before checking the standalone CLI available through `PATH`.

## Scope

- Parse terminal `task_complete` error details from Codex session JSONL files.
- Distinguish recoverable transport interruptions from normal completion and non-recoverable failures.
- Resolve and capability-check a standalone Codex CLI before enabling automatic recovery.
- Resume the same session with `codex exec resume <SESSION_ID> <PROMPT> --json`.
- Run automatic recovery from the Electron main process so tray-resident monitoring remains active.
- Prevent duplicate Airbar recovery attempts and best-effort avoid overlap with external Codex activity for the same failed turn.
- Apply bounded retry delays and a per-session circuit breaker.
- Expose recovery state and actionable failure information to the renderer.
- Persist versioned recovery records in an Airbar-owned file under Electron `userData`, keyed by session id plus failed-turn fingerprint. Write by temporary file plus atomic rename, prune old terminal records, and never write to Codex session files.
- Add focused validation for error parsing, retry classification, deduplication, CLI resolution, and process outcomes.

## Non-goals

- Write to `%USERPROFILE%\.codex\sessions` or any other Codex-owned state file.
- Retry authentication, quota, rate-limit, approval, context-limit, tool, or user-cancellation failures automatically.
- Bypass Codex approvals, hooks, sandboxing, or user configuration.
- Intentionally resume a session while observed Codex activity indicates that another process is already working on it.
- Guarantee recovery when the upstream provider remains unavailable.
- Generalize this work into planner/coder prompt relaying.
- Depend on an undocumented Codex desktop executable path as the primary CLI integration.

## Proposed Design

### Failure Detection

- Extend the status reader to retain the latest terminal turn id, completion timestamp, last agent message presence, and structured error fields.
- Classify only an explicit allowlist of transient transport failures as auto-recoverable.
- Limit automatic recovery to failures observed within a short recency window so enabling the feature cannot revive old abandoned work; older failures require an explicit manual retry.
- Treat error-bearing `task_complete` events as failed or attention-requiring states instead of normal `done` events.
- Recheck the same failed-turn fingerprint immediately before spawning, after a short stable grace period, and cancel recovery if a later user message, `task_started`, assistant activity, successful completion, or live recorded process appears.

### CLI Resolution

- Prefer an explicit `CODEX_AIRBAR_CODEX_PATH` override.
- Discover a standalone CLI from `PATH` and account for Windows `.cmd` launch behavior.
- Use the Codex desktop-managed executable only as a validated fallback, if retained at all.
- Run a startup capability probe such as `codex --version` and `codex exec resume --help` before advertising auto recovery as available.
- Report the selected executable and probe result without exposing credentials or sensitive configuration.

### Recovery Controller

- Keep recovery orchestration separate from `status-reader.js`; the reader remains read-only and returns structured observations.
- Key every attempt by session id plus failed turn id so repeated polling cannot send duplicate prompts.
- Acquire an in-process per-session lease before spawning the CLI.
- Treat external concurrency protection as best-effort: combine a stable failure fingerprint, a final compare-and-confirm snapshot, and recorded PID liveness checks instead of claiming an authoritative Codex session lock.
- Use a concise continuation prompt that states the preceding turn ended due to a transport interruption and asks Codex to continue the original task from available context.
- Capture CLI stdout, stderr, exit code, and JSONL progress with bounded output retention.
- Persist an explicit `scheduled -> running -> recovered | retryable_failed | permanent_failed | exhausted | cancelled` state machine. Process spawn or prompt insertion alone is never success; `recovered` requires exit code zero plus an error-free terminal turn event from `--json` output.
- Use bounded backoff, initially targeting no more than three attempts per failed turn.
- Stop retrying after success, non-recoverable CLI output, newer session activity, user intervention, or retry exhaustion.

### User Control And Visibility

- Default the feature to off until the UI provides an explicit user setting.
- Show CLI availability separately from auto-recovery enablement.
- Surface `failed`, `retrying`, `recovered`, and `needs attention` information without obscuring the existing working/done/idle monitor.
- Provide a manual retry action when automatic retries are disabled or exhausted.
- Emit system notifications when recovery succeeds or requires user attention.

## Safety Constraints

- Never send a continuation solely because a session file became quiet or stale.
- Never infer recoverability from arbitrary message text when a structured completion error is available.
- Never invoke more than one resume process for the same session at a time.
- Never use `--dangerously-bypass-approvals-and-sandbox` or `--dangerously-bypass-hook-trust`.
- Do not place API keys, authorization data, full environment dumps, or unbounded session content in Airbar logs.
- Preserve existing user configuration, model selection, permission profile, and workspace context unless the CLI requires an explicit safe override.

## Plan

1. Add structured completion-error parsing and fixtures to the status reader.
2. Add a CLI resolver and capability probe that works with Windows executables and command shims.
3. Add an Electron main-process recovery controller with leases, deduplication, backoff, and cancellation checks.
4. Add preload IPC and renderer settings/status presentation.
5. Add Airbar-owned persistence for recovery attempt records and circuit-breaker state.
6. Validate normal completion, recoverable failure, non-recoverable failure, concurrent activity, restart, and retry exhaustion paths.
7. Update stable architecture, product, design, engineering, and AI context documentation only after the implemented behavior establishes new project truth.

## Acceptance Criteria

- A session ending with the allowlisted stream-disconnection error is identified from its structured `task_complete.error` payload.
- A normal `task_complete`, `turn_aborted`, or non-allowlisted error does not trigger automatic continuation.
- Airbar can locate and validate the installed standalone Codex CLI without depending on the inaccessible Windows Store path.
- With auto recovery enabled, Airbar sends exactly one initial continuation prompt for one failed turn.
- The continuation uses the original session id and is visible as a new turn in the shared Codex session.
- Later session activity suppresses a stale scheduled retry.
- Retry delays are bounded, retry count is capped, and exhaustion produces a user-visible needs-attention state.
- Restarting Airbar does not repeat an already successful or exhausted recovery cycle.
- Simultaneous Airbar-owned resume processes for the same session are prevented, and a stable-tail plus live-PID check best-effort avoids overlap with external Codex activity.
- CLI execution does not bypass approvals, hooks, sandboxing, or configured permissions.
- Existing session monitoring, manual interactive resume, workspace opening, tray behavior, and notifications continue to work.
- `npm run check` and `npm run build:renderer` pass, with focused automated checks covering the recovery controller.

## Validation Plan

- Unit-test event parsing with successful, aborted, transient-error, permanent-error, and malformed JSONL tails.
- Unit-test allowlist matching without making network calls.
- Unit-test recovery state transitions with a fake clock and fake CLI process adapter.
- Unit-test deduplication across repeated snapshots and persisted restart state.
- Unit-test that process spawn and exit code zero without an error-free terminal turn event do not count as recovery success.
- Verify CLI resolution against an explicit path, the standalone `PATH` shim, missing CLI, failed probe, and desktop fallback.
- Manually reproduce a synthetic recoverable event using fixtures or an isolated test `CODEX_HOME`; do not edit live session files.
- Manually verify that a real CLI continuation appears in the same Codex desktop session only after explicit approval for that live test.

## Known Risks

- A provider can terminate a stream after performing side effects but before returning the final response, so a continuation may repeat work unless the prompt and agent context make completed actions clear.
- Codex local event formats are implementation-owned and may evolve; parsing must remain centralized and defensive.
- Desktop and standalone CLI versions can differ, so capability probing is more reliable than version-only checks.
- Non-interactive continuation cannot satisfy a newly surfaced interactive approval and must stop cleanly in that case.

## Execution Report

### Implementation Notes

- Extended the read-only session summary with structured `task_complete` details, failed-turn fingerprints, currentness checks, and recorded PID liveness.
- Added standalone CLI discovery that prefers `CODEX_AIRBAR_CODEX_PATH` and `PATH`, skips Windows Store aliases, and unwraps the installed npm `.cmd` shim to Node plus `codex.js` without shell interpolation.
- Added CLI capability probes for `--version` and `exec resume --help`.
- Added bounded `--json` execution with terminal-turn success semantics, transport-error classification, output limits, and process timeout handling.
- Added an Electron main-process recovery controller with a 10-second grace period, a 15-minute automatic recovery window, three attempts, backoff, in-process leases, stable-fingerprint confirmation, and live-PID checks.
- Added versioned Airbar-owned recovery persistence under Electron `userData`, atomic replacement, 30-day terminal-record pruning, and restart suppression for interrupted `running` attempts.
- Added explicit renderer controls. Automatic recovery defaults to off, reports CLI availability, shows recovery state on session rows, and supports manual retry for detected or exhausted failures.
- Added IPC and preload boundaries for recovery settings and manual retry.
- Added the new main-process modules to protected portable builds.
- Added Node test coverage and included it in `npm run check`.

### Review Adjustments

- Replaced the original absolute external-concurrency claim with a documented best-effort contract because Airbar does not own an authoritative Codex session lock.
- Defined recovery success as exit code zero plus an error-free terminal turn event; spawn success alone is insufficient.
- Defined the persistence owner, identity, atomic write behavior, schema version, and retention policy.
- Kept retry attempts in one recovery chain when a continuation turn receives another recoverable stream failure with a new turn id.
- Prevented first-time enablement from resuming historical failures by limiting automatic eligibility to 15 minutes.

### Validation

- `npm run check` passed with 13 tests plus the live status-reader smoke check.
- `npm run build:renderer` passed.
- `npm run protect:main` passed and protected all five Electron core modules.
- A real Electron startup probe resolved `C:\nvm4w\nodejs\codex.cmd`, reported `codex-cli 0.145.0`, initialized recovery with `enabled: false`, and produced no startup errors.
- A historical stream failure was observed and correctly changed to `cancelled` instead of being automatically resumed.
- No live session was sent a continuation prompt during validation. This avoids modifying user work; the same-session visual confirmation remains a deliberate manual test when the user enables the feature or approves a disposable live session.

## Context Delta

### Keep

- `src/status-reader.js` remains the read-only owner of Codex local file parsing and derived session observations.
- Codex-owned JSONL files are never an Airbar write interface.
- Non-interactive session continuation uses the documented Codex CLI entry point.

### Changed

- Error-bearing `task_complete` events now expose structured failure metadata and can enter Airbar-owned recovery state.
- Standalone CLI discovery and validation are explicit prerequisites for automatic recovery.
- Automatic recovery is an opt-in Electron main-process service and defaults to off.
- Historical failures older than 15 minutes are never resumed automatically.

### Avoid

- Avoid broad automatic retries based only on inactivity.
- Avoid treating every `codex_error_info: other` value as recoverable.
- Treat structured `server_overloaded` model-capacity failures as recoverable with a longer grace period and retry backoff than stream interruptions.
- Avoid coupling process orchestration directly into the read-only status reader.

### Follow-up

- Evaluate Codex app-server as a later integration if CLI-per-turn process spawning becomes limiting.
- Perform the optional same-session live confirmation only with a disposable failure or explicit user approval.

## Final Result

Airbar can now detect the selected structured stream-disconnection failure and, when explicitly enabled, continue the same recent Codex session through the installed standalone CLI with bounded retries, persisted deduplication, and conservative concurrency checks. The feature remains read-only toward Codex-owned session files and defaults to off.

## Links

- `src/status-reader.js`
- `src/main.js`
- `src/preload.js`
- `src/renderer/src/App.tsx`
- `src/codex-cli.js`
- `src/session-recovery.js`
- `test/`
- `doc/architecture/ARCHITECTURE_OVERVIEW.md`
- `doc/ai/decisions/ADR-0001_read-only-local-codex-state.md`
