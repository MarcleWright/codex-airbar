const POLL_MS = 5000;

let snapshot = null;
let previousStatuses = new Map();
let filterText = "";
let statusFilter = "all";

const els = {
  summary: document.querySelector("#summary"),
  workingCount: document.querySelector("#workingCount"),
  doneCount: document.querySelector("#doneCount"),
  recentCount: document.querySelector("#recentCount"),
  idleCount: document.querySelector("#idleCount"),
  projectList: document.querySelector("#projectList"),
  emptyState: document.querySelector("#emptyState"),
  errorBox: document.querySelector("#errorBox"),
  filterInput: document.querySelector("#filterInput"),
  statusFilter: document.querySelector("#statusFilter"),
  refreshButton: document.querySelector("#refreshButton"),
  logButton: document.querySelector("#logButton"),
  minimizeButton: document.querySelector("#minimizeButton"),
  closeButton: document.querySelector("#closeButton")
};

function formatRelative(isoDate) {
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, Date.now() - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function countsFor(snapshotValue) {
  const counts = { working: 0, done: 0, recent: 0, idle: 0 };
  for (const project of snapshotValue?.projects || []) {
    for (const session of project.sessions) {
      counts[session.status] += 1;
    }
  }
  return counts;
}

function sessionMatches(project, session) {
  if (statusFilter !== "all" && session.status !== statusFilter) return false;
  const needle = filterText.trim().toLowerCase();
  if (!needle) return true;
  return [
    project.name,
    project.workspace,
    session.title,
    session.id,
    session.lastMessage
  ].some((value) => String(value || "").toLowerCase().includes(needle));
}

function render() {
  const counts = countsFor(snapshot);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  els.workingCount.textContent = counts.working;
  els.doneCount.textContent = counts.done;
  els.recentCount.textContent = counts.recent;
  els.idleCount.textContent = counts.idle;
  els.summary.textContent = `${total} sessions across ${snapshot?.projects?.length || 0} projects`;

  if (snapshot?.error) {
    els.errorBox.textContent = snapshot.error;
    els.errorBox.classList.remove("hidden");
  } else {
    els.errorBox.classList.add("hidden");
  }

  const renderedProjects = [];
  for (const project of snapshot?.projects || []) {
    const sessions = project.sessions.filter((session) => sessionMatches(project, session));
    if (!sessions.length) continue;
    renderedProjects.push(`
      <article class="project">
        <header class="project-header">
          <div class="project-name">
            <strong title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</strong>
            <span title="${escapeHtml(project.workspace)}">${escapeHtml(project.workspace)}</span>
          </div>
          <div class="project-count">${sessions.length}</div>
        </header>
        <div class="session-list">
          ${sessions.map(renderSession).join("")}
        </div>
      </article>
    `);
  }

  els.projectList.innerHTML = renderedProjects.join("");
  els.emptyState.classList.toggle("hidden", renderedProjects.length > 0 || Boolean(snapshot?.error));
}

function renderSession(session) {
  const command = session.recentCommands?.[0]?.command;
  const message = session.lastMessage || command || session.lastType || "";
  return `
    <div class="session">
      <span class="dot ${escapeHtml(session.status)}"></span>
      <div>
        <div class="session-title">
          <strong title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</strong>
          <span class="badge">${escapeHtml(session.status)}</span>
        </div>
        <div class="session-meta">${formatRelative(session.updatedAt)} · ${escapeHtml(session.id.slice(0, 8))} · ${escapeHtml(session.lastType)}</div>
        ${message ? `<div class="session-message">${escapeHtml(message)}</div>` : ""}
      </div>
    </div>
  `;
}

async function poll() {
  try {
    const next = await window.airbar.getSnapshot();
    detectDoneTransitions(next);
    snapshot = next;
    render();
  } catch (error) {
    snapshot = {
      generatedAt: new Date().toISOString(),
      error: error.message || String(error),
      projects: []
    };
    render();
  }
}

function detectDoneTransitions(next) {
  const current = new Map();
  for (const project of next?.projects || []) {
    for (const session of project.sessions || []) {
      current.set(session.id, session.status);
      const previous = previousStatuses.get(session.id);
      if (previous === "working" && session.status === "done") {
        window.airbar.notify({
          title: "Codex session done",
          body: `${project.name}: ${session.title}`
        });
      }
    }
  }
  previousStatuses = current;
}

els.filterInput.addEventListener("input", (event) => {
  filterText = event.target.value;
  render();
});

els.statusFilter.addEventListener("change", (event) => {
  statusFilter = event.target.value;
  render();
});

els.refreshButton.addEventListener("click", poll);
els.logButton.addEventListener("click", () => window.airbar.openLogs());
els.minimizeButton.addEventListener("click", () => window.airbar.minimize());
els.closeButton.addEventListener("click", () => window.airbar.close());

poll();
setInterval(poll, POLL_MS);
