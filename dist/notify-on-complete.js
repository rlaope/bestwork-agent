var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/harness/logger.ts
var logger_exports = {};
__export(logger_exports, {
  log: () => log,
  logger: () => logger
});
import { appendFileSync, mkdirSync } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";
function formatError(err) {
  if (err instanceof Error) {
    return err.stack ? `${err.message}
  ${err.stack.split("\n").slice(1, 3).join("\n  ")}` : err.message;
  }
  return String(err);
}
function log(level, scope, msg, err) {
  try {
    mkdirSync(BW_DIR, { recursive: true });
    const ts = (/* @__PURE__ */ new Date()).toISOString().slice(11, 19);
    const tail = err !== void 0 ? ` \u2014 ${formatError(err)}` : "";
    appendFileSync(LOG_FILE, `[${ts}] [${level}] [${scope}] ${msg}${tail}
`);
  } catch {
  }
}
var BW_DIR, LOG_FILE, logger;
var init_logger = __esm({
  "src/harness/logger.ts"() {
    "use strict";
    BW_DIR = join2(homedir2(), ".bestwork");
    LOG_FILE = join2(BW_DIR, "gateway.log");
    logger = {
      debug: (scope, msg, err) => log("debug", scope, msg, err),
      info: (scope, msg, err) => log("info", scope, msg, err),
      warn: (scope, msg, err) => log("warn", scope, msg, err),
      error: (scope, msg, err) => log("error", scope, msg, err)
    };
  }
});

// src/harness/notify-on-complete.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join3, basename } from "path";
import { homedir as homedir3 } from "os";
import { execSync } from "child_process";

