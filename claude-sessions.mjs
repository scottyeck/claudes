#!/usr/bin/env node
//
// claude-sessions - Interactive CLI for managing Claude Code instances
//
// Features:
// - Show status of all running Claude Code instances
// - Interactive TUI with vim-style navigation
// - Jump to any session's tmux pane
//
// Usage:
//   claude-sessions          - Launch interactive TUI
//   claude-sessions 2        - Jump directly to session #2
//   claude-sessions cloud    - Jump to first project matching "cloud"
//   claude-sessions --list   - Non-interactive list (original behavior)
//

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
import * as readline from "readline";

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

// ============================================================================
// tmux correlation functions
// ============================================================================

function getTTYForPID(pid) {
  const output = exec(`ps -ho tty -p ${pid} 2>/dev/null`).trim();
  if (!output || output === "??" || output === "-") return null;
  // Normalize TTY format (e.g., "ttys001" -> "/dev/ttys001")
  return output.startsWith("/dev/") ? output : `/dev/${output}`;
}

function getTmuxPanes() {
  const output = exec("tmux list-panes -aF '#{pane_tty}:#{pane_id}:#{session_name}' 2>/dev/null");
  const panes = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const [tty, paneId, sessionName] = line.split(":");
    if (tty && paneId && sessionName) {
      panes.push({ tty, paneId, sessionName });
    }
  }
  return panes;
}

function findTmuxPaneForPID(pid, tmuxPanes) {
  const tty = getTTYForPID(pid);
  if (!tty) return null;
  return tmuxPanes.find((p) => p.tty === tty) || null;
}

