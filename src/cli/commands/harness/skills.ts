import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

export interface SkillEntry {
  name: string;
  description: string;
  source: "bundled" | "user" | "project";
  path: string;
}

function parseFrontmatter(content: string): { name: string; description: string } | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1]!;
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (!name) return null;
  return { name, description };
}

function scanSkillsDir(dir: string, source: SkillEntry["source"]): SkillEntry[] {
  if (!existsSync(dir)) return [];
  const entries: SkillEntry[] = [];
  let subdirs: string[];
  try {
    subdirs = readdirSync(dir);
  } catch {
    return [];
  }
  for (const sub of subdirs) {
    const full = join(dir, sub);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    const skillMd = join(full, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    try {
      const content = readFileSync(skillMd, "utf-8");
      const parsed = parseFrontmatter(content);
      if (parsed) {
        entries.push({ ...parsed, source, path: skillMd });
      }
    } catch {
      // Malformed SKILL.md — skip (gateway.log already warns on unexpected parses)
    }
  }
  return entries;
}

function resolveBundledSkillsDir(): string | null {
  // When installed as a plugin the env var points at the cache
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    const p = join(process.env.CLAUDE_PLUGIN_ROOT, "skills");
    if (existsSync(p)) return p;
  }
  // From dist/ up to project root during dev
  try {
    const here = fileURLToPath(import.meta.url);
    const candidates = [
      join(dirname(here), "..", "..", "..", "..", "skills"),
      join(dirname(here), "..", "..", "..", "skills"),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  } catch {
    // ignore
  }
  // Last resort: CWD/skills (e.g. running from repo root)
  const cwdSkills = join(process.cwd(), "skills");
  if (existsSync(cwdSkills)) return cwdSkills;
  return null;
}

export function collectSkills(): SkillEntry[] {
  const bundled = resolveBundledSkillsDir();
  const userDir = join(homedir(), ".bestwork", "skills");
  const projectDir = join(process.cwd(), ".bestwork", "skills");

  const all: SkillEntry[] = [
    ...(bundled ? scanSkillsDir(bundled, "bundled") : []),
    ...scanSkillsDir(userDir, "user"),
    ...scanSkillsDir(projectDir, "project"),
  ];

  // Project overrides user overrides bundled
  const dedup = new Map<string, SkillEntry>();
  const priority = { bundled: 0, user: 1, project: 2 } as const;
  for (const s of all) {
    const prev = dedup.get(s.name);
    if (!prev || priority[s.source] > priority[prev.source]) {
      dedup.set(s.name, s);
    }
  }
  return [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface SkillsCommandOptions {
  search?: string;
  json?: boolean;
}

export function skillsCommand(options: SkillsCommandOptions = {}): void {
  const all = collectSkills();
  const needle = options.search?.toLowerCase();
  const filtered = needle
    ? all.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.description.toLowerCase().includes(needle),
      )
    : all;

  if (options.json) {
    process.stdout.write(JSON.stringify(filtered, null, 2) + "\n");
    return;
  }

  if (filtered.length === 0) {
    const msg = needle
      ? `  No skills match "${options.search}".\n`
      : `  No skills found. Run \`bestwork install\` if you installed via npm.\n`;
    process.stdout.write("\n" + msg + "\n");
    return;
  }

  const maxName = Math.max(4, ...filtered.map((s) => s.name.length));
  const maxSrc = Math.max(6, ...filtered.map((s) => s.source.length));

  process.stdout.write(
    `\n  ${filtered.length} skill(s)${needle ? ` matching "${options.search}"` : ""}\n\n`,
  );
  for (const s of filtered) {
    const pad = (v: string, n: number) => v + " ".repeat(Math.max(0, n - v.length));
    process.stdout.write(`  ${pad(s.name, maxName)}  ${pad(s.source, maxSrc)}  ${s.description}\n`);
  }
  process.stdout.write("\n");
}
