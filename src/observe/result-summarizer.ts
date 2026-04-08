export type SkillName = "trio" | "blitz" | "pipeline-run" | "deliver";

export interface SkillResult {
  total: number;
  done: number;
  agents?: string[];
  tasks?: string[];
  durationMs?: number;
  decisions?: string[];
  reportFile?: string;
}

/**
 * Returns a 1-line summary for a skill execution result.
 * Example: `[BW] ✓ 3/3 done — details: .bestwork/reports/trio-1234567890.md`
 */
export function summarize(skillName: SkillName, results: SkillResult): string {
  const { total, done, reportFile } = results;
  const status = done >= total ? "✓" : "✗";
  const detailsPart = reportFile ? ` — details: ${reportFile}` : "";
  return `[BW] ${status} ${done}/${total} done${detailsPart}`;
}
