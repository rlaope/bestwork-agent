/**
 * bestwork-agent Orchestrator
 *
 * Runtime execution engine for team-based agent workflows.
 * Consumes TeamConfig/OrgRole and produces executable agent instructions.
 *
 * This replaces the "prompt-as-code" pattern where the smart gateway
 * LLM was responsible for spawning agents. Now, the orchestrator
 * generates deterministic execution plans that the gateway simply runs.
 */

import { ALL_ORG_ROLES, TEAM_PRESETS, type OrgRole, type TeamConfig } from "./org.js";
import { ALL_AGENTS, type AgentProfile } from "./agents/index.js";

// ============================================================
// Execution Plan — deterministic, serializable, testable
// ============================================================

export interface AgentStep {
  agentId: string;
  role: string;
  title: string;
  systemPrompt: string;
  phase: "implement" | "review" | "approve";
  parallel: boolean;
  dependsOn: string[]; // agentIds that must complete first
}

export interface ExecutionPlan {
  mode: "hierarchy" | "squad" | "review" | "advisory";
  teamName: string;
  task: string;
  steps: AgentStep[];
  maxRetries: number;
  feedbackLoop: boolean;
}

// ============================================================
// Plan Builder
// ============================================================

export function buildExecutionPlan(
  teamName: string,
  task: string
): ExecutionPlan | null {
  const preset = TEAM_PRESETS.find(
    (t) => t.name.toLowerCase() === teamName.toLowerCase()
  );
  if (!preset) return null;

  const roles = preset.roles
    .map((id) => ALL_ORG_ROLES.find((r) => r.id === id))
    .filter((r): r is OrgRole => r !== undefined);

  if (roles.length === 0) return null;

  const steps: AgentStep[] = [];

  if (preset.mode === "hierarchy") {
    // Bottom-up execution: junior first, c-level last
    const ordered = [...roles].sort((a, b) => levelOrder(a.level) - levelOrder(b.level));

    for (let i = 0; i < ordered.length; i++) {
      const role = ordered[i]!;
      const domainAgent = findMatchingDomainAgent(role);
      const combinedPrompt = combinePrompts(role, domainAgent, task);

      steps.push({
        agentId: role.id,
        role: role.title,
        title: role.title,
        systemPrompt: combinedPrompt,
        phase: i === 0 ? "implement" : i < ordered.length - 1 ? "review" : "approve",
        parallel: false,
        dependsOn: i > 0 ? [ordered[i - 1]!.id] : [],
      });
    }
  } else if (preset.mode === "squad") {
    // All parallel, no dependencies
    for (const role of roles) {
      const domainAgent = findMatchingDomainAgent(role);
      const combinedPrompt = combinePrompts(role, domainAgent, task);

      steps.push({
        agentId: role.id,
        role: role.title,
        title: role.title,
        systemPrompt: combinedPrompt,
        phase: "implement",
        parallel: true,
        dependsOn: [],
      });
    }
  } else if (preset.mode === "review") {
    // All review in parallel, need 2/3 approval
    for (const role of roles) {
      const combinedPrompt = combinePrompts(role, null, task);

      steps.push({
        agentId: role.id,
        role: role.title,
        title: role.title,
        systemPrompt: combinedPrompt,
        phase: "review",
        parallel: true,
        dependsOn: [],
      });
    }
  } else if (preset.mode === "advisory") {
    // Sequential advisory, no implementation
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]!;
      steps.push({
        agentId: role.id,
        role: role.title,
        title: role.title,
        systemPrompt: combinePrompts(role, null, task),
        phase: "review",
        parallel: false,
        dependsOn: i > 0 ? [roles[i - 1]!.id] : [],
      });
    }
  }

  return {
    mode: preset.mode,
    teamName: preset.name,
    task,
    steps,
    maxRetries: 3,
    feedbackLoop: preset.mode === "hierarchy" || preset.mode === "squad",
  };
}

// ============================================================
// Auto-allocate: pick team based on developer count
// ============================================================

export type ExecutionMode = "passthrough" | "solo" | "pair" | "trio" | "squad" | "hierarchy";

export interface Allocation {
  mode: ExecutionMode;
  developerCount: number;
  assignedAgents: string[];
  reasoning: string;
}

// Patterns that should never trigger agent allocation
const PASSTHROUGH_PATTERNS = [
  /^(git |commit|push|pull|merge|rebase|checkout|branch|stash|tag|log|diff|status)/i,
  /^(ls|cd|pwd|cat|head|tail|mv|cp|rm |mkdir|touch|chmod|find|grep|sed|awk)/i,
  /^(npm |yarn |pnpm |bun |npx |node |deno |cargo |pip |go |make)/i,
  /^(exit|quit|bye|thanks|thank|ok|yes|no|y|n)$/i,
  /^\/\w/,  // slash commands
  /^\.\//,  // dot commands
];

// Patterns that indicate lightweight work (solo agent)
const SOLO_PATTERNS = [
  /fix (a |the |this )?(typo|bug|error|issue|warning)/i,
  /rename|delete|remove|add (a |the )?comment/i,
  /update (the |a )?(version|readme|docs|changelog)/i,
  /format|lint|prettier|eslint/i,
];

