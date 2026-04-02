import { aggregateSessions } from "../../../observe/aggregator.js";
import { buildHeatmap, renderHeatmap } from "../../../observe/heatmap.js";

export async function heatmapCommand() {
  const sessions = await aggregateSessions();
  const data = buildHeatmap(sessions);
  console.log(renderHeatmap(data));
}
