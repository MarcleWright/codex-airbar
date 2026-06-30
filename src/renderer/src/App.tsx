import { CheckCheck, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, FileText, FolderOpen, Magnet, Minus, Moon, Pin, PinOff, RefreshCw, Settings, Sun, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { cn } from "./lib/utils";

const POLL_MS = 5000;
const PROJECT_UI_STORAGE_KEY = "codex-airbar-project-ui";
const CLEARED_DONE_STORAGE_KEY = "codex-airbar-cleared-done";
const SETTINGS_STORAGE_KEY = "codex-airbar-settings";
const DEFAULT_PROJECT_LIMIT = 4;
const MIN_PROJECT_LIMIT = 2;
const MAX_PROJECT_LIMIT = 6;
const DEFAULT_AIRBAR_WIDTH = 630;
const MIN_AIRBAR_WIDTH = 520;
const MAX_AIRBAR_WIDTH = 920;
const AUTO_HEIGHT_TITLE_BAR = 32;
const AUTO_HEIGHT_CONTENT_PADDING_Y = 20;
const AUTO_HEIGHT_PROJECT_HEADER = 26;
const AUTO_HEIGHT_SESSION_ROW = 28;
const AUTO_HEIGHT_PROJECT_GAP = 6;
const AUTO_HEIGHT_EMPTY_STATE = 82;
const AUTO_HEIGHT_ALERT = 42;
const COLLAPSED_SUMMARY_WIDTH = "min(420px, 64vw)";
const SETTINGS_VIEW_HEIGHT = 226;

type AirbarThemeSurface = "classic" | "glass";

type AirbarSettings = {
  themeSurface: AirbarThemeSurface;
  width: number;
  projectLimit: number;
};

const DEFAULT_AIRBAR_SETTINGS: AirbarSettings = {
  themeSurface: "classic",
  width: DEFAULT_AIRBAR_WIDTH,
  projectLimit: DEFAULT_PROJECT_LIMIT
};

type AirbarView = "projects" | "settings";

type OpenActionKey = "openWorkspace" | "resumeSession";

const SESSION_OPEN_ACTION: OpenActionKey = "openWorkspace";

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
  const [isBarCollapsed, setIsBarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<AirbarView>("projects");
  const [settings, setSettings] = useState<AirbarSettings>(() => readAirbarSettings());
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

  const autoWindowHeight = useMemo(() => {
    return calculateAutoWindowHeight({
      projects: filteredProjects,
      projectUiState,
      clearedDoneSessions,
      projectLimit: settings.projectLimit,
      hasError: Boolean(snapshot?.error),
      hasActionError: Boolean(actionError),
      isEmpty: !snapshot?.error && filteredProjects.length === 0
    });
  }, [actionError, clearedDoneSessions, filteredProjects, projectUiState, settings.projectLimit, snapshot?.error]);

  const statusSummary = useMemo(() => {
    return calculateStatusSummary(filteredProjects, clearedDoneSessions);
  }, [clearedDoneSessions, filteredProjects]);

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

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.airbar.setWindowWidth(settings.width).catch(() => null);
    window.airbar.setThemeSurface(settings.themeSurface).catch(() => null);
  }, [settings]);

  useEffect(() => {
    const nextHeight = isBarCollapsed ? AUTO_HEIGHT_TITLE_BAR : activeView === "settings" ? SETTINGS_VIEW_HEIGHT : autoWindowHeight;
    window.airbar.setContentHeight(nextHeight).catch(() => null);
  }, [activeView, autoWindowHeight, isBarCollapsed]);

  async function handleToggleAlwaysOnTop() {
    const next = await window.airbar.setAlwaysOnTop(!alwaysOnTop);
    setAlwaysOnTop(next);
  }

  async function handleSnapTopCenter() {
    const next = await window.airbar.snapTopCenter();
    setTopCenterSnapped(next);
  }

  return (
    <div
      className={cn("airbar-shell flex h-screen flex-col overflow-hidden text-foreground", `airbar-surface-${settings.themeSurface}`)}
      data-surface={settings.themeSurface}
    >
      <header className={cn("flex h-8 items-center bg-background/95", !isBarCollapsed && "border-b border-border")}>
        <div className="no-drag flex h-full min-w-0 items-center px-1.5">
          <button
            type="button"
            className="no-drag flex h-5 min-w-0 items-center gap-1.5 rounded-sm px-1.5 text-left active:bg-muted/50"
            title={isBarCollapsed ? "Restore Airbar" : "Collapse to title bar"}
            onClick={() => setIsBarCollapsed((current) => !current)}
          >
            <div className="h-4 w-1 rounded-full bg-gradient-to-b from-emerald-300 to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.28)]" />
            <h1 className="truncate text-[12px] font-semibold leading-none">Codex Airbar</h1>
          </button>
        </div>
        <div className={cn("h-full min-w-[32px] flex-1", !isBarCollapsed && "drag-region")} />
        <div
          className={cn("no-drag flex h-full items-center justify-end", isBarCollapsed ? "min-w-0" : "shrink-0")}
          style={isBarCollapsed ? { width: COLLAPSED_SUMMARY_WIDTH } : undefined}
        >
          {isBarCollapsed ? (
            <StatusSummaryDots summary={statusSummary} onRestore={() => setIsBarCollapsed(false)} />
          ) : (
            <TopBarToolset
              alwaysOnTop={alwaysOnTop}
              topCenterSnapped={topCenterSnapped}
              theme={theme}
              onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
              onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            onSnapTopCenter={handleSnapTopCenter}
            onRefresh={poll}
            settingsActive={activeView === "settings"}
            onToggleSettings={() => setActiveView((current) => (current === "settings" ? "projects" : "settings"))}
            onOpenLogs={() => window.airbar.openLogs()}
          />
          )}
        </div>
        <div className="no-drag flex items-center gap-0.5 pr-1.5">
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Minimize" onClick={() => window.airbar.minimize()}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Close" onClick={() => window.airbar.close()}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {!isBarCollapsed && activeView === "projects" ? (
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
      ) : null}
      {!isBarCollapsed && activeView === "settings" ? (
        <SettingsView
          settings={settings}
          onSettingsChange={(nextSettings) => setSettings(nextSettings)}
        />
      ) : null}
    </div>
  );
}

