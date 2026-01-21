import { execSync } from "child_process";

export function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}
