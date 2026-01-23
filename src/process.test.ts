import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  truncate,
  getFirstPromptFromIndex,
  getCleanUserMessages,
  getMostRecentSessionFile,
  getProcessStats,
  getClaudeProcesses,
} from "./process.js";

// Mock fs module
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// Mock exec module
vi.mock("./exec.js", () => ({
  exec: vi.fn(),
}));

import { readFileSync, readdirSync, statSync } from "fs";
import { exec } from "./exec.js";

const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockExec = vi.mocked(exec);

describe("truncate", () => {
  it("returns empty string for falsy input", () => {
    expect(truncate("")).toBe("");
    expect(truncate(null as unknown as string)).toBe("");
    expect(truncate(undefined as unknown as string)).toBe("");
  });

  it("returns same string if under max length", () => {
    expect(truncate("hello world")).toBe("hello world");
    expect(truncate("short", 10)).toBe("short");
  });

  it("truncates string if over max length", () => {
    expect(truncate("hello world", 5)).toBe("hello");
    expect(truncate("a".repeat(100), 10)).toBe("a".repeat(10));
  });

  it("replaces newlines with spaces", () => {
    expect(truncate("hello\nworld")).toBe("hello world");
    expect(truncate("line1\nline2\nline3")).toBe("line1 line2 line3");
  });

  it("collapses multiple whitespace to single space", () => {
    expect(truncate("hello   world")).toBe("hello world");
    expect(truncate("hello\n\n\nworld")).toBe("hello world");
    expect(truncate("  spaced  out  ")).toBe("spaced out");
  });

  it("uses default max length of 65", () => {
    const str65 = "a".repeat(65);
    const str66 = "a".repeat(66);
    expect(truncate(str65)).toBe(str65);
    expect(truncate(str66)).toBe(str65);
  });
});

describe("getFirstPromptFromIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns prompt when found in index", () => {
    const indexData = {
      entries: [
        { sessionId: "abc123", firstPrompt: "Hello Claude" },
        { sessionId: "def456", firstPrompt: "Another prompt" },
      ],
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(indexData));

    expect(getFirstPromptFromIndex("/path/to/index.json", "abc123")).toBe(
      "Hello Claude"
    );
    expect(mockReadFileSync).toHaveBeenCalledWith(
      "/path/to/index.json",
      "utf8"
    );
  });

  it("returns null when session not found", () => {
    const indexData = {
      entries: [{ sessionId: "abc123", firstPrompt: "Hello" }],
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(indexData));

    expect(getFirstPromptFromIndex("/path/to/index.json", "notfound")).toBeNull();
  });

  it("returns null when prompt is 'null' string", () => {
    const indexData = {
      entries: [{ sessionId: "abc123", firstPrompt: "null" }],
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(indexData));

    expect(getFirstPromptFromIndex("/path/to/index.json", "abc123")).toBeNull();
  });

  it("returns null when prompt is 'No prompt'", () => {
    const indexData = {
      entries: [{ sessionId: "abc123", firstPrompt: "No prompt" }],
    };
    mockReadFileSync.mockReturnValue(JSON.stringify(indexData));

    expect(getFirstPromptFromIndex("/path/to/index.json", "abc123")).toBeNull();
  });

  it("returns null when entries array is missing", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}));

    expect(getFirstPromptFromIndex("/path/to/index.json", "abc123")).toBeNull();
  });

  it("returns null on read error", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("File not found");
    });

    expect(getFirstPromptFromIndex("/path/to/index.json", "abc123")).toBeNull();
  });

  it("returns null on JSON parse error", () => {
    mockReadFileSync.mockReturnValue("not valid json");

    expect(getFirstPromptFromIndex("/path/to/index.json", "abc123")).toBeNull();
  });
});

describe("getCleanUserMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts user messages from JSONL file", () => {
    const jsonl = [
      '{"type":"user","message":{"content":"Hello Claude"}}',
      '{"type":"assistant","message":{"content":"Hi there"}}',
      '{"type":"user","message":{"content":"Second message"}}',
    ].join("\n");
    mockReadFileSync.mockReturnValue(jsonl);

    const messages = getCleanUserMessages("/path/to/session.jsonl");
    expect(messages).toEqual(["Hello Claude", "Second message"]);
  });

  it("filters out messages starting with < or [", () => {
    const jsonl = [
      '{"type":"user","message":{"content":"<command>test</command>"}}',
      '{"type":"user","message":{"content":"[System message]"}}',
      '{"type":"user","message":{"content":"Regular message"}}',
    ].join("\n");
    mockReadFileSync.mockReturnValue(jsonl);

    const messages = getCleanUserMessages("/path/to/session.jsonl");
    expect(messages).toEqual(["Regular message"]);
  });

  it("filters out empty messages after trimming", () => {
    const jsonl = [
      '{"type":"user","message":{"content":"   "}}',
      '{"type":"user","message":{"content":"\\n\\n"}}',
      '{"type":"user","message":{"content":"Valid"}}',
    ].join("\n");
    mockReadFileSync.mockReturnValue(jsonl);

    const messages = getCleanUserMessages("/path/to/session.jsonl");
    expect(messages).toEqual(["Valid"]);
  });

  it("skips lines that are not user type", () => {
    const jsonl = [
      '{"type":"system","message":{"content":"System"}}',
      '{"type":"user","message":{"content":"User"}}',
    ].join("\n");
    mockReadFileSync.mockReturnValue(jsonl);

    const messages = getCleanUserMessages("/path/to/session.jsonl");
    expect(messages).toEqual(["User"]);
  });

  it("handles non-string message content", () => {
    const jsonl = [
      '{"type":"user","message":{"content":123}}',
      '{"type":"user","message":{"content":null}}',
      '{"type":"user","message":{"content":"Valid"}}',
    ].join("\n");
    mockReadFileSync.mockReturnValue(jsonl);

    const messages = getCleanUserMessages("/path/to/session.jsonl");
    expect(messages).toEqual(["Valid"]);
  });

  it("returns empty array on file read error", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("File not found");
    });

    expect(getCleanUserMessages("/path/to/session.jsonl")).toEqual([]);
  });

  it("skips malformed JSON lines", () => {
    const jsonl = [
      '{"type":"user","message":{"content":"First"}}',
      "not valid json",
      '{"type":"user","message":{"content":"Second"}}',
    ].join("\n");
    mockReadFileSync.mockReturnValue(jsonl);

    const messages = getCleanUserMessages("/path/to/session.jsonl");
    expect(messages).toEqual(["First", "Second"]);
  });
});

