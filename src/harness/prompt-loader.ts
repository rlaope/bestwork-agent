import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve prompts dir relative to package root (works for both dev and installed)
function getPromptsDir(): string {
  // When installed globally: npm root -g/nysm/prompts
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

export async function loadPromptMeta(
  role: string,
  name: string
): Promise<{
  id: string;
  role: string;
  name: string;
  specialty: string;
  prompt: string;
}> {
  const filePath = join(getPromptsDir(), role, `${name}.md`);
  const content = await readFile(filePath, "utf-8");
  const parts = content.split("---");

  const meta: Record<string, string> = {};
  if (parts.length >= 3) {
    for (const line of parts[1].trim().split("\n")) {
      const [key, ...vals] = line.split(":");
      if (key && vals.length) meta[key.trim()] = vals.join(":").trim();
    }
  }

  return {
    id: meta.id ?? "",
    role: meta.role ?? role,
    name: meta.name ?? "",
    specialty: meta.specialty ?? "",
    prompt:
      parts.length >= 3 ? parts.slice(2).join("---").trim() : content.trim(),
  };
}
