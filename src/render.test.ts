import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  boxLine,
  boxTop,
  boxBottom,
  boxMid,
  renderSessionRow,
  renderTUI,
} from "./render.js";
import type { Session } from "./types.js";

// Mock process.stdout.write for renderTUI
const mockWrite = vi.fn();
vi.stubGlobal("process", {
  ...process,
  stdout: { ...process.stdout, write: mockWrite },
});

describe("boxLine", () => {
  it("creates a line with vertical borders", () => {
    const line = boxLine("test");
    expect(line.startsWith("║")).toBe(true);
    expect(line.endsWith("║")).toBe(true);
  });

  it("pads content by default", () => {
    const line = boxLine("test");
    expect(line).toContain(" test");
  });

  it("does not pad when pad=false", () => {
    const line = boxLine("test", false);
    expect(line.startsWith("║test")).toBe(true);
  });

  it("maintains consistent width (71 chars)", () => {
    const line = boxLine("hello");
    expect(line.length).toBe(71);
  });

  it("handles long content that exceeds width", () => {
    const longContent = "a".repeat(100);
    const line = boxLine(longContent);
    expect(line.startsWith("║")).toBe(true);
    expect(line.endsWith("║")).toBe(true);
  });

  it("handles empty content", () => {
    const line = boxLine("");
    expect(line.startsWith("║")).toBe(true);
    expect(line.endsWith("║")).toBe(true);
    expect(line.length).toBe(71);
  });
});

describe("boxTop", () => {
  it("creates top border with correct corners", () => {
    const top = boxTop();
    expect(top.startsWith("╔")).toBe(true);
    expect(top.endsWith("╗")).toBe(true);
  });

  it("has consistent width (71 chars)", () => {
    expect(boxTop().length).toBe(71);
  });

  it("uses horizontal border character", () => {
    const top = boxTop();
    expect(top.includes("═")).toBe(true);
  });
});

describe("boxBottom", () => {
  it("creates bottom border with correct corners", () => {
    const bottom = boxBottom();
    expect(bottom.startsWith("╚")).toBe(true);
    expect(bottom.endsWith("╝")).toBe(true);
  });

  it("has consistent width (71 chars)", () => {
    expect(boxBottom().length).toBe(71);
  });
});

describe("boxMid", () => {
  it("creates mid border with correct corners", () => {
    const mid = boxMid();
    expect(mid.startsWith("╠")).toBe(true);
    expect(mid.endsWith("╣")).toBe(true);
  });

  it("has consistent width (71 chars)", () => {
    expect(boxMid().length).toBe(71);
  });

  it("uses mid horizontal character (not double)", () => {
    const mid = boxMid();
    expect(mid.includes("─")).toBe(true);
  });
});

describe("renderSessionRow", () => {
  const createSession = (overrides: Partial<Session> = {}): Session => ({
    pid: "12345",
    cwd: "/Users/test/project",
    projectName: "test-project",
    cpu: 2.5,
    runtime: "01:23:45",
    isActive: false,
    firstPrompt: "Hello Claude",
    lastPrompt: "Another message",
    tmuxPane: null,
    ...overrides,
  });

  it("shows selection marker when selected", () => {
    const lines = renderSessionRow(createSession(), 0, true);
    expect(lines[0]).toContain("▶");
  });

  it("shows space when not selected", () => {
    const lines = renderSessionRow(createSession(), 0, false);
    expect(lines[0]).not.toContain("▶");
  });

  it("shows correct index number (1-based)", () => {
    const lines = renderSessionRow(createSession(), 0, false);
    expect(lines[0]).toContain("[1]");

    const lines2 = renderSessionRow(createSession(), 4, false);
    expect(lines2[0]).toContain("[5]");
  });

  it("shows ACTIVE state for active session", () => {
    const lines = renderSessionRow(createSession({ isActive: true }), 0, false);
    expect(lines[0]).toContain("ACTIVE");
  });

  it("shows IDLE state for inactive session", () => {
    const lines = renderSessionRow(createSession({ isActive: false }), 0, false);
    expect(lines[0]).toContain("IDLE");
  });

  it("includes project name", () => {
    const lines = renderSessionRow(
      createSession({ projectName: "my-project" }),
      0,
      false
    );
    expect(lines[0]).toContain("my-project");
  });

  it("includes runtime", () => {
    const lines = renderSessionRow(
      createSession({ runtime: "02:30:00" }),
      0,
      false
    );
    expect(lines[0]).toContain("02:30:00");
  });

  it("includes first prompt line when present", () => {
    const lines = renderSessionRow(
      createSession({ firstPrompt: "Initial prompt" }),
      0,
      false
    );
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.some((l) => l.includes("Initial prompt"))).toBe(true);
  });

  it("includes last prompt line when different from first", () => {
    const lines = renderSessionRow(
      createSession({
        firstPrompt: "First",
        lastPrompt: "Last",
      }),
      0,
      false
    );
    expect(lines.some((l) => l.includes("First"))).toBe(true);
    expect(lines.some((l) => l.includes("Last"))).toBe(true);
  });

  it("does not duplicate when first and last prompts are same", () => {
    const lines = renderSessionRow(
      createSession({
        firstPrompt: "Same prompt",
        lastPrompt: "Same prompt",
      }),
      0,
      false
    );
    const promptLines = lines.filter((l) => l.includes("Same prompt"));
    expect(promptLines.length).toBe(1);
  });

  it("handles missing first prompt", () => {
    const lines = renderSessionRow(
      createSession({ firstPrompt: "", lastPrompt: "" }),
      0,
      false
    );
    expect(lines.length).toBe(1); // Only header line
  });
});

