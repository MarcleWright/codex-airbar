const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  statusForSession,
  summarizeCompletion,
  summarizeLastEvents,
  summarizeProcessRows
} = require("../src/status-reader");

function failedCompletion() {
  return {
    timestamp: "2026-07-28T06:07:16.518Z",
    type: "event_msg",
    payload: {
      type: "task_complete",
      turn_id: "turn-1",
      last_agent_message: null,
      error: {
        message: "stream disconnected before completion: error sending request for url (https://api.openai-hk.com/v1/responses)",
        codex_error_info: "other"
      }
    }
  };
}

test("extracts a stable failed-turn fingerprint", () => {
  const summary = summarizeCompletion([failedCompletion()]);
  assert.equal(summary.turnId, "turn-1");
  assert.equal(summary.error.codexErrorInfo, "other");
  assert.equal(summary.isCurrent, true);
  assert.match(summary.fingerprint, /turn-1/);
});

test("marks completion stale after newer user activity", () => {
  const summary = summarizeCompletion([
    failedCompletion(),
    { type: "event_msg", payload: { type: "user_message", message: "continue" } }
  ]);
  assert.equal(summary.isCurrent, false);
});

test("ignores passive token accounting after completion", () => {
  const summary = summarizeCompletion([
    failedCompletion(),
    { type: "event_msg", payload: { type: "token_count" } }
  ]);
  assert.equal(summary.isCurrent, true);
});

test("marks a rolled-back failed turn as stale", () => {
  const summary = summarizeCompletion([
    failedCompletion(),
    { type: "event_msg", payload: { type: "thread_rolled_back" } }
  ]);
  assert.equal(summary.isCurrent, false);
});

test("finds terminal events before large trailing session metadata", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-airbar-status-"));
  const sessionPath = path.join(tempDir, "rollout.jsonl");
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const events = [
    { type: "event_msg", payload: { type: "agent_message", phase: "final_answer", message: "Done" } },
    { type: "event_msg", payload: { type: "task_complete", turn_id: "turn-large-tail", last_agent_message: "Done" } },
    ...Array.from({ length: 10 }, (_, index) => ({
      type: "session_meta",
      payload: { instructions: String(index).repeat(70 * 1024) }
    }))
  ];
  fs.writeFileSync(sessionPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);

  const summary = summarizeLastEvents(sessionPath);
  assert.equal(summary.hasTaskComplete, true);
  assert.equal(summary.hasFinalAnswer, true);
  assert.equal(summary.completion.turnId, "turn-large-tail");
  assert.equal(summary.completion.isCurrent, true);
});

test("does not treat a stale null-PID command record as working", () => {
  const now = Date.parse("2026-07-29T02:20:00.000Z");
  const threadId = "thread-stale-process";
  const processes = summarizeProcessRows(
    [{ conversationId: threadId, updatedAtMs: now - 17 * 60 * 60 * 1000, osPid: null }],
    now,
    () => true
  );
  const processInfo = processes.get(threadId);

  assert.equal(processInfo.hasLiveProcess, false);
  assert.equal(processInfo.hasRecentProcess, false);
  assert.equal(
    statusForSession({ mtimeMs: now - 25 * 60 * 1000 }, {}, processInfo, now),
    "idle"
  );
});

test("keeps a confirmed live process active regardless of command duration", () => {
  const now = Date.parse("2026-07-29T02:20:00.000Z");
  const threadId = "thread-live-process";
  const processes = summarizeProcessRows(
    [{ conversationId: threadId, updatedAtMs: now - 3 * 60 * 60 * 1000, osPid: 4242 }],
    now,
    (pid) => pid === 4242
  );
  const processInfo = processes.get(threadId);

  assert.equal(processInfo.hasLiveProcess, true);
  assert.equal(processInfo.hasRecentProcess, true);
  assert.equal(
    statusForSession({ mtimeMs: now - 25 * 60 * 1000 }, {}, processInfo, now),
    "working"
  );
});