function readAirbarSettings(): AirbarSettings {
  try {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return DEFAULT_AIRBAR_SETTINGS;
    const parsed = JSON.parse(saved) as Partial<AirbarSettings>;
    return normalizeAirbarSettings(parsed);
  } catch {
    return DEFAULT_AIRBAR_SETTINGS;
  }
}

function normalizeAirbarSettings(settings: Partial<AirbarSettings>): AirbarSettings {
  return {
    themeSurface: isAirbarThemeSurface(settings.themeSurface) ? settings.themeSurface : DEFAULT_AIRBAR_SETTINGS.themeSurface,
    width: clampNumber(settings.width, MIN_AIRBAR_WIDTH, MAX_AIRBAR_WIDTH, DEFAULT_AIRBAR_WIDTH),
    projectLimit: clampNumber(settings.projectLimit, MIN_PROJECT_LIMIT, MAX_PROJECT_LIMIT, DEFAULT_PROJECT_LIMIT)
  };
}

function isAirbarThemeSurface(value: unknown): value is AirbarThemeSurface {
  return value === "classic" || value === "glass";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.round(parsed), max));
}

function calculateStatusSummary(projects: AirbarProject[], clearedDoneSessions: Record<string, string>) {
  return projects.reduce(
    (summary, project) => {
      for (const session of project.sessions) {
        if (session.status === "working") summary.working += 1;
        if (session.status === "done" && clearedDoneSessions[session.id] !== session.updatedAt) summary.done += 1;
      }
      return summary;
    },
    { working: 0, done: 0 }
  );
}

