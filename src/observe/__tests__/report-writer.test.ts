import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeReport } from "../report-writer.js";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";

describe("writeReport", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "bw-report-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a report file and returns relative path", async () => {
    const reportPath = await writeReport(
      "trio",
      { total: 3, done: 3 },
      tmpDir
    );
    expect(reportPath).toMatch(/^\.bestwork\/reports\/trio-\d+\.md$/);
  });

  it("report file contains skill name and result", async () => {
    const reportPath = await writeReport(
      "blitz",
      { total: 5, done: 4 },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content).toContain("blitz");
    expect(content).toContain("4/5 done");
  });

  it("report includes agents section when provided", async () => {
    const reportPath = await writeReport(
      "trio",
      {
        total: 2,
        done: 2,
        agents: ["bestwork:tech-auth", "bestwork:critic-security"],
      },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content).toContain("## Agents");
    expect(content).toContain("bestwork:tech-auth");
    expect(content).toContain("bestwork:critic-security");
  });

  it("report includes task breakdown when provided", async () => {
    const reportPath = await writeReport(
      "pipeline-run",
      {
        total: 2,
        done: 2,
        tasks: ["implement auth endpoint", "add tests"],
      },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content).toContain("## Task Breakdown");
    expect(content).toContain("implement auth endpoint");
  });

  it("report includes duration when provided", async () => {
    const reportPath = await writeReport(
      "deliver",
      { total: 3, done: 3, durationMs: 5000 },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content).toContain("5.0s");
  });

  it("report includes decisions when provided", async () => {
    const reportPath = await writeReport(
      "trio",
      {
        total: 1,
        done: 1,
        decisions: ["used rebase merge strategy"],
      },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content).toContain("## Decisions");
    expect(content).toContain("used rebase merge strategy");
  });

  it("creates reports directory if it does not exist", async () => {
    const reportPath = await writeReport(
      "blitz",
      { total: 1, done: 1 },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("report contains ISO timestamp", async () => {
    const reportPath = await writeReport(
      "trio",
      { total: 1, done: 1 },
      tmpDir
    );
    const content = await readFile(join(tmpDir, reportPath), "utf8");
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
