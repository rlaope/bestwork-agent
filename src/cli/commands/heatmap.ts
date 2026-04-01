import { aggregateSessions } from "../../core/aggregator.js";
import { buildHeatmap, renderHeatmap } from "../../core/heatmap.js";

export async function heatmapCommand() {
  const sessions = await aggregateSessions();
  const data = buildHeatmap(sessions);
  console.log(renderHeatmap(data));
}
