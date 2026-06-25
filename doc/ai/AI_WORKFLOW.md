# AI Workflow

## Roles

This project does not require fixed planner/coder/reviewer roles yet. Agents should map responsibilities by behavior:

- Planning work defines task scope, constraints, and acceptance criteria.
- Implementation work changes code and validates behavior.
- Review work checks risks, correctness, documentation impact, and follow-up routing.

## Task Lifecycle

- For substantive changes, create or update one task file under `doc/ai/tasks/`.
- Keep execution details in the task file, not in `DEV_LOG.md`.
- Update stable owner-layer docs only when product, architecture, design, or engineering truth changes.
- Add a `Context Delta` when a task changes durable memory, structure, rules, or follow-up work.

## Documentation Update Rules

- `DEV_LOG.md` is a concise index.
- `AI_CONTEXT.md` is short current handoff context.
- Product behavior goes under `doc/product/`.
- Technical structure and data flow go under `doc/architecture/`.
- UI behavior goes under `doc/design/`.
- Setup, testing, troubleshooting, and release guidance go under `doc/engineering/`.

## Review Rules

- Verify app behavior with `npm run check` for status-reader changes.
- Verify Electron startup manually when main process, preload, renderer, launcher, or dependency behavior changes.
- Do not promote uncertain status-inference assumptions into product requirements as authoritative facts.
