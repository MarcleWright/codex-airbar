# UI Guide

## Main Screens Or Workspaces

Codex Airbar currently has one floating monitor window.

## Layout Structure

- Title bar: app name, status summary, refresh/log/minimize/close controls.
- Status strip: counts for `working`, `done`, `recent`, and `idle`.
- Toolbar: status filter.
- Project list: project cards grouped by workspace.
- Project header: title, collapse controls, Explorer button, and visible session count.
- Session rows: status dot, title, badge, updated time, id prefix, last event type, short message, and a Codex `Open` action.

## Key Visible Behaviors

- Window is frameless and always on top.
- Title region is draggable.
- Project and session text truncates to avoid layout overflow.
- Filtering updates the current list without changing underlying data.
- Notifications are sent when a session changes from `working` to `done`.
- The title bar includes a theme toggle for light/dark mode.
- UI primitives follow a shadcn-style source-owned pattern and consume shared theme tokens.
- Project cards support two compacting modes:
- `hide-idle`: hide idle sessions but keep active and recent ones visible.
- `collapsed`: collapse the whole project and leave only the header row visible.
- Project compacting modes persist in `localStorage`.
- Project headers expose a folder button that opens the project workspace in Explorer.
- Header and row icon buttons avoid visible border chrome unless a state needs emphasis.

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
