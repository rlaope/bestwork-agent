import { aggregateSessions } from "../../core/aggregator.js";
import { analyzeOutcome, renderOutcome } from "../../core/outcomes.js";

export async function outcomeCommand(id: string) {
  const sessions = await aggregateSessions();
  const session = sessions.find(
    (s) => s.id === id || s.id.startsWith(id)
  );

  if (!session) {
    console.log(`  Session not found: ${id}`);
    return;
  }

  const outcome = analyzeOutcome(session);
  console.log(renderOutcome(outcome));
}