describe("getMostRecentSessionFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns most recent jsonl file", () => {
    mockReaddirSync.mockReturnValue([
      "old.jsonl",
      "new.jsonl",
      "other.txt",
    ] as unknown as ReturnType<typeof readdirSync>);
    mockStatSync.mockImplementation((path) => {
      if (String(path).includes("old.jsonl")) {
        return { mtime: new Date("2024-01-01") } as ReturnType<typeof statSync>;
      }
      if (String(path).includes("new.jsonl")) {
        return { mtime: new Date("2024-06-01") } as ReturnType<typeof statSync>;
      }
      return { mtime: new Date("2024-03-01") } as ReturnType<typeof statSync>;
    });

    const result = getMostRecentSessionFile("/project/sessions");
    expect(result).toBe("/project/sessions/new.jsonl");
  });

  it("returns null when no jsonl files exist", () => {
    mockReaddirSync.mockReturnValue([
      "file.txt",
      "data.json",
    ] as unknown as ReturnType<typeof readdirSync>);

    const result = getMostRecentSessionFile("/project/sessions");
    expect(result).toBeNull();
  });

  it("returns null when directory is empty", () => {
    mockReaddirSync.mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);

    const result = getMostRecentSessionFile("/project/sessions");
    expect(result).toBeNull();
  });

  it("returns null on directory read error", () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("Directory not found");
    });

    const result = getMostRecentSessionFile("/nonexistent/path");
    expect(result).toBeNull();
  });
});

describe("getProcessStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses CPU and runtime from ps output", () => {
    mockExec.mockReturnValue("  2.5 01:23:45");

    const stats = getProcessStats("12345");
    expect(stats).toEqual({ cpu: 2.5, runtime: "01:23:45" });
  });

  it("handles missing CPU value", () => {
    mockExec.mockReturnValue("");

    const stats = getProcessStats("12345");
    expect(stats).toEqual({ cpu: 0, runtime: "unknown" });
  });

  it("handles zero CPU", () => {
    mockExec.mockReturnValue("  0.0 00:05:32");

    const stats = getProcessStats("12345");
    expect(stats).toEqual({ cpu: 0, runtime: "00:05:32" });
  });
});

describe("getClaudeProcesses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses claude processes from lsof output", () => {
    const lsofOutput = `COMMAND     PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
claude    12345   user  cwd    DIR  1,4      640 1234 /Users/user/project1
claude    67890   user  cwd    DIR  1,4      640 5678 /Users/user/project2`;
    mockExec.mockReturnValue(lsofOutput);

    const processes = getClaudeProcesses();
    expect(processes).toEqual([
      { pid: "12345", cwd: "/Users/user/project1" },
      { pid: "67890", cwd: "/Users/user/project2" },
    ]);
  });

  it("filters out non-claude processes", () => {
    const lsofOutput = `COMMAND     PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node      12345   user  cwd    DIR  1,4      640 1234 /Users/user/project1
claude    67890   user  cwd    DIR  1,4      640 5678 /Users/user/project2`;
    mockExec.mockReturnValue(lsofOutput);

    const processes = getClaudeProcesses();
    expect(processes).toEqual([
      { pid: "67890", cwd: "/Users/user/project2" },
    ]);
  });

  it("falls back to pgrep when lsof returns empty", () => {
    mockExec
      .mockReturnValueOnce("") // First call (lsof -c claude) returns empty
      .mockReturnValueOnce("12345\n67890\n") // pgrep returns PIDs
      .mockReturnValueOnce(`COMMAND     PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
claude    12345   user  cwd    DIR  1,4      640 1234 /Users/user/project`);

    const processes = getClaudeProcesses();
    expect(processes).toEqual([{ pid: "12345", cwd: "/Users/user/project" }]);
    expect(mockExec).toHaveBeenCalledTimes(3);
  });

  it("returns empty array when no processes found", () => {
    mockExec.mockReturnValue("");

    const processes = getClaudeProcesses();
    expect(processes).toEqual([]);
  });

  it("only includes lines with cwd file descriptor", () => {
    const lsofOutput = `COMMAND     PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
claude    12345   user  txt    REG  1,4      640 1234 /usr/bin/claude
claude    12345   user  cwd    DIR  1,4      640 1234 /Users/user/project`;
    mockExec.mockReturnValue(lsofOutput);

    const processes = getClaudeProcesses();
    expect(processes).toEqual([{ pid: "12345", cwd: "/Users/user/project" }]);
  });
});
