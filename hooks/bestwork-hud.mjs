#!/usr/bin/env node
/**
 * bestwork HUD — statusline for Claude Code
 *
 * Reads stdin JSON from Claude Code (context info)
 * Fetches Anthropic usage API (5h + weekly)
 * Shows: version | 5h usage(reset) | weekly | context% | session | efficiency
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import https from "node:https";

const VERSION = "0.10.0";
const home = homedir();
const claudeDir = join(home, ".claude");
const bwDir = join(home, ".bestwork");

// ANSI
const R = "\x1b[0m", B = "\x1b[1m", D = "\x1b[2m";
const CC = "\x1b[36m", CG = "\x1b[32m", CY = "\x1b[33m", CR = "\x1b[31m";
const CM = "\x1b[35m", CW = "\x1b[37m";

function pctColor(pct) {
  if (pct > 80) return CR;
  if (pct > 50) return CY;
  return CG;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

// === Read stdin (Claude Code passes context JSON) ===
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (c) => data += c);
    process.stdin.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
    // Timeout — don't hang if no stdin
    setTimeout(() => resolve(null), 500);
  });
}

// === Anthropic Usage API ===
async function getUsage() {
  try {
    let token = null;
    // macOS Keychain
    if (process.platform === "darwin") {
      try {
        const raw = execFileSync("security", [
          "find-generic-password", "-s", "Claude Code-credentials", "-w"
        ], { encoding: "utf-8", timeout: 3000 }).trim();
        const creds = JSON.parse(raw);
        for (const val of Object.values(creds)) {
          if (typeof val === "object" && val.accessToken) { token = val.accessToken; break; }
        }
      } catch {}
    }
    // Fallback: credentials file
    if (!token) {
      const credPath = join(claudeDir, ".credentials.json");
      if (existsSync(credPath)) {
        const creds = JSON.parse(readFileSync(credPath, "utf-8"));
        for (const val of Object.values(creds)) {
          if (typeof val === "object" && val.accessToken) { token = val.accessToken; break; }
        }
      }
    }
    if (!token) return null;

    // Check cache first (avoid rate limits)
    const cachePath = join(bwDir, ".usage-cache.json");
    if (existsSync(cachePath)) {
      try {
        const cache = JSON.parse(readFileSync(cachePath, "utf-8"));
        if (Date.now() - cache.ts < 300000) return cache.data; // 5min cache
      } catch {}
    }

    const data = await new Promise((resolve, reject) => {
      const req = https.get("https://api.anthropic.com/api/oauth/usage", {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000,
      }, (res) => {
        let body = "";
        res.on("data", (c) => body += c);
        res.on("end", () => {
          if (res.statusCode === 429) { reject("rate_limited"); return; }
          try {
            const j = JSON.parse(body);
            if (j.error) { reject(j.error); return; }
            resolve(j);
          } catch { reject(); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(); });
    });

    const result = {
      fiveHour: Math.round((data.five_hour?.utilization ?? 0) * 100),
      fiveHourReset: data.five_hour?.resets_at ? new Date(data.five_hour.resets_at) : null,
      weekly: Math.round((data.seven_day?.utilization ?? 0) * 100),
      weeklyReset: data.seven_day?.resets_at ? new Date(data.seven_day.resets_at) : null,
    };

    // Cache
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(bwDir, { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ ts: Date.now(), data: result }));
    } catch {}

    return result;
  } catch (e) {
    // Try read stale cache first
    const cachePath = join(bwDir, ".usage-cache.json");
    if (existsSync(cachePath)) {
      try { return JSON.parse(readFileSync(cachePath, "utf-8")).data; } catch {}
    }
    // If rate limited and no cache, return marker
    if (e === "rate_limited") return "rate_limited";
    return null;
  }
}

// === Session info ===
function getSessionInfo() {
  const sessDir = join(claudeDir, "sessions");
  try {
    const files = readdirSync(sessDir).filter(f => f.endsWith(".json")).sort().reverse();
    if (!files.length) return null;
    const latest = JSON.parse(readFileSync(join(sessDir, files[0]), "utf-8"));
    let started = latest.startedAt;
    if (started > 1e12) started = Math.floor(started / 1000);
    const elapsed = Math.floor(Date.now() / 1000) - started;
    const timeStr = elapsed < 60 ? `${elapsed}s` : elapsed < 3600 ? `${Math.floor(elapsed / 60)}m` : `${Math.floor(elapsed / 3600)}h${Math.floor((elapsed % 3600) / 60)}m`;

    let calls = 0, prompts = 0;

    // Primary: read from bestwork's own event log
    const bwDataPath = join(bwDir, "data", `${latest.sessionId}.jsonl`);
    if (existsSync(bwDataPath)) {
      const lines = readFileSync(bwDataPath, "utf-8").split("\n").filter(Boolean);
      calls = lines.filter(l => l.includes('"post"')).length;
    }

    // Fallback: Claude Code's session stats
    if (calls === 0) {
      const statsPath = join(claudeDir, ".session-stats.json");
      if (existsSync(statsPath)) {
        const stats = JSON.parse(readFileSync(statsPath, "utf-8"));
        calls = stats.sessions?.[latest.sessionId]?.total_calls ?? 0;
      }
    }

    // Count prompts from history
    const histPath = join(claudeDir, "history.jsonl");
    if (existsSync(histPath)) {
      const lines = readFileSync(histPath, "utf-8").split("\n").filter(Boolean);
      prompts = lines.filter(l => l.includes(latest.sessionId)).length;
    }

    return { timeStr, calls, prompts };
  } catch {
    return null;
  }
}

// === Context % from stdin ===
function getContextPercent(stdinData) {
  if (!stdinData) return null;
  // Claude Code passes context_window_tokens and context_used_tokens
  const used = stdinData.context_used_tokens ?? stdinData.tokenCount;
  const total = stdinData.context_window_tokens ?? stdinData.contextWindow;
  if (used && total) return Math.round((used / total) * 100);
  return null;
}

// === Render ===
async function main() {
  const [stdinData, usage, session] = await Promise.all([
    readStdin(),
    getUsage(),
    Promise.resolve(getSessionInfo()),
  ]);

  let out = `${B}${CC}BW${R}${D}#${VERSION}${R}`;

  // 5h usage + reset time
  if (usage === "rate_limited") {
    out += ` ${D}|${R} ${CY}usage: wait${R}`;
  } else if (usage) {
    const c5 = pctColor(usage.fiveHour);
    out += ` ${D}|${R} ${c5}${usage.fiveHour}%${R}${D}(5h)${R}`;
    if (usage.fiveHourReset) {
      const ms = usage.fiveHourReset.getTime() - Date.now();
      if (ms > 0) out += `${D}↻${formatDuration(ms)}${R}`;
    }

    const cw = pctColor(usage.weekly);
    out += ` ${cw}${usage.weekly}%${R}${D}(wk)${R}`;
  }

  // Context %
  const ctx = getContextPercent(stdinData);
  if (ctx != null) {
    const cc = pctColor(ctx);
    out += ` ${D}|${R} ${D}ctx${R} ${cc}${ctx}%${R}`;
  }

  // Session
  if (session) {
    out += ` ${D}|${R} ${D}ses${R} ${CW}${session.timeStr}${R}`;

    // BW unique: efficiency score (calls per prompt — lower is better)
    if (session.prompts > 0) {
      const eff = Math.round(session.calls / session.prompts);
      const ec = eff <= 10 ? CG : eff <= 20 ? CY : CR;
      out += ` ${ec}⚡${eff}${R}${D}c/p${R}`;
    }
  }

  // Guards + notifications
  if (existsSync(join(bwDir, "scope.lock"))) out += ` 🔒`;
  if (existsSync(join(bwDir, "strict.lock"))) out += ` 🛡`;
  const cfg = existsSync(join(bwDir, "config.json")) ? JSON.parse(readFileSync(join(bwDir, "config.json"), "utf-8")) : {};
  if (cfg.notify?.discord?.webhookUrl || cfg.notify?.slack?.webhookUrl) out += ` 📨`;

  process.stdout.write(out + "\n");
}

main().catch(() => process.stdout.write(`${B}${CC}BW${R}${D}#${VERSION}${R}\n`));
