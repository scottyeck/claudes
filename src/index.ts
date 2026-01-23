#!/usr/bin/env node

import { writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseArgs } from "./cli.js";
import { renderList } from "./render.js";
import { collectSessionData } from "./session.js";
import { jumpToTmuxPane } from "./tmux.js";
import { startTUI } from "./tui.js";

const CACHE_FILE = join(homedir(), ".claude", "sessions-cache.json");

function main(): void {
  const { options, target } = parseArgs();

  const sessions = collectSessionData();

  if (options.updateCache) {
    try {
      mkdirSync(join(homedir(), ".claude"), { recursive: true });
      const cacheData = {
        updatedAt: new Date().toISOString(),
        sessions,
      };
      writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    } catch {
      // Silently fail - daemon should not produce output
    }
    process.exit(0);
  }

  if (options.json) {
    console.log(JSON.stringify(sessions, null, 2));
    process.exit(0);
  }

  if (options.list) {
    renderList(sessions);
    process.exit(0);
  }

  if (target) {
    const num = parseInt(target, 10);

    if (!isNaN(num) && num > 0) {
      // Jump by number
      const index = num - 1;
      if (index >= 0 && index < sessions.length) {
        const session = sessions[index];
        if (session.tmuxPane && jumpToTmuxPane(session.tmuxPane)) {
          process.exit(0);
        } else {
          console.error(`Session ${num} has no tmux pane or jump failed.`);
          process.exit(1);
        }
      } else {
        console.error(`Session ${num} not found. There are ${sessions.length} sessions.`);
        process.exit(1);
      }
    } else {
      // Jump by name
      const match = sessions.find((s) =>
        s.projectName.toLowerCase().includes(target.toLowerCase())
      );
      if (match) {
        if (match.tmuxPane && jumpToTmuxPane(match.tmuxPane)) {
          process.exit(0);
        } else {
          console.error(`Session "${match.projectName}" has no tmux pane or jump failed.`);
          process.exit(1);
        }
      } else {
        console.error(`No session matching "${target}" found.`);
        process.exit(1);
      }
    }
  }

  // Default: start TUI
  startTUI(sessions);
}

main();
