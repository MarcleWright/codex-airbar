import { CheckCheck, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, FileText, FolderOpen, Magnet, Minus, Moon, Pin, PinOff, RefreshCw, Sun, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { cn } from "./lib/utils";

const POLL_MS = 5000;
const PROJECT_UI_STORAGE_KEY = "codex-airbar-project-ui";
const CLEARED_DONE_STORAGE_KEY = "codex-airbar-cleared-done";

type OpenActionKey = "openWorkspace" | "resumeSession";

const SESSION_OPEN_ACTION: OpenActionKey = "resumeSession";

const statusTone: Record<AirbarStatus, string> = {
  working: "bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.6)]",
  done: "bg-sky-400",
  idle: "bg-muted-foreground"
};

type ProjectUiState = {
  collapsed?: boolean;
  hideIdle?: boolean;
};

const DEFAULT_PROJECT_UI_STATE: Required<ProjectUiState> = {
  collapsed: false,
  hideIdle: true
};

const sessionOpenActions: Record<
  OpenActionKey,
  {
    label: string;
    icon: typeof ExternalLink;
    title: (session: AirbarSession) => string;
    disabled: (session: AirbarSession) => boolean;
    run: (session: AirbarSession) => Promise<{ ok: boolean; error?: string }>;
    fallbackError: string;
  }
> = {
  openWorkspace: {
    label: "Open",
    icon: ExternalLink,
    title: (session) => (session.workspace === "Projectless" ? "No project workspace available" : "Open project in Codex"),
    disabled: (session) => session.workspace === "Projectless",
    run: (session) => window.airbar.openProject(session.workspace),
    fallbackError: "Failed to open the project in Codex."
  },
  resumeSession: {
    label: "Resume",
    icon: Terminal,
    title: (session) => (session.id ? "Resume this Codex session" : "No session id available"),
    disabled: (session) => !session.id,
    run: (session) => window.airbar.resumeSession(session.id, session.workspace),
    fallbackError: "Failed to resume the Codex session."
  }
};

export function App() {
  const [snapshot, setSnapshot] = useState<AirbarSnapshot | null>(null);
  const previousStatusesRef = useRef<Map<string, AirbarStatus>>(new Map());
  const [actionError, setActionError] = useState<string | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [topCenterSnapped, setTopCenterSnapped] = useState(false);
  const [clearedDoneSessions, setClearedDoneSessions] = useState<Record<string, string>>(() => {
    try {
      const saved = window.localStorage.getItem(CLEARED_DONE_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [projectUiState, setProjectUiState] = useState<Record<string, ProjectUiState>>(() => {
    try {
      const saved = window.localStorage.getItem(PROJECT_UI_STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved) as Record<string, ProjectUiState | "expanded" | "hide-idle" | "collapsed">;
      return Object.fromEntries(
        Object.entries(parsed).map(([workspace, value]) => {
          if (typeof value === "string") {
            return [
              workspace,
              {
                collapsed: value === "collapsed",
                hideIdle: value === "hide-idle"
              } satisfies ProjectUiState
            ];
          }
          return [workspace, value];
        })
      );
    } catch {
      return {};
    }
  });
  const { theme, setTheme } = useTheme();

  const filteredProjects = useMemo(() => {
    return [...(snapshot?.projects || [])].sort((a, b) => {
      const aHasDone = a.sessions.some((session) => session.status === "done" && clearedDoneSessions[session.id] !== session.updatedAt);
      const bHasDone = b.sessions.some((session) => session.status === "done" && clearedDoneSessions[session.id] !== session.updatedAt);
      if (aHasDone !== bHasDone) return aHasDone ? -1 : 1;

      const aWorking = a.sessions.some((session) => session.status === "working");
      const bWorking = b.sessions.some((session) => session.status === "working");
      if (aWorking !== bWorking) return aWorking ? -1 : 1;

      const aTime = new Date(a.sessions[0]?.updatedAt || 0).getTime();
      const bTime = new Date(b.sessions[0]?.updatedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [clearedDoneSessions, snapshot?.projects]);

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
    window.airbar.isTopCenterSnapped().then(setTopCenterSnapped).catch(() => null);
    const offSnapState = window.airbar.onSnapTopCenterStateChanged(setTopCenterSnapped);
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      offSnapState();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_UI_STORAGE_KEY, JSON.stringify(projectUiState));
  }, [projectUiState]);

  useEffect(() => {
    window.localStorage.setItem(CLEARED_DONE_STORAGE_KEY, JSON.stringify(clearedDoneSessions));
  }, [clearedDoneSessions]);

  async function handleToggleAlwaysOnTop() {
    const next = await window.airbar.setAlwaysOnTop(!alwaysOnTop);
    setAlwaysOnTop(next);
  }

  async function handleSnapTopCenter() {
    const next = await window.airbar.snapTopCenter();
    setTopCenterSnapped(next);
  }

  return (
    <div className="airbar-shell flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-8 items-center border-b border-border bg-background/95">
        <div className="drag-region flex h-full min-w-0 flex-1 items-center gap-1.5 px-2">
          <div className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-300 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.28)]" />
          <h1 className="truncate text-[12px] font-semibold leading-none">Codex Airbar</h1>
        </div>
        <div className="no-drag flex items-center gap-0.5 pr-1">
          <Button
            variant="ghost"
            size="icon"
            title={alwaysOnTop ? "Disable always on top" : "Enable always on top"}
            className="h-6 w-6 rounded-sm"
            onClick={handleToggleAlwaysOnTop}
          >
            {alwaysOnTop ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Refresh" onClick={poll}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-sm"
            title={topCenterSnapped ? "Snapped to top center" : "Snap to top center"}
            onClick={handleSnapTopCenter}
          >
            <Magnet className={cn("h-3.5 w-3.5", topCenterSnapped ? "fill-current" : "")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Open logs" onClick={() => window.airbar.openLogs()}>
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Minimize" onClick={() => window.airbar.minimize()}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Close" onClick={() => window.airbar.close()}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-2.5">
        {snapshot?.error ? <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{snapshot.error}</div> : null}
        {actionError ? <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">{actionError}</div> : null}

        <section className="grid gap-1.5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.workspace}
              project={project}
              onOpenError={setActionError}
              isDoneCleared={(session) => clearedDoneSessions[session.id] === session.updatedAt}
              onClearDone={() =>
                setClearedDoneSessions((current) => {
                  const next = { ...current };
                  for (const session of project.sessions) {
                    if (session.status === "done") {
                      next[session.id] = session.updatedAt;
                    }
                  }
                  return next;
                })
              }
              collapsed={projectUiState[project.workspace]?.collapsed ?? DEFAULT_PROJECT_UI_STATE.collapsed}
              hideIdle={projectUiState[project.workspace]?.hideIdle ?? DEFAULT_PROJECT_UI_STATE.hideIdle}
              onToggleCollapsed={() =>
                setProjectUiState((current) => ({
                  ...current,
                  [project.workspace]: {
                    collapsed: !(current[project.workspace]?.collapsed ?? DEFAULT_PROJECT_UI_STATE.collapsed),
                    hideIdle: current[project.workspace]?.hideIdle ?? DEFAULT_PROJECT_UI_STATE.hideIdle
                  }
                }))
              }
              onToggleHideIdle={() =>
                setProjectUiState((current) => ({
                  ...current,
                  [project.workspace]: {
                    collapsed: current[project.workspace]?.collapsed ?? DEFAULT_PROJECT_UI_STATE.collapsed,
                    hideIdle: !(current[project.workspace]?.hideIdle ?? DEFAULT_PROJECT_UI_STATE.hideIdle)
                  }
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
  isDoneCleared,
  onClearDone,
  collapsed,
  hideIdle,
  onToggleCollapsed,
  onToggleHideIdle
}: {
  project: AirbarProject;
  onOpenError: (message: string | null) => void;
  isDoneCleared: (session: AirbarSession) => boolean;
  onClearDone: () => void;
  collapsed: boolean;
  hideIdle: boolean;
  onToggleCollapsed: () => void;
  onToggleHideIdle: () => void;
}) {
  const visibleSessions = project.sessions.filter((session) => {
    if (collapsed) return false;
    if (session.status === "done" && isDoneCleared(session)) return false;
    if (hideIdle && session.status === "idle") return false;
    return true;
  });
  const workingCount = project.sessions.filter((session) => session.status === "working").length;
  const doneCount = project.sessions.filter((session) => session.status === "done" && !isDoneCleared(session)).length;

  const isProjectless = project.workspace === "Projectless";

  async function handleOpenProject() {
    onOpenError(null);
    const result = await window.airbar.openProjectFolder(project.workspace);
    if (!result.ok) {
      onOpenError(result.error || "Failed to open the project folder.");
    }
  }

  const collapseTitle = collapsed ? "Expand project" : "Collapse project";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="min-h-6 px-2 py-0.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-sm"
            title={collapseTitle}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <div className="min-w-0">
            <span className="block truncate text-[11px] font-medium leading-4">{project.name}</span>
          </div>
          {collapsed ? (
            <div className="flex shrink-0 items-center gap-1" title={`${workingCount} working, ${doneCount} done`}>
              {Array.from({ length: workingCount }).map((_, index) => (
                <span key={`working-${index}`} className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
              ))}
              {Array.from({ length: doneCount }).map((_, index) => (
                <span key={`done-${index}`} className="h-2 w-2 rounded-full bg-sky-400" />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {doneCount > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 rounded-sm"
              title="Clear done"
              onClick={onClearDone}
            >
              <CheckCheck className="h-3 w-3" />
            </Button>
          ) : null}
          <Button
            variant={hideIdle ? "secondary" : "ghost"}
            size="icon"
            className="h-5 w-5 shrink-0 rounded-sm"
            title={hideIdle ? "Show idle sessions" : "Hide idle sessions"}
            onClick={onToggleHideIdle}
          >
            {hideIdle ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-5 min-w-[24px] shrink-0 rounded-sm px-1"
            title={isProjectless ? "No project folder available" : "Open project folder in Explorer"}
            onClick={handleOpenProject}
            disabled={isProjectless}
          >
            <FolderOpen className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {collapsed ? null : visibleSessions.map((session) => (
          <SessionRow key={`${session.id}-${session.file}`} session={session} />
        ))}
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
  const message = session.lastMessage || command || "";
  const [actionError, setActionError] = useState<string | null>(null);
  const openAction = sessionOpenActions[SESSION_OPEN_ACTION];
  const OpenActionIcon = openAction.icon;

  async function handleSessionAction() {
    setActionError(null);
    const result = await openAction.run(session);
    if (!result.ok) {
      setActionError(result.error || openAction.fallbackError);
    }
  }

  return (
    <div className="grid grid-cols-[8px_minmax(0,1fr)_20px] items-center gap-1.5 border-b border-border px-2 py-1 last:border-b-0">
      <span className={cn("h-6 w-1 rounded-full self-center", statusTone[session.status])} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 truncate text-[11px] leading-4" title={session.title}>
            {session.title}
          </span>
          <span className="shrink-0 text-[9px] leading-4 text-muted-foreground" title={new Date(session.updatedAt).toLocaleString()}>
            {formatElapsed(session.updatedAt)}
          </span>
          {message ? <span className="min-w-0 flex-1 truncate text-[9px] leading-4 text-muted-foreground">{message}</span> : null}
        </div>
        {actionError ? <div className="mt-0.5 text-[9px] text-amber-300">{actionError}</div> : null}
      </div>
      <Button
        variant="secondary"
        size="icon"
        className="h-5 w-5 shrink-0 rounded-sm self-center"
        title={openAction.title(session)}
        onClick={handleSessionAction}
        disabled={openAction.disabled(session)}
      >
        <OpenActionIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

function formatElapsed(isoDate: string) {
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
