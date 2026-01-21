import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { exec } from "./exec.js";
import type { ClaudeProcess, ProcessStats } from "./types.js";

export function getClaudeProcesses(): ClaudeProcess[] {
  const output = exec("lsof -c claude 2>/dev/null");
  const processes: ClaudeProcess[] = [];

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

export function getProcessStats(pid: string): ProcessStats {
  const output = exec(`ps -p ${pid} -o %cpu=,etime= 2>/dev/null`).trim();
  const [cpu, runtime] = output.split(/\s+/);
  return { cpu: parseFloat(cpu) || 0, runtime: runtime || "unknown" };
}

export function getMostRecentSessionFile(projectDir: string): string | null {
  try {
    const files = readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({
        name: f,
        path: join(projectDir, f),
        mtime: statSync(join(projectDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    return files[0]?.path || null;
  } catch {
    return null;
  }
}

interface SessionIndexEntry {
  sessionId: string;
  firstPrompt?: string;
}

interface SessionIndex {
  entries?: SessionIndexEntry[];
}

export function getFirstPromptFromIndex(
  indexFile: string,
  sessionId: string
): string | null {
  try {
    const data: SessionIndex = JSON.parse(readFileSync(indexFile, "utf8"));
    const entry = data.entries?.find((e) => e.sessionId === sessionId);
    const prompt = entry?.firstPrompt;
    if (prompt && prompt !== "null" && prompt !== "No prompt") {
      return prompt;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

interface SessionEntry {
  message?: {
    content?: string;
  };
}

export function getCleanUserMessages(sessionFile: string): string[] {
  try {
    const content = readFileSync(sessionFile, "utf8");
    const messages: string[] = [];

    for (const line of content.split("\n")) {
      if (!line.includes('"type":"user"')) continue;
      try {
        const entry: SessionEntry = JSON.parse(line);
        const msgContent = entry?.message?.content;
        if (typeof msgContent === "string") {
          const cleaned = msgContent.trim();
          if (cleaned && !cleaned.startsWith("<") && !cleaned.startsWith("[")) {
            messages.push(cleaned);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return messages;
  } catch {
    return [];
  }
}

export function truncate(str: string, maxLen = 65): string {
  if (!str) return "";
  const single = str.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return single.length > maxLen ? single.slice(0, maxLen) : single;
}
