import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_AGENTS } from "../agents/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function readJSON(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, relPath), "utf-8"));
}

describe("install integrity", () => {
  describe("dist artifacts exist", () => {
    it("dist/smart-gateway.js exists (referenced by hooks.json)", () => {
      expect(existsSync(join(ROOT, "dist/smart-gateway.js"))).toBe(true);
    });

    it("dist/index.js exists (package.json bin entry)", () => {
      expect(existsSync(join(ROOT, "dist/index.js"))).toBe(true);
    });
  });

  describe("hooks.json file references resolve", () => {
    const hooksJson = readJSON("hooks/hooks.json") as {
      hooks: Record<string, Array<{ hooks: Array<{ type: string; command?: string }> }>>;
    };

    // Extract all shell/node file paths from command hooks
    const commandPaths: string[] = [];
    for (const eventHooks of Object.values(hooksJson.hooks)) {
      for (const group of eventHooks) {
        for (const hook of group.hooks) {
          if (hook.type === "command" && hook.command) {
            // Extract file paths: patterns like "hooks/foo.sh" or "dist/foo.js"
            // Commands use ${CLAUDE_PLUGIN_ROOT}/path — extract the relative path after it
            const matches = hook.command.matchAll(
              /\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"]+)/g
            );
            for (const m of matches) {
              commandPaths.push(m[1]);
            }
          }
        }
      }
    }

    it("found at least one command path to verify", () => {
      expect(commandPaths.length).toBeGreaterThan(0);
    });

    it.each(commandPaths)("%s exists on disk", (relPath) => {
      expect(existsSync(join(ROOT, relPath))).toBe(true);
    });
  });

  describe("version consistency", () => {
    const pkgJson = readJSON("package.json");
    const pluginJson = readJSON(".claude-plugin/plugin.json");
    const marketplaceJson = readJSON(".claude-plugin/marketplace.json");

    it("package.json has a version string", () => {
      expect(typeof pkgJson.version).toBe("string");
      expect((pkgJson.version as string).length).toBeGreaterThan(0);
    });

    it("package.json version matches plugin.json version", () => {
      expect(pluginJson.version).toBe(pkgJson.version);
    });

    it("package.json version matches marketplace.json plugin version", () => {
      const plugins = (marketplaceJson as { plugins: Array<{ version: string }> }).plugins;
      expect(plugins).toBeDefined();
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0].version).toBe(pkgJson.version);
    });
  });

  describe("skills have SKILL.md", () => {
    const skillsDir = join(ROOT, "skills");
    const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    it("found at least one skill directory", () => {
      expect(skillDirs.length).toBeGreaterThan(0);
    });

    it.each(skillDirs)("skills/%s/SKILL.md exists", (skillName) => {
      expect(existsSync(join(skillsDir, skillName, "SKILL.md"))).toBe(true);
    });
  });

  describe("agent prompt files exist", () => {
    // Each agent id is "{role}-{name}", prompt file is prompts/{role}/{name}.md
    const agentPromptPaths = ALL_AGENTS.map((a) => {
      const name = a.id.replace(`${a.role}-`, "");
      return { id: a.id, relPath: `prompts/${a.role}/${name}.md` };
    });

    it("found agents to verify", () => {
      expect(agentPromptPaths.length).toBeGreaterThan(0);
    });

    it.each(agentPromptPaths)("$relPath exists for agent $id", ({ relPath }) => {
      expect(existsSync(join(ROOT, relPath))).toBe(true);
    });
  });
});
