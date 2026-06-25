import { CheckCircle2, ChevronDown, ChevronRight, Circle, ExternalLink, Eye, EyeOff, FileText, FolderOpen, Minus, Moon, Pin, RefreshCw, Sun, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./theme-provider";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Select } from "./components/ui/select";
import { cn } from "./lib/utils";

const POLL_MS = 5000;
const PROJECT_COLLAPSE_STORAGE_KEY = "codex-airbar-project-collapse";

const statusLabels: Record<AirbarStatus, string> = {
  working: "Working",
  done: "Done",
  recent: "Recent",
  idle: "Idle"
};

const statusTone: Record<AirbarStatus, string> = {
  working: "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]",
  done: "bg-sky-400",
  recent: "bg-amber-300",
  idle: "bg-muted-foreground"
};

type ProjectCollapseMode = "expanded" | "hide-idle" | "collapsed";

export function App() {
  const [snapshot, setSnapshot] = useState<AirbarSnapshot | null>(null);
  const previousStatusesRef = useRef<Map<string, AirbarStatus>>(new Map());
  const [statusFilter, setStatusFilter] = useState<AirbarStatus | "all">("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [projectCollapseModes, setProjectCollapseModes] = useState<Record<string, ProjectCollapseMode>>(() => {
    try {
      const saved = window.localStorage.getItem(PROJECT_COLLAPSE_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Record<string, ProjectCollapseMode>) : {};
    } catch {
      return {};
    }
  });
  const { theme, setTheme } = useTheme();

  const counts = useMemo(() => {
    const next: Record<AirbarStatus, number> = { working: 0, done: 0, recent: 0, idle: 0 };
    for (const project of snapshot?.projects || []) {
      for (const session of project.sessions) {
        next[session.status] += 1;
      }
    }
    return next;
  }, [snapshot]);

  const filteredProjects = useMemo(() => {
    return (snapshot?.projects || [])
      .map((project) => ({
        ...project,
        sessions: project.sessions.filter((session) => statusFilter === "all" || session.status === statusFilter)
      }))
      .filter((project) => project.sessions.length > 0);
  }, [snapshot?.projects, statusFilter]);

  async function poll() {
    try {
      const next = await window.airbar.getSnapshot();
      detectDoneTransitions(next);
      setSnapshot(next);
    } catch (error) {
      setSnapshot({
        generatedAt: new Date().toISOString(),
        codexHome: "",
        error: error instanceof Error ? error.message : String(error),
        projects: []
      });
    }
  }

  function detectDoneTransitions(next: AirbarSnapshot) {
    const current = new Map<string, AirbarStatus>();
    for (const project of next.projects || []) {
      for (const session of project.sessions || []) {
        current.set(session.id, session.status);
        const previous = previousStatusesRef.current.get(session.id);
        if (previous === "working" && session.status === "done") {
          window.airbar.notify({
            title: "Codex session done",
            body: `${project.name}: ${session.title}`
          });
        }
      }
    }
    previousStatusesRef.current = current;
  }

  useEffect(() => {
    window.airbar.getAlwaysOnTop().then(setAlwaysOnTop).catch(() => null);
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_COLLAPSE_STORAGE_KEY, JSON.stringify(projectCollapseModes));
  }, [projectCollapseModes]);

  async function handleToggleAlwaysOnTop() {
    const next = await window.airbar.setAlwaysOnTop(!alwaysOnTop);
    setAlwaysOnTop(next);
  }

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-[68px] items-center border-b border-border bg-background/95">
        <div className="drag-region flex h-full min-w-0 flex-1 items-center px-3">
          <div className="mr-3 h-7 w-3 rounded-full bg-gradient-to-b from-emerald-300 to-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.38)]" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">Codex Airbar</h1>
            <p className="truncate text-xs text-muted-foreground">
              {total} sessions across {snapshot?.projects?.length || 0} projects
            </p>
          </div>
        </div>
        <div className="no-drag flex items-center gap-1.5 pr-2">
          <Button
            variant={alwaysOnTop ? "secondary" : "ghost"}
            size="icon"
            title={alwaysOnTop ? "Disable always on top" : "Enable always on top"}
            onClick={handleToggleAlwaysOnTop}
          >
            <Pin className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" title="Refresh" onClick={poll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Open logs" onClick={() => window.airbar.openLogs()}>
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Minimize" onClick={() => window.airbar.minimize()}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Close" onClick={() => window.airbar.close()}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-3">
        <section className="mb-3 grid grid-cols-4 gap-2">
          {(Object.keys(statusLabels) as AirbarStatus[]).map((status) => (
            <Card key={status} className="rounded-lg">
              <div className="p-2">
                <div className="text-xl font-bold leading-6">{counts[status]}</div>
                <div className="text-[11px] text-muted-foreground">{statusLabels[status]}</div>
              </div>
            </Card>
          ))}
        </section>

        <section className="mb-3">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AirbarStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="working">Working</option>
            <option value="done">Done</option>
            <option value="recent">Recent</option>
            <option value="idle">Idle</option>
          </Select>
        </section>

        {snapshot?.error ? <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{snapshot.error}</div> : null}
        {actionError ? <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">{actionError}</div> : null}

        <section className="grid gap-2.5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.workspace}
              project={project}
              onOpenError={setActionError}
              collapseMode={projectCollapseModes[project.workspace] ?? "expanded"}
              onChangeCollapseMode={(nextMode) =>
                setProjectCollapseModes((current) => ({
                  ...current,
                  [project.workspace]: nextMode
                }))
              }
            />
          ))}
        </section>

        {!snapshot?.error && filteredProjects.length === 0 ? (
          <Card className="p-4">
            <h2 className="text-sm font-semibold">No Codex sessions found</h2>
            <p className="mt-1 text-xs text-muted-foreground">Airbar reads from your local .codex folder in read-only mode.</p>
          </Card>
        ) : null}
      </main>
    </div>
  );
}

