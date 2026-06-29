const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = path.join(__dirname, "..");
const electronBinary = require("electron");

const child = spawn(electronBinary, ["."], {
  cwd: rootDir,
  detached: true,
  stdio: "ignore",
  windowsHide: true
});

child.unref();
