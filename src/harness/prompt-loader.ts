import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve prompts dir relative to package root (works for both dev and installed)
function getPromptsDir(): string {
  // When installed globally: npm root -g/bestwork-agent/prompts
  // When running from source: project-root/prompts
  const thisFile = fileURLToPath(import.meta.url);
  // src/harness/prompt-loader.ts -> go up 2 levels to project root
  return join(dirname(thisFile), "..", "..", "..", "prompts");
}

export async function loadPrompt(role: string, name: string): Promise<string> {
  const filePath = join(getPromptsDir(), role, `${name}.md`);
  const content = await readFile(filePath, "utf-8");
  // Extract body after frontmatter
  const parts = content.split("---");
  if (parts.length >= 3) {
    return parts.slice(2).join("---").trim();
  }
  return content.trim();
}

export interface PromptMeta {
  id: string;
  role: string;
  name: string;
  specialty: string;
  costTier: "low" | "medium" | "high";
  useWhen: string[];
  avoidWhen: string[];
  prompt: string;
}

/**
 * Parse a YAML list from frontmatter lines starting after a key like "useWhen:".
 * Supports both inline `useWhen: ["a", "b"]` and multi-line `- "a"\n- "b"` forms.
 */
function parseYamlList(lines: string[], startIdx: number): string[] {
  const firstLine = lines[startIdx];
  if (!firstLine) return [];
  const afterColon = firstLine.split(":").slice(1).join(":").trim();

  // Inline array: useWhen: ["a", "b"]
  if (afterColon.startsWith("[")) {
    try {
      return JSON.parse(afterColon);
    } catch {
      return [];
    }
  }

  // Multi-line list items
  const items: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("- ")) {
      items.push(line.slice(2).replace(/^["']|["']$/g, "").trim());
    } else {
      break;
    }
  }
  return items;
}

export async function loadPromptMeta(
  role: string,
  name: string
): Promise<PromptMeta> {
  const filePath = join(getPromptsDir(), role, `${name}.md`);
  const content = await readFile(filePath, "utf-8");
  const parts = content.split("---");

  const meta: Record<string, string> = {};
  let useWhen: string[] = [];
  let avoidWhen: string[] = [];

  if (parts.length >= 3) {
    const fmLines = parts[1]!.trim().split("\n");
    for (let i = 0; i < fmLines.length; i++) {
      const line = fmLines[i]!;
      const [key, ...vals] = line.split(":");
      const k = key?.trim();
      if (!k) continue;

      if (k === "useWhen") {
        useWhen = parseYamlList(fmLines, i);
      } else if (k === "avoidWhen") {
        avoidWhen = parseYamlList(fmLines, i);
      } else if (vals.length && !line.trim().startsWith("-")) {
        meta[k] = vals.join(":").trim();
      }
    }
  }

  return {
    id: meta.id ?? "",
    role: meta.role ?? role,
    name: meta.name ?? "",
    specialty: meta.specialty ?? "",
    costTier: (meta.costTier as "low" | "medium" | "high") ?? "medium",
    useWhen,
    avoidWhen,
    prompt:
      parts.length >= 3 ? parts.slice(2).join("---").trim() : content.trim(),
  };
}
