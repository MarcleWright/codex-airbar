const fs = require("node:fs");
const path = require("node:path");
const { classifyRecoverableError } = require("./codex-cli");

const STORE_VERSION = 1;
const GRACE_MS = 10 * 1000;
const MAX_FAILURE_AGE_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [15 * 1000, 45 * 1000];
const OVERLOAD_GRACE_MS = 30 * 1000;
const OVERLOAD_RETRY_DELAYS_MS = [60 * 1000, 180 * 1000];
const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TERMINAL_STATES = new Set(["recovered", "permanent_failed", "exhausted", "cancelled"]);
const RETRYABLE_STATES = new Set(["retryable_failed", "permanent_failed", "exhausted", "cancelled"]);
const CONTINUE_PROMPT = "The previous turn ended because its response stream was interrupted. Continue the original task from the available session context. Re-check existing work before repeating any action.";
const OVERLOAD_CONTINUE_PROMPT = "The previous turn ended because the selected model was temporarily at capacity. Continue the original task from the available session context. Re-check existing work before repeating any action.";

function recoveryPolicy(kind) {
  if (kind === "server_overloaded") {
    return {
      graceMs: OVERLOAD_GRACE_MS,
      retryDelaysMs: OVERLOAD_RETRY_DELAYS_MS,
      prompt: OVERLOAD_CONTINUE_PROMPT,
      detectedMessage: "Recoverable model-capacity failure detected."
    };
  }
  return {
    graceMs: GRACE_MS,
    retryDelaysMs: RETRY_DELAYS_MS,
    prompt: CONTINUE_PROMPT,
    detectedMessage: "Recoverable stream interruption detected."
  };
}

function emptyStore() {
  return { version: STORE_VERSION, enabled: false, records: {} };
}

function loadStore(storePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, "utf8"));
    if (parsed?.version !== STORE_VERSION || typeof parsed.records !== "object") return emptyStore();
    for (const record of Object.values(parsed.records)) {
      if (record.state === "running") {
        record.state = "cancelled";
        record.message = "Airbar restarted while a recovery process was running; automatic replay was suppressed.";
        record.updatedAt = Date.now();
      }
    }
    return parsed;
  } catch {
    return emptyStore();
  }
}

function saveStoreAtomic(storePath, store) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(temporaryPath, storePath);
}

function flattenSessions(snapshot) {
  return (snapshot?.projects || []).flatMap((project) => project.sessions || []);
}

function recoveryKey(session) {
  return `${session.id}:${session.completion?.fingerprint || ""}`;
}

function eligibleFailure(session, now = Date.now(), options = {}) {
  const completedAt = new Date(session?.completion?.timestamp || "").getTime();
  const recent = Number.isFinite(completedAt) && now - completedAt >= -60 * 1000 && now - completedAt <= MAX_FAILURE_AGE_MS;
  return Boolean(
      session?.completion?.isCurrent &&
      session.completion.error?.message &&
      classifyRecoverableError(session.completion.error) &&
      (options.ignoreAge || recent)
  );
}

class SessionRecoveryController {
  constructor(options) {
    this.storePath = options.storePath;
    this.readSnapshot = options.readSnapshot;
    this.runResume = options.runResume;
    this.notify = options.notify || (() => {});
    this.log = options.log || (() => {});
    this.now = options.now || Date.now;
    this.store = loadStore(this.storePath);
    this.runningSessions = new Set();
    this.cli = options.cli || { available: false, path: null, version: null, error: "CLI probe has not run." };
    this.prune();
    this.persist();
  }

  setCliStatus(cli) {
    this.cli = cli;
  }

  getStatus() {
    return { enabled: Boolean(this.store.enabled), cli: this.cli };
  }

  setEnabled(enabled) {
    this.store.enabled = Boolean(enabled);
    if (this.store.enabled) {
      for (const record of Object.values(this.store.records)) {
        if (record.state === "retryable_failed") {
          const policy = recoveryPolicy(record.recoveryKind);
          record.state = "scheduled";
          record.nextAttemptAt = this.now() + policy.graceMs;
          record.updatedAt = this.now();
        }
      }
    }
    this.persist();
    return this.getStatus();
  }

  decorateSnapshot(snapshot) {
    const bySession = new Map();
    for (const record of Object.values(this.store.records)) {
      const previous = bySession.get(record.sessionId);
      if (!previous || Number(record.updatedAt) > Number(previous.updatedAt)) bySession.set(record.sessionId, record);
    }
    return {
      ...snapshot,
      recovery: this.getStatus(),
      projects: (snapshot.projects || []).map((project) => ({
        ...project,
        sessions: project.sessions.map((session) => {
          const record = bySession.get(session.id) || null;
          const currentFingerprint = session.completion?.fingerprint;
          const recoveredIsRecent = record?.state === "recovered" && new Date(session.updatedAt).getTime() <= record.updatedAt + 5000;
          const recordIsCurrent = record && (record.currentFingerprint || record.fingerprint) === currentFingerprint;
          return { ...session, recovery: recoveredIsRecent || recordIsCurrent ? record : null };
        })
      }))
    };
  }

  async retry(sessionId) {
    if (!this.cli.available) return { ok: false, error: this.cli.error || "Standalone Codex CLI is unavailable." };
    const records = Object.values(this.store.records)
      .filter((record) => record.sessionId === sessionId && RETRYABLE_STATES.has(record.state))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const record = records[0];
    if (!record) return { ok: false, error: "No failed recovery is available for this session." };
    record.state = "scheduled";
    record.attemptCount = 0;
    record.nextAttemptAt = this.now();
    record.updatedAt = this.now();
    record.message = "Manual retry scheduled.";
    this.persist();
    await this.attempt(record, { ignoreAge: true });
    return { ok: true };
  }

