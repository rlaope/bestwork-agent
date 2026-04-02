#!/usr/bin/env node
/**
 * bestwork HUD — statusline for Claude Code
 *
 * Reads stdin JSON from Claude Code (context info)
 * Fetches Anthropic usage API (5h + weekly)
 * Shows: version | 5h usage(reset) | weekly | context% | session | efficiency
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
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

// === OAuth token management ===
const CACHE_TTL_MS = 600000; // 10min normal cache
const MAX_STALE_MS = 1800000; // 30min stale data OK

const API_TIMEOUT = 5000;

function getCredentials() {
  // macOS Keychain
  if (process.platform === "darwin") {
    try {
      const raw = execFileSync("security", [
        "find-generic-password", "-s", "Claude Code-credentials", "-w"
      ], { encoding: "utf-8", timeout: 3000 }).trim();
      const creds = JSON.parse(raw);
      for (const val of Object.values(creds)) {
        if (typeof val === "object" && val.accessToken) return val;
      }
    } catch {}
  }
  // Fallback: credentials file
  const credPath = join(claudeDir, ".credentials.json");
  if (existsSync(credPath)) {
    try {
      const creds = JSON.parse(readFileSync(credPath, "utf-8"));
      for (const val of Object.values(creds)) {
        if (typeof val === "object" && val.accessToken) return val;
      }
    } catch {}
  }
  return null;
}

function isTokenExpired(creds) {
  if (!creds.expiresAt) return false; // no expiry info, assume OK
  return Date.now() > creds.expiresAt;
}

function fetchUsage(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get("https://api.anthropic.com/api/oauth/usage", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: API_TIMEOUT,
    }, (res) => {
      let body = "";
      res.on("data", (c) => body += c);
      res.on("end", () => {
        if (res.statusCode === 429) { reject("rate_limited"); return; }
        if (res.statusCode === 401) { reject("auth_expired"); return; }
        try {
          const j = JSON.parse(body);
          if (j.error) { reject(j.error); return; }
          resolve(j);
        } catch { reject("parse_error"); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject("timeout"); });
  });
}

function readUsageCache() {
  const cachePath = join(bwDir, ".usage-cache.json");
  if (!existsSync(cachePath)) return null;
  try { return JSON.parse(readFileSync(cachePath, "utf-8")); } catch { return null; }
}

function writeUsageCache(data, rateLimited = false) {
  const cachePath = join(bwDir, ".usage-cache.json");
  try {
    mkdirSync(bwDir, { recursive: true });
    const cache = readUsageCache() || {};
    const entry = {
      ts: Date.now(),
      data,
      rateLimited,
      rateLimitedCount: rateLimited ? ((cache.rateLimitedCount || 0) + 1) : 0,
      lastSuccessAt: rateLimited ? (cache.lastSuccessAt || null) : Date.now(),
    };
    writeFileSync(cachePath, JSON.stringify(entry));
  } catch {}
}

// === Anthropic Usage API (READ-ONLY — never refresh tokens) ===
// IMPORTANT: Do NOT call refreshAccessToken() here. The HUD runs as a
// statusline hook on every render. Refreshing the OAuth token invalidates
// the token Claude Code holds, causing 401 auth errors for the user.
async function getUsage() {
  try {
    const cache = readUsageCache();
    if (cache) {
      if (cache.rateLimited) {
        const count = cache.rateLimitedCount || 1;
        const backoff = Math.min(CACHE_TTL_MS * Math.pow(2, count - 1), MAX_STALE_MS);
        if (Date.now() - cache.ts < backoff) {
          return cache.data || "rate_limited";
        }
      } else if (Date.now() - cache.ts < CACHE_TTL_MS) {
        return cache.data;
      }
    }

    const creds = getCredentials();
    if (!creds) return cache?.data || null;

    // If token is expired, just use cache — do NOT refresh
    if (isTokenExpired(creds)) {
      return cache?.data || null;
    }

    const data = await fetchUsage(creds.accessToken);
    const result = {
      fiveHour: Math.round((data.five_hour?.utilization ?? 0) * 100),
      fiveHourReset: data.five_hour?.resets_at ? new Date(data.five_hour.resets_at) : null,
      weekly: Math.round((data.seven_day?.utilization ?? 0) * 100),
      weeklyReset: data.seven_day?.resets_at ? new Date(data.seven_day.resets_at) : null,
    };

    writeUsageCache(result, false);
    return result;
  } catch (e) {
    const cache = readUsageCache();

    if (e === "auth_expired") {
      // Token expired mid-flight — return cached data, don't refresh
      return cache?.data || null;
    }

    if (e === "rate_limited") {
      writeUsageCache(cache?.data || null, true);
      if (cache?.data && cache.lastSuccessAt && Date.now() - cache.lastSuccessAt < MAX_STALE_MS) {
        return cache.data;
      }
      return "rate_limited";
    }

    if (cache?.data && cache.lastSuccessAt && Date.now() - cache.lastSuccessAt < MAX_STALE_MS) {
      return cache.data;
    }
    return null;
  }
}

// === Session info ===
function getSessionInfo() {
  const sessDir = join(claudeDir, "sessions");
  try {
    const files = readdirSync(sessDir)
      .filter(f => f.endsWith(".json"))
      .map(f => ({ name: f, mtime: statSync(join(sessDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .map(f => f.name);
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

// === Gateway mode indicator ===
function getLastGatewayAction() {
  const logPath = join(bwDir, "gateway.log");
  if (!existsSync(logPath)) return "idle";
  try {
    const content = readFileSync(logPath, "utf-8").trimEnd();
    const lastNewline = content.lastIndexOf("\n");
    const lastLine = lastNewline === -1 ? content : content.slice(lastNewline + 1);
    if (!lastLine) return "idle";

    const parsed = JSON.parse(lastLine);
    const ts = parsed.timestamp || parsed.ts;
    if (!ts) return "idle";

    const age = Date.now() - new Date(ts).getTime();
    if (age > 60000) return "idle";

    // Extract mode from the log entry
    const mode = parsed.mode || parsed.route || parsed.action;
    if (!mode) {
      if (parsed.skill) return parsed.skill;
      return "idle";
    }
    return mode;
  } catch {
    return "idle";
  }
}

const MODE_LABELS = {
  trio: "\u25b6trio",
  solo: "solo",
  pair: "pair",
  hierarchy: "hier",
  review: "review",
};

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
    out += ` ${D}|${R} ${D}--%(5h) --%(wk)${R}`;
  } else if (usage) {
    const c5 = pctColor(usage.fiveHour);
    out += ` ${D}|${R} ${c5}${usage.fiveHour}%${R}${D}(5h)${R}`;
    if (usage.fiveHourReset) {
      const ms = new Date(usage.fiveHourReset).getTime() - Date.now();
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
    out += ` ${D}|${R} ${CW}${session.timeStr}${R}`;

    // BW unique: efficiency score (calls per prompt — lower is better)
    if (session.prompts > 0) {
      const eff = Math.round(session.calls / session.prompts);
      const ec = eff <= 10 ? CG : eff <= 20 ? CY : CR;
      out += ` ${ec}⚡${eff}${R}${D}c/p${R}`;
    }
  }

  // Gateway mode
  const gwMode = getLastGatewayAction();
  if (gwMode !== "idle") {
    const label = MODE_LABELS[gwMode] || gwMode;
    out += ` ${CC}${label}${R}`;
  }

  // Guards
  if (existsSync(join(bwDir, "scope.lock"))) out += ` 🔒`;
  if (existsSync(join(bwDir, "strict.lock"))) out += ` 🛡`;

  // Notifications — show which messengers are active
  const cfg = existsSync(join(bwDir, "config.json")) ? JSON.parse(readFileSync(join(bwDir, "config.json"), "utf-8")) : {};
  const messengers = [];
  if (cfg.notify?.discord?.webhookUrl) messengers.push("discord");
  if (cfg.notify?.slack?.webhookUrl) messengers.push("slack");
  if (messengers.length > 0) out += ` ${D}msg:${messengers.join(",")}${R}`;

  process.stdout.write(out + "\n");
}

main().catch(() => process.stdout.write(`${B}${CC}BW${R}${D}#${VERSION}${R}\n`));
