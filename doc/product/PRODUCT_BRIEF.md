# Product Brief

## Purpose

Codex Airbar is a small always-on-top companion for monitoring local Codex execution work inside the unified ChatGPT desktop application.

Airbar monitors rollout-backed Codex threads. It is not a general monitor for every conversation shown in the desktop application's Recent area.

## Target Users

- A user running multiple Codex tasks across several local projects.
- A user who wants a quick supervisor view without switching back into the ChatGPT desktop application's Codex view.

## Core Value

- Show which local Codex tasks appear to be working, done, failed, recovering, or idle.
- Group sessions by project/workspace so concurrent work is easier to scan.
- Notify the user when a supported Codex task appears to finish or needs attention.
- Optionally recover selected recent transport interruptions through the installed Codex CLI.

## Supported Conversation Boundary

- A rollout-backed local Codex thread is a supported monitored session.
- A projectless thread can still be a Codex thread; `Projectless` describes workspace attribution, not conversation kind.
- A normal ChatGPT Chat or Work conversation surfaced in Recent is outside the current monitoring contract unless a future integration provides an authoritative kind and lifecycle signal.
- Airbar must not classify a conversation from its title, message text, or lack of workspace alone.

## Lifecycle Semantics

- Codex task lifecycle uses `working`, `done`, and `idle`, with failure and recovery details layered on top. These states are derived from local rollout events and process evidence.
- `done` means a supported Codex agent turn reached a completion-like terminal signal. It does not mean the conversation can no longer receive messages.
- A normal ChatGPT conversation does not have the same task-completion contract. If supported later, it should use chat-oriented activity such as `responding`, `waiting`, and `idle` rather than inheriting Codex `done` semantics.
- An unknown conversation kind must remain conservative: no done notification and no automatic recovery.

## Core Workflows

- Start Codex Airbar by double-clicking `start-codex-airbar.bat` or running `npm start`.
- Keep the floating window visible while Codex works in other windows.
- Scan project groups, hide or reveal idle sessions, and use status signals to judge whether work needs attention.
- Enable automatic recovery explicitly when the standalone Codex CLI is available.

## Non-goals

- Do not write to Codex local state.
- Do not replace the ChatGPT desktop application's Chat, Work, Codex, or Recent interfaces.
- Do not depend on remote services for status monitoring.
- Do not claim coverage for ordinary ChatGPT Recent conversations without a supported data source and lifecycle contract.

## Key Domain Concepts

- Project: a local workspace path associated with one or more Codex threads.
- Monitored session: a rollout-backed local Codex thread identified by a conversation/thread id.
- Conversation kind: the product category that owns lifecycle semantics, currently `codex`; future values may include `chat` and `unknown` only after a reliable source exists.
- Status: a kind-specific derived activity state based on local files, structured events, and process activity.
