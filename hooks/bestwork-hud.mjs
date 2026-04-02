#!/usr/bin/env node
/**
 * bestwork HUD — statusline for Claude Code
 *
 * Reads stdin JSON from Claude Code (context info)
 * Fetches Anthropic usage API (5h + weekly)
 * Shows: version | 5h usage(reset) | weekly | context% | session | efficiency
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import https from "node:https";

const VERSION = "1.0.0";
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

// === Caching constants (OMC-aligned) ===
const POLL_INTERVAL_MS = 90_000;       // 90s between successful API calls
const CACHE_TTL_FAILURE_MS = 15_000;   // 15s for non-transient errors
const CACHE_TTL_NETWORK_MS = 120_000;  // 2min for network errors
const MAX_BACKOFF_MS = 300_000;        // 5min cap for 429 backoff
const MAX_STALE_MS = 900_000;          // 15min stale data cutoff
const API_TIMEOUT_MS = 5_000;          // 5s API timeout
const LOCK_TIMEOUT_MS = 15_000;        // 15s lock staleness

const CACHE_PATH = join(bwDir, ".usage-cache.json");
const LOCK_PATH = join(bwDir, ".usage-cache.lock");

// === File locking — prevent concurrent API calls ===
function acquireLock() {
  try {
    mkdirSync(bwDir, { recursive: true });
    if (existsSync(LOCK_PATH)) {
      const lock = JSON.parse(readFileSync(LOCK_PATH, "utf-8"));
      if (Date.now() - lock.ts < LOCK_TIMEOUT_MS) return false; // lock is fresh
      // Stale lock — remove it
      try { unlinkSync(LOCK_PATH); } catch {}
    }
    writeFileSync(LOCK_PATH, JSON.stringify({ ts: Date.now(), pid: process.pid }));
    return true;
  } catch { return false; }
}

function releaseLock() {
  try { unlinkSync(LOCK_PATH); } catch {}
}

// === OAuth credentials (READ-ONLY) ===
function getCredentials() {
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
  if (!creds.expiresAt) return false;
  return Date.now() > creds.expiresAt;
}

// === API call ===
function fetchUsage(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get("https://api.anthropic.com/api/oauth/usage", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: API_TIMEOUT_MS,
    }, (res) => {
      let body = "";
      res.on("data", (c) => body += c);
      res.on("end", () => {
        if (res.statusCode === 429) {
          const retryAfter = parseInt(res.headers["retry-after"] || "0", 10);
          reject({ type: "rate_limited", retryAfterMs: retryAfter > 0 ? retryAfter * 1000 : 0 });
          return;
        }
        if (res.statusCode === 401) { reject("auth_expired"); return; }
        try {
          const j = JSON.parse(body);
          if (j.error) { reject(j.error); return; }
          resolve(j);
        } catch { reject("parse_error"); }
      });
    });
    req.on("error", () => reject("network"));
    req.on("timeout", () => { req.destroy(); reject("network"); });
  });
}

// === Cache read/write ===
function readUsageCache() {
  if (!existsSync(CACHE_PATH)) return null;
  try { return JSON.parse(readFileSync(CACHE_PATH, "utf-8")); } catch { return null; }
}

function writeUsageCache(entry) {
  try {
    mkdirSync(bwDir, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(entry));
  } catch {}
}

// Helper: return stale data if available. Prefer recent data,
// but always return cached data over nothing (better UX than --)
function staleDataOrNull(cache) {
  if (cache?.data) return cache.data;
  return null;
}

// === Anthropic Usage API (READ-ONLY — never refresh tokens) ===
// IMPORTANT: Do NOT call refreshAccessToken() here. The HUD runs as a
// statusline hook on every render. Refreshing the OAuth token invalidates
// the token Claude Code holds, causing 401 auth errors for the user.
async function getUsage() {
  const cache = readUsageCache();

  // Check if cache is still valid
  if (cache) {
    if (cache.rateLimited) {
      // Use server's retry-after if available, otherwise exponential backoff
      const retryAfterMs = cache.retryAfterMs || 0;
      const count = cache.rateLimitedCount || 1;
      const calcBackoff = Math.min(POLL_INTERVAL_MS * Math.pow(2, Math.max(0, count - 1)), MAX_BACKOFF_MS);
      const backoff = retryAfterMs > 0 ? Math.max(retryAfterMs, calcBackoff) : calcBackoff;
      if (Date.now() - cache.ts < backoff) {
        return staleDataOrNull(cache);
      }
    } else if (cache.error === "network") {
      if (Date.now() - cache.ts < CACHE_TTL_NETWORK_MS) {
        return staleDataOrNull(cache);
      }
    } else if (cache.error) {
      if (Date.now() - cache.ts < CACHE_TTL_FAILURE_MS) {
        return staleDataOrNull(cache);
      }
    } else if (Date.now() - cache.ts < POLL_INTERVAL_MS) {
      return cache.data;
    }
  }

  // Try to acquire lock — if can't, return cached data
  if (!acquireLock()) {
    return staleDataOrNull(cache);
  }

  try {
    // Re-check cache inside lock (another process may have refreshed it)
    const freshCheck = readUsageCache();
    if (freshCheck && !freshCheck.rateLimited && !freshCheck.error && Date.now() - freshCheck.ts < POLL_INTERVAL_MS) {
      releaseLock();
      return freshCheck.data;
    }

    const creds = getCredentials();
    if (!creds) { releaseLock(); return staleDataOrNull(cache); }

    // If token is expired, just use cache — do NOT refresh
    if (isTokenExpired(creds)) { releaseLock(); return staleDataOrNull(cache); }

    const data = await fetchUsage(creds.accessToken);
    const result = {
      fiveHour: Math.round((data.five_hour?.utilization ?? 0) * 100),
      fiveHourReset: data.five_hour?.resets_at ? new Date(data.five_hour.resets_at) : null,
      weekly: Math.round((data.seven_day?.utilization ?? 0) * 100),
      weeklyReset: data.seven_day?.resets_at ? new Date(data.seven_day.resets_at) : null,
    };

    writeUsageCache({ ts: Date.now(), data: result, rateLimited: false, rateLimitedCount: 0, lastSuccessAt: Date.now(), error: null });
    releaseLock();
    return result;
  } catch (e) {
    const freshCache = readUsageCache() || cache;

    if (e?.type === "rate_limited" || e === "rate_limited") {
      const count = (freshCache?.rateLimitedCount || 0) + 1;
      const retryAfterMs = e?.retryAfterMs || 0;
      writeUsageCache({
        ts: Date.now(), data: freshCache?.data || null,
        rateLimited: true, rateLimitedCount: count,
        retryAfterMs,
        lastSuccessAt: freshCache?.lastSuccessAt || null, error: null,
      });
    } else if (e === "network") {
      writeUsageCache({
        ts: Date.now(), data: freshCache?.data || null,
        rateLimited: false, rateLimitedCount: 0,
        lastSuccessAt: freshCache?.lastSuccessAt || null, error: "network",
      });
    } else {
      // auth_expired, parse_error, etc.
      writeUsageCache({
        ts: Date.now(), data: freshCache?.data || null,
        rateLimited: false, rateLimitedCount: 0,
        lastSuccessAt: freshCache?.lastSuccessAt || null, error: String(e),
      });
    }

    releaseLock();
    return staleDataOrNull(freshCache);
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

  // Usage: 5-hour + weekly
  if (!usage || typeof usage !== "object") {
    out += ` ${D}|${R} ${D}5h${R} ${D}--%${R} ${D}week${R} ${D}--%${R}`;
  } else {
    const c5 = pctColor(usage.fiveHour);
    out += ` ${D}|${R} ${D}5h${R} ${c5}${usage.fiveHour}%${R}`;
    if (usage.fiveHourReset) {
      const ms = new Date(usage.fiveHourReset).getTime() - Date.now();
      if (ms > 0) out += `${D}↻${formatDuration(ms)}${R}`;
    }
    const cw = pctColor(usage.weekly);
    out += ` ${D}week${R} ${cw}${usage.weekly}%${R}`;
  }

  // Context window usage
  const ctx = getContextPercent(stdinData);
  if (ctx != null) {
    const cc = pctColor(ctx);
    out += ` ${D}|${R} ${D}context${R} ${cc}${ctx}%${R}`;
  }

  // Session uptime + efficiency
  if (session) {
    out += ` ${D}|${R} ${D}session${R} ${CW}${session.timeStr}${R}`;

    // Efficiency: avg tool calls per prompt (lower = better)
    if (session.prompts > 0) {
      const eff = Math.round(session.calls / session.prompts);
      const ec = eff <= 10 ? CG : eff <= 20 ? CY : CR;
      out += ` ${D}efficiency${R} ${ec}⚡${eff}${R}`;
    }
  }

  // Active bestwork mode
  const gwMode = getLastGatewayAction();
  if (gwMode !== "idle") {
    const label = MODE_LABELS[gwMode] || gwMode;
    out += ` ${D}|${R} ${D}mode${R} ${CC}${label}${R}`;
  }

  // Active guards
  if (existsSync(join(bwDir, "scope.lock"))) out += ` 🔒${D}scope${R}`;
  if (existsSync(join(bwDir, "strict.lock"))) out += ` 🛡${D}strict${R}`;

  // Notification channels
  const cfg = existsSync(join(bwDir, "config.json")) ? JSON.parse(readFileSync(join(bwDir, "config.json"), "utf-8")) : {};
  const messengers = [];
  if (cfg.notify?.discord?.webhookUrl) messengers.push("discord");
  if (cfg.notify?.slack?.webhookUrl) messengers.push("slack");
  if (messengers.length > 0) out += ` ${D}msg:${messengers.join(",")}${R}`;

  process.stdout.write(out + "\n");
}

main().catch(() => process.stdout.write(`${B}${CC}BW${R}${D}#${VERSION}${R}\n`));
