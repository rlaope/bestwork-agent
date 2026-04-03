import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".bestwork");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface NotifyConfig {
  discord?: { webhookUrl: string };
  slack?: { webhookUrl: string };
  telegram?: { botToken: string; chatId: string };
}

export interface ProjectConfig {
  /** Default execution mode override */
  defaultMode?: "solo" | "pair" | "trio" | "squad" | "hierarchy";
  /** Agent IDs to prefer when multiple agents could fit */
  preferredAgents?: string[];
  /** Agent IDs to never assign */
  disabledAgents?: string[];
  /** Custom test command for the project */
  testCommand?: string;
  /** Custom build command for the project */
  buildCommand?: string;
}

export interface BestworkConfig {
  notify: NotifyConfig;
  project?: ProjectConfig;
}

export async function loadConfig(): Promise<BestworkConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { notify: {} };
  }
}

/**
 * Load project-level config from .bestwork/config.json in CWD,
 * merged with global ~/.bestwork/config.json. Project config wins.
 */
export async function loadMergedConfig(cwd?: string): Promise<BestworkConfig> {
  const globalConfig = await loadConfig();
  const projectDir = join(cwd ?? process.cwd(), ".bestwork");
  const projectConfigFile = join(projectDir, "config.json");

  let projectConfig: Partial<BestworkConfig> = {};
  try {
    const raw = await readFile(projectConfigFile, "utf-8");
    projectConfig = JSON.parse(raw);
  } catch {
    // No project config — use global only
  }

  // Merge: project.project wins over global.project, notify is deep-merged
  return {
    notify: {
      ...globalConfig.notify,
      ...(projectConfig.notify ?? {}),
    },
    project: {
      ...globalConfig.project,
      ...projectConfig.project,
    },
  };
}

/**
 * Load only the project-level settings (from both project + global config).
 */
export async function loadProjectConfig(cwd?: string): Promise<ProjectConfig> {
  const merged = await loadMergedConfig(cwd);
  return merged.project ?? {};
}

export async function saveConfig(config: BestworkConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

const ALLOWED_WEBHOOK_HOSTS: Record<string, RegExp> = {
  discord: /^(discord\.com|discordapp\.com)$/,
  slack: /^hooks\.slack\.com$/,
  telegram: /^api\.telegram\.org$/,
};

const BLOCKED_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^169\.254\./,
  /^10\./,
  /^192\.168\./,
];

export function validateWebhookUrl(url: string, service: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL for ${service}: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${service} webhook URL must use HTTPS`);
  }
  const host = parsed.hostname;
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(host)) {
      throw new Error(`${service} webhook URL host is blocked: ${host}`);
    }
  }
  const allowed = ALLOWED_WEBHOOK_HOSTS[service];
  if (allowed && !allowed.test(host)) {
    throw new Error(`${service} webhook URL host is not allowed: ${host}`);
  }
}

export async function sendNotification(
  title: string,
  body: string
): Promise<void> {
  const config = await loadConfig();
  const errors: string[] = [];

  if (config.notify.discord?.webhookUrl) {
    try {
      await sendDiscord(config.notify.discord.webhookUrl, title, body);
    } catch (e) {
      errors.push(`Discord: ${e}`);
    }
  }

  if (config.notify.slack?.webhookUrl) {
    try {
      await sendSlack(config.notify.slack.webhookUrl, title, body);
    } catch (e) {
      errors.push(`Slack: ${e}`);
    }
  }

  if (config.notify.telegram?.botToken && config.notify.telegram?.chatId) {
    try {
      await sendTelegram(
        config.notify.telegram.botToken,
        config.notify.telegram.chatId,
        title,
        body
      );
    } catch (e) {
      errors.push(`Telegram: ${e}`);
    }
  }

  if (errors.length > 0) {
    console.error("  Notification errors:", errors.join(", "));
  }
}

async function sendDiscord(
  webhookUrl: string,
  title: string,
  body: string
): Promise<void> {
  validateWebhookUrl(webhookUrl, "discord");
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `🔍 bestwork-agent — ${title}`,
          description: body,
          color: 0x00d4aa,
          footer: { text: "bestwork-agent" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

async function sendSlack(
  webhookUrl: string,
  title: string,
  body: string
): Promise<void> {
  validateWebhookUrl(webhookUrl, "slack");
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `🔍 bestwork-agent — ${title}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: body },
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: "bestwork-agent" },
          ],
        },
      ],
    }),
  });
}

async function sendTelegram(
  botToken: string,
  chatId: string,
  title: string,
  body: string
): Promise<void> {
  validateWebhookUrl(`https://api.telegram.org/bot${botToken}/sendMessage`, "telegram");
  const text = `🔍 *bestwork-agent — ${title}*\n\n${body}`;
  await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );
}
