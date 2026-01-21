import { existsSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import {
  getClaudeProcesses,
  getProcessStats,
  getMostRecentSessionFile,
  getFirstPromptFromIndex,
  getCleanUserMessages,
  truncate,
} from "./process.js";
import { getTmuxPanes, findTmuxPaneForPID } from "./tmux.js";
import type { Session } from "./types.js";

export function collectSessionData(): Session[] {
  const processes = getClaudeProcesses();
  const claudeDir = join(homedir(), ".claude", "projects");
  const tmuxPanes = getTmuxPanes();
  const sessions: Session[] = [];

  for (const { pid, cwd } of processes) {
    const projectPath = cwd.replace(/\//g, "-");
    const projectDir = join(claudeDir, projectPath);
    const { cpu, runtime } = getProcessStats(pid);
    const tmuxPane = findTmuxPaneForPID(pid, tmuxPanes);

    let firstPrompt = "";
    let lastPrompt = "";

    if (existsSync(projectDir)) {
      const sessionFile = getMostRecentSessionFile(projectDir);

      if (sessionFile) {
        const sessionId = basename(sessionFile, ".jsonl");
        const indexFile = join(projectDir, "sessions-index.json");

        if (existsSync(indexFile)) {
          firstPrompt = getFirstPromptFromIndex(indexFile, sessionId) || "";
        }

        const cleanMsgs = getCleanUserMessages(sessionFile);

        if (!firstPrompt && cleanMsgs.length > 0) {
          firstPrompt = cleanMsgs[0];
        }
        if (cleanMsgs.length > 0) {
          lastPrompt = cleanMsgs[cleanMsgs.length - 1];
        }

        firstPrompt = truncate(firstPrompt);
        lastPrompt = truncate(lastPrompt);
      }
    }

    const isActive = cpu > 5;
    sessions.push({
      pid,
      cwd,
      projectName: basename(cwd),
      cpu,
      runtime,
      isActive,
      firstPrompt,
      lastPrompt,
      tmuxPane,
    });
  }

  return sessions;
}
