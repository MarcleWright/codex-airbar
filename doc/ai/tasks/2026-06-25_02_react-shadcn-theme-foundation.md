# Task

## ID

2026-06-25_02

## Title

React Shadcn Theme Foundation

## Status

Done

## Goal

Prepare Codex Airbar for shadcn/ui-style components and one-click light/dark theme switching without changing the core monitoring behavior.

## Scope

- Migrate renderer from static HTML/CSS/JS to Vite + React.
- Add Tailwind and `components.json`.
- Add shadcn-style local UI primitives for current controls.
- Add CSS variable theme tokens and a theme provider.
- Add a visible light/dark toggle.
- Keep Electron main process IPC, status-reader behavior, notifications, and `.bat` launcher intact.

## Non-goals

- Add the full shadcn/ui component catalog.
- Redesign the product workflow.
- Change Codex status inference.
- Package the app as an installer.

## Plan

- Install React, Vite, Tailwind, lucide icons, and utility dependencies.
- Configure Vite to build the renderer into `dist/renderer`.
- Update Electron to load the Vite dev server when configured or built renderer output otherwise.
- Rebuild the existing UI as React components.
- Add theme provider and semantic CSS tokens.
- Validate renderer build, status-reader check, and Electron startup.

## Acceptance Criteria

- `npm run build:renderer` succeeds.
- `npm run check` succeeds.
- `npm start` launches Electron using the built renderer.
- User can toggle light/dark theme from the title bar.
- Existing session list, filters, status counts, notifications, and log/minimize/close controls remain present.

## Execution Report

### Implementation Contributor(s)

- Codex implementation agent.

### Implementation Notes

- Added `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, and `components.json`.
- Added React renderer under `src/renderer/src/`.
- Added `ThemeProvider`, `cn`, and local UI primitives for button, input, select, card, and badge.
- Updated `src/main.js` to load Vite dev URL when `VITE_DEV_SERVER_URL` is set and built renderer output otherwise.
- Updated documentation across architecture, design, engineering, AI context, and dev log.

### Validation

- `npm run build:renderer` succeeded.
- `npm run check` succeeded.
- `npm start` launched Electron successfully.
- App log showed `App ready` and no renderer load failure.

### Planner/Reviewer Follow-up Fixes

None.

## Reviewer Notes

- The foundation is shadcn-style and shadcn-compatible, but only current-needed primitives were added.
- Future official shadcn component additions should keep source-owned components under `src/renderer/src/components/ui/` or update aliases intentionally.

## Context Delta

### Keep

- Renderer is now Vite + React + Tailwind.
- Theme is controlled by CSS variables and the root `.light` / `.dark` class.
- Existing monitoring behavior should remain decoupled from UI component migration.

### Changed

- `npm start` now builds the renderer before launching Electron.
- Renderer source now lives under `src/renderer/src/`.

### Avoid

- Avoid hard-coded colors in new components when semantic theme tokens exist.
- Avoid adding a large UI framework runtime; prefer source-owned shadcn-style primitives.

### Follow-up

- Add more official shadcn components only as needed.
- Add compact mode after the theme foundation stabilizes.
- Consider a richer settings menu for theme, polling interval, and notifications.

## Final Result

Codex Airbar now has a React/Vite renderer, Tailwind/shadcn-style component foundation, and light/dark theme switching.

## Links

- `src/renderer/src/App.tsx`
- `src/renderer/src/theme-provider.tsx`
- `src/renderer/src/styles.css`
- `components.json`
