import { readSessionEvents } from "../../../data/store.js";
import { buildReplay, renderReplay } from "../../../observe/replay.js";
import { aggregateSessions } from "../../../observe/aggregator.js";

export async function replayCommand(id: string) {
  // Try hooks data first
  let events = await readSessionEvents(id);

  // If no hooks data, try partial match
  if (events.length === 0) {
    const sessions = await aggregateSessions();
    const match = sessions.find(
      (s) => s.id === id || s.id.startsWith(id)
    );

    if (match) {
      events = await readSessionEvents(match.id);
    }

    if (events.length === 0) {
      console.log(
        "\n  No replay data found for this session." +
          "\n  Run `nysm install` to enable hooks for future sessions.\n"
      );
      return;
    }
  }

  const steps = buildReplay(events);
  console.log(renderReplay(steps, id));
}