function jumpToTmuxPane(pane) {
  if (!pane) return false;
  try {
    execSync(`tmux switch-client -t '${pane.sessionName}' 2>/dev/null`, { stdio: "pipe" });
    execSync(`tmux select-pane -t '${pane.paneId}' 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Process discovery functions
// ============================================================================

function getClaudeProcesses() {
  const output = exec("lsof -c claude 2>/dev/null");
  const processes = [];

  for (const line of output.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[3] === "cwd") {
      const pid = parts[1];
      const cwd = parts[parts.length - 1];
      processes.push({ pid, cwd });
    }
  }

  return processes;
}

function getProcessStats(pid) {
  const output = exec(`ps -p ${pid} -o %cpu=,etime= 2>/dev/null`).trim();
  const [cpu, runtime] = output.split(/\s+/);
  return { cpu: parseFloat(cpu) || 0, runtime: runtime || "unknown" };
}

function getMostRecentSessionFile(projectDir) {
  try {
    const files = readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({
        name: f,
        path: join(projectDir, f),
        mtime: statSync(join(projectDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files[0]?.path || null;
  } catch {
    return null;
  }
}

function getFirstPromptFromIndex(indexFile, sessionId) {
  try {
    const data = JSON.parse(readFileSync(indexFile, "utf8"));
    const entry = data.entries?.find((e) => e.sessionId === sessionId);
    const prompt = entry?.firstPrompt;
    if (prompt && prompt !== "null" && prompt !== "No prompt") {
      return prompt;
    }
  } catch {}
  return null;
}

function getCleanUserMessages(sessionFile) {
  try {
    const content = readFileSync(sessionFile, "utf8");
    const messages = [];

    for (const line of content.split("\n")) {
      if (!line.includes('"type":"user"')) continue;
      try {
        const entry = JSON.parse(line);
        const msgContent = entry?.message?.content;
        if (typeof msgContent === "string") {
          const cleaned = msgContent.trim();
          // Skip messages starting with <, [, or empty
          if (cleaned && !cleaned.startsWith("<") && !cleaned.startsWith("[")) {
            messages.push(cleaned);
          }
        }
      } catch {}
    }

    return messages;
  } catch {
    return [];
  }
}

function truncate(str, maxLen = 65) {
  if (!str) return "";
  const single = str.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return single.length > maxLen ? single.slice(0, maxLen) : single;
}

// ============================================================================
// Data collection
// ============================================================================

function collectSessionData() {
  const processes = getClaudeProcesses();
  const claudeDir = join(homedir(), ".claude", "projects");
  const tmuxPanes = getTmuxPanes();
  const sessions = [];

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

// ============================================================================
// Rendering functions
// ============================================================================

const BOX_WIDTH = 71;
const BOX_CHARS = {
  topLeft: "╔",
  topRight: "╗",
  bottomLeft: "╚",
  bottomRight: "╝",
  horizontal: "═",
  vertical: "║",
  midLeft: "╠",
  midRight: "╣",
  midHorizontal: "─",
};

function boxLine(content, pad = true) {
  const inner = pad ? ` ${content}` : content;
  const padLen = BOX_WIDTH - 2 - inner.length;
  return `${BOX_CHARS.vertical}${inner}${" ".repeat(Math.max(0, padLen))}${BOX_CHARS.vertical}`;
}

function boxTop() {
  return `${BOX_CHARS.topLeft}${BOX_CHARS.horizontal.repeat(BOX_WIDTH - 2)}${BOX_CHARS.topRight}`;
}

function boxBottom() {
  return `${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(BOX_WIDTH - 2)}${BOX_CHARS.bottomRight}`;
}

function boxMid() {
  return `${BOX_CHARS.midLeft}${BOX_CHARS.midHorizontal.repeat(BOX_WIDTH - 2)}${BOX_CHARS.midRight}`;
}

function renderSessionRow(session, index, isSelected) {
  const { isActive, projectName, runtime, firstPrompt, lastPrompt } = session;
  const state = isActive ? "🔄 ACTIVE" : "💤 IDLE";
  const marker = isSelected ? "▶" : " ";
  const num = `[${index + 1}]`;

  const lines = [];
  const header = `${marker} ${num} ${state} | ${projectName.slice(0, 24).padEnd(24)} | Up ${runtime}`;
  lines.push(boxLine(header));

  if (firstPrompt) {
    lines.push(boxLine(`      🚀 ${truncate(firstPrompt, 55)}`));
  }
  if (lastPrompt && lastPrompt !== firstPrompt) {
    lines.push(boxLine(`      💬 ${truncate(lastPrompt, 55)}`));
  }

  return lines;
}

function renderList(sessions) {
  for (const session of sessions) {
    const { pid, cwd, cpu, runtime, isActive, firstPrompt, lastPrompt } = session;
    const state = isActive ? "🔄 ACTIVE" : "💤 IDLE";

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`${state} | PID ${pid.toString().padEnd(5)} | CPU ${cpu.toFixed(1).padStart(5)}% | Up ${runtime}`);
    console.log(`📁 ${basename(cwd)}`);
    if (firstPrompt) {
      console.log(`🚀 ${firstPrompt}`);
    }
    if (lastPrompt && lastPrompt !== firstPrompt) {
      console.log(`💬 ${lastPrompt}`);
    }
  }
  console.log("═══════════════════════════════════════════════════════════════════");
}

function renderTUI(sessions, selectedIndex, searchQuery = "") {
  const output = [];

  // Clear screen and move cursor to top
  output.push("\x1b[2J\x1b[H");

  // Filter sessions if searching
  const filteredSessions = searchQuery
    ? sessions.filter(
        (s) =>
          s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.firstPrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.lastPrompt.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  // Header
  output.push(boxTop());
  output.push(boxLine("Claude Sessions                                    [j/k] navigate"));
  output.push(boxMid());

  if (filteredSessions.length === 0) {
    output.push(boxLine(searchQuery ? "No matching sessions found" : "No Claude sessions running"));
  } else {
    for (let i = 0; i < filteredSessions.length; i++) {
      const sessionLines = renderSessionRow(filteredSessions[i], i, i === selectedIndex);
      output.push(...sessionLines);
      if (i < filteredSessions.length - 1) {
        output.push(boxMid());
      }
    }
  }

  // Footer
  output.push(boxMid());
  if (searchQuery !== null && searchQuery !== undefined && typeof searchQuery === "string" && searchQuery.length > 0) {
    output.push(boxLine(`Search: ${searchQuery}_`));
  } else {
    output.push(boxLine("[Enter] Jump  [/] Search  [1-9] Direct  [q] Quit"));
  }
  output.push(boxBottom());

  process.stdout.write(output.join("\n"));

  // Return filtered sessions so caller knows what's being displayed
  return filteredSessions;
}

// ============================================================================
// TUI interaction
// ============================================================================

function startTUI(sessions) {
  if (sessions.length === 0) {
    console.log("No Claude sessions running.");
    process.exit(0);
  }

  let selectedIndex = 0;
  let searchMode = false;
  let searchQuery = "";
  let displayedSessions = sessions;

  // Setup raw mode for immediate key handling
  if (!process.stdin.isTTY) {
    console.log("Not running in a TTY. Use --list for non-interactive output.");
    process.exit(1);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  const render = () => {
    displayedSessions = renderTUI(sessions, selectedIndex, searchMode ? searchQuery : "");
  };

  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdout.write("\x1b[2J\x1b[H"); // Clear screen
  };

  const jumpToSelected = () => {
    if (displayedSessions.length === 0) return false;
    const session = displayedSessions[selectedIndex];
    if (session?.tmuxPane) {
      cleanup();
      return jumpToTmuxPane(session.tmuxPane);
    }
    return false;
  };

  render();

  process.stdin.on("keypress", (str, key) => {
    if (!key) return;

    // Handle Ctrl+C
    if (key.ctrl && key.name === "c") {
      cleanup();
      process.exit(0);
    }

    if (searchMode) {
      // Search mode key handling
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
      // Normal mode key handling
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
      } else if (str >= "1" && str <= "9") {
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

// ============================================================================
// CLI argument handling
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    return { mode: "help" };
  }

  if (args.includes("--list") || args.includes("-l")) {
    return { mode: "list" };
  }

  if (args.length === 0) {
    return { mode: "tui" };
  }

  const arg = args[0];
  const num = parseInt(arg, 10);

  if (!isNaN(num) && num > 0) {
    return { mode: "jump-number", value: num };
  }

  return { mode: "jump-name", value: arg };
}

function showHelp() {
  console.log(`
claude-sessions - Interactive CLI for managing Claude Code instances

Usage:
  claude-sessions              Launch interactive TUI
  claude-sessions <number>     Jump directly to session #N
  claude-sessions <name>       Jump to first project matching name
  claude-sessions --list       Non-interactive list output
  claude-sessions --help       Show this help message

TUI Navigation:
  j/k or ↑/↓    Move selection up/down
  Enter         Jump to selected session
  1-9           Jump directly to session by number
  /             Enter search mode
  Escape        Exit search mode
  q             Quit
`);
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const { mode, value } = parseArgs();

  if (mode === "help") {
    showHelp();
    process.exit(0);
  }

  const sessions = collectSessionData();

  if (mode === "list") {
    renderList(sessions);
    process.exit(0);
  }

  if (mode === "jump-number") {
    const index = value - 1;
    if (index >= 0 && index < sessions.length) {
      const session = sessions[index];
      if (session.tmuxPane && jumpToTmuxPane(session.tmuxPane)) {
        process.exit(0);
      } else {
        console.error(`Session ${value} has no tmux pane or jump failed.`);
        process.exit(1);
      }
    } else {
      console.error(`Session ${value} not found. There are ${sessions.length} sessions.`);
      process.exit(1);
    }
  }

  if (mode === "jump-name") {
    const match = sessions.find((s) =>
      s.projectName.toLowerCase().includes(value.toLowerCase())
    );
    if (match) {
      if (match.tmuxPane && jumpToTmuxPane(match.tmuxPane)) {
        process.exit(0);
      } else {
        console.error(`Session "${match.projectName}" has no tmux pane or jump failed.`);
        process.exit(1);
      }
    } else {
      console.error(`No session matching "${value}" found.`);
      process.exit(1);
    }
  }

  if (mode === "tui") {
    startTUI(sessions);
  }
}

main();
