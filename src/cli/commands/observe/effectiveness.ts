import { aggregateSessions } from "../../../observe/aggregator.js";
import {
  calculateEffectiveness,
  renderEffectiveness,
} from "../../../observe/effectiveness.js";

export async function effectivenessCommand() {
  const sessions = await aggregateSessions();
  const points = calculateEffectiveness(sessions, 14);
  console.log(renderEffectiveness(points));
}
