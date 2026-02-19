import { List, ActionPanel, Action, showToast, Toast, closeMainWindow } from "@raycast/api";
import { useState, useEffect } from "react";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface TmuxPane {
  tty: string;
  paneId: string;
  sessionName: string;
  windowIndex: string;
}

interface Session {
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

interface CacheData {
  updatedAt: string;
  sessions: Session[];
}

const CACHE_FILE = join(homedir(), ".claude", "sessions-cache.json");

function readCache(): { sessions: Session[]; updatedAt: string | null; error: string | null } {
  if (!existsSync(CACHE_FILE)) {
    return { sessions: [], updatedAt: null, error: "Cache file not found. Is the daemon running?" };
  }

  try {
    const content = readFileSync(CACHE_FILE, "utf-8");
    const data: CacheData = JSON.parse(content);
    return { sessions: data.sessions, updatedAt: data.updatedAt, error: null };
  } catch (e) {
    return { sessions: [], updatedAt: null, error: `Failed to read cache: ${e}` };
  }
}

function formatAge(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

export default function Command() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCache = () => {
    setIsLoading(true);
    const { sessions, updatedAt, error } = readCache();
    setSessions(sessions);
    setUpdatedAt(updatedAt);
    setError(error);
    setIsLoading(false);
  };

  useEffect(() => {
    loadCache();
  }, []);

  const jumpToSession = async (session: Session) => {
    if (!session.tmuxPane) {
      await showToast({ style: Toast.Style.Failure, title: "No tmux pane found" });
      return;
    }

    try {
      const { sessionName, windowIndex, paneId } = session.tmuxPane;

      // Close Raycast window first
      await closeMainWindow();

      // Focus Ghostty
      execSync(`osascript -e 'tell application "Ghostty" to activate'`);

      // Navigate tmux
      execSync(`/opt/homebrew/bin/tmux select-window -t '${sessionName}:${windowIndex}'`);
      execSync(`/opt/homebrew/bin/tmux select-pane -t '${paneId}'`);
      execSync(`/opt/homebrew/bin/tmux switch-client -t '${sessionName}'`);

      await showToast({ style: Toast.Style.Success, title: `Jumped to ${session.projectName}` });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to jump", message: String(e) });
    }
  };

  if (error) {
    return (
      <List>
        <List.EmptyView title="Error loading sessions" description={error} />
      </List>
    );
  }

  const subtitle = updatedAt ? `Updated ${formatAge(updatedAt)}` : undefined;

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search sessions...">
      {sessions.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No Claude sessions found"
          description="Start a Claude Code session in a tmux pane to see it here"
        />
      ) : (
        sessions.map((session) => (
          <List.Item
            key={session.pid}
            title={session.projectName}
            subtitle={session.firstPrompt || session.lastPrompt || undefined}
            accessories={[
              { text: session.runtime },
              { tag: { value: session.isActive ? "ACTIVE" : "IDLE", color: session.isActive ? "#22c55e" : "#6b7280" } },
              { text: subtitle, tooltip: updatedAt ? `Cache updated: ${updatedAt}` : undefined },
            ]}
            actions={
              <ActionPanel>
                <Action title="Jump to Session" onAction={() => jumpToSession(session)} />
                <Action title="Refresh" shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => loadCache()} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
