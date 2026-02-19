import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTTYForPID,
  getTmuxPanes,
  findTmuxPaneForPID,
  jumpToTmuxPane,
} from "./tmux.js";
import type { TmuxPane } from "./types.js";

// Mock exec module
vi.mock("./exec.js", () => ({
  exec: vi.fn(),
}));

// Mock child_process for jumpToTmuxPane
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { exec } from "./exec.js";
import { execSync } from "child_process";

const mockExec = vi.mocked(exec);
const mockExecSync = vi.mocked(execSync);

describe("getTTYForPID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full TTY path when not prefixed with /dev/", () => {
    mockExec.mockReturnValue("ttys001\n");

    const tty = getTTYForPID("12345");
    expect(tty).toBe("/dev/ttys001");
  });

  it("returns TTY as-is when already prefixed with /dev/", () => {
    mockExec.mockReturnValue("/dev/ttys001\n");

    const tty = getTTYForPID("12345");
    expect(tty).toBe("/dev/ttys001");
  });

  it("returns null for ?? output", () => {
    mockExec.mockReturnValue("??\n");

    const tty = getTTYForPID("12345");
    expect(tty).toBeNull();
  });

  it("returns null for - output", () => {
    mockExec.mockReturnValue("-\n");

    const tty = getTTYForPID("12345");
    expect(tty).toBeNull();
  });

  it("returns null for TTY header output", () => {
    mockExec.mockReturnValue("TTY\n");

    const tty = getTTYForPID("12345");
    expect(tty).toBeNull();
  });

  it("returns null for empty output", () => {
    mockExec.mockReturnValue("");

    const tty = getTTYForPID("12345");
    expect(tty).toBeNull();
  });

  it("handles multiple lines and takes the last one", () => {
    mockExec.mockReturnValue("TTY\nttys002\n");

    const tty = getTTYForPID("12345");
    expect(tty).toBe("/dev/ttys002");
  });
});

describe("getTmuxPanes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses tmux pane list correctly", () => {
    const tmuxOutput = `/dev/ttys001:%1:main:0
/dev/ttys002:%2:work:1
/dev/ttys003:%3:work:2`;
    mockExec.mockReturnValue(tmuxOutput);

    const panes = getTmuxPanes();
    expect(panes).toEqual([
      { tty: "/dev/ttys001", paneId: "%1", sessionName: "main", windowIndex: "0" },
      { tty: "/dev/ttys002", paneId: "%2", sessionName: "work", windowIndex: "1" },
      { tty: "/dev/ttys003", paneId: "%3", sessionName: "work", windowIndex: "2" },
    ]);
  });

  it("skips empty lines", () => {
    const tmuxOutput = `/dev/ttys001:%1:main:0

/dev/ttys002:%2:work:1
`;
    mockExec.mockReturnValue(tmuxOutput);

    const panes = getTmuxPanes();
    expect(panes).toHaveLength(2);
  });

  it("skips malformed lines missing required fields", () => {
    const tmuxOutput = `/dev/ttys001:%1:main:0
incomplete:line
/dev/ttys002:%2:work:1`;
    mockExec.mockReturnValue(tmuxOutput);

    const panes = getTmuxPanes();
    expect(panes).toHaveLength(2);
  });

  it("returns empty array when no tmux panes", () => {
    mockExec.mockReturnValue("");

    const panes = getTmuxPanes();
    expect(panes).toEqual([]);
  });
});

describe("findTmuxPaneForPID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const tmuxPanes: TmuxPane[] = [
    { tty: "/dev/ttys001", paneId: "%1", sessionName: "main", windowIndex: "0" },
    { tty: "/dev/ttys002", paneId: "%2", sessionName: "work", windowIndex: "1" },
  ];

  it("finds matching pane by TTY", () => {
    mockExec.mockReturnValue("ttys001\n");

    const pane = findTmuxPaneForPID("12345", tmuxPanes);
    expect(pane).toEqual({
      tty: "/dev/ttys001",
      paneId: "%1",
      sessionName: "main",
      windowIndex: "0",
    });
  });

  it("returns null when no matching TTY", () => {
    mockExec.mockReturnValue("ttys999\n");

    const pane = findTmuxPaneForPID("12345", tmuxPanes);
    expect(pane).toBeNull();
  });

  it("returns null when getTTYForPID returns null", () => {
    mockExec.mockReturnValue("??\n");

    const pane = findTmuxPaneForPID("12345", tmuxPanes);
    expect(pane).toBeNull();
  });
});

describe("jumpToTmuxPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for null pane", () => {
    expect(jumpToTmuxPane(null)).toBe(false);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it("executes tmux commands for valid pane", () => {
    const pane: TmuxPane = {
      tty: "/dev/ttys001",
      paneId: "%1",
      sessionName: "main",
      windowIndex: "0",
    };

    expect(jumpToTmuxPane(pane)).toBe(true);
    expect(mockExecSync).toHaveBeenCalledTimes(3);
    expect(mockExecSync).toHaveBeenCalledWith(
      "tmux select-window -t 'main:0' 2>/dev/null",
      { stdio: "pipe" }
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "tmux select-pane -t '%1' 2>/dev/null",
      { stdio: "pipe" }
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "tmux switch-client -t 'main' 2>/dev/null",
      { stdio: "pipe" }
    );
  });

  it("returns false when tmux command fails", () => {
    const pane: TmuxPane = {
      tty: "/dev/ttys001",
      paneId: "%1",
      sessionName: "main",
      windowIndex: "0",
    };
    mockExecSync.mockImplementation(() => {
      throw new Error("tmux not found");
    });

    expect(jumpToTmuxPane(pane)).toBe(false);
  });
});
