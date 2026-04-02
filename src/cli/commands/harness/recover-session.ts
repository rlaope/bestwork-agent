import { listActiveSessions, loadSession } from "../../../harness/session-recovery.js";
import { bwLog, bwOk, bwWarn, bwErr } from "../../../utils/brand.js";

export async function recoverSessionCommand(id?: string): Promise<void> {
  if (!id) {
    // List all active (non-completed) sessions
    const sessions = await listActiveSessions();

    if (sessions.length === 0) {
      bwLog("No active sessions found.");
      return;
    }

    bwLog(`Active sessions (${sessions.length}):\n`);
    for (const session of sessions) {
      const pending = session.steps.filter((s) => s.status === "pending" || s.status === "failed").length;
      const total = session.steps.length;
      console.log(`  ${session.id}`);
      console.log(`    mode:    ${session.mode}`);
      console.log(`    status:  ${session.status}`);
      console.log(`    task:    ${session.task}`);
      console.log(`    steps:   ${total - pending}/${total} completed`);
      console.log(`    started: ${session.startedAt}`);
      console.log("");
    }
    return;
  }

  // Show session state and remaining steps
  const session = await loadSession(id);

  if (!session) {
    bwErr(`Session not found: ${id}`);
    return;
  }

  bwLog(`Session: ${session.id}`);
  console.log(`  mode:    ${session.mode}`);
  console.log(`  status:  ${session.status}`);
  console.log(`  task:    ${session.task}`);
  console.log(`  started: ${session.startedAt}`);
  console.log("");

  const remaining = session.steps.filter((s) => s.status === "pending" || s.status === "failed");

  if (remaining.length === 0) {
    bwOk("All steps completed.");
    return;
  }

  bwWarn(`Remaining steps (${remaining.length}):\n`);
  for (const step of remaining) {
    console.log(`  ${step.agentId}`);
    console.log(`    status: ${step.status}`);
    if (step.startedAt) console.log(`    started: ${step.startedAt}`);
    if (step.result) console.log(`    result: ${step.result}`);
    console.log("");
  }
}
