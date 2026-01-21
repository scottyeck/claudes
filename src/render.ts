import { basename } from "path";
import { truncate } from "./process.js";
import type { Session } from "./types.js";

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

export function boxLine(content: string, pad = true): string {
  const inner = pad ? ` ${content}` : content;
  const padLen = BOX_WIDTH - 2 - inner.length;
  return `${BOX_CHARS.vertical}${inner}${" ".repeat(Math.max(0, padLen))}${BOX_CHARS.vertical}`;
}

export function boxTop(): string {
  return `${BOX_CHARS.topLeft}${BOX_CHARS.horizontal.repeat(BOX_WIDTH - 2)}${BOX_CHARS.topRight}`;
}

export function boxBottom(): string {
  return `${BOX_CHARS.bottomLeft}${BOX_CHARS.horizontal.repeat(BOX_WIDTH - 2)}${BOX_CHARS.bottomRight}`;
}

export function boxMid(): string {
  return `${BOX_CHARS.midLeft}${BOX_CHARS.midHorizontal.repeat(BOX_WIDTH - 2)}${BOX_CHARS.midRight}`;
}

export function renderSessionRow(
  session: Session,
  index: number,
  isSelected: boolean
): string[] {
  const { isActive, projectName, runtime, firstPrompt, lastPrompt } = session;
  const state = isActive ? "🔄 ACTIVE" : "💤 IDLE";
  const marker = isSelected ? "▶" : " ";
  const num = `[${index + 1}]`;

  const lines: string[] = [];
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

export function renderList(sessions: Session[]): void {
  for (const session of sessions) {
    const { pid, cwd, cpu, runtime, isActive, firstPrompt, lastPrompt } = session;
    const state = isActive ? "🔄 ACTIVE" : "💤 IDLE";

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(
      `${state} | PID ${pid.toString().padEnd(5)} | CPU ${cpu.toFixed(1).padStart(5)}% | Up ${runtime}`
    );
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

export function renderTUI(
  sessions: Session[],
  selectedIndex: number,
  searchQuery = ""
): Session[] {
  const output: string[] = [];

  output.push("\x1b[2J\x1b[H");

  const filteredSessions = searchQuery
    ? sessions.filter(
        (s) =>
          s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.firstPrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.lastPrompt.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions;

  output.push(boxTop());
  output.push(boxLine("Claude Sessions                                    [j/k] navigate"));
  output.push(boxMid());

  if (filteredSessions.length === 0) {
    output.push(
      boxLine(searchQuery ? "No matching sessions found" : "No Claude sessions running")
    );
  } else {
    for (let i = 0; i < filteredSessions.length; i++) {
      const sessionLines = renderSessionRow(filteredSessions[i], i, i === selectedIndex);
      output.push(...sessionLines);
      if (i < filteredSessions.length - 1) {
        output.push(boxMid());
      }
    }
  }

  output.push(boxMid());
  if (searchQuery.length > 0) {
    output.push(boxLine(`Search: ${searchQuery}_`));
  } else {
    output.push(boxLine("[Enter] Jump  [/] Search  [1-9] Direct  [q] Quit"));
  }
  output.push(boxBottom());

  process.stdout.write(output.join("\n"));

  return filteredSessions;
}
