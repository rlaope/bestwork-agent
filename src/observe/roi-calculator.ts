import { getTokenStats } from "./token-tracker.js";
import type { ROIResult } from "../types/index.js";

export async function calculateROI(): Promise<ROIResult[]> {
  const stats = await getTokenStats();
  if (stats.length === 0) return [];

  const results: ROIResult[] = stats.map((s) => {
    const tokensPerTask = s.totalTasks > 0 ? s.totalTokens / s.totalTasks : 0;
    const roi =
      s.totalTokens > 0 ? s.totalTasks / (s.totalTokens / 10000) : 0;
    return {
      skill: s.skill,
      tokensPerTask,
      roi,
    };
  });

  results.sort((a, b) => b.roi - a.roi);
  return results;
}

export async function getROISummary(): Promise<string> {
  const results = await calculateROI();
  if (results.length === 0) return "ROI: no data";

  const parts = results
    .slice(0, 5)
    .map((r) => `${r.skill} ${r.roi.toFixed(1)}x`);
  return `ROI: ${parts.join(" | ")}`;
}
