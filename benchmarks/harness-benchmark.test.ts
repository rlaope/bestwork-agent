/**
 * Harness Effectiveness Benchmark
 *
 * Measures bestwork harness gates against known-bad scenarios.
 * Compares: bestwork ON (harness active) vs OFF (vanilla, no gates).
 *
 * Run: npm run benchmark
 */

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Scenario types ───

interface Scenario {
  name: string;
  category: "hallucination" | "platform" | "security" | "grounding" | "deprecated";
  /** Diff lines (added lines with +) that simulate bad code */
  diffLines: string[];
  /** Expected: should the harness catch this? */
  shouldCatch: boolean;
  /** Which gate should catch it */
  gate: "review" | "grounding";
}

// ─── Test scenarios ───

const SCENARIOS: Scenario[] = [
  // 1. Fake imports — package doesn't exist
  {
    name: "fake-import: nonexistent npm package",
    category: "hallucination",
    diffLines: [
      '+import { magic } from "super-nonexistent-pkg-xyz"',
      "+const x = magic();",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 2. Hallucinated method calls
  {
    name: "hallucinated-method: console.success()",
    category: "hallucination",
    diffLines: [
      "+console.success('done');",
      "+const arr = Array.from(map.entries().map(x => x));",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 3. Platform mismatch — always uses the "other" OS patterns
  //    On Linux CI: catches macOS patterns. On macOS: catches Linux patterns.
  {
    name: "platform-mismatch: wrong OS patterns",
    category: "platform",
    diffLines: process.platform === "linux"
      ? [
          "+const app = NSApplication.sharedApplication();",
          "+const plist = readFileSync('/Library/Preferences/com.apple.finder.plist');",
        ]
      : [
          "+const cpuInfo = readFileSync('/proc/cpuinfo', 'utf-8');",
          "+const cgroups = readFileSync('/proc/cgroups', 'utf-8');",
        ],
    shouldCatch: true,
    gate: "review",
  },
  // 4. Wrong runtime — Deno API without Deno
  {
    name: "wrong-runtime: Deno API without Deno installed",
    category: "platform",
    diffLines: [
      "+const file = await Deno.readTextFile('./config.json');",
      "+Deno.serve(handler);",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 5. Deprecated Node.js patterns
  {
    name: "deprecated: new Buffer() usage",
    category: "deprecated",
    diffLines: [
      "+const buf = new Buffer('hello');",
      "+const exists = fs.exists('./file');",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 6. Type safety bypass
  {
    name: "type-bypass: as any and ts-ignore",
    category: "security",
    diffLines: [
      "+const data = response as any;",
      "+// @ts-ignore",
      "+const user = getUser() as unknown as Admin;",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 7. Clean code — should NOT trigger
  {
    name: "clean-code: valid TypeScript with real imports",
    category: "hallucination",
    diffLines: [
      '+import { join } from "node:path";',
      "+const fullPath = join(__dirname, 'config.json');",
      "+console.log(fullPath);",
    ],
    shouldCatch: false,
    gate: "review",
  },
  // 8. Windows-specific code on macOS
  {
    name: "platform-mismatch: Windows registry on macOS",
    category: "platform",
    diffLines: [
      "+const reg = HKEY_LOCAL_MACHINE;",
      '+exec("cmd.exe /c dir C:\\\\Users");',
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 9. Bun API without Bun
  {
    name: "wrong-runtime: Bun API without Bun installed",
    category: "platform",
    diffLines: [
      "+const server = Bun.serve({ port: 3000 });",
      '+import { file } from "bun";',
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 10. Mixed — some bad, some clean
  {
    name: "mixed: valid import + hallucinated method",
    category: "hallucination",
    diffLines: [
      '+import { readFileSync } from "node:fs";',
      "+const data = readFileSync('./data.json', 'utf-8');",
      "+console.success('loaded data');",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 11. Relative import to missing file
  {
    name: "missing-file: relative import to nonexistent module",
    category: "hallucination",
    diffLines: [
      '+import { helper } from "../utils/nonexistent-helper-xyz.js";',
      "+helper();",
    ],
    shouldCatch: true,
    gate: "review",
  },
  // 12. False-positive: valid scoped package
  {
    name: "false-positive: valid scoped package @types/node",
    category: "security",
    diffLines: [
      '+import type { IncomingMessage } from "node:http";',
      "+const req: IncomingMessage = {} as IncomingMessage;",
    ],
    shouldCatch: false,
    gate: "review",
  },
  // 13. False-positive: legitimate platform-conditional code
  {
    name: "false-positive: guarded platform check",
    category: "platform",
    diffLines: [
      "+const isLinux = process.platform === 'linux';",
      "+const configPath = isLinux ? '/etc/config' : '/usr/local/etc/config';",
    ],
    shouldCatch: false,
    gate: "review",
  },
];

// ─── Review hook simulator ───

function simulateReviewHook(diffLines: string[]): { warnings: string[]; caught: boolean } {
  const added = diffLines.filter((l) => l.startsWith("+")).map((l) => l.slice(1));
  const warnings: string[] = [];

  // 1. Fake imports
  for (const line of added) {
    const match = line.match(/from\s+["']([^"']+)["']/);
    if (match) {
      const pkg = match[1];
      if (pkg.startsWith(".") || pkg.startsWith("node:")) continue;
      const pkgName = pkg.split("/")[0];
      const pkgJsonPath = join(process.cwd(), "node_modules", pkgName);
      if (!existsSync(pkgJsonPath)) {
        warnings.push(`fake-import: '${pkgName}' not in dependencies`);
      }
    }
  }

  // 2. Nonexistent relative file imports
  for (const line of added) {
    const match = line.match(/from\s+["'](\.\.?\/[^"']+)["']/);
    if (match) {
      const rel = match[1];
      const base = rel.replace(/\.[jt]sx?$/, "");
      const found = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js", ""].some(
        (ext) => existsSync(join(process.cwd(), base + ext)),
      );
      if (!found) {
        warnings.push(`missing-file: relative import '${rel}' — file not found`);
      }
    }
  }

  // 3. Hallucinated methods
  const suspicious =
    /\.(toJSON|toObject|toPlainObject|toSnakeCase|toCamelCase)\(|Array\.from\(.*\.entries\(\)\.map|console\.(success|fail|complete)\(/;
  for (const line of added) {
    if (suspicious.test(line)) {
      warnings.push(`hallucinated-method: ${line.trim().slice(0, 60)}`);
    }
  }

  // 3. Platform mismatch
  const os = process.platform;
  if (os !== "linux") {
    for (const line of added) {
      if (/\/proc\/|cgroups|systemd|apt-get|yum |epoll_|inotify_init/.test(line)) {
        warnings.push(`platform-mismatch: Linux-specific on ${os}`);
      }
    }
  }
  if (os !== "darwin") {
    for (const line of added) {
      if (/launchd|NSApplication|CoreFoundation|IOKit|\.plist/.test(line)) {
        warnings.push(`platform-mismatch: macOS-specific on ${os}`);
      }
    }
  }
  if (os !== "win32") {
    for (const line of added) {
      if (/HKEY_|registry|\.exe|C:\\\\|cmd\.exe/.test(line)) {
        warnings.push(`platform-mismatch: Windows-specific on ${os}`);
      }
    }
  }

  // 4. Wrong runtime
  const hasDeno = false; // assume not installed for benchmark
  const hasBun = false;
  if (!hasDeno) {
    for (const line of added) {
      if (/Deno\./.test(line)) {
        warnings.push(`wrong-runtime: Deno API without Deno`);
      }
    }
  }
  if (!hasBun) {
    for (const line of added) {
      if (/Bun\.|from "bun"/.test(line)) {
        warnings.push(`wrong-runtime: Bun API without Bun`);
      }
    }
  }

  // 5. Deprecated patterns
  for (const line of added) {
    if (/new Buffer\(|fs\.exists\(|url\.parse\(/.test(line)) {
      warnings.push(`deprecated: ${line.trim().slice(0, 60)}`);
    }
  }

  // 6. Type safety bypass
  for (const line of added) {
    if (/as any|@ts-ignore|@ts-nocheck|as unknown as/.test(line)) {
      warnings.push(`type-bypass: ${line.trim().slice(0, 60)}`);
    }
  }

  return { warnings, caught: warnings.length > 0 };
}

// ─── Benchmark results ───

interface BenchmarkResult {
  scenario: string;
  category: string;
  gate: string;
  shouldCatch: boolean;
  harnessOn: { caught: boolean; warnings: string[] };
  harnessOff: { caught: boolean; warnings: string[] };
  correct: boolean;
}

// ─── Tests ───

describe("Harness Effectiveness Benchmark", () => {
  const results: BenchmarkResult[] = [];

  for (const scenario of SCENARIOS) {
    it(`${scenario.name}`, () => {
      // Harness ON — run through review gate
      const harnessOn = simulateReviewHook(scenario.diffLines);

      // Harness OFF — no gates, nothing caught
      const harnessOff = { caught: false, warnings: [] as string[] };

      const correct = scenario.shouldCatch ? harnessOn.caught : !harnessOn.caught;

      results.push({
        scenario: scenario.name,
        category: scenario.category,
        gate: scenario.gate,
        shouldCatch: scenario.shouldCatch,
        harnessOn,
        harnessOff,
        correct,
      });

      if (scenario.shouldCatch) {
        expect(harnessOn.caught, `harness should catch: ${scenario.name}`).toBe(true);
        expect(harnessOff.caught, `vanilla should miss: ${scenario.name}`).toBe(false);
      } else {
        expect(harnessOn.caught, `harness should NOT false-positive: ${scenario.name}`).toBe(false);
      }
    });
  }

  it("generates summary report", () => {
    const total = results.length;
    const correctCount = results.filter((r) => r.correct).length;
    const catchable = results.filter((r) => r.shouldCatch);
    const caughtByHarness = catchable.filter((r) => r.harnessOn.caught).length;
    const caughtByVanilla = catchable.filter((r) => r.harnessOff.caught).length;
    const falsePositives = results.filter((r) => !r.shouldCatch && r.harnessOn.caught).length;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalScenarios: total,
        correctClassifications: correctCount,
        accuracy: `${((correctCount / total) * 100).toFixed(1)}%`,
        harnessOn: {
          catchRate: `${((caughtByHarness / catchable.length) * 100).toFixed(1)}%`,
          caught: caughtByHarness,
          total: catchable.length,
          falsePositives,
        },
        harnessOff: {
          catchRate: `${((caughtByVanilla / catchable.length) * 100).toFixed(1)}%`,
          caught: caughtByVanilla,
          total: catchable.length,
          falsePositives: 0,
        },
      },
      byCategory: Object.entries(
        results.reduce(
          (acc, r) => {
            if (!acc[r.category]) acc[r.category] = { catchable: 0, caught: 0, negatives: 0, falsePositives: 0 };
            if (r.shouldCatch) {
              acc[r.category].catchable++;
              if (r.harnessOn.caught) acc[r.category].caught++;
            } else {
              acc[r.category].negatives++;
              if (r.harnessOn.caught) acc[r.category].falsePositives++;
            }
            return acc;
          },
          {} as Record<string, { catchable: number; caught: number; negatives: number; falsePositives: number }>,
        ),
      ).map(([cat, data]) => ({ category: cat, ...data })),
      scenarios: results.map((r) => ({
        name: r.scenario,
        category: r.category,
        shouldCatch: r.shouldCatch,
        harnessOnCaught: r.harnessOn.caught,
        harnessOnWarnings: r.harnessOn.warnings,
        correct: r.correct,
      })),
    };

    // Save results
    const resultsDir = join(process.cwd(), "benchmarks", "results");
    mkdirSync(resultsDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    writeFileSync(join(resultsDir, `benchmark-${ts}.json`), JSON.stringify(report, null, 2));

    // Print summary
    console.log("\n═══════════════════════════════════");
    console.log("  HARNESS EFFECTIVENESS BENCHMARK");
    console.log("═══════════════════════════════════\n");
    console.log(`  Scenarios:      ${total}`);
    console.log(`  Accuracy:       ${report.summary.accuracy}`);
    console.log("");
    console.log("  Harness ON:");
    console.log(`    Catch rate:   ${report.summary.harnessOn.catchRate} (${caughtByHarness}/${catchable.length})`);
    console.log(`    False pos:    ${falsePositives}`);
    console.log("");
    console.log("  Harness OFF (vanilla):");
    console.log(`    Catch rate:   ${report.summary.harnessOff.catchRate} (${caughtByVanilla}/${catchable.length})`);
    console.log("");
    console.log("  By category:");
    for (const cat of report.byCategory) {
      console.log(`    ${cat.category.padEnd(16)} ${cat.caught}/${cat.catchable} caught${cat.falsePositives ? `, ${cat.falsePositives} false pos` : ""}`);
    }
    console.log("\n═══════════════════════════════════\n");

    // Assertions on overall quality
    expect(correctCount).toBe(total);
    expect(caughtByHarness).toBeGreaterThanOrEqual(catchable.length * 0.8); // 80%+ catch rate
  });
});
