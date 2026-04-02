import { loadConfig, saveConfig, sendNotification } from "../../core/notify.js";

interface NotifySetupOptions {
  discord?: string;
  slack?: string;
  telegramToken?: string;
  telegramChat?: string;
  test?: boolean;
}

export async function notifyConfigCommand(options: NotifySetupOptions) {
  const config = await loadConfig();

  if (options.discord) {
    config.notify.discord = { webhookUrl: options.discord };
    console.log("  Discord webhook configured.");
  }

  if (options.slack) {
    config.notify.slack = { webhookUrl: options.slack };
    console.log("  Slack webhook configured.");
  }

  if (options.telegramToken && options.telegramChat) {
    config.notify.telegram = {
      botToken: options.telegramToken,
      chatId: options.telegramChat,
    };
    console.log("  Telegram bot configured.");
  }

  await saveConfig(config);

  if (options.test) {
    console.log("\n  Sending test notification...");
    await sendNotification(
      "Test",
      "nysm notifications are working! 🎉"
    );
    console.log("  Done. Check your channels.\n");
    return;
  }

  console.log("\n  Config saved to ~/.nysm/config.json");
  console.log("  Run with --test to send a test notification.\n");
}

interface NotifySendOptions {
  title: string;
  body: string;
}

export async function notifySendCommand(options: NotifySendOptions) {
  await sendNotification(options.title, options.body);
}
