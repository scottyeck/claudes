export interface TmuxPane {
  tty: string;
  paneId: string;
  sessionName: string;
  windowIndex: string;
}

export interface ClaudeProcess {
  pid: string;
  cwd: string;
}

export interface ProcessStats {
  cpu: number;
  runtime: string;
}

export interface Session {
  pid: string;
  cwd: string;
  projectName: string;
  cpu: number;
  runtime: string;
  isActive: boolean;
  firstPrompt: string;
  lastPrompt: string;
  tmuxPane: TmuxPane | null;
}
