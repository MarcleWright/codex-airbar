const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MAX_CAPTURE_BYTES = 256 * 1024;
const TRANSPORT_ERROR_PATTERN = /stream disconnected before completion:\s*error sending request for url/i;

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function isRecoverableTransportError(message) {
  return typeof message === "string" && TRANSPORT_ERROR_PATTERN.test(message);
}

function commandSpecForCandidate(candidate) {
  if (!candidate || !safeStat(candidate)?.isFile()) return null;
  const extension = path.extname(candidate).toLowerCase();
  if (extension === ".exe" || process.platform !== "win32") {
    return { command: candidate, prefixArgs: [], displayPath: candidate };
  }
  if (extension !== ".cmd" && extension !== ".bat") return null;

  const binDir = path.dirname(candidate);
  const nodePath = path.join(binDir, "node.exe");
  const codexScript = path.join(binDir, "node_modules", "@openai", "codex", "bin", "codex.js");
  if (!safeStat(nodePath)?.isFile() || !safeStat(codexScript)?.isFile()) return null;
  return {
    command: nodePath,
    prefixArgs: [codexScript],
    displayPath: candidate
  };
}

function resolveCodexCommand(options = {}) {
  const explicitPath = options.explicitPath || process.env.CODEX_AIRBAR_CODEX_PATH;
  if (explicitPath) {
    return commandSpecForCandidate(path.resolve(explicitPath));
  }

  const pathEntries = String(options.pathValue ?? process.env.PATH ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  const names = process.platform === "win32" ? ["codex.cmd", "codex.exe"] : ["codex"];
  for (const entry of pathEntries) {
    if (/\\WindowsApps(?:\\|$)/i.test(entry)) continue;
    for (const name of names) {
      const spec = commandSpecForCandidate(path.join(entry, name));
      if (spec) return spec;
    }
  }
  return null;
}

function appendBounded(current, chunk) {
  const next = current + chunk.toString("utf8");
  return next.length <= MAX_CAPTURE_BYTES ? next : next.slice(next.length - MAX_CAPTURE_BYTES);
}

function runCommand(spec, args, options = {}) {
  return new Promise((resolve) => {
    if (!spec) {
      resolve({ ok: false, exitCode: null, stdout: "", stderr: "Codex CLI was not found.", spawnError: true });
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const child = spawn(spec.command, [...spec.prefixArgs, ...args], {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs || 30 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: false, exitCode: null, stdout, stderr: error.message, spawnError: true, timedOut });
    });
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ok: exitCode === 0, exitCode, signal, stdout, stderr, spawnError: false, timedOut });
    });
  });
}

function parseJsonEvents(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function eventError(event) {
  const type = event?.type || event?.payload?.type;
  return event?.error?.message || event?.payload?.error?.message || event?.turn?.error?.message || (type === "error" ? event?.message || event?.payload?.message : null) || null;
}

function isTerminalTurnEvent(event) {
  const type = event?.type || event?.payload?.type;
  return type === "turn.completed" || type === "turn_completed" || type === "turn.failed" || type === "turn_failed" || type === "task_complete";
}

function interpretExecResult(result) {
  const events = parseJsonEvents(result.stdout);
  const terminalEvents = events.filter(isTerminalTurnEvent);
  const errors = events.map(eventError).filter(Boolean);
  if (result.stderr) errors.push(result.stderr.trim());
  const terminal = terminalEvents.at(-1);
  const terminalError = eventError(terminal);
  const message = terminalError || errors.at(-1) || (result.timedOut ? "Codex CLI recovery timed out." : result.exitCode === 0 ? "Codex CLI exited without a terminal turn event." : `Codex CLI exited with code ${result.exitCode}.`);
  const recovered = result.exitCode === 0 && Boolean(terminal) && !terminalError;
  return {
    recovered,
    retryable: result.spawnError || result.timedOut || isRecoverableTransportError(message),
    message,
    exitCode: result.exitCode,
    terminalEvent: terminal || null
  };
}

async function probeCodexCommand(spec) {
  if (!spec) return { available: false, path: null, version: null, error: "Standalone Codex CLI was not found." };
  const versionResult = await runCommand(spec, ["--version"], { timeoutMs: 10000 });
  if (!versionResult.ok) {
    return { available: false, path: spec.displayPath, version: null, error: versionResult.stderr || "Codex CLI version probe failed." };
  }
  const helpResult = await runCommand(spec, ["exec", "resume", "--help"], { timeoutMs: 10000 });
  const supported = helpResult.ok && /Resume a previous session/i.test(helpResult.stdout);
  return {
    available: supported,
    path: spec.displayPath,
    version: versionResult.stdout.trim(),
    error: supported ? null : helpResult.stderr || "This Codex CLI does not support exec resume."
  };
}

async function resumeSession(spec, session, prompt) {
  const cwd = session.workspace && session.workspace !== "Projectless" ? session.workspace : undefined;
  const result = await runCommand(spec, ["exec", "resume", session.id, prompt, "--json"], { cwd });
  return interpretExecResult(result);
}

module.exports = {
  commandSpecForCandidate,
  interpretExecResult,
  isRecoverableTransportError,
  parseJsonEvents,
  probeCodexCommand,
  resolveCodexCommand,
  resumeSession,
  runCommand
};
