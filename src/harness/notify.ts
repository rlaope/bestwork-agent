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

export interface BestworkConfig {
  notify: NotifyConfig;
}

export async function loadConfig(): Promise<BestworkConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { notify: {} };
  }
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
