/**
 * Context Accumulator — persists decisions, risks, and tech-debt across sessions.
 *
 * Appends to .bestwork/context/ markdown files so project context survives
 * session boundaries and can be referenced by agents and skills.
 */

import { readFile, appendFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Decision, ContextIndex } from "../types/index.js";

function getContextDir(): string {
  return join(process.cwd(), ".bestwork", "context");
}

function getDecisionsFile(): string { return join(getContextDir(), "decisions.md"); }
function getRisksFile(): string { return join(getContextDir(), "risks.md"); }
function getTechDebtFile(): string { return join(getContextDir(), "tech-debt.md"); }
function getIndexFile(): string { return join(getContextDir(), "index.json"); }

async function ensureContextDir(): Promise<void> {
  await mkdir(getContextDir(), { recursive: true });
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Append a decision entry to decisions.md
 */
export async function accumulateDecision(decision: Decision): Promise<void> {
  await ensureContextDir();

  const date = decision.date ?? formatDate(new Date());
  const entry = [
    `## ${date}: ${decision.title}`,
    `- **Decision**: ${decision.text}`,
    `- **Reason**: ${decision.reason}`,
    `- **Impact**: ${decision.impact}`,
    "",
  ].join("\n");

  const decisionsFile = getDecisionsFile();
  if (!existsSync(decisionsFile)) {
    await writeFile(decisionsFile, "# Decisions\n\n");
  }

  await appendFile(decisionsFile, entry + "\n");
}

/**
 * Append a risk entry to risks.md
 */
export async function accumulateRisk(risk: string): Promise<void> {
  await ensureContextDir();

  const date = formatDate(new Date());
  const entry = `- [${date}] ${risk}\n`;

  const risksFile = getRisksFile();
  if (!existsSync(risksFile)) {
    await writeFile(risksFile, "# Risks\n\n");
  }

  await appendFile(risksFile, entry);
}

/**
 * Append a tech-debt entry to tech-debt.md
 */
export async function accumulateTechDebt(item: string): Promise<void> {
  await ensureContextDir();

  const date = formatDate(new Date());
  const entry = `- [${date}] ${item}\n`;

  const techDebtFile = getTechDebtFile();
  if (!existsSync(techDebtFile)) {
    await writeFile(techDebtFile, "# Tech Debt\n\n");
  }

  await appendFile(techDebtFile, entry);
}

export interface AccumulatedContext {
  decisions: string;
  risks: string;
  techDebt: string;
  index: ContextIndex | null;
}

/**
 * Read all accumulated context and return structured data
 */
export async function getContext(): Promise<AccumulatedContext> {
  await ensureContextDir();

  const [decisions, risks, techDebt, indexRaw] = await Promise.all([
    readFile(getDecisionsFile(), "utf-8").catch(() => ""),
    readFile(getRisksFile(), "utf-8").catch(() => ""),
    readFile(getTechDebtFile(), "utf-8").catch(() => ""),
    readFile(getIndexFile(), "utf-8").catch(() => null),
  ]);

  let index: ContextIndex | null = null;
  if (indexRaw !== null) {
    try {
      index = JSON.parse(indexRaw) as ContextIndex;
    } catch {
      index = null;
    }
  }

  return { decisions, risks, techDebt, index };
}
