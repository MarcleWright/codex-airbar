# UI Guide

## Main Screens Or Workspaces

Codex Airbar currently has one floating monitor window.

## Layout Structure

- Title bar: app name, always-on-top toggle, theme toggle, refresh, magnet snap, log, minimize, and close controls.
- Project list: project cards grouped by workspace.
- Project header: title, independent collapse and idle-visibility controls, collapsed-state working/done count capsules, and Explorer button.
- Session rows: vertical status bar, title, elapsed time, inline context snippet, and an icon-only Codex action.

## Key Visible Behaviors

- Window is frameless and always on top.
- Title region is draggable.
- Project and session text truncates to avoid layout overflow.
- Notifications are sent when a session changes from `working` to `done`.
- The title bar includes a theme toggle for light/dark mode.
- UI primitives follow a shadcn-style source-owned pattern and consume shared theme tokens.
- Project cards support two independent compacting controls:
- `hideIdle`: hide idle sessions while keeping non-idle sessions visible.
- `collapsed`: collapse the whole project and leave only the header row visible.
- Project compacting state persists in `localStorage`.
- Idle sessions are hidden by default until the user enables them for a specific project.
- Project headers expose a folder button that opens the project workspace in Explorer.
- Project visibility uses paired `EyeOff` / `Eye` icons instead of color-only state.
- Buttons stay visually transparent by default and use pressed-state color only as click feedback.
- Pin and magnet controls use filled icons to indicate active state.
- Status colors use violet for `working`, Codex-style blue for `done`, and muted gray for `idle`.
- Scrollbars and future range inputs use slim custom styling so the UI reads as a compact utility rather than a stock system panel.

## Important UI States

- Loading: initial summary shows that local sessions are being read.
- Normal: project cards and session rows are visible.
- Empty: no local Codex sessions found.
- Error: snapshot errors appear in an error box while the app remains open.

## Theme Foundation

- Theme colors are defined as CSS variables in `src/renderer/src/styles.css`.
- `.light` and `.dark` classes on `document.documentElement` select the active theme.
- `ThemeProvider` stores the selected theme in `localStorage`.
- Components should use semantic tokens such as `background`, `foreground`, `card`, `border`, `muted`, and `primary` instead of hard-coded app colors.
