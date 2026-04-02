#!/usr/bin/env node
/**
 * Sync local build artifacts to plugin cache + marketplace paths.
 * Runs after `tsup` so local dev changes are immediately available.
 */
import { cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const home = homedir();
const src = process.cwd();

// Directories to sync
const SYNC_DIRS = ["skills", "hooks", "dist", ".claude-plugin"];
const SYNC_FILES = ["package.json"];

// Find all target paths
const targets = [];

// 1. Plugin cache: ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/
const cachePath = join(home, ".claude/plugins/cache/bestwork-tools/bestwork-agent");
if (existsSync(cachePath)) {
  for (const ver of readdirSync(cachePath)) {
    targets.push(join(cachePath, ver));
  }
}

// 2. Marketplace: ~/.claude/plugins/marketplaces/bestwork-tools/
const mpPath = join(home, ".claude/plugins/marketplaces/bestwork-tools");
if (existsSync(mpPath)) {
  targets.push(mpPath);
}

if (targets.length === 0) {
  console.log("[sync] no plugin paths found, skipping");
  process.exit(0);
}

let synced = 0;
for (const target of targets) {
  for (const dir of SYNC_DIRS) {
    const srcDir = join(src, dir);
    const destDir = join(target, dir);
    if (existsSync(srcDir)) {
      cpSync(srcDir, destDir, { recursive: true, force: true });
      synced++;
    }
  }
  for (const file of SYNC_FILES) {
    const srcFile = join(src, file);
    const destFile = join(target, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, destFile, { force: true });
      synced++;
    }
  }
}

console.log(`[sync] synced ${synced} items to ${targets.length} plugin path(s)`);