  async tick(snapshot) {
    const now = this.now();
    for (const session of flattenSessions(snapshot)) {
      if (!eligibleFailure(session, now)) continue;
      const activeRecord = Object.values(this.store.records).find(
        (record) => record.sessionId === session.id && !TERMINAL_STATES.has(record.state)
      );
      if (activeRecord) continue;
      const key = recoveryKey(session);
      if (!this.store.records[key]) {
        const recoveryKind = classifyRecoverableError(session.completion.error).kind;
        const policy = recoveryPolicy(recoveryKind);
        this.store.records[key] = {
          key,
          sessionId: session.id,
          fingerprint: session.completion.fingerprint,
          currentFingerprint: session.completion.fingerprint,
          recoveryKind,
          state: this.store.enabled && this.cli.available ? "scheduled" : "retryable_failed",
          attemptCount: 0,
          detectedAt: now,
          nextAttemptAt: now + policy.graceMs,
          updatedAt: now,
          message: policy.detectedMessage
        };
        this.persist();
      }
    }

    const sessionsById = new Map(flattenSessions(snapshot).map((session) => [session.id, session]));
    for (const record of Object.values(this.store.records)) {
      if (TERMINAL_STATES.has(record.state) || record.state === "running") continue;
      const session = sessionsById.get(record.sessionId);
      if (!eligibleFailure(session, now) || session.completion.fingerprint !== (record.currentFingerprint || record.fingerprint)) {
        this.finish(record, "cancelled", "The recoverable failure is no longer current or recent enough for automatic recovery.");
      }
    }

    if (!this.store.enabled || !this.cli.available) return;

    for (const record of Object.values(this.store.records)) {
      if (record.state !== "scheduled" || record.nextAttemptAt > now) continue;
      await this.attempt(record);
    }
  }

  async attempt(record, options = {}) {
    if (this.runningSessions.has(record.sessionId)) return;
    const freshSnapshot = this.readSnapshot();
    const session = flattenSessions(freshSnapshot).find((candidate) => candidate.id === record.sessionId);
    if (!session || !eligibleFailure(session, this.now(), options) || session.completion.fingerprint !== (record.currentFingerprint || record.fingerprint)) {
      this.finish(record, "cancelled", "Newer session activity replaced the failed-turn fingerprint.");
      return;
    }
    if (session.hasLiveProcess) {
      record.nextAttemptAt = this.now() + GRACE_MS;
      record.updatedAt = this.now();
      record.message = "Waiting for recorded Codex process activity to stop.";
      this.persist();
      return;
    }

    this.runningSessions.add(record.sessionId);
    record.state = "running";
    record.attemptCount += 1;
    record.updatedAt = this.now();
    record.message = `Recovery attempt ${record.attemptCount} is running.`;
    this.persist();
    try {
      const policy = recoveryPolicy(record.recoveryKind);
      const result = await this.runResume(session, policy.prompt);
      if (result.recovered) {
        this.finish(record, "recovered", "The interrupted session continued successfully.");
        this.notify("Codex session recovered", session.title || session.id);
        return;
      }

      if (!result.retryable) {
        this.finish(record, "permanent_failed", result.message);
        this.notify("Codex session needs attention", session.title || session.id);
        return;
      }
      if (result.recoveryKind) record.recoveryKind = result.recoveryKind;
      const latestSession = flattenSessions(this.readSnapshot()).find((candidate) => candidate.id === record.sessionId);
      if (eligibleFailure(latestSession, this.now(), options)) {
        record.currentFingerprint = latestSession.completion.fingerprint;
      }
      const retryDelaysMs = recoveryPolicy(record.recoveryKind).retryDelaysMs;
      if (record.attemptCount >= MAX_ATTEMPTS) {
        this.finish(record, "exhausted", result.message);
        this.notify("Codex recovery retries exhausted", session.title || session.id);
        return;
      }
      record.state = "scheduled";
      record.nextAttemptAt = this.now() + retryDelaysMs[record.attemptCount - 1];
      record.updatedAt = this.now();
      record.message = result.message;
      this.persist();
    } catch (error) {
      this.log("Session recovery attempt failed", error);
      const retryDelaysMs = recoveryPolicy(record.recoveryKind).retryDelaysMs;
      if (record.attemptCount >= MAX_ATTEMPTS) {
        this.finish(record, "exhausted", error.message || String(error));
      } else {
        record.state = "scheduled";
        record.nextAttemptAt = this.now() + retryDelaysMs[record.attemptCount - 1];
        record.updatedAt = this.now();
        record.message = error.message || String(error);
        this.persist();
      }
    } finally {
      this.runningSessions.delete(record.sessionId);
    }
  }

  finish(record, state, message) {
    record.state = state;
    record.updatedAt = this.now();
    record.message = message;
    delete record.nextAttemptAt;
    this.persist();
  }

  prune() {
    const cutoff = this.now() - TERMINAL_RETENTION_MS;
    for (const [key, record] of Object.entries(this.store.records)) {
      if (TERMINAL_STATES.has(record.state) && record.updatedAt < cutoff) delete this.store.records[key];
    }
  }

  persist() {
    saveStoreAtomic(this.storePath, this.store);
  }
}

module.exports = {
  CONTINUE_PROMPT,
  GRACE_MS,
  MAX_FAILURE_AGE_MS,
  OVERLOAD_CONTINUE_PROMPT,
  OVERLOAD_GRACE_MS,
  OVERLOAD_RETRY_DELAYS_MS,
  SessionRecoveryController,
  eligibleFailure,
  loadStore,
  recoveryKey,
  recoveryPolicy,
  saveStoreAtomic
};
