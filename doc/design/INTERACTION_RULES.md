# Interaction Rules

## Selection Behavior

The MVP has no row selection state. Session rows are informational.

## Create / Edit Flows

The MVP does not create or edit Codex sessions.

## Navigation Behavior

- The session-level `Open` action opens the related workspace in Codex Desktop.
- The action is project-level navigation, not session-level deep-link navigation.
- Sessions without a known workspace disable the `Open` action.

## Delete / Destructive Action Rules

No destructive actions are exposed. The app must not delete, modify, or archive Codex data.

## Drag And Drop Rules

The title area is draggable as a frameless Electron window. The content area is not used for drag and drop.

## Error / Confirmation Behavior

- Snapshot read failures should render inside the window.
- Startup and snapshot errors should be logged to `codex-airbar.log`.
- The `.bat` launcher pauses on dependency install or startup failure so the user can read the error.

## Notification Behavior

- A system notification is sent only when the renderer observes a session transition from `working` to `done`.
- Notifications are best-effort and depend on OS/Electron support.
