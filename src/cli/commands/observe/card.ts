import { aggregateSessions } from "../../../observe/aggregator.js";
import { renderStatsCard } from "../../../observe/stats-card.js";

export async function cardCommand() {
  const sessions = await aggregateSessions();
  console.log(renderStatsCard(sessions));
}
