import { aggregateSessions } from "../../core/aggregator.js";
import { renderStatsCard } from "../../core/stats-card.js";

export async function cardCommand() {
  const sessions = await aggregateSessions();
  console.log(renderStatsCard(sessions));
}
