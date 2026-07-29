# Decision

## Context

Codex is now a dedicated experience inside the unified ChatGPT desktop application. The desktop UI can surface Chat, Work, Codex, and recent conversations in one shell, but those surfaces do not share one completion meaning.

Airbar currently reads `%USERPROFILE%\.codex\sessions\**\*.jsonl` and `session_index.jsonl`. Local inspection found that the title index exposes only `id`, `thread_name`, and `updated_at`; it does not expose conversation kind. The rollout files observed on this machine identify Codex Desktop sessions, while the current Airbar source does not expose ordinary ChatGPT Recent conversations.

For a Codex task, a terminal agent turn can reasonably produce a derived `done` state. For a normal chat, an assistant response may finish while the conversation remains open, so conversation-level `done` is misleading.

## Decision

- Airbar's current monitored-session contract covers rollout-backed local Codex threads only.
- `done`, completion notifications, and automatic recovery apply only to sessions with supported Codex provenance and structured terminal-turn evidence.
- `Projectless`, title text, message text, and inactivity are not conversation-kind classifiers.
- Ordinary ChatGPT Chat/Work conversations are outside the current monitoring contract.
- Any future multi-source model must introduce an authoritative `kind` before status inference: `codex`, `chat`, or `unknown`.
- Future `chat` lifecycle should describe response activity such as `responding`, `waiting`, or `idle`; it must not inherit Codex task `done` semantics.
- `unknown` must be conservative and ineligible for done notifications or automatic recovery.

## Reason

This keeps Airbar's claims aligned with the evidence it can actually read. It prevents ordinary conversations from appearing as completed engineering tasks and prevents unsafe CLI continuation against an unclassified thread.

## Consequences

- The product definition is narrower than the unified desktop application's Recent surface.
- A projectless Codex task remains supported and is not reclassified as ordinary chat.
- Supporting ChatGPT Recent later requires a documented source/API, kind mapping, lifecycle mapping, privacy review, and separate acceptance criteria.
- UI grouping may eventually separate Codex Tasks, Chats, and Unknown instead of mixing them under project status counts.

## Evidence

- Official [ChatGPT surface guidance](https://learn.chatgpt.com/docs/use-chatgpt#compare-chatgpt-work-and-codex-on-desktop) states that Chat, Work, and Codex are distinct working modes and that Codex focuses on developer chats and projects.
- Official [desktop changelog guidance](https://learn.chatgpt.com/docs/changelog#codex-2026-07-09-app) records the Codex merge into the ChatGPT desktop application while retaining a dedicated Codex experience.
- Current local `session_index.jsonl` rows contain no kind field.
- Current local rollout metadata is consistently identified as Codex Desktop data.
- The current callable desktop thread inventory marks the locally observed rollout-backed entries as `kind=codex`; Airbar does not currently consume that inventory as an integration API.
