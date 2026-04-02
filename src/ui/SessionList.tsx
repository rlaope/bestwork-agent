import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../core/types.js";
import { relativeTime, shortSessionId, formatNumber, truncate } from "../utils/format.js";

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
}

export function SessionList({ sessions, selectedIndex }: SessionListProps) {
  const visibleCount = 10;
  const start = Math.max(0, selectedIndex - Math.floor(visibleCount / 2));
  const visible = sessions.slice(start, start + visibleCount);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>
          Sessions ({sessions.length} total)
        </Text>
      </Box>

      {visible.map((session, i) => {
        const globalIndex = start + i;
        const isSelected = globalIndex === selectedIndex;
        const lastPrompt = session.prompts[session.prompts.length - 1];
        const cwd = session.meta?.cwd ?? "";
        const cwdShort = cwd.length > 30 ? "…" + cwd.slice(-29) : cwd;
        const promptText = lastPrompt
          ? truncate(lastPrompt.display, 50)
          : "";

        return (
          <Box key={session.id} flexDirection="column">
            <Box>
              <Text color={isSelected ? "cyan" : "gray"}>
                {isSelected ? "▸ " : "  "}
              </Text>
              <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
                {shortSessionId(session.id)}
              </Text>
              <Text color="gray">  {relativeTime(session.startedAt)}</Text>
              <Text color="yellow">  {formatNumber(session.totalCalls)} calls</Text>
              <Text>  {session.lastTool || "N/A"}</Text>
              {session.isActive ? (
                <Text color="green" bold>  ● live</Text>
              ) : (
                <Text color="gray">  ○ done</Text>
              )}
            </Box>
            <Box marginLeft={3}>
              {cwdShort ? (
                <Text color="gray">📁 {cwdShort}</Text>
              ) : null}
              {promptText ? (
                <Text color="gray">  💬 {promptText}</Text>
              ) : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
