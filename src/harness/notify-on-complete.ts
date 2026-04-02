/**
 * Notification on prompt completion — TypeScript replacement for bestwork-prompt-done.sh
 *
 * Called by hook: node -e "import('./notify-on-complete.js').then(m => m.run())"
 * Receives session data, collects git diff, sends to Discord/Slack.
 */

import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

interface Config {
  notify?: {
    discord?: { webhookUrl: string };
    slack?: { webhookUrl: string };
  };
}

const EXCLUDE_PATHS = [".omc", ".bestwork", "node_modules", "dist", "*.lock", "package-lock.json"];

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

function getExcludeArgs(): string {
  return EXCLUDE_PATHS.map((p) => `":(exclude)${p}"`).join(" ");
}

function getTaskTitle(): string {
  const msg = exec("git log -1 --format=%s");
  return msg || "Unknown task";
}

function getLastPrompt(sessionId: string): string {
  try {
    const historyPath = join(homedir(), ".claude", "history.jsonl");
    const content = execSync(`grep '"sessionId":"${sessionId}"' "${historyPath}" | tail -1`, {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    if (content) {
      const entry = JSON.parse(content);
      const display = (entry.display ?? "").replace(/\x1b\[[0-9;]*m/g, "");
      return display.slice(0, 100) || "N/A";
    }
  } catch {}
  return "N/A";
}

function getSessionStats(sessionId: string): { calls: string; prompts: string } {
  try {
    const raw = exec(`bestwork session "${sessionId.slice(0, 8)}"`).replace(/\x1b\[[0-9;]*m/g, "");
    const callsMatch = raw.match(/Total calls:\s*(\S+)/);
    const promptsMatch = raw.match(/Prompts:\s*(\S+)/);
    return {
      calls: callsMatch?.[1] ?? "?",
      prompts: promptsMatch?.[1] ?? "?",
    };
  } catch {
    return { calls: "?", prompts: "?" };
  }
}

interface GitInfo {
  stat: string;
  files: string[];
  snippet: string;
}

function getGitChanges(): GitInfo {
  const excl = getExcludeArgs();
  const empty: GitInfo = { stat: "No changes", files: [], snippet: "" };

  // Try: unstaged → staged → last commit
  const sources = [
    { stat: `git diff --stat -- . ${excl}`, files: `git diff --name-only -- . ${excl}`, diff: `git diff -- . ${excl}` },
    { stat: `git diff --cached --stat -- . ${excl}`, files: `git diff --cached --name-only -- . ${excl}`, diff: `git diff --cached -- . ${excl}` },
    { stat: `git diff HEAD~1 --stat -- . ${excl}`, files: `git diff HEAD~1 --name-only -- . ${excl}`, diff: `git diff HEAD~1 -- . ${excl}` },
  ];

  for (const src of sources) {
    const stat = exec(src.stat);
    const lastLine = stat.split("\n").pop()?.trim();
    if (lastLine && lastLine.includes("changed")) {
      const filesRaw = exec(src.files);
      const files = filesRaw.split("\n").filter(Boolean).slice(0, 5);

      // Extract added lines as code snippet
      const diffRaw = exec(src.diff);
      const addedLines = diffRaw
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1))
        .filter((l) => l.trim().length > 0)
        .slice(0, 10);

      return {
        stat: lastLine,
        files,
        snippet: addedLines.join("\n").slice(0, 400),
      };
    }
  }

  return empty;
}

function getReviewResult(): string {
  try {
    const scriptDir = join(homedir(), ".nvm/versions/node", `v${process.versions.node}`, "lib/node_modules/bestwork-agent/hooks");
    const output = exec(`echo '{}' | BESTWORK_REVIEW_TRIGGER=1 bash "${scriptDir}/bestwork-review.sh"`);
    if (output.includes("⚠️")) {
      const parsed = JSON.parse(output);
      const content = parsed?.hookSpecificOutput?.additionalContext ?? "";
      const warnings = content
        .split("\n")
        .filter((l: string) => l.includes("⚠️"))
        .slice(0, 5)
        .join("\n");
      return warnings || "✅ No issues";
    }
  } catch {}
  return "✅ No issues";
}

async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(join(homedir(), ".bestwork", "config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getProjectName(): string {
  try {
    const pkgPath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(execSync(`cat "${pkgPath}"`, { encoding: "utf-8" }));
    return pkg.name || basename(process.cwd());
  } catch {
    return basename(process.cwd());
  }
}

async function sendDiscord(url: string, payload: object): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

async function sendSlack(url: string, payload: object): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export async function run(inputJson?: string): Promise<void> {
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
  } catch {}

  const project = getProjectName();
  const title = getTaskTitle();
  const prompt = getLastPrompt(sessionId);
  const stats = getSessionStats(sessionId);
  const git = getGitChanges();
  const review = getReviewResult();
  const timestamp = new Date().toISOString();

  const hasWarnings = review.includes("⚠️");
  const color = hasWarnings ? 0xffaa00 : 0x00d4aa;

  // Build description
  let desc = `**Project:** ${project}\n`;
  desc += `**Prompt:** ${prompt}\n`;
  desc += `**Stats:** ${stats.calls} calls | ${stats.prompts} prompts\n\n`;
  desc += `**Changes:** ${git.stat}\n`;
  if (git.files.length > 0) {
    desc += `**Files:** ${git.files.join(", ")}\n`;
  }
  if (git.snippet) {
    desc += `\`\`\`ts\n${git.snippet}\n\`\`\`\n`;
  }
  desc += `\n**Review:** ${review}`;

  if (discordUrl) {
    await sendDiscord(discordUrl, {
      embeds: [
        {
          title,
          description: desc,
          color,
          footer: { text: "bestwork-agent" },
          timestamp,
        },
      ],
    });
  }

  if (slackUrl) {
    const slackDesc = desc.replace(/\*\*/g, "*");
    await sendSlack(slackUrl, {
      blocks: [
        { type: "header", text: { type: "plain_text", text: title } },
        { type: "section", text: { type: "mrkdwn", text: slackDesc } },
        { type: "context", elements: [{ type: "mrkdwn", text: "bestwork-agent" }] },
      ],
    });
  }
}

// Direct execution
run().catch(() => {});
