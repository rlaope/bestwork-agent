import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillName, SkillResult } from "./result-summarizer.js";

export interface ReportDetails extends SkillResult {
  agents?: string[];
  tasks?: string[];
  durationMs?: number;
  decisions?: string[];
}

/**
 * Writes a detailed execution report to `.bestwork/reports/{skill}-{timestamp}.md`.
 * Returns the path to the created report file.
 */
export async function writeReport(
  skillName: SkillName,
  details: ReportDetails,
  projectRoot: string = process.cwd()
): Promise<string> {
  const timestamp = Date.now();
  const reportsDir = join(projectRoot, ".bestwork", "reports");
  const fileName = `${skillName}-${timestamp}.md`;
  const filePath = join(reportsDir, fileName);

  await mkdir(reportsDir, { recursive: true });

  const lines: string[] = [];
  const isoTime = new Date(timestamp).toISOString();

  lines.push(`# ${skillName} report`);
  lines.push("");
  lines.push(`**Skill**: ${skillName}`);
  lines.push(`**Timestamp**: ${isoTime}`);
  lines.push(`**Result**: ${details.done}/${details.total} done`);

  if (details.durationMs !== undefined) {
    lines.push(`**Duration**: ${(details.durationMs / 1000).toFixed(1)}s`);
  }

  if (details.agents && details.agents.length > 0) {
    lines.push("");
    lines.push("## Agents");
    for (const agent of details.agents) {
      lines.push(`- ${agent}`);
    }
  }

  if (details.tasks && details.tasks.length > 0) {
    lines.push("");
    lines.push("## Task Breakdown");
    for (const task of details.tasks) {
      lines.push(`- ${task}`);
    }
  }

  if (details.decisions && details.decisions.length > 0) {
    lines.push("");
    lines.push("## Decisions");
    for (const decision of details.decisions) {
      lines.push(`- ${decision}`);
    }
  }

  lines.push("");

  await writeFile(filePath, lines.join("\n"), "utf8");

  return join(".bestwork", "reports", fileName);
}
