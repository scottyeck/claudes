import { execSync } from "child_process";
import { exec } from "./exec.js";
import type { TmuxPane } from "./types.js";

export function getTTYForPID(pid: string): string | null {
  const output = exec(`ps -ho tty -p ${pid} 2>/dev/null`).trim();
  const lines = output.split("\n").filter((l) => l.trim());
  const tty = lines[lines.length - 1]?.trim();
  if (!tty || tty === "??" || tty === "-" || tty === "TTY") return null;
  return tty.startsWith("/dev/") ? tty : `/dev/${tty}`;
}

export function getTmuxPanes(): TmuxPane[] {
  const output = exec(
    "tmux list-panes -aF '#{pane_tty}:#{pane_id}:#{session_name}:#{window_index}' 2>/dev/null"
  );
  const panes: TmuxPane[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [tty, paneId, sessionName, windowIndex] = line.split(":");
    if (tty && paneId && sessionName) {
      panes.push({ tty, paneId, sessionName, windowIndex });
    }
  }
  return panes;
}

export function findTmuxPaneForPID(
  pid: string,
  tmuxPanes: TmuxPane[]
): TmuxPane | null {
  const tty = getTTYForPID(pid);
  if (!tty) return null;
  return tmuxPanes.find((p) => p.tty === tty) || null;
}

export function jumpToTmuxPane(pane: TmuxPane | null): boolean {
  if (!pane) return false;
  try {
    const target = `${pane.sessionName}:${pane.windowIndex}`;
    execSync(`tmux select-window -t '${target}' 2>/dev/null`, { stdio: "pipe" });
    execSync(`tmux select-pane -t '${pane.paneId}' 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
