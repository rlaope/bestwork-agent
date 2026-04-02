import { Command } from "commander";
import { sessionsCommand } from "./commands/observe/sessions.js";
import { sessionCommand } from "./commands/observe/session.js";
import { summaryCommand } from "./commands/observe/summary.js";
import { liveCommand } from "./commands/observe/live.js";
import { dashboardCommand } from "./commands/observe/dashboard.js";
import { heatmapCommand } from "./commands/observe/heatmap.js";
import { replayCommand } from "./commands/observe/replay.js";
import { loopsCommand } from "./commands/observe/loops.js";
import { installCommand } from "./commands/harness/install.js";
import { outcomeCommand } from "./commands/observe/outcome.js";
import { cardCommand } from "./commands/observe/card.js";
import { effectivenessCommand } from "./commands/observe/effectiveness.js";
import { exportCommand } from "./commands/observe/export.js";
import { notifyConfigCommand, notifySendCommand } from "./commands/notify/notify-config.js";
import { watchCommand } from "./commands/harness/watch.js";
import { agentsCommand } from "./commands/harness/agents.js";

const program = new Command();

program
  .name("nysm")
  .description("now you see me — Claude Code Agent Observability & Session Analytics")
  .version("0.1.0");

program
  .command("sessions")
  .description("List all sessions")
  .option("-n, --limit <number>", "Number of sessions to show", "10")
  .action(sessionsCommand);

program
  .command("session <id>")
  .description("Show session detail")
  .action(sessionCommand);

program
  .command("summary")
  .description("Show today's summary")
  .option("-w, --weekly", "Show weekly summary")
  .action(summaryCommand);

program
  .command("live")
  .description("Live monitoring mode")
  .action(liveCommand);

program
  .command("dashboard", { isDefault: true })
  .description("Interactive TUI dashboard")
  .action(dashboardCommand);

program
  .command("heatmap")
  .description("GitHub-style activity heatmap")
  .action(heatmapCommand);

program
  .command("replay <id>")
  .description("Replay a session step-by-step")
  .action(replayCommand);

program
  .command("loops")
  .description("Detect agent loop patterns")
  .action(loopsCommand);

program
  .command("install")
  .description("Install Claude Code hooks for advanced tracking")
  .action(installCommand);

program
  .command("outcome <id>")
  .description("Session outcome analysis (productive/struggling)")
  .action(outcomeCommand);

program
  .command("card")
  .description("Shareable stats card")
  .action(cardCommand);

program
  .command("effectiveness")
  .description("Prompt effectiveness trend (calls/prompt over time)")
  .action(effectivenessCommand);

program
  .command("export")
  .description("Export session data")
  .option("-f, --format <format>", "Output format (json|csv)", "json")
  .option("-o, --output <file>", "Output file path")
  .action(exportCommand);

program
  .command("watch")
  .description("Watch sessions and notify on completion (Discord/Slack)")
  .action(watchCommand);

program
  .command("agents")
  .description("List all available specialist agent profiles")
  .action(agentsCommand);

const notifyCmd = program
  .command("notify")
  .description("Notification settings");

notifyCmd
  .command("setup")
  .description("Configure Discord/Slack/Telegram notifications")
  .option("--discord <url>", "Discord webhook URL")
  .option("--slack <url>", "Slack webhook URL")
  .option("--telegram-token <token>", "Telegram bot token")
  .option("--telegram-chat <id>", "Telegram chat ID")
  .option("--test", "Send a test notification")
  .action(notifyConfigCommand);

notifyCmd
  .command("send")
  .description("Send a notification manually")
  .requiredOption("--title <title>", "Notification title")
  .requiredOption("--body <body>", "Notification body")
  .action(notifySendCommand);

program.parse();
