const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const CODEX_HOME = path.join(os.homedir(), ".codex");
const ACTIVE_WINDOW_MS = 90 * 1000;
const RECENT_WINDOW_MS = 8 * 60 * 1000;
const MAX_SESSION_FILES = 120;

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function normalizeCandidatePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") return "";
  return filePath.replace(/\//g, path.sep).trim();
}

function findWorkspaceRoot(filePath) {
  const normalized = normalizeCandidatePath(filePath);
  if (!normalized) return "";

  const stat = safeStat(normalized);
  let current = stat?.isDirectory() ? normalized : path.dirname(normalized);
  if (!current || !safeStat(current)?.isDirectory()) return "";

  let codexProjectsRoot = "";
  let codexProjectsChild = "";
  while (true) {
    if (safeStat(path.join(current, ".git"))) return current;

    const parent = path.dirname(current);
    if (path.basename(current) === "Codex_Projects" && parent !== current) {
      codexProjectsRoot = current;
      codexProjectsChild = path.basename(stat?.isDirectory() ? normalized : path.dirname(normalized));
    }

    if (parent === current) break;
    current = parent;
  }

  if (codexProjectsRoot) {
    const relative = path.relative(codexProjectsRoot, stat?.isDirectory() ? normalized : path.dirname(normalized));
    const [firstSegment] = relative.split(/[\\/]/).filter(Boolean);
    if (firstSegment) {
      const candidate = path.join(codexProjectsRoot, firstSegment);
      if (safeStat(candidate)?.isDirectory()) {
        return candidate;
      }
    }
  }

  return "";
}

function readSessionIndex() {
  const indexPath = path.join(CODEX_HOME, "session_index.jsonl");
  try {
    const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/).filter(Boolean);
    const byId = new Map();
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (!row.id) continue;
        byId.set(row.id, { ...byId.get(row.id), ...row });
      } catch {
        // Ignore malformed partial lines while Codex is writing.
      }
    }
    return byId;
  } catch {
    return new Map();
  }
}

function collectSessionFiles(root) {
  const files = [];
  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const stat = safeStat(fullPath);
        if (stat) files.push({ path: fullPath, mtimeMs: stat.mtimeMs, size: stat.size });
      }
    }
  }
  walk(root);
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_SESSION_FILES);
}

function parseThreadIdFromFile(filePath) {
  const base = path.basename(filePath, ".jsonl");
  const match = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match ? match[1] : base;
}

function readTailLines(filePath, maxBytes = 65536) {
  const stat = safeStat(filePath);
  if (!stat) return [];
  const fd = fs.openSync(filePath, "r");
  try {
    const length = Math.min(maxBytes, stat.size);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, Math.max(0, stat.size - length));
    return buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
  } finally {
    fs.closeSync(fd);
  }
}

function summarizeLastEvents(filePath) {
  const lines = readTailLines(filePath);
  const events = [];
  for (const line of lines.slice(-40)) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // Ignore partial writes.
    }
  }

  const last = events.at(-1) || null;
  const lastAgentMessage = [...events].reverse().find((event) => {
    return event?.payload?.type === "agent_message" || event?.type === "response_item";
  });
  const hasFunctionCall = events.some((event) => {
    const payloadType = event?.payload?.type;
    return payloadType === "function_call" || payloadType === "custom_tool_call";
  });
  const hasFunctionOutput = events.some((event) => {
    const payloadType = event?.payload?.type;
    return payloadType === "function_call_output" || payloadType === "custom_tool_call_output";
  });

  return {
    lastType: last?.type || last?.payload?.type || "unknown",
    lastPayloadType: last?.payload?.type || null,
    lastMessage: extractShortMessage(lastAgentMessage),
    lastCwd: extractLastCwd(events),
    hasFunctionCall,
    hasFunctionOutput
  };
}

function extractShortMessage(event) {
  const payload = event?.payload;
  const direct = payload?.message;
  if (typeof direct === "string") return trimText(direct);
  const content = payload?.content;
  if (Array.isArray(content)) {
    const text = content.map((part) => part.text || part.output_text || "").join(" ").trim();
    return trimText(text);
  }
  return "";
}

function trimText(text) {
  return text.replace(/\s+/g, " ").slice(0, 160);
}

