import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================
// Types
// ============================================================

export interface TeamSession {
  id: string;
  mode: "trio" | "squad" | "hierarchy";
  task: string;
  startedAt: string;
  steps: StepState[];
  status: "running" | "paused" | "completed" | "failed";
}

export interface StepState {
  agentId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================
// Storage
// ============================================================

const SESSIONS_DIR = join(homedir(), ".bestwork", "sessions");

async function ensureSessionsDir(): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

function sessionFile(id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return join(SESSIONS_DIR, `${safeId}.json`);
}

// ============================================================
// Public API
// ============================================================

export async function saveSession(session: TeamSession): Promise<void> {
  await ensureSessionsDir();
  await writeFile(sessionFile(session.id), JSON.stringify(session, null, 2) + "\n");
}

export async function loadSession(id: string): Promise<TeamSession | null> {
  try {
    const raw = await readFile(sessionFile(id), "utf-8");
    return JSON.parse(raw) as TeamSession;
  } catch {
    return null;
  }
}

export async function listActiveSessions(): Promise<TeamSession[]> {
  await ensureSessionsDir();

  let files: string[];
  try {
    files = await readdir(SESSIONS_DIR);
  } catch {
    return [];
  }

  const sessions: TeamSession[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(SESSIONS_DIR, file), "utf-8");
      const session = JSON.parse(raw) as TeamSession;
      if (session.status !== "completed") {
        sessions.push(session);
      }
    } catch {
      // skip malformed files
    }
  }

  return sessions;
}

export async function resumeSession(id: string): Promise<TeamSession | null> {
  const session = await loadSession(id);
  if (!session) return null;

  // Return session with only pending/failed steps remaining
  return {
    ...session,
    steps: session.steps.filter((s) => s.status === "pending" || s.status === "failed"),
  };
}

export async function markStepComplete(
  sessionId: string,
  agentId: string,
  result: string
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;

  const step = session.steps.find((s) => s.agentId === agentId);
  if (!step) return;

  step.status = "completed";
  step.result = result;
  step.completedAt = new Date().toISOString();

  // Mark session completed if all steps are done
  const allDone = session.steps.every((s) => s.status === "completed");
  if (allDone) {
    session.status = "completed";
  }

  await saveSession(session);
}
