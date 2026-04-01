# Contributing to nysm

Thanks for your interest in contributing to nysm! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/rlaope/nysm.git
cd nysm
npm install
npm run build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build with tsup |
| `npm run dev` | Watch mode |
| `npm test` | Run tests |
| `npm run test:watch` | Watch tests |
| `npm run typecheck` | Type check |

## Project Structure

```
src/
├── cli/           # CLI entry point & commands
├── ui/            # Ink TUI components
├── core/          # Analytics engine & types
├── data/          # Data parsers (~/.claude/)
└── utils/         # Formatting helpers
```

## Guidelines

- Write tests for new features
- Run `npm run typecheck` before submitting
- Keep PRs focused — one feature per PR
- Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)

## Adding a New Command

1. Create `src/cli/commands/your-command.ts`
2. Register it in `src/cli/index.ts`
3. Add tests if applicable

## Adding a New Data Source

1. Add parser in `src/data/claude-parser.ts`
2. Add types in `src/core/types.ts`
3. Integrate in `src/core/aggregator.ts`
4. Write unit tests with mock data

## Reporting Issues

Open an issue at https://github.com/rlaope/nysm/issues with:
- What you expected
- What happened
- Steps to reproduce
- `nysm --version` output
