# Data Model

## Overview

The app does not own a persistent database. It builds an in-memory snapshot from local Codex files on each poll.

## Core Entities

### Snapshot

- `generatedAt`: ISO timestamp for the snapshot.
- `codexHome`: resolved local Codex home path.
- `projects`: grouped project list.
- `error`: optional snapshot error.

### Project

- `workspace`: workspace path or `Projectless`.
- `name`: display name derived from the workspace path.
- `sessions`: recent sessions associated with the workspace.
- `counts`: status counts for sessions in the project.

### Session

- `id`: Codex thread/conversation id.
- `title`: latest known thread name from `session_index.jsonl`, or fallback text.
- `status`: `working`, `done`, `recent`, or `idle`.
- `updatedAt`: timestamp derived from the rollout file modified time.
- `workspace`: project/workspace path.
- `file`: rollout `.jsonl` source file.
- `lastType`: latest known event payload/type.
- `lastMessage`: short extracted event message when available.
- `recentCommands`: recent process-manager commands associated with the session.

## Relationships

- One project contains many sessions.
- One session is associated with one workspace for display purposes.
- Multiple rollout files can exist over time; the MVP treats recent rollout files as sessions by parsed thread id.

## Important Constraints

- Local Codex state is an external source of truth and may change while being read.
- Partial JSONL lines must be ignored safely.
- Status is inferred, not authoritative.
- The app must not mutate Codex state files.

## Source Of Truth

Primary local sources:

- `%USERPROFILE%\.codex\session_index.jsonl`
- `%USERPROFILE%\.codex\.codex-global-state.json`
- `%USERPROFILE%\.codex\sessions\**\*.jsonl`
- `%USERPROFILE%\.codex\process_manager\chat_processes.json`
