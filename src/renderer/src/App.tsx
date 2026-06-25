import { CheckCircle2, Circle, FileText, Minus, Moon, RefreshCw, Search, Sun, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./theme-provider";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Select } from "./components/ui/select";
import { cn } from "./lib/utils";

const POLL_MS = 5000;

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

export function App() {
  const [snapshot, setSnapshot] = useState<AirbarSnapshot | null>(null);
  const previousStatusesRef = useRef<Map<string, AirbarStatus>>(new Map());
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<AirbarStatus | "all">("all");
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
    const needle = filterText.trim().toLowerCase();
    return (snapshot?.projects || [])
      .map((project) => {
        const sessions = project.sessions.filter((session) => {
          if (statusFilter !== "all" && session.status !== statusFilter) return false;
          if (!needle) return true;
          return [project.name, project.workspace, session.title, session.id, session.lastMessage].some((value) =>
            String(value || "").toLowerCase().includes(needle)
          );
        });
        return { ...project, sessions };
      })
      .filter((project) => project.sessions.length > 0);
  }, [filterText, snapshot?.projects, statusFilter]);

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
    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

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

        <section className="mb-3 grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" type="search" placeholder="Filter projects or sessions" value={filterText} onChange={(event) => setFilterText(event.target.value)} />
          </div>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AirbarStatus | "all")}>
            <option value="all">All</option>
            <option value="working">Working</option>
            <option value="done">Done</option>
            <option value="recent">Recent</option>
            <option value="idle">Idle</option>
          </Select>
        </section>

        {snapshot?.error ? <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{snapshot.error}</div> : null}

        <section className="grid gap-2.5">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.workspace} project={project} />
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

function ProjectCard({ project }: { project: AirbarProject }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="min-w-0">
          <strong className="block truncate text-sm">{project.name}</strong>
          <span className="block max-w-[280px] truncate text-[11px] text-muted-foreground" title={project.workspace}>
            {project.workspace}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{project.sessions.length}</span>
      </CardHeader>
      <CardContent>
        {project.sessions.map((session) => (
          <SessionRow key={`${session.id}-${session.file}`} session={session} />
        ))}
      </CardContent>
    </Card>
  );
}

function SessionRow({ session }: { session: AirbarSession }) {
  const command = session.recentCommands?.[0]?.command;
  const message = session.lastMessage || command || session.lastType || "";

  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0">
      <span className={cn("mt-1.5 h-2 w-2 rounded-full", statusTone[session.status])} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <strong className="truncate text-sm" title={session.title}>
            {session.title}
          </strong>
          <Badge>{session.status}</Badge>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {session.status === "done" ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          <span>{formatRelative(session.updatedAt)}</span>
          <span>{session.id.slice(0, 8)}</span>
          <span className="truncate">{session.lastType}</span>
        </div>
        {message ? <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{message}</div> : null}
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
