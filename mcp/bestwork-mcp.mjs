#!/usr/bin/env node
/**
 * bestwork-agent MCP server (stdio, JSON-RPC 2.0)
 * Exposes bestwork data as tools for Claude Code.
 * No external dependencies — uses only Node.js built-ins.
 */

import { createInterface } from "readline";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve, dirname, basename } from "path";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PLUGIN_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PROMPTS_DIR = join(PLUGIN_ROOT, "prompts");
const HOME_BESTWORK = join(homedir(), ".bestwork");
const SESSION_DATA_DIR = join(HOME_BESTWORK, "data");

// Project-local .bestwork is resolved relative to cwd
function projectBestwork() {
  return join(process.cwd(), ".bestwork");
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "bestwork_agents",
    description:
      "List all bestwork specialist agents with their roles, specialties, and cost tiers. Returns the full agent catalog parsed from prompt frontmatter.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "bestwork_meeting_log",
    description:
      "Return the latest meeting log entries from the current project's .bestwork/state/meeting.jsonl. Shows trio/squad/hierarchy meeting history.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of log entries to return (default: 50)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "bestwork_session_stats",
    description:
      "Return session statistics summary from ~/.bestwork/data/*.jsonl. Shows total sessions, events, and date range.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "bestwork_heatmap",
    description:
      "Return activity heatmap data — calls per day derived from session data in ~/.bestwork/data/. Shows daily activity counts for the last 90 days.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to include (default: 90)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "bestwork_plan",
    description:
      "Return the latest saved execution plan from .bestwork/plans/*.json in the current project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split("\n")) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let val = line.slice(sep + 1).trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }
  return meta;
}

function toolAgents() {
  const agents = [];
  const roles = ["tech", "pm", "critic"];

  for (const role of roles) {
    const dir = join(PROMPTS_DIR, role);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = readFileSync(join(dir, file), "utf-8");
        const meta = parseFrontmatter(content);
        if (meta) {
          agents.push({
            id: meta.id || `${role}-${basename(file, ".md")}`,
            role: meta.role || role,
            name: meta.name || basename(file, ".md"),
            specialty: meta.specialty || "",
            costTier: meta.costTier || "medium",
          });
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  return { agents, count: agents.length };
}

function toolMeetingLog(limit = 50) {
  const logPath = join(projectBestwork(), "state", "meeting.jsonl");
  if (!existsSync(logPath)) {
    return { entries: [], message: "No meeting log found at " + logPath };
  }

  const lines = readFileSync(logPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  const entries = [];
  for (const line of lines.slice(-limit)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  return { entries, count: entries.length };
}

function toolSessionStats() {
  if (!existsSync(SESSION_DATA_DIR)) {
    return { sessions: 0, message: "No session data directory at " + SESSION_DATA_DIR };
  }

  const files = readdirSync(SESSION_DATA_DIR).filter((f) => f.endsWith(".jsonl"));
  let totalEvents = 0;
  let earliest = null;
  let latest = null;

  for (const file of files) {
    const fpath = join(SESSION_DATA_DIR, file);
    try {
      const stat = statSync(fpath);
      const mtime = stat.mtime;
      const ctime = stat.birthtime || stat.ctime;
      if (!earliest || ctime < earliest) earliest = ctime;
      if (!latest || mtime > latest) latest = mtime;

      const content = readFileSync(fpath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      totalEvents += lines.length;
    } catch {
      // skip
    }
  }

  return {
    sessions: files.length,
    totalEvents,
    dateRange: {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null,
    },
  };
}

function toolHeatmap(days = 90) {
  if (!existsSync(SESSION_DATA_DIR)) {
    return { days: [], message: "No session data directory at " + SESSION_DATA_DIR };
  }

  const files = readdirSync(SESSION_DATA_DIR).filter((f) => f.endsWith(".jsonl"));
  const countMap = new Map();

  // Count events per day using file modification dates as proxy
  for (const file of files) {
    try {
      const stat = statSync(join(SESSION_DATA_DIR, file));
      const dateStr = stat.mtime.toISOString().slice(0, 10);
      countMap.set(dateStr, (countMap.get(dateStr) || 0) + 1);
    } catch {
      // skip
    }
  }

  // Build day array for the last N days
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = countMap.get(dateStr) || 0;
    result.push({ date: dateStr, count });
  }

  const maxCount = Math.max(...result.map((d) => d.count), 0);
  const activeDays = result.filter((d) => d.count > 0).length;

  return { days: result, maxCount, activeDays, totalDays: days };
}

function toolPlan() {
  const plansDir = join(projectBestwork(), "plans");
  if (!existsSync(plansDir)) {
    return { plan: null, message: "No plans directory at " + plansDir };
  }

  const jsonFiles = readdirSync(plansDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      name: f,
      path: join(plansDir, f),
      mtime: statSync(join(plansDir, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (jsonFiles.length === 0) {
    return { plan: null, message: "No plan files found in " + plansDir };
  }

  try {
    const content = readFileSync(jsonFiles[0].path, "utf-8");
    return { plan: JSON.parse(content), file: jsonFiles[0].name };
  } catch {
    return { plan: null, message: "Failed to parse " + jsonFiles[0].name };
  }
}

function executeTool(name, args) {
  switch (name) {
    case "bestwork_agents":
      return toolAgents();
    case "bestwork_meeting_log":
      return toolMeetingLog(args?.limit);
    case "bestwork_session_stats":
      return toolSessionStats();
    case "bestwork_heatmap":
      return toolHeatmap(args?.days);
    case "bestwork_plan":
      return toolPlan();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC transport (stdio)
// ---------------------------------------------------------------------------

function send(response) {
  const json = JSON.stringify(response);
  process.stdout.write(json + "\n");
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  // Notifications (no id) — just acknowledge silently
  if (id === undefined || id === null) {
    // Handle notifications like initialized
    if (method === "notifications/initialized") {
      // No response needed for notifications
    }
    return;
  }

  switch (method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "bestwork-mcp",
            version: "1.0.0",
          },
        },
      });
      break;

    case "tools/list":
      send({
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      });
      break;

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      try {
        const result = executeTool(toolName, toolArgs);
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
          },
        });
      }
      break;
    }

    default:
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    handleMessage(msg);
  } catch (err) {
    // Malformed JSON — send parse error if we can guess an id
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
});

// Prevent unhandled errors from crashing the server
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});
