# Decision

## Context

Codex Airbar needs to monitor Codex sessions across projects. Local Codex state files are available under `%USERPROFILE%\.codex`, but they are owned by Codex itself.

## Decision

Codex Airbar will read local Codex state in read-only mode for the MVP.

## Reason

Read-only monitoring provides value while minimizing risk to Codex sessions and avoiding dependence on private write behavior.

## Consequences

- Status is derived rather than authoritative.
- Future control features must be designed explicitly and should not be mixed into the monitor reader.
- File parsing assumptions should remain centralized in `src/status-reader.js`.