function TopBarToolset({
  alwaysOnTop,
  topCenterSnapped,
  theme,
  onToggleAlwaysOnTop,
  onToggleTheme,
  onSnapTopCenter,
  onRefresh,
  settingsActive,
  onToggleSettings,
  onOpenLogs
}: {
  alwaysOnTop: boolean;
  topCenterSnapped: boolean;
  theme: string;
  onToggleAlwaysOnTop: () => void;
  onToggleTheme: () => void;
  onSnapTopCenter: () => void;
  onRefresh: () => void;
  settingsActive: boolean;
  onToggleSettings: () => void;
  onOpenLogs: () => void;
}) {
  return (
    <div className="no-drag flex h-full w-full min-w-0 items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        title={alwaysOnTop ? "Disable always on top" : "Enable always on top"}
        className="h-6 w-6 rounded-sm"
        onClick={onToggleAlwaysOnTop}
      >
        {alwaysOnTop ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm"
        title={theme === "dark" ? "Dark theme active" : "Light theme active"}
        onClick={onToggleTheme}
      >
        {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm"
        title={topCenterSnapped ? "Snapped to top center" : "Snap to top center"}
        onClick={onSnapTopCenter}
      >
        <Magnet className={cn("h-3.5 w-3.5", topCenterSnapped ? "fill-current" : "")} />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Refresh" onClick={onRefresh}>
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={cn("h-6 w-6 rounded-sm", settingsActive && "bg-muted")} title="Settings" onClick={onToggleSettings}>
        <Settings className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm" title="Open logs" onClick={onOpenLogs}>
        <FileText className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StatusSummaryDots({
  summary,
  onRestore
}: {
  summary: { working: number; done: number };
  onRestore: () => void;
}) {
  const dotCount = summary.working + summary.done;
  return (
    <button
      type="button"
      className="no-drag flex h-5 w-full min-w-0 items-center justify-end gap-1 overflow-hidden rounded-sm px-1 hover:bg-muted/45 active:bg-muted"
      title={`${summary.working} working, ${summary.done} done. Click to restore Airbar.`}
      onClick={onRestore}
    >
      {dotCount === 0 ? <span className="text-[10px] leading-none text-muted-foreground">idle</span> : null}
      {Array.from({ length: summary.working }).map((_, index) => (
        <span key={`working-${index}`} className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.65)]" />
      ))}
      {Array.from({ length: summary.done }).map((_, index) => (
        <span key={`done-${index}`} className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
      ))}
    </button>
  );
}

function SettingsView({
  settings,
  onSettingsChange
}: {
  settings: AirbarSettings;
  onSettingsChange: (settings: AirbarSettings) => void;
}) {
  function updateSettings(next: Partial<AirbarSettings>) {
    onSettingsChange(normalizeAirbarSettings({ ...settings, ...next }));
  }

  return (
    <main className="flex-1 overflow-auto p-2.5">
      <section className="grid gap-2">
        <Card className="p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium leading-4">Theme</div>
              <div className="text-[10px] leading-4 text-muted-foreground">Surface style</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 rounded-sm px-2 text-[10px]", settings.themeSurface === "classic" && "bg-muted")}
                onClick={() => updateSettings({ themeSurface: "classic" })}
              >
                Classic
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 rounded-sm px-2 text-[10px]", settings.themeSurface === "glass" && "bg-muted")}
                onClick={() => updateSettings({ themeSurface: "glass" })}
              >
                Glass
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium leading-4">Width</div>
              <div className="text-[10px] leading-4 text-muted-foreground">{settings.width}px</div>
            </div>
            <input
              className="max-w-[260px] flex-1"
              type="range"
              min={MIN_AIRBAR_WIDTH}
              max={MAX_AIRBAR_WIDTH}
              step={10}
              value={settings.width}
              onChange={(event) => updateSettings({ width: Number(event.currentTarget.value) })}
            />
          </div>
        </Card>

        <Card className="p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium leading-4">Projects</div>
              <div className="text-[10px] leading-4 text-muted-foreground">{settings.projectLimit} height basis</div>
            </div>
            <input
              className="max-w-[260px] flex-1"
              type="range"
              min={MIN_PROJECT_LIMIT}
              max={MAX_PROJECT_LIMIT}
              step={1}
              value={settings.projectLimit}
              onChange={(event) => updateSettings({ projectLimit: Number(event.currentTarget.value) })}
            />
          </div>
        </Card>
      </section>
    </main>
  );
}

function calculateVisibleSessionCount(
  project: AirbarProject,
  uiState: ProjectUiState | undefined,
  clearedDoneSessions: Record<string, string>
) {
  const collapsed = uiState?.collapsed ?? DEFAULT_PROJECT_UI_STATE.collapsed;
  if (collapsed) return 0;

  const hideIdle = uiState?.hideIdle ?? DEFAULT_PROJECT_UI_STATE.hideIdle;
  return project.sessions.filter((session) => {
    if (session.status === "done" && clearedDoneSessions[session.id] === session.updatedAt) return false;
    if (hideIdle && session.status === "idle") return false;
    return true;
  }).length;
}

function calculateAutoWindowHeight({
  projects,
  projectUiState,
  clearedDoneSessions,
  projectLimit,
  hasError,
  hasActionError,
  isEmpty
}: {
  projects: AirbarProject[];
  projectUiState: Record<string, ProjectUiState>;
  clearedDoneSessions: Record<string, string>;
  projectLimit: number;
  hasError: boolean;
  hasActionError: boolean;
  isEmpty: boolean;
}) {
  const visibleProjects = projects.slice(0, projectLimit);
  const projectHeight = visibleProjects.reduce((total, project) => {
    const sessionCount = calculateVisibleSessionCount(project, projectUiState[project.workspace], clearedDoneSessions);
    return total + AUTO_HEIGHT_PROJECT_HEADER + sessionCount * AUTO_HEIGHT_SESSION_ROW;
  }, 0);
  const projectGaps = Math.max(0, visibleProjects.length - 1) * AUTO_HEIGHT_PROJECT_GAP;
  const alertHeight = (hasError ? AUTO_HEIGHT_ALERT : 0) + (hasActionError ? AUTO_HEIGHT_ALERT : 0);
  const bodyHeight = isEmpty ? AUTO_HEIGHT_EMPTY_STATE : projectHeight + projectGaps;

  return AUTO_HEIGHT_TITLE_BAR + AUTO_HEIGHT_CONTENT_PADDING_Y + alertHeight + bodyHeight;
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
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-sm"
            title={hideIdle ? "Show idle sessions" : "Hide idle sessions"}
            onClick={onToggleHideIdle}
          >
            {hideIdle ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
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
    <div
      data-airbar-session-row
      className="grid grid-cols-[8px_minmax(0,1fr)_20px] items-center gap-1.5 border-b border-border px-2 py-1 last:border-b-0"
    >
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
