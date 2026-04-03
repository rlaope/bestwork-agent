# Installing bestwork-agent

## Option 1: Claude Code Plugin (recommended)

Inside Claude Code session:
```
/plugin marketplace add https://github.com/rlaope/bestwork-agent
/plugin install bestwork-agent
/reload-plugins
```

Or from terminal:
```bash
claude plugin marketplace add https://github.com/rlaope/bestwork-agent
claude plugin install bestwork-agent
```

After install, restart Claude Code. Type `./help` to see all commands.

## Option 2: npm global install

```bash
npm install -g bestwork-agent
bestwork install
```

Restart Claude Code to activate hooks.

## Option 3: Inside Claude Code

Type this in Claude Code:
```
./bw-install
```

With options:
```
./bw-install --discord <webhook_url>
./bw-install --slack <webhook_url>
./bw-install --strict
./bw-install --scope src/
```

## Verify

```bash
bestwork doctor
```

Checks: CLI version, Node.js, hooks, config, data directory.

## Update

```bash
bestwork update          # check for updates
npm install -g bestwork-agent@latest
bestwork install         # re-register hooks
```

For plugin installs, the update name is `bestwork-agent@bestwork-tools`:
```bash
/plugin update bestwork-agent@bestwork-tools
```

## Uninstall

```bash
npm uninstall -g bestwork-agent
# Remove hooks from ~/.claude/settings.json manually
# Remove ~/.bestwork/ directory
```
