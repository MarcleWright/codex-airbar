const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCompletion } = require("../src/status-reader");

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
