import * as readline from "readline";
import { renderTUI } from "./render.js";
import { jumpToTmuxPane } from "./tmux.js";
import type { Session } from "./types.js";

export function startTUI(sessions: Session[]): void {
  if (sessions.length === 0) {
    console.log("No Claude sessions running.");
    process.exit(0);
  }

  let selectedIndex = 0;
  let searchMode = false;
  let searchQuery = "";
  let displayedSessions = sessions;

  if (!process.stdin.isTTY) {
    console.log("Not running in a TTY. Use --list for non-interactive output.");
    process.exit(1);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  const render = (): void => {
    displayedSessions = renderTUI(sessions, selectedIndex, searchMode ? searchQuery : "");
  };

  const cleanup = (): void => {
    process.stdin.setRawMode(false);
    process.stdout.write("\x1b[2J\x1b[H");
  };

  const jumpToSelected = (): boolean => {
    if (displayedSessions.length === 0) return false;
    const session = displayedSessions[selectedIndex];
    if (session?.tmuxPane) {
      cleanup();
      return jumpToTmuxPane(session.tmuxPane);
    }
    return false;
  };

  render();

  process.stdin.on("keypress", (str: string | undefined, key: readline.Key) => {
    if (!key) return;

    if (key.ctrl && key.name === "c") {
      cleanup();
      process.exit(0);
    }

    if (searchMode) {
      if (key.name === "escape") {
        searchMode = false;
        searchQuery = "";
        selectedIndex = 0;
        render();
      } else if (key.name === "return") {
        searchMode = false;
        if (jumpToSelected()) {
          process.exit(0);
        }
        render();
      } else if (key.name === "backspace") {
        searchQuery = searchQuery.slice(0, -1);
        selectedIndex = 0;
        render();
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        searchQuery += str;
        selectedIndex = 0;
        render();
      }
    } else {
      if (key.name === "q") {
        cleanup();
        process.exit(0);
      } else if (key.name === "j" || key.name === "down") {
        selectedIndex = Math.min(selectedIndex + 1, displayedSessions.length - 1);
        render();
      } else if (key.name === "k" || key.name === "up") {
        selectedIndex = Math.max(selectedIndex - 1, 0);
        render();
      } else if (key.name === "return") {
        if (jumpToSelected()) {
          process.exit(0);
        }
      } else if (str === "/") {
        searchMode = true;
        searchQuery = "";
        render();
      } else if (str && str >= "1" && str <= "9") {
        const num = parseInt(str, 10) - 1;
        if (num < displayedSessions.length) {
          selectedIndex = num;
          if (jumpToSelected()) {
            process.exit(0);
          }
          render();
        }
      }
    }
  });
}
