import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

describe("context-indexer", () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "bw-idx-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeDecisions(content: string): Promise<void> {
    const dir = join(tmpDir, ".bestwork", "context");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "decisions.md"), content);
  }

  it("indexDecisions returns empty entries when decisions.md is missing", async () => {
    const { indexDecisions } = await import("../context-indexer.js");
    const index = await indexDecisions();
    expect(index.entries).toHaveLength(0);
  });

  it("indexDecisions parses a single decision correctly", async () => {
    await writeDecisions([
      "# Decisions",
      "",
      "## 2024-02-10: Use ESM modules",
      "- **Decision**: Switch to ESM",
      "- **Reason**: Better tree-shaking",
      "- **Impact**: Medium — requires bundler update",
      "",
    ].join("\n"));

    const { indexDecisions } = await import("../context-indexer.js");
    const index = await indexDecisions();

    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]?.date).toBe("2024-02-10");
    expect(index.entries[0]?.title).toBe("Use ESM modules");
    expect(index.entries[0]?.file).toBe("decisions.md");
    expect(index.entries[0]?.line).toBeGreaterThan(0);
    expect(index.entries[0]?.keywords).toContain("esm");
  });

  it("indexDecisions parses multiple decisions", async () => {
    await writeDecisions([
      "# Decisions",
      "",
      "## 2024-01-05: Use TypeScript",
      "- **Decision**: Adopt TypeScript",
      "- **Reason**: Type safety",
      "- **Impact**: High",
      "",
      "## 2024-02-20: Use vitest",
      "- **Decision**: Replace jest with vitest",
      "- **Reason**: Faster and ESM-native",
      "- **Impact**: Low",
      "",
    ].join("\n"));

    const { indexDecisions } = await import("../context-indexer.js");
    const index = await indexDecisions();

    expect(index.entries).toHaveLength(2);
    expect(index.entries[0]?.title).toBe("Use TypeScript");
    expect(index.entries[1]?.title).toBe("Use vitest");
  });

  it("indexDecisions writes index.json to disk", async () => {
    await writeDecisions("## 2024-03-01: Cache strategy\n- **Decision**: Use file cache\n- **Reason**: Simple\n- **Impact**: Low\n");

    const { indexDecisions } = await import("../context-indexer.js");
    await indexDecisions();

    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(join(tmpDir, ".bestwork", "context", "index.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].title).toBe("Cache strategy");
  });

  it("searchContext finds entries matching keyword in title", async () => {
    await writeDecisions([
      "## 2024-04-01: Adopt Redis cache\n- **Decision**: Use Redis\n- **Reason**: Speed\n- **Impact**: High\n",
      "## 2024-04-02: Drop jQuery\n- **Decision**: Remove jQuery\n- **Reason**: Bundle size\n- **Impact**: Medium\n",
    ].join("\n"));

    const { indexDecisions, searchContext } = await import("../context-indexer.js");
    await indexDecisions();

    const results = await searchContext("redis");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Adopt Redis cache");
  });

  it("searchContext finds entries matching keyword in body", async () => {
    await writeDecisions(
      "## 2024-05-01: Performance upgrade\n- **Decision**: Switch to bun runtime\n- **Reason**: Faster startup\n- **Impact**: Medium\n"
    );

    const { indexDecisions, searchContext } = await import("../context-indexer.js");
    await indexDecisions();

    const results = await searchContext("bun");
    expect(results).toHaveLength(1);
  });

  it("searchContext returns empty array when no matches", async () => {
    await writeDecisions("## 2024-06-01: Some decision\n- **Decision**: Foo\n- **Reason**: Bar\n- **Impact**: Baz\n");

    const { indexDecisions, searchContext } = await import("../context-indexer.js");
    await indexDecisions();

    const results = await searchContext("nonexistentkeyword12345");
    expect(results).toHaveLength(0);
  });

  it("searchContext builds index automatically if index.json missing", async () => {
    await writeDecisions("## 2024-07-01: Auto-index test\n- **Decision**: X\n- **Reason**: Y\n- **Impact**: Z\n");

    const { searchContext } = await import("../context-indexer.js");
    const results = await searchContext("auto");
    expect(results.length).toBeGreaterThan(0);
  });
});
