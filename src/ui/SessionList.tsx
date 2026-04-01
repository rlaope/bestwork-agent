import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../core/types.js";
import { relativeTime, shortSessionId, formatNumber } from "../utils/format.js";

interface SessionListProps {
  sessions: Session[];
  selectedIndex: number;
}

export function SessionList({ sessions, selectedIndex }: SessionListProps) {
  const visibleCount = 15;
  const start = Math.max(0, selectedIndex - Math.floor(visibleCount / 2));
  const visible = sessions.slice(start, start + visibleCount);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>
          Sessions ({sessions.length} total)
        </Text>
      </Box>

      <Box>
        <Box width={4}>
          <Text bold color="gray">#</Text>
        </Box>
        <Box width={12}>
          <Text bold color="gray">ID</Text>
        </Box>
        <Box width={20}>
          <Text bold color="gray">Started</Text>
        </Box>
        <Box width={10}>
          <Text bold color="gray">Calls</Text>
        </Box>
        <Box width={15}>
          <Text bold color="gray">Last Tool</Text>
        </Box>
        <Box width={8}>
          <Text bold color="gray">Status</Text>
        </Box>
      </Box>

      {visible.map((session, i) => {
        const globalIndex = start + i;
        const isSelected = globalIndex === selectedIndex;

        return (
          <Box key={session.id}>
            <Box width={4}>
              <Text color={isSelected ? "cyan" : "gray"}>
                {isSelected ? "▸" : " "} {globalIndex + 1}
              </Text>
            </Box>
            <Box width={12}>
              <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
                {shortSessionId(session.id)}
              </Text>
            </Box>
            <Box width={20}>
              <Text color="gray">{relativeTime(session.startedAt)}</Text>
            </Box>
            <Box width={10}>
              <Text color="yellow">{formatNumber(session.totalCalls)}</Text>
            </Box>
            <Box width={15}>
              <Text>{session.lastTool || "N/A"}</Text>
            </Box>
            <Box width={8}>
              {session.isActive ? (
                <Text color="green" bold>● live</Text>
              ) : (
                <Text color="gray">○ done</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
