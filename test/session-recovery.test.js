const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { OVERLOAD_CONTINUE_PROMPT, SessionRecoveryController } = require("../src/session-recovery");

const ERROR_MESSAGE = "stream disconnected before completion: error sending request for url (https://api.openai-hk.com/v1/responses)";

function snapshot(fingerprint = "turn-1|time|error", options = {}) {
  return {
    projects: [{
      workspace: "C:\\workspace",
      name: "workspace",
      sessions: [{
        id: "session-1",
        title: "Test session",
        workspace: "C:\\workspace",
        hasLiveProcess: Boolean(options.hasLiveProcess),
        completion: {
          fingerprint,
          timestamp: options.timestamp || new Date(1000).toISOString(),
          isCurrent: options.isCurrent !== false,
          error: options.error || { message: ERROR_MESSAGE }
        }
      }]
    }]
  };
}

function fixture(runResume = async () => ({ recovered: true })) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "airbar-recovery-test-"));
  let now = 1000;
  let currentSnapshot = snapshot();
  const controller = new SessionRecoveryController({
    storePath: path.join(directory, "state.json"),
    readSnapshot: () => currentSnapshot,
    runResume,
    now: () => now,
    cli: { available: true, path: "codex", version: "test", error: null }
  });
  controller.setEnabled(true);
  return {
    controller,
    directory,
    setNow: (value) => { now = value; },
    setSnapshot: (value) => { currentSnapshot = value; }
  };
}

test("schedules once across repeated snapshots and reaches recovered", async (t) => {
  let calls = 0;
  const item = fixture(async () => {
    calls += 1;
    return { recovered: true };
  });
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));

  await item.controller.tick(snapshot());
  await item.controller.tick(snapshot());
  assert.equal(Object.keys(item.controller.store.records).length, 1);

  item.setNow(12000);
  await item.controller.tick(snapshot());
  assert.equal(calls, 1);
  assert.equal(Object.values(item.controller.store.records)[0].state, "recovered");
});

test("cancels when the failed-turn fingerprint changes before spawn", async (t) => {
  const item = fixture();
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));
  item.setSnapshot(snapshot("turn-2|time|error"));
  await item.controller.tick(snapshot());
  assert.equal(Object.values(item.controller.store.records)[0].state, "cancelled");
});

test("suppresses automatic replay after restart during a running attempt", (t) => {
  const item = fixture();
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));
  const record = {
    key: "session-1:turn-1",
    sessionId: "session-1",
    fingerprint: "turn-1",
    state: "running",
    attemptCount: 1,
    updatedAt: 1000
  };
  fs.writeFileSync(path.join(item.directory, "state.json"), JSON.stringify({ version: 1, enabled: true, records: { [record.key]: record } }), "utf8");
  const restarted = new SessionRecoveryController({
    storePath: path.join(item.directory, "state.json"),
    readSnapshot: () => snapshot(),
    runResume: async () => ({ recovered: true }),
    now: () => 2000,
    cli: { available: true }
  });
  assert.equal(restarted.store.records[record.key].state, "cancelled");
});

test("detects while disabled and allows an explicit manual retry", async (t) => {
  let calls = 0;
  const item = fixture(async () => {
    calls += 1;
    return { recovered: true };
  });
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));
  item.controller.setEnabled(false);
  await item.controller.tick(snapshot());
  const record = Object.values(item.controller.store.records)[0];
  assert.equal(record.state, "retryable_failed");
  const result = await item.controller.retry("session-1");
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(record.state, "recovered");
});

test("does not automatically schedule an old stream failure", async (t) => {
  const item = fixture();
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));
  item.setNow(20 * 60 * 1000);
  const oldSnapshot = snapshot("old-turn|time|error", { timestamp: new Date(1000).toISOString() });
  item.setSnapshot(oldSnapshot);
  await item.controller.tick(oldSnapshot);
  assert.equal(Object.keys(item.controller.store.records).length, 0);
});

test("starts a server-overloaded recovery without an observation delay", async (t) => {
  let prompt = null;
  const item = fixture(async (_session, nextPrompt) => {
    prompt = nextPrompt;
    return { recovered: true };
  });
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));
  const overloaded = snapshot("turn-overloaded|time|error", {
    error: {
      message: "Selected model is at capacity. Please try a different model.",
      codexErrorInfo: "server_overloaded"
    }
  });
  item.setSnapshot(overloaded);

  await item.controller.tick(overloaded);
  const record = Object.values(item.controller.store.records)[0];
  assert.equal(record.recoveryKind, "server_overloaded");
  assert.equal(record.attemptCount, 1);
  assert.equal(prompt, OVERLOAD_CONTINUE_PROMPT);
  assert.equal(record.state, "recovered");
});

test("retries a server-overloaded recovery on each poll without backoff", async (t) => {
  let calls = 0;
  const item = fixture(async () => {
    calls += 1;
    return {
      recovered: false,
      retryable: true,
      recoveryKind: "server_overloaded",
      message: "Selected model is at capacity. Please try a different model."
    };
  });
  t.after(() => fs.rmSync(item.directory, { recursive: true, force: true }));
  const overloaded = snapshot("turn-overloaded|time|error", {
    error: {
      message: "Selected model is at capacity. Please try a different model.",
      codexErrorInfo: "server_overloaded"
    }
  });
  item.setSnapshot(overloaded);

  await item.controller.tick(overloaded);
  const record = Object.values(item.controller.store.records)[0];
  assert.equal(record.nextAttemptAt, 1000);
  await item.controller.tick(overloaded);
  assert.equal(record.nextAttemptAt, 1000);
  await item.controller.tick(overloaded);

  assert.equal(calls, 3);
  assert.equal(record.state, "exhausted");
});
