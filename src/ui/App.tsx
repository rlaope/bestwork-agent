import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { SessionList } from "./SessionList.js";
import { SessionDetail } from "./SessionDetail.js";
import { aggregateSessions } from "../observe/aggregator.js";
import { format } from "date-fns";
import type { Session } from "../types/index.js";

type View = "list" | "detail";

interface AppProps {
  watchMode?: boolean;
}

export function App({ watchMode = false }: AppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const loadData = async () => {
    const data = await aggregateSessions();
    setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    if (watchMode) {
      const interval = setInterval(loadData, 2000);
      return () => clearInterval(interval);
    }
  }, [watchMode]);

  useInput((input, key) => {
    if (view === "list") {
      if (key.escape) {
        exit();
        return;
      }
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedIndex((i) => Math.min(sessions.length - 1, i + 1));
      } else if (key.return) {
        setView("detail");
      }
    } else if (view === "detail") {
      if (key.escape) {
        setView("list");
      }
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="cyan">Loading sessions...</Text>
      </Box>
    );
  }

  if (sessions.length === 0) {
    return (
      <Box padding={1}>
        <Text color="yellow">No sessions found in ~/.claude/</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color="cyan">
            bestwork
          </Text>
          <Text color="gray"> — now you see me</Text>
          {watchMode && (
            <Text color="green"> [LIVE]</Text>
          )}
        </Box>
        <Box>
          <Text color="gray">
            {format(new Date(), "yyyy-MM-dd HH:mm")}
          </Text>
          <Text color="yellow">
            {"  "}Total: {sessions.reduce((s, sess) => s + sess.totalCalls, 0).toLocaleString()} calls
          </Text>
          <Text color="gray">
            {"  "}{sessions.length} sessions
          </Text>
        </Box>
      </Box>

      {view === "list" ? (
        <SessionList
          sessions={sessions}
          selectedIndex={selectedIndex}
          totalCalls={sessions.reduce((s, sess) => s + sess.totalCalls, 0)}
        />
      ) : (
        <SessionDetail session={sessions[selectedIndex]!} />
      )}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        {view === "list" ? (
          <Text color="gray">
            ↑↓ navigate • Enter select • Ctrl+C quit
          </Text>
        ) : (
          <Text color="gray">
            Esc back • Ctrl+C quit
          </Text>
        )}
      </Box>
    </Box>
  );
}
