/// <reference types="vite/client" />

type AirbarStatus = "working" | "done" | "recent" | "idle";

interface AirbarCommand {
  command: string;
  cwd: string;
  updatedAtMs: number | null;
  osPid: number | null;
}

interface AirbarSession {
  id: string;
  title: string;
  status: AirbarStatus;
  updatedAt: string;
  workspace: string;
  file: string;
  lastType: string;
  lastMessage: string;
  recentCommands: AirbarCommand[];
}

interface AirbarProject {
  workspace: string;
  name: string;
  sessions: AirbarSession[];
  counts: Record<AirbarStatus, number>;
}

interface AirbarSnapshot {
  generatedAt: string;
  codexHome: string;
  error?: string;
  projects: AirbarProject[];
}

interface Window {
  airbar: {
    getSnapshot: () => Promise<AirbarSnapshot>;
    openProject: (workspacePath: string) => Promise<{ ok: boolean; error?: string }>;
    minimize: () => Promise<void>;
    getAlwaysOnTop: () => Promise<boolean>;
    setAlwaysOnTop: (value: boolean) => Promise<boolean>;
    close: () => Promise<void>;
    openLogs: () => Promise<void>;
    notify: (payload: { title: string; body: string }) => Promise<boolean>;
  };
}
