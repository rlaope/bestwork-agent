---
name: meetings
description: Search and browse past meeting logs
---

When this skill is invoked, you MUST follow this exact output sequence.

## Step 1: Read meeting log

Read `.bestwork/state/meeting.jsonl` from the project root. Each line is a JSON object. Meeting entries have a `type` field:

- `type: "header"` — meeting start: `{ type: "header", date, task, mode, agents, agentCount }`
- `type: "agent"` — agent contribution: `{ type: "agent", agent, role, output, verdict }`
- `type: "footer"` — meeting end: `{ type: "footer", verdict, summary, rounds }`

A complete meeting is a header followed by agent entries followed by a footer.

If the file does not exist or is empty:
```
[BW] no meetings found. Run a trio/waterfall/deliver task to create meeting logs.
```

## Step 2: Determine mode

Check the user's invocation:

- `./meetings` (no args) — list all meetings
- `./meetings <keyword>` — search meetings by keyword (matches task description, agent names, summary)
- `./meetings <number>` — show full details of meeting #N

## Step 3: List mode (no args)

Parse all header+footer pairs and display:

```
[BW] meeting history

  #1  2026-04-03 | trio | "HUD caching rewrite" | 3 agents | APPROVED
  #2  2026-04-03 | hierarchy | "gateway accuracy test" | 4 agents | APPROVED
  #3  2026-04-02 | squad | "4 issues parallel" | 4 agents | APPROVED

  3 meetings found. Use ./meetings <keyword> to search.
```

Number meetings sequentially (#1 = oldest).

## Step 4: Search mode (keyword arg)

Filter meetings where the keyword appears in:
- The task description (header `task` field)
- Any agent name (header `agents` field)
- The summary text (footer `summary` field)

Case-insensitive matching.

```
[BW] meeting search: "auth"

  #1  2026-04-03 | trio | "auth token refresh" | 3 agents | APPROVED
  #4  2026-04-04 | squad | "OAuth integration" | 5 agents | APPROVED

  2 meetings match "auth". Use ./meetings <number> for details.
```

If no matches:
```
[BW] no meetings match "auth". Try a different keyword.
```

## Step 5: Detail mode (number arg)

Show the full meeting record:

```
[BW] meeting #2: "gateway accuracy test"

  Date:    2026-04-03
  Mode:    hierarchy (4 agents)
  Verdict: APPROVED

  Agents:
    bestwork:tech-backend — implemented gateway rules
    bestwork:pm-product — validated user scenarios
    bestwork:critic-code — APPROVE, clean implementation
    bestwork:tech-testing — 12 tests pass

  Summary: Improved gateway classification with regex tightening and edge case handling.
```

If the meeting number is out of range:
```
[BW] meeting #99 not found. Only 3 meetings recorded.
```

## Rules

- Read `.bestwork/state/meeting.jsonl` — do NOT look in `~/.bestwork/`
- Display meetings in reverse chronological order (newest first) for list/search
- Number meetings sequentially starting from #1 (oldest = #1)
- Keyword search is case-insensitive and matches partial strings
- If meeting.jsonl has malformed lines, skip them silently