function inferWorkspaceFromText(text) {
  if (typeof text !== "string" || text.trim() === "") return "";

  const candidates = [];
  const markdownPathPattern = /\((([A-Za-z]:[\\/][^)\r\n]+))\)/g;
  const windowsPathPattern = /([A-Za-z]:[\\/][^\s<>"`|]+(?:\s+[^\s<>"`|]+)*)/g;

  for (const match of text.matchAll(markdownPathPattern)) {
    candidates.push(match[1]);
  }
  for (const match of text.matchAll(windowsPathPattern)) {
    candidates.push(match[1]);
  }

  for (const candidate of candidates) {
    const workspace = findWorkspaceRoot(candidate);
    if (workspace) {
      return workspace;
    }
  }

  return "";
}

function tokenizeCommand(command) {
  if (typeof command !== "string" || command.trim() === "") return [];
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) => {
    if (
      (part.startsWith('"') && part.endsWith('"')) ||
      (part.startsWith("'") && part.endsWith("'"))
    ) {
      return part.slice(1, -1);
    }
    return part;
  });
}

function parseWorkspaceFromCommand(command) {
  const tokens = tokenizeCommand(command);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "-C" || token === "--cd") {
      const next = tokens[index + 1];
      if (typeof next === "string" && next.trim() !== "") {
        return next;
      }
    }
    if (token.startsWith("-C=") || token.startsWith("--cd=")) {
      const [, value = ""] = token.split(/=(.*)/s);
      if (value.trim() !== "") {
        return value;
      }
    }
  }
  return "";
}

function extractLastCwd(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (typeof event?.cwd === "string" && event.cwd.trim() !== "") {
      return event.cwd;
    }
    const payload = event?.payload;
    if (typeof payload?.cwd === "string" && payload.cwd.trim() !== "") {
      return payload.cwd;
    }
  }
  return "";
}

function extractCommandWorkspace(processInfo) {
  const commands = processInfo?.recentCommands || [];
  for (const row of commands) {
    const workspace = parseWorkspaceFromCommand(row.command);
    if (workspace) {
      return workspace;
    }
  }
  return "";
}

function readProcessManager() {
  const processPath = path.join(CODEX_HOME, "process_manager", "chat_processes.json");
  const rows = safeReadJson(processPath, []);
  const now = Date.now();
  const byThread = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row.conversationId) continue;
    const ageMs = now - Number(row.updatedAtMs || row.startedAtMs || 0);
    const active = ageMs >= 0 && ageMs < RECENT_WINDOW_MS;
    const existing = byThread.get(row.conversationId) || { recentCommands: [], hasRecentProcess: false };
    existing.recentCommands.push({
      command: row.command || "",
      cwd: row.cwd || "",
      updatedAtMs: row.updatedAtMs || row.startedAtMs || null,
      osPid: row.osPid || null
    });
    existing.hasRecentProcess = existing.hasRecentProcess || active;
    byThread.set(row.conversationId, existing);
  }
  return byThread;
}

function readGlobalState() {
  return safeReadJson(path.join(CODEX_HOME, ".codex-global-state.json"), {});
}

function workspaceForThread(threadId, globalState, processInfo, eventSummary) {
  const rootHints = globalState?.["thread-workspace-root-hints"] || {};
  if (rootHints[threadId]) return rootHints[threadId];

  const permissions = globalState?.["electron-persisted-atom-state"]?.["heartbeat-thread-permissions-by-id"] || {};
  const writableRoots = permissions?.[threadId]?.sandboxPolicy?.writableRoots;
  if (Array.isArray(writableRoots) && writableRoots[0]) return writableRoots[0];

  const cwd = processInfo?.recentCommands?.find((row) => row.cwd)?.cwd;
  if (cwd) return cwd;

  if (eventSummary?.lastCwd) return eventSummary.lastCwd;

  const commandWorkspace = extractCommandWorkspace(processInfo);
  if (commandWorkspace) return commandWorkspace;

  const messageWorkspace = inferWorkspaceFromText(eventSummary?.lastMessage);
  if (messageWorkspace) return messageWorkspace;

  return "Projectless";
}

function statusForSession(file, eventSummary, processInfo) {
  const now = Date.now();
  const ageMs = now - file.mtimeMs;
  if (processInfo?.hasRecentProcess || ageMs < ACTIVE_WINDOW_MS) return "working";
  if (ageMs < RECENT_WINDOW_MS && eventSummary.hasFunctionOutput) return "done";
  if (ageMs < RECENT_WINDOW_MS) return "recent";
  return "idle";
}

function readCodexSnapshot() {
  const codexHomeStat = safeStat(CODEX_HOME);
  if (!codexHomeStat) {
    return {
      generatedAt: new Date().toISOString(),
      codexHome: CODEX_HOME,
      error: "Codex home was not found.",
      projects: []
    };
  }

  const globalState = readGlobalState();
  const sessionIndex = readSessionIndex();
  const processes = readProcessManager();
  const sessionRoot = path.join(CODEX_HOME, "sessions");
  const files = collectSessionFiles(sessionRoot);
  const projects = new Map();

  for (const file of files) {
    const threadId = parseThreadIdFromFile(file.path);
    const index = sessionIndex.get(threadId) || {};
    const processInfo = processes.get(threadId) || null;
    const eventSummary = summarizeLastEvents(file.path);
    const workspace = workspaceForThread(threadId, globalState, processInfo, eventSummary);
    const projectName = workspace === "Projectless" ? "Projectless" : path.basename(workspace);
    const status = statusForSession(file, eventSummary, processInfo);
    const session = {
      id: threadId,
      title: index.thread_name || "Untitled session",
      status,
      updatedAt: new Date(file.mtimeMs).toISOString(),
      workspace,
      file: file.path,
      lastType: eventSummary.lastPayloadType || eventSummary.lastType,
      lastMessage: eventSummary.lastMessage,
      recentCommands: (processInfo?.recentCommands || []).slice(0, 3)
    };

    if (!projects.has(workspace)) {
      projects.set(workspace, {
        workspace,
        name: projectName,
        sessions: [],
        counts: { working: 0, done: 0, recent: 0, idle: 0 }
      });
    }
    const project = projects.get(workspace);
    project.sessions.push(session);
    project.counts[status] += 1;
  }

  const projectList = Array.from(projects.values())
    .map((project) => ({
      ...project,
      sessions: project.sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    }))
    .sort((a, b) => {
      const aTime = new Date(a.sessions[0]?.updatedAt || 0).getTime();
      const bTime = new Date(b.sessions[0]?.updatedAt || 0).getTime();
      return bTime - aTime;
    });

  return {
    generatedAt: new Date().toISOString(),
    codexHome: CODEX_HOME,
    projects: projectList
  };
}

module.exports = { readCodexSnapshot };
