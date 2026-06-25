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
- The title bar includes a theme toggle for light/dark mode.
- UI primitives follow a shadcn-style source-owned pattern and consume shared theme tokens.

## Important UI States

- Loading: initial summary shows that local sessions are being read.
- Normal: project cards and session rows are visible.
- Empty: no matching sessions or no local Codex sessions found.
- Error: snapshot errors appear in an error box while the app remains open.

## Theme Foundation

- Theme colors are defined as CSS variables in `src/renderer/src/styles.css`.
- `.light` and `.dark` classes on `document.documentElement` select the active theme.
- `ThemeProvider` stores the selected theme in `localStorage`.
- Components should use semantic tokens such as `background`, `foreground`, `card`, `border`, `muted`, and `primary` instead of hard-coded app colors.