export function classifyWeight(task: string): ExecutionMode {
  // Passthrough: no agents needed
  for (const pattern of PASSTHROUGH_PATTERNS) {
    if (pattern.test(task.trim())) return "passthrough";
  }

  // Solo: single lightweight task
  for (const pattern of SOLO_PATTERNS) {
    if (pattern.test(task)) return "solo";
  }

  // Default: let autoAllocate decide based on signals
  return "pair"; // placeholder, overridden by autoAllocate
}

export function autoAllocate(
  task: string,
  signals: { fileCount?: number; domains?: string[]; complexity?: "low" | "medium" | "high" }
): Allocation {
  // Check passthrough first
  const weight = classifyWeight(task);
  if (weight === "passthrough") {
    return {
      mode: "passthrough",
      developerCount: 0,
      assignedAgents: [],
      reasoning: "Lightweight operation — direct execution, no agents needed",
    };
  }

  if (weight === "solo") {
    return {
      mode: "solo",
      developerCount: 1,
      assignedAgents: ["sr-fullstack"],
      reasoning: "Simple task — single developer, no review overhead",
    };
  }

  const { fileCount = 1, domains = ["backend"], complexity = "medium" } = signals;

  let devCount = 1;

  // Scope-based scaling
  if (fileCount >= 10) devCount = 4;
  else if (fileCount >= 5) devCount = 3;
  else if (fileCount >= 3) devCount = 2;

  // Domain overlap
  devCount = Math.max(devCount, Math.min(domains.length, 4));

  // Complexity boost
  if (complexity === "high" && devCount < 3) devCount = 3;

  devCount = Math.min(devCount, 4);

  // Pick agents based on domains
  const agents: string[] = [];
  const domainToAgent: Record<string, string> = {
    backend: "sr-backend",
    frontend: "sr-frontend",
    fullstack: "sr-fullstack",
    infra: "sr-infra",
    security: "sr-security",
    ai: "sr-backend",
    data: "sr-backend",
    mobile: "sr-frontend",
  };

  for (const domain of domains.slice(0, devCount)) {
    agents.push(domainToAgent[domain] ?? "sr-fullstack");
  }

  while (agents.length < devCount) {
    if (!agents.includes("sr-fullstack")) agents.push("sr-fullstack");
    else if (!agents.includes("qa-lead")) agents.push("qa-lead");
    else agents.push("jr-engineer");
  }

  let mode: ExecutionMode;
  if (devCount === 1) mode = "solo";
  else if (devCount === 2) mode = "pair";
  else if (devCount === 3) mode = "trio";
  else if (complexity === "high") mode = "hierarchy";
  else mode = "squad";

  return {
    mode,
    developerCount: devCount,
    assignedAgents: agents,
    reasoning: `${fileCount} files, ${domains.length} domains (${domains.join(", ")}), ${complexity} complexity → ${devCount} devs in ${mode} mode`,
  };
}

// ============================================================
// Format plan for display / gateway consumption
// ============================================================

export function formatPlan(plan: ExecutionPlan): string {
  const lines: string[] = [];

  lines.push(`\n  [bestwork: ${plan.mode} → ${plan.teamName}]`);
  lines.push(`  Task: ${plan.task}\n`);

  for (const step of plan.steps) {
    const marker = step.parallel ? "║" : step.dependsOn.length === 0 ? "╔" : step.phase === "approve" ? "╚" : "╠";
    const phaseTag = step.phase === "implement" ? "🔨" : step.phase === "review" ? "🔍" : "✅";
    lines.push(`  ${marker} ${phaseTag} ${step.title} (${step.agentId})`);
  }

  if (plan.feedbackLoop) {
    lines.push(`\n  Feedback loop: max ${plan.maxRetries} retries`);
  }

  lines.push("");
  return lines.join("\n");
}

// ============================================================
// Internals
// ============================================================

function levelOrder(level: string): number {
  switch (level) {
    case "junior": return 0;
    case "senior": return 1;
    case "lead": return 2;
    case "c-level": return 3;
    default: return 1;
  }
}

function findMatchingDomainAgent(role: OrgRole): AgentProfile | null {
  // Map org roles to domain specialist agents
  const mapping: Record<string, string> = {
    "sr-backend": "tech-backend",
    "sr-frontend": "tech-frontend",
    "sr-fullstack": "tech-fullstack",
    "sr-infra": "tech-infra",
    "sr-security": "tech-security",
    "jr-engineer": "tech-fullstack",
    "jr-qa": "tech-testing",
    "qa-lead": "tech-testing",
    "tech-lead": "tech-fullstack",
    "product-lead": "pm-product",
  };

  const agentId = mapping[role.id];
  if (!agentId) return null;
  return ALL_AGENTS.find((a) => a.id === agentId) ?? null;
}

function combinePrompts(role: OrgRole, domainAgent: AgentProfile | null, task: string): string {
  let prompt = role.systemPrompt;

  if (domainAgent) {
    prompt += `\n\nDomain expertise (${domainAgent.name}):\n${domainAgent.systemPrompt}`;
  }

  prompt += `\n\nTask: ${task}`;
  return prompt;
}
