import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

/**
 * Stage-to-stage handoff documents.
 *
 * Modeled on the OMC pattern: every stage transition (plan → exec → verify → fix)
 * produces a markdown record of what was decided, what alternatives were rejected,
 * what risks were identified, and what is still open. The next stage reads it
 * instead of inferring intent from the diff alone.
 *
 * Storage: .bestwork/handoffs/{stage}.md (project-local, ignored by git by default).
 * Format is plain markdown so a human reviewer can read it directly.
 */

export interface Handoff {
  /** Logical stage name — e.g. "plan", "exec", "verify", "fix". */
  stage: string;
  /** Decisions made in this stage that downstream stages must respect. */
  decided: string[];
  /** Alternatives considered and rejected, with the reason. */
  rejected: string[];
  /** Risks identified — non-blocking but worth surfacing to the next stage. */
  risks: string[];
  /** Concrete files touched / produced in this stage. */
  files: string[];
  /** Open items the next stage must address. */
  remaining: string[];
  /** ISO timestamp the handoff was written. */
  writtenAt: string;
}

const HANDOFF_DIR_NAME = ".bestwork/handoffs";

function dirFor(cwd: string = process.cwd()): string {
  return join(cwd, HANDOFF_DIR_NAME);
}

function fileFor(stage: string, cwd: string = process.cwd()): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(stage)) {
    throw new Error(`invalid stage name: ${stage}`);
  }
  return join(dirFor(cwd), `${stage}.md`);
}

function bulletList(label: string, items: string[]): string {
  if (items.length === 0) return `## ${label}\n\n_(none)_\n`;
  return `## ${label}\n\n${items.map((i) => `- ${i.replace(/\n/g, " ")}`).join("\n")}\n`;
}

export function renderHandoff(h: Handoff): string {
  return [
    `# Handoff: ${h.stage}`,
    `_Written ${h.writtenAt}_`,
    "",
    bulletList("Decided", h.decided),
    bulletList("Rejected alternatives", h.rejected),
    bulletList("Risks", h.risks),
    bulletList("Files", h.files),
    bulletList("Remaining for next stage", h.remaining),
  ].join("\n");
}

export async function writeHandoff(
  data: Omit<Handoff, "writtenAt"> & { writtenAt?: string },
  cwd: string = process.cwd(),
): Promise<string> {
  const handoff: Handoff = {
    ...data,
    writtenAt: data.writtenAt ?? new Date().toISOString(),
  };
  const path = fileFor(handoff.stage, cwd);
  await mkdir(dirFor(cwd), { recursive: true });
  await writeFile(path, renderHandoff(handoff), "utf-8");
  return path;
}

/**
 * Parse a handoff file back into structured form. Tolerant of human edits:
 * unknown sections are ignored and missing sections become empty arrays.
 */
export async function readHandoff(stage: string, cwd: string = process.cwd()): Promise<Handoff | null> {
  const path = fileFor(stage, cwd);
  if (!existsSync(path)) return null;

  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    logger.warn("handoff", `failed to read ${path}`, err);
    return null;
  }

  const writtenAtMatch = raw.match(/^_Written (.+)_$/m);
  const writtenAt = writtenAtMatch?.[1]?.trim() ?? "";

  const sectionFor = (label: string): string[] => {
    const re = new RegExp(`## ${label}\\n\\n([\\s\\S]*?)(?=\\n## |$)`, "m");
    const m = raw.match(re);
    if (!m) return [];
    const body = m[1]!.trim();
    if (body === "_(none)_") return [];
    return body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim());
  };

  return {
    stage,
    decided: sectionFor("Decided"),
    rejected: sectionFor("Rejected alternatives"),
    risks: sectionFor("Risks"),
    files: sectionFor("Files"),
    remaining: sectionFor("Remaining for next stage"),
    writtenAt,
  };
}

export async function listHandoffs(cwd: string = process.cwd()): Promise<string[]> {
  const dir = dirFor(cwd);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    logger.warn("handoff", `failed to list ${dir}`, err);
    return [];
  }
  return entries
    .filter((e) => e.endsWith(".md"))
    .map((e) => e.slice(0, -3))
    .sort();
}
