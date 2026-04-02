import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

const OK = "\x1b[32m✓\x1b[0m";
const WARN = "\x1b[33m!\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";

export async function doctorCommand() {
  console.log("\n  bestwork doctor\n");

  let issues = 0;

  // 1. CLI version
  let currentVersion = "unknown";
  try {
    const pkgPath = join(homedir(), ".nvm/versions/node", `v${process.versions.node}`, "lib/node_modules/bestwork-agent/package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    currentVersion = pkg.version;
  } catch {
    try {
      const out = execSync("bestwork --version 2>/dev/null", { encoding: "utf-8" }).trim();
      currentVersion = out;
    } catch {
      // fallback
    }
  }
  console.log(`  ${OK} CLI version: ${currentVersion}`);

  // 2. Check npm registry for updates
  try {
    const res = await fetch("https://registry.npmjs.org/bestwork-agent/latest");
    if (res.ok) {
      const data = (await res.json()) as { version: string };
      if (data.version !== currentVersion) {
        console.log(`  ${WARN} Update available: ${currentVersion} → ${data.version}`);
        console.log(`      Run: npm install -g bestwork-agent@latest`);
        issues++;
      } else {
        console.log(`  ${OK} Up to date (latest: ${data.version})`);
      }
    }
  } catch {
    console.log(`  ${WARN} Could not check npm registry`);
  }

  // 3. Node.js version
  const nodeVersion = process.versions.node;
  const nodeMajor = parseInt(nodeVersion.split(".")[0]!);
  if (nodeMajor >= 18) {
    console.log(`  ${OK} Node.js: v${nodeVersion}`);
  } else {
    console.log(`  ${FAIL} Node.js: v${nodeVersion} (requires >=18)`);
    issues++;
  }

  // 4. Data directory
  const dataDir = join(homedir(), ".bestwork", "data");
  try {
    await access(dataDir);
    console.log(`  ${OK} Data directory: ~/.bestwork/data/`);
  } catch {
    console.log(`  ${WARN} Data directory missing: ~/.bestwork/data/`);
    console.log(`      Run: bestwork install`);
    issues++;
  }

  // 5. Config file
  const configPath = join(homedir(), ".bestwork", "config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    const hasDiscord = !!config.notify?.discord?.webhookUrl;
    const hasSlack = !!config.notify?.slack?.webhookUrl;
    console.log(`  ${OK} Config: ~/.bestwork/config.json`);
    console.log(`      Discord: ${hasDiscord ? "configured" : "not set"}`);
    console.log(`      Slack: ${hasSlack ? "configured" : "not set"}`);
  } catch {
    console.log(`  ${WARN} No config file (notifications not set up)`);
  }

  // 6. Claude Code settings hooks
  const settingsPath = join(homedir(), ".claude", "settings.json");
  try {
    const raw = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings.hooks ?? {};

    const hookEvents = ["PostToolUse", "PreToolUse", "UserPromptSubmit", "Stop", "SessionStart"];
    let registeredCount = 0;

    for (const event of hookEvents) {
      const arr = hooks[event] as unknown[] | undefined;
      if (arr && arr.length > 0) {
        const hasBestwork = JSON.stringify(arr).includes("bestwork");
        if (hasBestwork) registeredCount++;
      }
    }

    if (registeredCount >= 4) {
      console.log(`  ${OK} Hooks: ${registeredCount}/5 events registered`);
    } else if (registeredCount > 0) {
      console.log(`  ${WARN} Hooks: only ${registeredCount}/5 events registered`);
      console.log(`      Run: bestwork install`);
      issues++;
    } else {
      console.log(`  ${FAIL} Hooks: not installed`);
      console.log(`      Run: bestwork install`);
      issues++;
    }

    // Check for legacy nysm hooks
    const rawStr = JSON.stringify(hooks);
    if (rawStr.includes("nysm")) {
      console.log(`  ${WARN} Legacy nysm hooks detected in settings.json`);
      console.log(`      Run: bestwork install (will clean up)`);
      issues++;
    }
  } catch {
    console.log(`  ${FAIL} Cannot read ~/.claude/settings.json`);
    issues++;
  }

  // 7. Hook scripts executable
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
    const hooksDir = join(npmRoot, "bestwork-agent", "hooks");
    await access(hooksDir);
    console.log(`  ${OK} Hook scripts: ${hooksDir}`);
  } catch {
    console.log(`  ${WARN} Hook scripts not found in global npm`);
    console.log(`      Run: npm install -g bestwork-agent`);
    issues++;
  }

  // 8. Scope/strict state
  const scopePath = join(homedir(), ".bestwork", "scope.lock");
  const strictPath = join(homedir(), ".bestwork", "strict.lock");
  try {
    const scope = await readFile(scopePath, "utf-8");
    console.log(`  ${OK} Scope lock: ${scope.trim()}`);
  } catch {
    console.log(`  ${OK} Scope lock: none (unrestricted)`);
  }
  try {
    await access(strictPath);
    console.log(`  ${OK} Strict mode: ON`);
  } catch {
    console.log(`  ${OK} Strict mode: OFF`);
  }

  // Summary
  console.log("");
  if (issues === 0) {
    console.log(`  ${OK} All checks passed. bestwork is healthy.\n`);
  } else {
    console.log(`  ${WARN} ${issues} issue(s) found. See recommendations above.\n`);
  }
}
