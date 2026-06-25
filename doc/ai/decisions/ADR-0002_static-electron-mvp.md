# Decision

## Context

The initial goal is a small floating monitor app, not a large product shell.

## Decision

Use Electron with static HTML, CSS, and JavaScript for the MVP.

## Reason

This keeps startup, debugging, and packaging surface small while the product behavior is still being explored.

## Consequences

- No frontend build step is required.
- Renderer code stays simple but should be kept disciplined as features grow.
- A framework can be introduced later only if UI complexity justifies it.
