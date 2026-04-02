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
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
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
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `🔍 bestwork-agent — ${title}`,
          description: body,
          color: 0x00d4aa,
          footer: { text: "bestwork-agent — now you see me" },
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
            { type: "mrkdwn", text: "bestwork-agent — now you see me" },
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
