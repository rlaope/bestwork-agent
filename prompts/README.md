# Agent Prompts

System prompts for bestwork's 36 specialist agents.
Edit these files to customize agent behavior without rebuilding.

## Structure

- `tech/` — 18 implementation specialists
- `pm/` — 8 requirements verification specialists
- `critic/` — 10 quality review specialists

## Format

YAML frontmatter (id, role, name, specialty) + markdown body (system prompt).

## Usage

Prompts are loaded at runtime via `src/harness/prompt-loader.ts`:

```ts
import { loadPrompt, loadPromptMeta } from "./harness/prompt-loader.js";

// Load just the prompt body
const prompt = await loadPrompt("tech", "backend");

// Load prompt + metadata
const { id, role, name, specialty, prompt } = await loadPromptMeta("tech", "backend");
```

## Customization

Edit any `.md` file in these directories to change agent behavior. Changes take effect immediately without rebuilding — no TypeScript recompilation needed.
