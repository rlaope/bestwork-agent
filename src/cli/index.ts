import { Command } from "commander";
import { sessionsCommand } from "./commands/sessions.js";
import { sessionCommand } from "./commands/session.js";
import { summaryCommand } from "./commands/summary.js";
import { liveCommand } from "./commands/live.js";
import { dashboardCommand } from "./commands/dashboard.js";
import { heatmapCommand } from "./commands/heatmap.js";
import { replayCommand } from "./commands/replay.js";
import { loopsCommand } from "./commands/loops.js";
import { installCommand } from "./commands/install.js";

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

program.parse();
