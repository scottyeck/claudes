import { Command } from "commander";
import { version } from "./version.js";

export interface CliOptions {
  list?: boolean;
  json?: boolean;
  updateCache?: boolean;
}

export interface ParsedArgs {
  options: CliOptions;
  target?: string;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("claudes")
    .description("Interactive CLI for managing Claude Code instances")
    .version(version)
    .option("-l, --list", "Non-interactive list output")
    .option("-j, --json", "Output session data as JSON")
    .option("--update-cache", "Update the session cache file (for daemon use)")
    .argument("[target]", "Session number or project name to jump to")
    .addHelpText(
      "after",
      `
TUI Navigation:
  j/k or ↑/↓    Move selection up/down
  Enter         Jump to selected session
  1-9           Jump directly to session by number
  /             Enter search mode
  Escape        Exit search mode
  q             Quit

Examples:
  claudes              Launch interactive TUI
  claudes 2            Jump directly to session #2
  claudes cloud        Jump to first project matching "cloud"
  claudes --list       Non-interactive list output
  claudes --json       Output session data as JSON`
    );

  return program;
}

export function parseArgs(): ParsedArgs {
  const program = createProgram();
  program.parse();

  const options = program.opts<CliOptions>();
  const target = program.args[0];

  return { options, target };
}
