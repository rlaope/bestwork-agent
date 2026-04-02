#!/usr/bin/env node
/**
 * bestwork HUD — Node.js statusline
 * Reads Anthropic usage API + session stats + config
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import https from "node:https";

const VERSION = "0.9.0";
const home = homedir();
const claudeDir = join(home, ".claude");
const bwDir = join(home, ".bestwork");

// ANSI
const R = "\x1b[0m", B = "\x1b[1m", D = "\x1b[2m";
const CC = "\x1b[36m", CG = "\x1b[32m", CY = "\x1b[33m", CR = "\x1b[31m";
const CM = "\x1b[35m", CW = "\x1b[37m";

// === Usage API (same approach as OMC) ===
async function getUsage() {
  try {
    let token = null;

    // Try macOS Keychain
    if (process.platform === "darwin") {
      try {
        const raw = execFileSync("security", [
          "find-generic-password", "-s", "Claude Code-credentials", "-w"
        ], { encoding: "utf-8", timeout: 3000 }).trim();
        const creds = JSON.parse(raw);
        // Find OAuth token
        for (const val of Object.values(creds)) {
          if (typeof val === "object" && val.accessToken) {
            token = val.accessToken;
            break;
          }
        }
      } catch { /* not on macOS or no keychain entry */ }
    }

    // Fallback: .credentials.json
    if (!token) {
      const credPath = join(claudeDir, ".credentials.json");
      if (existsSync(credPath)) {
        const creds = JSON.parse(readFileSync(credPath, "utf-8"));
        for (const val of Object.values(creds)) {
          if (typeof val === "object" && val.accessToken) {
            token = val.accessToken;
            break;
          }
        }
      }
    }

    if (!token) return null;

    // Fetch usage
    const data = await new Promise((resolve, reject) => {
      const req = https.get("https://api.anthropic.com/api/oauth/usage", {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      }, (res) => {
        let body = "";
        res.on("data", (c) => body += c);
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch { reject(); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(); });
    });

    return {
      fiveHour: data.five_hour?.utilization ?? null,
      weekly: data.seven_day?.utilization ?? null,
    };
  } catch {
    return null;
  }
}

// === Session info ===
function getSessionInfo() {
  const sessDir = join(claudeDir, "sessions");
  try {
    const files = readdirSync(sessDir).filter(f => f.endsWith(".json")).sort().reverse();
    if (files.length === 0) return null;
    const latest = JSON.parse(readFileSync(join(sessDir, files[0]), "utf-8"));
    let started = latest.startedAt;
    if (started > 1e12) started = Math.floor(started / 1000);
    const elapsed = Math.floor(Date.now() / 1000) - started;

    let timeStr;
    if (elapsed < 60) timeStr = `${elapsed}s`;
    else if (elapsed < 3600) timeStr = `${Math.floor(elapsed / 60)}m`;
    else timeStr = `${Math.floor(elapsed / 3600)}h${Math.floor((elapsed % 3600) / 60)}m`;

    // Calls from session stats
    let calls = 0;
    const statsPath = join(claudeDir, ".session-stats.json");
    if (existsSync(statsPath)) {
      const stats = JSON.parse(readFileSync(statsPath, "utf-8"));
      calls = stats.sessions?.[latest.sessionId]?.total_calls ?? 0;
    }

    return { timeStr, calls, sessionId: latest.sessionId };
  } catch {
    return null;
  }
}

// === Config ===
function getConfig() {
  const configPath = join(bwDir, "config.json");
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

// === Render ===
async function render() {
  const [usage, session] = await Promise.all([
    getUsage(),
    Promise.resolve(getSessionInfo()),
  ]);
  const config = getConfig();

  let out = `${B}${CC}BW${R}${D}#${VERSION}${R}`;

  // 5h usage
  if (usage?.fiveHour != null) {
    const pct = Math.round(usage.fiveHour * 100);
    const c = pct > 80 ? CR : pct > 50 ? CY : CG;
    out += `  ${D}5h${R} ${c}${pct}%${R}`;
  }

  // Weekly usage
  if (usage?.weekly != null) {
    const pct = Math.round(usage.weekly * 100);
    const c = pct > 80 ? CR : pct > 50 ? CY : CG;
    out += `  ${D}wk${R} ${c}${pct}%${R}`;
  }

  // Session
  if (session) {
    out += `  ${D}ses${R} ${CW}${session.timeStr}${R}`;
    if (session.calls > 0) {
      out += `  ${D}calls${R} ${CM}${session.calls}${R}`;
    }
  }

  // Guards
  if (existsSync(join(bwDir, "scope.lock"))) out += ` 🔒`;
  if (existsSync(join(bwDir, "strict.lock"))) out += ` 🛡`;

  // Notifications
  if (config.notify?.discord?.webhookUrl) out += ` 📨`;
  if (config.notify?.slack?.webhookUrl) out += ` 📨`;

  process.stdout.write(out + "\n");
}

render().catch(() => process.stdout.write(`${B}${CC}BW${R}${D}#${VERSION}${R}\n`));
