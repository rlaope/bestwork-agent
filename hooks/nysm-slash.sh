#!/bin/bash
# nysm slash command handler
# Intercepts ./command patterns in Claude Code prompts

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // .display // ""' 2>/dev/null)

# ./discord <webhook_url>
if echo "$PROMPT" | grep -qE '^\./discord'; then
  URL=$(echo "$PROMPT" | sed 's|^\./discord\s*||' | tr -d ' ')
  if [ -n "$URL" ]; then
    mkdir -p "$HOME/.nysm"
    jq -n --arg url "$URL" '{"notify":{"discord":{"webhookUrl":$url}}}' > "$HOME/.nysm/config.json"
    # Test notification
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d '{"embeds":[{"title":"🔍 nysm connected","description":"Discord notifications enabled. You will receive alerts after each prompt.","color":55467}]}' > /dev/null 2>&1
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm] Discord webhook configured and tested. Notifications will be sent after each prompt completion.\"}}"
  else
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm] Usage: ./discord <webhook_url>\"}}"
  fi
  exit 0
fi

# ./slack <webhook_url>
if echo "$PROMPT" | grep -qE '^\./slack'; then
  URL=$(echo "$PROMPT" | sed 's|^\./slack\s*||' | tr -d ' ')
  if [ -n "$URL" ]; then
    mkdir -p "$HOME/.nysm"
    jq -n --arg url "$URL" '{"notify":{"slack":{"webhookUrl":$url}}}' > "$HOME/.nysm/config.json"
    curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d '{"blocks":[{"type":"header","text":{"type":"plain_text","text":"🔍 nysm connected"}},{"type":"section","text":{"type":"mrkdwn","text":"Slack notifications enabled. You will receive alerts after each prompt."}}]}' > /dev/null 2>&1
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm] Slack webhook configured and tested. Notifications will be sent after each prompt completion.\"}}"
  else
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm] Usage: ./slack <webhook_url>\"}}"
  fi
  exit 0
fi

# ./nysm-status
if echo "$PROMPT" | grep -qE '^\./nysm'; then
  CONFIG=$(cat "$HOME/.nysm/config.json" 2>/dev/null || echo '{}')
  HAS_DISCORD=$(echo "$CONFIG" | jq -r '.notify.discord.webhookUrl // empty')
  HAS_SLACK=$(echo "$CONFIG" | jq -r '.notify.slack.webhookUrl // empty')
  STATUS="nysm status:\\n"
  [ -n "$HAS_DISCORD" ] && STATUS="${STATUS}  Discord: connected\\n" || STATUS="${STATUS}  Discord: not configured\\n"
  [ -n "$HAS_SLACK" ] && STATUS="${STATUS}  Slack: connected\\n" || STATUS="${STATUS}  Slack: not configured\\n"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"[nysm] ${STATUS}\"}}"
  exit 0
fi

echo '{}'