// src/harness/meeting-state.ts
import { readFile, appendFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
var STATE_DIR = join(homedir(), ".bestwork", "state");
var MEETING_FILE = join(STATE_DIR, "meeting.jsonl");
async function readMeeting() {
  try {
    const raw = await readFile(MEETING_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    let summary = null;
    const entries = [];
    for (const line of lines) {
      const obj = JSON.parse(line);
      if (obj.type === "header") {
        summary = {
          teamName: obj.teamName,
          mode: obj.mode,
          task: obj.task,
          classification: obj.classification,
          developerCount: obj.developerCount,
          routingReason: obj.routingReason,
          entries: [],
          verdict: "IN_PROGRESS",
          totalIterations: 0
        };
      } else if (obj.type === "entry") {
        entries.push(obj);
      } else if (obj.type === "footer") {
        if (summary) {
          summary.verdict = obj.verdict;
          summary.totalIterations = obj.totalIterations;
        }
      }
    }
    if (summary) {
      summary.entries = entries;
    }
    return summary;
  } catch {
    return null;
  }
}
async function clearMeeting() {
  try {
    await writeFile(MEETING_FILE, "");
  } catch {
  }
}
function formatMeetingForNotification(meeting) {
  let desc = "";
  desc += `**Team:** ${meeting.teamName} (${meeting.mode})
`;
  desc += `**Task:** ${meeting.task}
`;
  desc += `**Type:** ${meeting.classification} \xB7 **Devs:** ${meeting.developerCount}
`;
  desc += `**Why:** ${meeting.routingReason}

`;
  for (const entry of meeting.entries) {
    const icon = entry.decision === "APPROVE" ? "\u2705" : entry.decision === "REQUEST_CHANGES" ? "\u{1F504}" : entry.decision === "IMPLEMENT" ? "\u{1F528}" : "\u{1F4AC}";
    desc += `${icon} **${entry.title}** \u2192 ${entry.decision}
`;
    desc += `${entry.summary}
`;
    if (entry.codeSnippet) {
      const snippet = entry.codeSnippet.split("\n").slice(0, 4).join("\n");
      desc += `\`\`\`ts
${snippet}
\`\`\`
`;
    }
    if (entry.filesChanged && entry.filesChanged.length > 0) {
      desc += `\u{1F4C1} ${entry.filesChanged.slice(0, 3).join(", ")}
`;
    }
    desc += "\n";
  }
  const approveCount = meeting.entries.filter((e) => e.decision === "APPROVE").length;
  const changesCount = meeting.entries.filter((e) => e.decision === "REQUEST_CHANGES").length;
  desc += `**Verdict:** ${meeting.verdict}
`;
  desc += `**Decisions:** ${approveCount} approve \xB7 ${changesCount} changes \xB7 ${meeting.totalIterations} iterations`;
  return desc;
}

// src/harness/notify-on-complete.ts
var EXCLUDE_PATHS = [".omc", ".bestwork", "node_modules", "dist", "*.lock", "package-lock.json"];
function exec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5e3 }).trim();
  } catch {
    return "";
  }
}
function getExcludeArgs() {
  return EXCLUDE_PATHS.map((p) => `":(exclude)${p}"`).join(" ");
}
function getTaskTitle() {
  const msg = exec("git log -1 --format=%s");
  return msg || "Unknown task";
}
function getLastPrompt(sessionId) {
  try {
    const historyPath = join3(homedir3(), ".claude", "history.jsonl");
    const content = execSync(`grep '"sessionId":"${sessionId}"' "${historyPath}" | tail -1`, {
      encoding: "utf-8",
      timeout: 3e3
    }).trim();
    if (content) {
      const entry = JSON.parse(content);
      const display = (entry.display ?? "").replace(/\x1b\[[0-9;]*m/g, "");
      return display.slice(0, 100) || "N/A";
    }
  } catch (err) {
    Promise.resolve().then(() => (init_logger(), logger_exports)).then(
      ({ logger: logger2 }) => logger2.debug("notify", `failed to read last prompt from history.jsonl`, err)
    ).catch(() => {
    });
  }
  return "N/A";
}
function getSessionStats(sessionId) {
  try {
    const raw = exec(`bestwork session "${sessionId.slice(0, 8)}"`).replace(/\x1b\[[0-9;]*m/g, "");
    const callsMatch = raw.match(/Total calls:\s*(\S+)/);
    const promptsMatch = raw.match(/Prompts:\s*(\S+)/);
    return {
      calls: callsMatch?.[1] ?? "?",
      prompts: promptsMatch?.[1] ?? "?"
    };
  } catch {
    return { calls: "?", prompts: "?" };
  }
}
function getGitChanges() {
  const excl = getExcludeArgs();
  const empty = { stat: "No changes", files: [], snippet: "" };
  const sources = [
    { stat: `git diff --stat -- . ${excl}`, files: `git diff --name-only -- . ${excl}`, diff: `git diff -- . ${excl}` },
    { stat: `git diff --cached --stat -- . ${excl}`, files: `git diff --cached --name-only -- . ${excl}`, diff: `git diff --cached -- . ${excl}` },
    { stat: `git diff HEAD~1 --stat -- . ${excl}`, files: `git diff HEAD~1 --name-only -- . ${excl}`, diff: `git diff HEAD~1 -- . ${excl}` }
  ];
  for (const src of sources) {
    const stat = exec(src.stat);
    const lastLine = stat.split("\n").pop()?.trim();
    if (lastLine && lastLine.includes("changed")) {
      const filesRaw = exec(src.files);
      const files = filesRaw.split("\n").filter(Boolean).slice(0, 5);
      const diffRaw = exec(src.diff);
      const addedLines = diffRaw.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).filter((l) => l.trim().length > 0).slice(0, 10);
      return {
        stat: lastLine,
        files,
        snippet: addedLines.join("\n").slice(0, 400)
      };
    }
  }
  return empty;
}
function getReviewResult() {
  try {
    const scriptDir = join3(homedir3(), ".nvm/versions/node", `v${process.versions.node}`, "lib/node_modules/bestwork-agent/hooks");
    const output = exec(`echo '{}' | BESTWORK_REVIEW_TRIGGER=1 bash "${scriptDir}/bestwork-review.sh"`);
    if (output.includes("\u26A0\uFE0F")) {
      const parsed = JSON.parse(output);
      const content = parsed?.hookSpecificOutput?.additionalContext ?? "";
      const warnings = content.split("\n").filter((l) => l.includes("\u26A0\uFE0F")).slice(0, 5).join("\n");
      return warnings || "\u2705 No issues";
    }
  } catch {
  }
  return "\u2705 No issues";
}
async function loadConfig() {
  try {
    const raw = await readFile2(join3(homedir3(), ".bestwork", "config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function getProjectName() {
  try {
    const pkgPath = join3(process.cwd(), "package.json");
    const pkg = JSON.parse(execSync(`cat "${pkgPath}"`, { encoding: "utf-8" }));
    return pkg.name || basename(process.cwd());
  } catch {
    return basename(process.cwd());
  }
}
async function sendDiscord(url, payload) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
  }
}
async function sendSlack(url, payload) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
  }
}
async function run(inputJson) {
  const config = await loadConfig();
  const discordUrl = config.notify?.discord?.webhookUrl;
  const slackUrl = config.notify?.slack?.webhookUrl;
  if (!discordUrl && !slackUrl) return;
  let sessionId = "unknown";
  try {
    if (inputJson) {
      const input = JSON.parse(inputJson);
      sessionId = input.session_id ?? "unknown";
    }
  } catch {
  }
  const project = getProjectName();
  const title = getTaskTitle();
  const prompt = getLastPrompt(sessionId);
  const stats = getSessionStats(sessionId);
  const git = getGitChanges();
  const review = getReviewResult();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const meeting = await readMeeting();
  const hasWarnings = review.includes("\u26A0\uFE0F");
  const hasMeeting = meeting && meeting.entries.length > 0;
  const color = hasMeeting ? meeting.verdict === "APPROVED" ? 54442 : meeting.verdict === "REJECTED" ? 16729156 : 16755200 : hasWarnings ? 16755200 : 54442;
  let desc = `**Project:** ${project}
`;
  desc += `**Prompt:** ${prompt}
`;
  desc += `**Stats:** ${stats.calls} calls | ${stats.prompts} prompts

`;
  if (hasMeeting) {
    desc += formatMeetingForNotification(meeting);
    desc += "\n\n";
  }
  desc += `**Changes:** ${git.stat}
`;
  if (git.files.length > 0) {
    desc += `**Files:** ${git.files.join(", ")}
`;
  }
  if (git.snippet && !hasMeeting) {
    desc += `\`\`\`ts
${git.snippet}
\`\`\`
`;
  }
  desc += `
**Review:** ${review}`;
  if (hasMeeting) {
    await clearMeeting();
  }
  if (discordUrl) {
    await sendDiscord(discordUrl, {
      embeds: [
        {
          title,
          description: desc,
          color,
          footer: { text: "bestwork-agent" },
          timestamp
        }
      ]
    });
  }
  if (slackUrl) {
    const slackDesc = desc.replace(/\*\*/g, "*");
    await sendSlack(slackUrl, {
      blocks: [
        { type: "header", text: { type: "plain_text", text: title } },
        { type: "section", text: { type: "mrkdwn", text: slackDesc } },
        { type: "context", elements: [{ type: "mrkdwn", text: "bestwork-agent" }] }
      ]
    });
  }
}
export {
  run
};
