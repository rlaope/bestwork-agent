import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";

type Phase = "welcome" | "hooks" | "notifications" | "guardrails" | "done";

interface Choice {
  label: string;
  description: string;
  key: string;
}

export function SetupWizard() {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [cursor, setCursor] = useState(0);
  const [results, setResults] = useState<string[]>([]);

  // Notification state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifyPlatform, setNotifyPlatform] = useState<"discord" | "slack" | "skip">("skip");

  // Guardrail state
  const [enableStrict, setEnableStrict] = useState(false);
  const [scopePath, setScopePath] = useState("");
  const [scopeInput, setScopeInput] = useState("");

  const phaseChoices: Record<string, Choice[]> = {
    welcome: [
      { label: "Full setup", description: "Install hooks + configure notifications + guardrails", key: "full" },
      { label: "Hooks only", description: "Just install Claude Code hooks (minimal)", key: "hooks" },
      { label: "Cancel", description: "Exit without changes", key: "cancel" },
    ],
    notifications: [
      { label: "Discord", description: "Get alerts via Discord webhook", key: "discord" },
      { label: "Slack", description: "Get alerts via Slack webhook", key: "slack" },
      { label: "Skip", description: "Configure later with ./discord or ./slack", key: "skip" },
    ],
    guardrails: [
      { label: "Strict mode", description: "Block rm -rf, force read-before-edit, auto typecheck", key: "strict" },
      { label: "Default", description: "Standard guardrails (grounding + validation only)", key: "default" },
    ],
  };

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    // Phase: webhook URL input
    if (phase === "notifications" && (notifyPlatform === "discord" || notifyPlatform === "slack")) {
      if (key.return && webhookUrl.length > 0) {
        setResults((r) => [...r, `${notifyPlatform}: ${webhookUrl.slice(0, 30)}...`]);
        setPhase("guardrails");
        setCursor(0);
        return;
      }
      if (key.backspace || key.delete) {
        setWebhookUrl((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setWebhookUrl((prev) => prev + input);
        return;
      }
      return;
    }

    // Phase: scope path input
    if (phase === "guardrails" && enableStrict && scopePath === "") {
      if (key.return) {
        if (scopeInput.length > 0) {
          setScopePath(scopeInput);
          setResults((r) => [...r, `Scope: ${scopeInput}`]);
        }
        setPhase("done");
        return;
      }
      if (key.backspace || key.delete) {
        setScopeInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setScopeInput((prev) => prev + input);
        return;
      }
      return;
    }

    // Arrow navigation
    const choices = phaseChoices[phase];
    if (choices) {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      if (key.downArrow) setCursor((c) => Math.min(choices.length - 1, c + 1));

      if (key.return) {
        const selected = choices[cursor]!;

        if (phase === "welcome") {
          if (selected.key === "cancel") { exit(); return; }
          setResults((r) => [...r, `Mode: ${selected.label}`]);
          if (selected.key === "hooks") {
            setPhase("done");
          } else {
            setPhase("notifications");
          }
          setCursor(0);
        } else if (phase === "notifications") {
          if (selected.key === "skip") {
            setResults((r) => [...r, "Notifications: skip"]);
            setPhase("guardrails");
            setCursor(0);
          } else {
            setNotifyPlatform(selected.key as "discord" | "slack");
          }
        } else if (phase === "guardrails") {
          if (selected.key === "strict") {
            setEnableStrict(true);
            setResults((r) => [...r, "Guardrails: strict"]);
            // Ask for scope path
          } else {
            setResults((r) => [...r, "Guardrails: default"]);
            setPhase("done");
          }
        }
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">bestwork-agent setup</Text>
      </Box>

      {/* Progress */}
      <Box marginBottom={1}>
        {(["hooks", "notifications", "guardrails", "done"] as Phase[]).map((p, i) => (
          <Text key={p} color={phase === p ? "cyan" : phase === "done" || results.length > i ? "green" : "gray"}>
            {phase === p ? "●" : results.length > i || phase === "done" ? "✓" : "○"} {p}{i < 3 ? " → " : ""}
          </Text>
        ))}
      </Box>

      {/* Welcome */}
      {phase === "welcome" && (
        <PhaseUI title="How do you want to set up?" choices={phaseChoices.welcome!} cursor={cursor} />
      )}

      {/* Notifications - platform select */}
      {phase === "notifications" && notifyPlatform === "skip" && (
        <PhaseUI title="Notification platform" choices={phaseChoices.notifications!} cursor={cursor} />
      )}

      {/* Notifications - URL input */}
      {phase === "notifications" && notifyPlatform !== "skip" && (
        <Box flexDirection="column">
          <Text bold>{notifyPlatform === "discord" ? "Discord" : "Slack"} webhook URL:</Text>
          <Box marginTop={1}>
            <Text color="cyan">{webhookUrl || "paste URL here..."}</Text>
            <Text color="gray">█</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Enter to confirm</Text>
          </Box>
        </Box>
      )}

      {/* Guardrails - select */}
      {phase === "guardrails" && !enableStrict && (
        <PhaseUI title="Guardrail level" choices={phaseChoices.guardrails!} cursor={cursor} />
      )}

      {/* Guardrails - scope input */}
      {phase === "guardrails" && enableStrict && scopePath === "" && (
        <Box flexDirection="column">
          <Text bold>Scope lock (optional — press Enter to skip):</Text>
          <Text color="gray">Restrict edits to a specific directory</Text>
          <Box marginTop={1}>
            <Text color="cyan">{scopeInput || "e.g. src/"}</Text>
            <Text color="gray">█</Text>
          </Box>
        </Box>
      )}

      {/* Done */}
      {phase === "done" && (
        <Box flexDirection="column">
          <Text bold color="green">Setup complete!</Text>
          <Box marginTop={1} flexDirection="column">
            {results.map((r, i) => (
              <Text key={i} color="gray">  ✓ {r}</Text>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              Installing hooks... Run `bestwork install` to apply.{"\n"}
              Restart Claude Code to activate.
            </Text>
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">↑↓ select • Enter confirm • Esc cancel</Text>
      </Box>
    </Box>
  );
}

function PhaseUI({ title, choices, cursor }: { title: string; choices: Choice[]; cursor: number }) {
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Box marginTop={1} flexDirection="column">
        {choices.map((choice, i) => (
          <Box key={choice.key}>
            <Text color={i === cursor ? "cyan" : "gray"}>
              {i === cursor ? "▸ " : "  "}
            </Text>
            <Text color={i === cursor ? "cyan" : "white"} bold={i === cursor}>
              {choice.label}
            </Text>
            <Text color="gray"> — {choice.description}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
