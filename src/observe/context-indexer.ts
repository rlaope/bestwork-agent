/**
 * Context Indexer — builds a searchable JSON index of accumulated decisions.
 *
 * Scans decisions.md and produces index.json so agents and skills can
 * quickly search past decisions by keyword without reading the full file.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ContextEntry, ContextIndex } from "../types/index.js";

function getContextDir(): string {
  return join(process.cwd(), ".bestwork", "context");
}

function getDecisionsFile(): string { return join(getContextDir(), "decisions.md"); }
function getIndexFile(): string { return join(getContextDir(), "index.json"); }

async function ensureContextDir(): Promise<void> {
  await mkdir(getContextDir(), { recursive: true });
}

/**
 * Extract keywords from a decision block (title + decision/reason/impact lines).
 * Returns lowercased, unique, non-trivial tokens.
 */
function extractKeywords(lines: string[]): string[] {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for",
    "of", "with", "is", "it", "be", "as", "by", "we", "use",
  ]);

  const text = lines.join(" ").toLowerCase();
  const tokens = text
    .replace(/[*#\-`[\]()]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  return [...new Set(tokens)];
}

/**
 * Parse decisions.md into ContextEntry records.
 * Each `## date: title` heading starts a new entry.
 */
function parseDecisions(content: string): ContextEntry[] {
  const entries: ContextEntry[] = [];
  const lines = content.split("\n");

  let currentEntry: { date: string; title: string; bodyLines: string[]; startLine: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2}):\s+(.+)$/);

    if (headingMatch) {
      // Flush previous entry
      if (currentEntry) {
        entries.push({
          date: currentEntry.date,
          title: currentEntry.title,
          keywords: extractKeywords([currentEntry.title, ...currentEntry.bodyLines]),
          file: "decisions.md",
          line: currentEntry.startLine,
        });
      }

      currentEntry = {
        date: headingMatch[1]!,
        title: headingMatch[2]!,
        bodyLines: [],
        startLine: i + 1, // 1-based line number
      };
    } else if (currentEntry && line.trim()) {
      currentEntry.bodyLines.push(line);
    }
  }

  // Flush last entry
  if (currentEntry) {
    entries.push({
      date: currentEntry.date,
      title: currentEntry.title,
      keywords: extractKeywords([currentEntry.title, ...currentEntry.bodyLines]),
      file: "decisions.md",
      line: currentEntry.startLine,
    });
  }

  return entries;
}

/**
 * Scan decisions.md and write index.json
 */
export async function indexDecisions(): Promise<ContextIndex> {
  await ensureContextDir();

  const content = await readFile(getDecisionsFile(), "utf-8").catch(() => "");
  const entries = parseDecisions(content);
  const index: ContextIndex = { entries };

  await writeFile(getIndexFile(), JSON.stringify(index, null, 2));
  return index;
}

/**
 * Search the index by keyword. Returns matching entries.
 * Falls back to indexDecisions() if index.json does not exist.
 */
export async function searchContext(keyword: string): Promise<ContextEntry[]> {
  await ensureContextDir();

  let index: ContextIndex;
  try {
    const raw = await readFile(getIndexFile(), "utf-8");
    index = JSON.parse(raw) as ContextIndex;
  } catch {
    index = await indexDecisions();
  }

  const q = keyword.toLowerCase();
  return index.entries.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.keywords.some((k) => k.includes(q))
  );
}
