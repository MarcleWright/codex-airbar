# Development Setup

## Prerequisites

- Windows.
- Node.js and npm available on `PATH`.
- Local Codex state under `%USERPROFILE%\.codex`.

## Install

```powershell
npm install
```

## Run

```powershell
npm start
```

Alternative Windows launcher:

```powershell
.\start-codex-airbar.bat
```

The launcher checks whether npm is available and whether Electron is installed. If Electron is missing, it runs `npm install`.

## Common Troubleshooting

### Electron failed to install correctly

This can happen when `npm install` times out while downloading Electron. Stop leftover `npm` or `node install.js` processes, remove `node_modules\electron`, then reinstall.

```powershell
Remove-Item -LiteralPath .\node_modules\electron -Recurse -Force
npm install electron@31.7.7 --save-dev
```

### App closes too quickly

Use `start-codex-airbar.bat` so the terminal pauses on startup failure.

### Logs

Electron app log:

```text
%APPDATA%\codex-airbar\codex-airbar.log
```
