import { describe, it, expect } from "vitest";
import { createProgram } from "./cli.js";

describe("createProgram", () => {
  it("creates a program with correct name", () => {
    const program = createProgram();
    expect(program.name()).toBe("claudes");
  });

  it("has version set", () => {
    const program = createProgram();
    expect(program.version()).toBeDefined();
  });

  it("parses --list option", () => {
    const program = createProgram();
    program.parse(["--list"], { from: "user" });
    const opts = program.opts();
    expect(opts.list).toBe(true);
  });

  it("parses -l shorthand option", () => {
    const program = createProgram();
    program.parse(["-l"], { from: "user" });
    const opts = program.opts();
    expect(opts.list).toBe(true);
  });

  it("parses --json option", () => {
    const program = createProgram();
    program.parse(["--json"], { from: "user" });
    const opts = program.opts();
    expect(opts.json).toBe(true);
  });

  it("parses -j shorthand option", () => {
    const program = createProgram();
    program.parse(["-j"], { from: "user" });
    const opts = program.opts();
    expect(opts.json).toBe(true);
  });

  it("parses --update-cache option", () => {
    const program = createProgram();
    program.parse(["--update-cache"], { from: "user" });
    const opts = program.opts();
    expect(opts.updateCache).toBe(true);
  });

  it("parses target argument as number", () => {
    const program = createProgram();
    program.parse(["2"], { from: "user" });
    expect(program.args[0]).toBe("2");
  });

  it("parses target argument as project name", () => {
    const program = createProgram();
    program.parse(["myproject"], { from: "user" });
    expect(program.args[0]).toBe("myproject");
  });

  it("has no target when not provided", () => {
    const program = createProgram();
    program.parse([], { from: "user" });
    expect(program.args[0]).toBeUndefined();
  });

  it("can combine options with target", () => {
    const program = createProgram();
    program.parse(["--list", "myproject"], { from: "user" });
    const opts = program.opts();
    expect(opts.list).toBe(true);
    expect(program.args[0]).toBe("myproject");
  });

  it("has a description", () => {
    const program = createProgram();
    expect(program.description()).toContain("Claude");
  });
});
