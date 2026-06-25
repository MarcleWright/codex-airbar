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

function workspaceForThread(threadId, globalState, processInfo) {
  const rootHints = globalState?.["thread-workspace-root-hints"] || {};
  if (rootHints[threadId]) return rootHints[threadId];

  const permissions = globalState?.["electron-persisted-atom-state"]?.["heartbeat-thread-permissions-by-id"] || {};
  const writableRoots = permissions?.[threadId]?.sandboxPolicy?.writableRoots;
  if (Array.isArray(writableRoots) && writableRoots[0]) return writableRoots[0];

  const cwd = processInfo?.recentCommands?.find((row) => row.cwd)?.cwd;
  if (cwd) return cwd;

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
    const workspace = workspaceForThread(threadId, globalState, processInfo);
    const projectName = workspace === "Projectless" ? "Projectless" : path.basename(workspace);
    const eventSummary = summarizeLastEvents(file.path);
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
