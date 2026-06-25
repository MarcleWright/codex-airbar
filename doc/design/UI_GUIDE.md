# UI Guide

## Main Screens Or Workspaces

Codex Airbar currently has one floating monitor window.

## Layout Structure

- Title bar: app name, status summary, refresh/log/minimize/close controls.
- Status strip: counts for `working`, `done`, `recent`, and `idle`.
- Toolbar: text filter and status filter.
- Project list: project cards grouped by workspace.
- Session rows: status dot, title, badge, updated time, id prefix, last event type, and short message.

## Key Visible Behaviors

- Window is frameless and always on top.
- Title region is draggable.
- Project and session text truncates to avoid layout overflow.
- Filtering updates the current list without changing underlying data.
- Notifications are sent when a session changes from `working` to `done`.

## Important UI States

- Loading: initial summary shows that local sessions are being read.
- Normal: project cards and session rows are visible.
- Empty: no matching sessions or no local Codex sessions found.
- Error: snapshot errors appear in an error box while the app remains open.
