# Discord / Slack Notifications

## Discord

1. Open your Discord server
2. Channel Settings → Integrations → Webhooks → New Webhook
3. Copy the webhook URL
4. In Claude Code, type:
```
./discord https://discord.com/api/webhooks/...
```

You'll get a test message confirming the connection.

## Slack

1. Go to https://api.slack.com/apps → Create New App
2. Incoming Webhooks → Activate → Add New Webhook to Workspace
3. Copy the webhook URL
4. In Claude Code, type:
```
./slack https://hooks.slack.com/services/...
```

## What you receive

Every time a prompt completes:
- **Prompt summary** — what was asked
- **Session stats** — call count, prompt count
- **Git changes** — files modified, diff summary
- **Platform review** — OS/runtime mismatch warnings
- **Session health** — failure rate, loop detection
- **Color coding** — green (clean), yellow (warnings), red (issues)

When using team/squad execution:
- **Agent decisions** — who approved, who requested changes
- **Meeting summary** — iterations, verdicts, reasoning
- **Team composition** — which specialists were assigned

## Disable

Remove `~/.bestwork/config.json` or set webhook URLs to empty.
