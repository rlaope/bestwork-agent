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
import { setupCommand } from "./commands/harness/setup.js";
import { orgCommand } from "./commands/harness/org.js";
import { updateCommand } from "./commands/harness/update.js";
import { doctorCommand } from "./commands/harness/doctor.js";
import { welcomeCommand } from "./commands/harness/welcome.js";
import { recoverSessionCommand } from "./commands/harness/recover-session.js";
import { skillsCommand } from "./commands/harness/skills.js";

const program = new Command();

const DEBUG = process.argv.includes("--debug") || process.env.BW_DEBUG === "1";

function reportError(label: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n  ✗ bestwork ${label}: ${msg}\n`);
  if (DEBUG && err instanceof Error && err.stack) {
    process.stderr.write(`\n${err.stack}\n`);
  } else if (!DEBUG) {
    process.stderr.write(`  (re-run with --debug or BW_DEBUG=1 for a stack trace)\n`);
  }
  process.exitCode = 1;
}

process.on("unhandledRejection", (reason) => reportError("unhandled rejection", reason));
process.on("uncaughtException", (err) => reportError("uncaught exception", err));

program
  .name("bestwork")
  .description("bestwork-agent — harness engineering for Claude Code")
  .option("--debug", "Show full stack traces on error")
  .version("0.9.0");

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
  .command("setup")
  .description("Interactive setup wizard")
  .action(setupCommand);

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

program
  .command("org")
  .description("Show organization chart — roles, levels, team presets")
  .action(orgCommand);

program
  .command("update")
  .description("Check for updates and show upgrade instructions")
  .action(updateCommand);

program
  .command("doctor")
  .description("Diagnose bestwork installation health")
  .action(doctorCommand);

program
  .command("welcome")
  .description("Show bestwork branded welcome message")
  .action(welcomeCommand);

program
  .command("recover [id]")
  .description("Recover a team/trio/squad session (list active or show by ID)")
  .action(recoverSessionCommand);

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

program
  .command("skills")
  .description("List all available skills (bundled + user + project)")
  .option("-s, --search <term>", "Filter skills by name or description")
  .option("--json", "Output as JSON")
  .action(skillsCommand);

program.parse();
