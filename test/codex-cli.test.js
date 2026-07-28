const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { interpretExecResult, isRecoverableTransportError, resolveCodexCommand } = require("../src/codex-cli");

test("recognizes the selected stream interruption as recoverable", () => {
  assert.equal(
    isRecoverableTransportError(
      "stream disconnected before completion: error sending request for url (https://api.openai-hk.com/v1/responses)"
    ),
    true
  );
  assert.equal(isRecoverableTransportError("401 Unauthorized"), false);
});

test("requires an error-free terminal turn event for recovery success", () => {
  const noTerminal = interpretExecResult({ exitCode: 0, stdout: '{"type":"turn.started"}\n', stderr: "", spawnError: false });
  assert.equal(noTerminal.recovered, false);

  const complete = interpretExecResult({ exitCode: 0, stdout: '{"type":"turn.completed","turn":{"status":"completed"}}\n', stderr: "", spawnError: false });
  assert.equal(complete.recovered, true);

  const failed = interpretExecResult({
    exitCode: 1,
    stdout: '{"type":"turn.completed","error":{"message":"stream disconnected before completion: error sending request for url (https://example.test/v1/responses)"}}\n',
    stderr: "",
    spawnError: false
  });
  assert.equal(failed.recovered, false);
  assert.equal(failed.retryable, true);
});

test("reads a top-level JSON error from a failed turn", () => {
  const result = interpretExecResult({
    exitCode: 1,
    stdout: '{"type":"turn.failed","error":{"message":"stream disconnected before completion: error sending request for url (https://example.test/v1/responses)"}}\n',
    stderr: "",
    spawnError: false,
    timedOut: false
  });
  assert.equal(result.recovered, false);
  assert.equal(result.retryable, true);

  const errorEvent = interpretExecResult({
    exitCode: 1,
    stdout: '{"type":"error","message":"stream disconnected before completion: error sending request for url (https://example.test/v1/responses)"}\n',
    stderr: "",
    spawnError: false,
    timedOut: false
  });
  assert.equal(errorEvent.retryable, true);
});

test("resolves an npm Codex command shim without invoking a shell", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "airbar-cli-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "codex.cmd"), "@echo off\n", "utf8");
  fs.writeFileSync(path.join(directory, "node.exe"), "fixture", "utf8");
  const script = path.join(directory, "node_modules", "@openai", "codex", "bin", "codex.js");
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, "// fixture\n", "utf8");

  const spec = resolveCodexCommand({ pathValue: directory });
  assert.equal(spec.command, path.join(directory, "node.exe"));
  assert.deepEqual(spec.prefixArgs, [script]);
  assert.equal(spec.displayPath, path.join(directory, "codex.cmd"));
});
