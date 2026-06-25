# Testing

## Test Types

- Status-reader smoke test.
- Electron startup test.
- Manual UI verification.
- Dependency/audit check.

## Automated Checks

```powershell
npm run check
```

Expected result:

- Prints JSON with `generatedAt`, `codexHome`, `projectCount`, and `sessionCount`.
- `error` should be `null` when local Codex state is readable.

Dependency audit for runtime dependencies:

```powershell
npm audit --omit=dev
```

## Manual Verification

- Run `npm start`.
- Confirm the floating window opens and stays on top.
- Confirm projects and sessions appear.
- Try text filtering and status filtering.
- Confirm the log button opens the app log.
- Confirm `start-codex-airbar.bat` starts the app from Explorer.

## Release Validation

Before a packaged release exists, release validation means:

- Fresh `npm install` works.
- `npm run check` works.
- `npm start` works.
- `.bat` launcher works.
