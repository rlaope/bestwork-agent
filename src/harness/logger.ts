import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BW_DIR = join(homedir(), ".bestwork");
const LOG_FILE = join(BW_DIR, "gateway.log");

export type LogLevel = "debug" | "info" | "warn" | "error";

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ? `${err.message}\n  ${err.stack.split("\n").slice(1, 3).join("\n  ")}` : err.message;
  }
  return String(err);
}

export function log(level: LogLevel, scope: string, msg: string, err?: unknown): void {
  try {
    mkdirSync(BW_DIR, { recursive: true });
    const ts = new Date().toISOString().slice(11, 19);
    const tail = err !== undefined ? ` — ${formatError(err)}` : "";
    appendFileSync(LOG_FILE, `[${ts}] [${level}] [${scope}] ${msg}${tail}\n`);
  } catch {
    // Logger itself must never throw — silent fallback is the only safe option here
  }
}

export const logger = {
  debug: (scope: string, msg: string, err?: unknown) => log("debug", scope, msg, err),
  info: (scope: string, msg: string, err?: unknown) => log("info", scope, msg, err),
  warn: (scope: string, msg: string, err?: unknown) => log("warn", scope, msg, err),
  error: (scope: string, msg: string, err?: unknown) => log("error", scope, msg, err),
};
