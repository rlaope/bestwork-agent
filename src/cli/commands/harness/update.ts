import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export async function updateCommand() {
  const thisFile = fileURLToPath(import.meta.url);
  const pkgPath = join(dirname(thisFile), "..", "..", "..", "..", "package.json");

  let currentVersion = "unknown";
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    currentVersion = pkg.version;
  } catch {
    // fallback
  }

  console.log(`\n  bestwork-agent v${currentVersion}\n`);
  console.log("  Checking for updates...\n");

  try {
    const res = await fetch("https://registry.npmjs.org/bestwork-agent/latest");
    if (!res.ok) {
      console.log("  Could not reach npm registry. Check your connection.\n");
      return;
    }

    const data = (await res.json()) as { version: string };
    const latestVersion = data.version;

    if (latestVersion === currentVersion) {
      console.log(`  Already on latest version (${currentVersion}).\n`);
      return;
    }

    const current = currentVersion.split(".").map(Number);
    const latest = latestVersion.split(".").map(Number);
    const isNewer =
      latest[0]! > current[0]! ||
      (latest[0] === current[0] && latest[1]! > current[1]!) ||
      (latest[0] === current[0] && latest[1] === current[1] && latest[2]! > current[2]!);

    if (!isNewer) {
      console.log(`  Local version (${currentVersion}) is ahead of npm (${latestVersion}).\n`);
      return;
    }

    console.log(`  Update available: ${currentVersion} → ${latestVersion}\n`);
    console.log("  Run this to update:\n");
    console.log("    npm install -g bestwork-agent@latest\n");
    console.log("  Then run 'bestwork install' to update hooks.\n");
  } catch (e) {
    console.log(`  Update check failed: ${e}\n`);
  }
}
