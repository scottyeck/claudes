#!/usr/bin/env node
//
// claude-sessions - Show status of all running Claude Code instances
//
// Displays: status, PID, CPU, uptime, project directory, and conversation context
//

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

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

function main() {
  const processes = getClaudeProcesses();
  const claudeDir = join(homedir(), ".claude", "projects");

  for (const { pid, cwd } of processes) {
    const projectPath = cwd.replace(/\//g, "-");
    const projectDir = join(claudeDir, projectPath);

    const { cpu, runtime } = getProcessStats(pid);

    let firstPrompt = "";
    let lastPrompt = "";

    if (existsSync(projectDir)) {
      const sessionFile = getMostRecentSessionFile(projectDir);

      if (sessionFile) {
        const sessionId = basename(sessionFile, ".jsonl");
        const indexFile = join(projectDir, "sessions-index.json");

        // Try sessions-index.json first
        if (existsSync(indexFile)) {
          firstPrompt = getFirstPromptFromIndex(indexFile, sessionId) || "";
        }

        // Get clean user messages from jsonl
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

    // Determine status based on CPU usage
    const state = cpu > 5 ? "🔄 ACTIVE" : "💤 IDLE";

    console.log(
      "═══════════════════════════════════════════════════════════════════"
    );
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

  console.log(
    "═══════════════════════════════════════════════════════════════════"
  );
}

main();