function ProjectCard({
  project,
  onOpenError,
  collapseMode,
  onChangeCollapseMode
}: {
  project: AirbarProject;
  onOpenError: (message: string | null) => void;
  collapseMode: ProjectCollapseMode;
  onChangeCollapseMode: (nextMode: ProjectCollapseMode) => void;
}) {
  const visibleSessions = project.sessions.filter((session) => {
    if (collapseMode === "collapsed") return false;
    if (collapseMode === "hide-idle") return session.status !== "idle";
    return true;
  });

  const hiddenIdleCount = project.sessions.filter((session) => session.status === "idle").length;
  const isProjectless = project.workspace === "Projectless";

  async function handleOpenProject() {
    onOpenError(null);
    const result = await window.airbar.openProjectFolder(project.workspace);
    if (!result.ok) {
      onOpenError(result.error || "Failed to open the project folder.");
    }
  }

  function cycleCollapseMode() {
    if (collapseMode === "expanded") {
      onChangeCollapseMode("hide-idle");
      return;
    }
    if (collapseMode === "hide-idle") {
      onChangeCollapseMode("collapsed");
      return;
    }
    onChangeCollapseMode("expanded");
  }

  const collapseTitle =
    collapseMode === "expanded"
      ? "Hide idle sessions"
      : collapseMode === "hide-idle"
        ? "Collapse project"
        : "Expand project";

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title={collapseTitle}
            onClick={cycleCollapseMode}
          >
            {collapseMode === "collapsed" ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <div className="min-w-0">
            <strong className="block truncate text-sm">{project.name}</strong>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={collapseMode === "hide-idle" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7 shrink-0"
            title={collapseMode === "hide-idle" ? "Show idle sessions" : "Hide idle sessions"}
            onClick={() => onChangeCollapseMode(collapseMode === "hide-idle" ? "expanded" : "hide-idle")}
          >
            {collapseMode === "hide-idle" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 min-w-[36px] shrink-0 px-2.5 text-[11px] font-semibold"
            title={isProjectless ? "No project folder available" : "Open project folder in Explorer"}
            onClick={handleOpenProject}
            disabled={isProjectless}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {collapseMode === "collapsed" ? null : visibleSessions.map((session) => (
          <SessionRow key={`${session.id}-${session.file}`} session={session} />
        ))}
        {collapseMode === "hide-idle" && hiddenIdleCount > 0 ? (
          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {hiddenIdleCount} idle session{hiddenIdleCount > 1 ? "s" : ""} hidden
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SessionRow({
  session
}: {
  session: AirbarSession;
}) {
  const command = session.recentCommands?.[0]?.command;
  const message = session.lastMessage || command || session.lastType || "";
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSessionAction() {
    setActionError(null);
    const result = await window.airbar.openProject(session.workspace);
    if (!result.ok) {
      setActionError(result.error || "Failed to open the project in Codex.");
    }
  }

  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0">
      <span className={cn("mt-1.5 h-2 w-2 rounded-full", statusTone[session.status])} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm" title={session.title}>
              {session.title}
            </strong>
            <Badge>{session.status}</Badge>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 min-w-[72px] shrink-0 px-2.5 text-[11px] font-semibold"
            title={session.workspace === "Projectless" ? "No project workspace available" : "Open project in Codex"}
            onClick={handleSessionAction}
            disabled={session.workspace === "Projectless"}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {session.status === "done" ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          <span>{formatRelative(session.updatedAt)}</span>
          <span>{session.id.slice(0, 8)}</span>
          <span className="truncate">{session.lastType}</span>
        </div>
        {message ? <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{message}</div> : null}
        {actionError ? <div className="mt-2 text-[11px] text-amber-300">{actionError}</div> : null}
      </div>
    </div>
  );
}

function formatRelative(isoDate: string) {
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, Date.now() - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
