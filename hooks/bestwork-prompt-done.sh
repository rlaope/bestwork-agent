#!/bin/bash
# bestwork prompt completion — delegates to TypeScript
# All logic is in src/harness/notify-on-complete.ts (compiled to dist/notify-on-complete.js)

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(npm root -g 2>/dev/null)/bestwork-agent}"
INPUT=$(cat)

echo "$INPUT" | node --input-type=module -e "
import { createInterface } from 'readline';
const rl = createInterface({ input: process.stdin });
let data = '';
rl.on('line', l => data += l);
rl.on('close', async () => {
  try {
    const m = await import('${PLUGIN_ROOT}/dist/notify-on-complete.js');
    await m.run(data);
  } catch(e) { /* silent */ }
});
" 2>/dev/null

echo '{}'
