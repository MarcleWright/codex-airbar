# Product Brief

## Purpose

Codex Airbar is a small always-on-top desktop floating window for monitoring local Codex work across projects and sessions.

## Target Users

- A user running multiple Codex sessions across several local projects.
- A user who wants a quick "supervisor" view without switching back into the main Codex window.

## Core Value

- Show which Codex sessions are currently working, recently active, done, or idle.
- Group sessions by project/workspace so concurrent work is easier to scan.
- Notify the user when a monitored session appears to finish.

## Core Workflows

- Start Codex Airbar by double-clicking `start-codex-airbar.bat` or running `npm start`.
- Keep the floating window visible while Codex works in other windows.
- Filter sessions by text or status.
- Use status counts to quickly judge whether any sessions need attention.

## Non-goals

- Do not control Codex sessions directly in the MVP.
- Do not write to Codex local state.
- Do not replace the Codex app's own thread and session UI.
- Do not depend on remote services for status monitoring.

## Key Domain Concepts

- Project: a local workspace path associated with one or more Codex threads.
- Session: a Codex thread or rollout log identified by a conversation/thread id.
- Status: a derived state based on local Codex files and recent process activity.
