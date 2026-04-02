#!/bin/bash
# bestwork prompt completion — delegates to TypeScript
# All logic is in src/harness/notify-on-complete.ts (compiled to dist/notify-on-complete.js)

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(npm root -g 2>/dev/null)/bestwork-agent}"
if [ ! -d "$PLUGIN_ROOT" ]; then
  PLUGIN_ROOT="$(ls -d ~/.claude/plugins/cache/bestwork-tools/bestwork-agent/*/ 2>/dev/null | sort -V | tail -1)"
fi
INPUT=$(cat)

NOTIFY_JS="$PLUGIN_ROOT/dist/notify-on-complete.js"
if [ -f "$NOTIFY_JS" ]; then
  echo "$INPUT" | BW_NOTIFY_JS="$NOTIFY_JS" node --input-type=module -e "
import { createInterface } from 'readline';
const rl = createInterface({ input: process.stdin });
let data = '';
rl.on('line', l => data += l);
rl.on('close', async () => {
  try {
    const m = await import(process.env.BW_NOTIFY_JS);
    await m.run(data);
  } catch(e) { /* silent */ }
});
" 2>/dev/null
fi

# Refresh usage cache if stale (>90s since last update)
CACHE="$HOME/.bestwork/.usage-cache.json"
if [ -f "$CACHE" ]; then
  CACHE_AGE=$(( $(date +%s) * 1000 - $(jq -r '.ts // 0' "$CACHE" 2>/dev/null) ))
  if [ "$CACHE_AGE" -gt 90000 ]; then
    # Background refresh — don't block the hook
    HUD_SCRIPT="$HOME/.bestwork/hud.mjs"
    [ -f "$HUD_SCRIPT" ] && node "$HUD_SCRIPT" < /dev/null > /dev/null 2>&1 &
  fi
fi

echo '{}'
