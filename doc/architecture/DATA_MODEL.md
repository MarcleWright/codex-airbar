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
- `repositoryWorkspace`: canonical main repository workspace shared by linked Git worktrees.
- `isWorktree` and `worktreeBranch`: identify sessions running from a linked worktree without replacing their actionable `workspace` path.

Current limitation:

- The snapshot does not expose a conversation-kind field because `session_index.jsonl` contains title/index data but no kind, and the current collector only ingests rollout-backed local Codex sessions.
- `Projectless` is a workspace-attribution result and must never be treated as a proxy for ordinary ChatGPT chat.

Future source expansion must add an explicit `kind` such as `codex`, `chat`, or `unknown` before applying lifecycle rules. `codex` can use task-oriented `working` / `done` / `idle`; `chat` requires response-oriented activity states; `unknown` must not emit completion notifications or enter automatic recovery.

## Relationships

- One project contains many sessions.
- A main Git worktree and each linked worktree remain separate Airbar projects keyed by their concrete workspace paths.
- Shared Git common-directory metadata records their repository relationship without merging their project cards.
- Desktop `local-projects` and `thread-project-assignments` provide the user-visible worktree project name when available.
- One session is associated with one workspace for display purposes.
- Multiple rollout files can exist over time; the MVP treats recent rollout files as sessions by parsed thread id.

## Important Constraints

- Local Codex state is an external source of truth and may change while being read.
- Partial JSONL lines must be ignored safely.
- Status is inferred, not authoritative.
- Status semantics are valid only for the conversation kind and source that produced the evidence.
- The app must not mutate Codex state files.

## Source Of Truth

Primary local sources:

- `%USERPROFILE%\.codex\session_index.jsonl`
- `%USERPROFILE%\.codex\.codex-global-state.json`
- `%USERPROFILE%\.codex\sessions\**\*.jsonl`
- `%USERPROFILE%\.codex\process_manager\chat_processes.json`
