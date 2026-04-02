import { writeFile } from "node:fs/promises";
import { aggregateSessions, getToolRanking } from "../../core/aggregator.js";

interface ExportOptions {
  format: string;
  output?: string;
}

export async function exportCommand(options: ExportOptions) {
  const sessions = await aggregateSessions();
  const fmt = options.format ?? "json";

  const data = sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    totalCalls: s.totalCalls,
    lastTool: s.lastTool,
    toolCounts: s.toolCounts,
    promptCount: s.prompts.length,
    subagentCount: s.subagents.length,
    isActive: s.isActive,
    cwd: s.meta?.cwd ?? "",
  }));

  let output: string;

  if (fmt === "csv") {
    const headers = [
      "id",
      "startedAt",
      "totalCalls",
      "lastTool",
      "promptCount",
      "subagentCount",
      "isActive",
      "cwd",
    ];
    const rows = data.map((d) =>
      [
        d.id,
        d.startedAt,
        d.totalCalls,
        d.lastTool,
        d.promptCount,
        d.subagentCount,
        d.isActive,
        d.cwd,
      ].join(",")
    );
    output = [headers.join(","), ...rows].join("\n");
  } else {
    output = JSON.stringify(data, null, 2);
  }

  if (options.output) {
    await writeFile(options.output, output);
    console.log(`  Exported ${data.length} sessions to ${options.output}`);
  } else {
    console.log(output);
  }
}