describe("renderTUI", () => {
  beforeEach(() => {
    mockWrite.mockClear();
  });

  const createSession = (overrides: Partial<Session> = {}): Session => ({
    pid: "12345",
    cwd: "/Users/test/project",
    projectName: "test-project",
    cpu: 2.5,
    runtime: "01:23:45",
    isActive: false,
    firstPrompt: "Hello Claude",
    lastPrompt: "Another message",
    tmuxPane: null,
    ...overrides,
  });

  it("returns all sessions when no search query", () => {
    const sessions = [
      createSession({ projectName: "project1" }),
      createSession({ projectName: "project2" }),
    ];

    const result = renderTUI(sessions, 0);
    expect(result).toHaveLength(2);
  });

  it("filters sessions by project name", () => {
    const sessions = [
      createSession({ projectName: "webapp" }),
      createSession({ projectName: "api-server" }),
      createSession({ projectName: "mobile-app" }),
    ];

    const result = renderTUI(sessions, 0, "app");
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.projectName)).toEqual(["webapp", "mobile-app"]);
  });

  it("filters sessions by first prompt", () => {
    const sessions = [
      createSession({ projectName: "proj1", firstPrompt: "Fix the bug" }),
      createSession({ projectName: "proj2", firstPrompt: "Add feature" }),
    ];

    const result = renderTUI(sessions, 0, "bug");
    expect(result).toHaveLength(1);
    expect(result[0].firstPrompt).toBe("Fix the bug");
  });

  it("filters sessions by last prompt", () => {
    const sessions = [
      createSession({ projectName: "proj1", lastPrompt: "Deploy to prod" }),
      createSession({ projectName: "proj2", lastPrompt: "Run tests" }),
    ];

    const result = renderTUI(sessions, 0, "deploy");
    expect(result).toHaveLength(1);
    expect(result[0].lastPrompt).toBe("Deploy to prod");
  });

  it("is case insensitive when filtering", () => {
    const sessions = [
      createSession({ projectName: "WebApp" }),
      createSession({ projectName: "mobile" }),
    ];

    const resultLower = renderTUI(sessions, 0, "webapp");
    const resultUpper = renderTUI(sessions, 0, "WEBAPP");

    expect(resultLower).toHaveLength(1);
    expect(resultUpper).toHaveLength(1);
  });

  it("returns empty array when no sessions match", () => {
    const sessions = [createSession({ projectName: "project" })];

    const result = renderTUI(sessions, 0, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("writes output to stdout", () => {
    const sessions = [createSession()];

    renderTUI(sessions, 0);
    expect(mockWrite).toHaveBeenCalled();
  });

  it("handles empty sessions array", () => {
    const result = renderTUI([], 0);
    expect(result).toHaveLength(0);
    expect(mockWrite).toHaveBeenCalled();
  });
});
