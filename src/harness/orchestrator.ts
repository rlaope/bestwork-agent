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
import { ALL_AGENTS, getAgentWithPrompt, type AgentProfile } from "./agents/index.js";

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
// Intent Gate — structured classification with reasoning
// ============================================================

export interface IntentClassification {
  mode: ExecutionMode;
  tasks: string[];
  reasoning: string;
  confidence: "high" | "medium" | "low";
  suggestedAgents: string[];
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  backend:  ["api", "server", "endpoint", "database", "db", "query", "rest", "graphql", "auth", "authentication", "authorization", "middleware", "route", "controller", "서버", "백엔드", "엔드포인트", "라우트", "미들웨어"],
  frontend: ["ui", "component", "page", "css", "style", "button", "modal", "form", "dark mode", "toggle", "layout", "react", "vue", "angular", "html", "프론트", "컴포넌트", "페이지", "스타일", "레이아웃", "화면"],
  infra:    ["deploy", "docker", "kubernetes", "k8s", "ci", "cd", "pipeline", "terraform", "cloud", "aws", "gcp", "azure", "nginx", "devops", "배포", "인프라", "파이프라인"],
  security: ["auth", "oauth", "jwt", "token", "permission", "role", "acl", "xss", "csrf", "encryption", "hash", "ssl", "tls", "vulnerability", "인증", "보안", "권한", "암호화", "취약점"],
  data:     ["data", "analytics", "etl", "pipeline", "warehouse", "schema", "migration", "seed", "report", "dashboard", "metrics", "데이터", "분석", "마이그레이션", "스키마"],
  ml:       ["ml", "ai", "model", "training", "inference", "embedding", "vector", "llm", "neural", "dataset", "prediction", "모델", "학습", "추론"],
  testing:  ["test", "testing", "spec", "e2e", "unit test", "integration test", "coverage", "jest", "vitest", "mocha", "pytest", "tdd", "bug", "debug", "테스트", "버그", "디버그", "テスト", "バグ"],
};

const DOMAIN_TO_AGENT: Record<string, string> = {
  backend:  "sr-backend",
  frontend: "sr-frontend",
  infra:    "sr-infra",
  security: "sr-security",
  data:     "sr-backend",
  ml:       "sr-backend",
  testing:  "qa-lead",
};

function splitTasks(task: string): string[] {
  // Split by "|"
  if (task.includes("|")) {
    return task.split("|").map((t) => t.trim()).filter(Boolean);
  }

  // Split by "and then" / Korean conjunctions / Japanese て form
  const conjunctionPattern = /\band then\b|그리고\s|(?<=[가-힣])고\s|하고$|다음에\s|그다음\s|して|してから/i;
  if (conjunctionPattern.test(task)) {
    return task.split(conjunctionPattern).map((t) => t.trim()).filter(Boolean);
  }

  // Split by numbered list: "1. ... 2. ... 3. ..."
  const numberedMatch = task.match(/\d+\.\s+.+?(?=\s+\d+\.|$)/g);
  if (numberedMatch && numberedMatch.length > 1) {
    return numberedMatch.map((t) => t.replace(/^\d+\.\s+/, "").trim()).filter(Boolean);
  }

  return [task.trim()];
}

function detectDomains(task: string): string[] {
  const lower = task.toLowerCase();
  const found: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      found.push(domain);
    }
  }
  return found.length > 0 ? [...new Set(found)] : ["backend"];
}

export function classifyIntent(task: string): IntentClassification {
  const tasks = splitTasks(task);
  const taskCount = tasks.length;

  // Check passthrough first
  const weight = classifyWeight(task);
  if (weight === "passthrough") {
    return {
      mode: "passthrough",
      tasks,
      reasoning: "Task matches passthrough pattern (git/shell/npm command or simple acknowledgement) — no agent allocation needed.",
      confidence: "high",
      suggestedAgents: [],
    };
  }

  // Detect domains across all sub-tasks
  const allDomains = [...new Set(tasks.flatMap((t) => detectDomains(t)))];
  const suggestedAgents = allDomains
    .map((d) => DOMAIN_TO_AGENT[d] ?? "sr-fullstack")
    .filter((a, i, arr) => arr.indexOf(a) === i);

  // Multi-task path
  if (taskCount >= 3) {
    return {
      mode: "trio",
      tasks,
      reasoning: `Task contains ${taskCount} separable sub-tasks ("${tasks.join(" | ")}") spanning domains: ${allDomains.join(", ")}. Trio mode assigns one agent per sub-task in parallel.`,
      confidence: "high",
      suggestedAgents,
    };
  }

  if (taskCount === 2) {
    return {
      mode: "pair",
      tasks,
      reasoning: `Task splits into 2 sub-tasks covering domains: ${allDomains.join(", ")}. Pair mode with one agent per task.`,
      confidence: "high",
      suggestedAgents,
    };
  }

  // Single task — use autoAllocate signals
  const soloWeight = classifyWeight(task);
  if (soloWeight === "solo") {
    return {
      mode: "solo",
      tasks,
      reasoning: `Single lightweight task matching solo pattern (typo fix, rename, format, or minor update). One senior developer sufficient.`,
      confidence: "high",
      suggestedAgents: ["sr-fullstack"],
    };
  }

  // Infer complexity from domain count + keywords
  const complexitySignals = [
    /refactor|리팩토링|リファクタ/i,
    /redesign|재설계|再設計/i,
    /migrate|마이그레이션|マイグレーション/i,
    /architect|아키텍처|アーキテクチャ/i,
    /implement.*system|시스템.*구현/i,
    /build.*platform|플랫폼.*구축/i,
  ];
  const isComplex = complexitySignals.some((p) => p.test(task)) || allDomains.length >= 3;

  if (isComplex) {
    return {
      mode: "hierarchy",
      tasks,
      reasoning: `Complex single task touching ${allDomains.length} domain(s) (${allDomains.join(", ")}) with structural complexity signals. Hierarchy mode with senior → lead → CTO chain.`,
      confidence: allDomains.length >= 2 ? "high" : "medium",
      suggestedAgents,
    };
  }

  // Fallback: use autoAllocate to decide pair vs solo
  const allocation = autoAllocate(task, { domains: allDomains });
  const finalMode: ExecutionMode = allocation.mode === "passthrough" || allocation.mode === "solo"
    ? allocation.mode
    : allDomains.length >= 2 ? "pair" : "solo";

  return {
    mode: finalMode,
    tasks,
    reasoning: `Single task in domain(s): ${allDomains.join(", ")}. ${allocation.reasoning}`,
    confidence: "medium",
    suggestedAgents,
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

const ROLE_TO_AGENT_ID: Record<string, string> = {
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

function findMatchingDomainAgent(role: OrgRole): AgentProfile | null {
  const agentId = ROLE_TO_AGENT_ID[role.id];
  if (!agentId) return null;
  return ALL_AGENTS.find((a) => a.id === agentId) ?? null;
}

async function findMatchingDomainAgentWithPrompt(role: OrgRole): Promise<AgentProfile | null> {
  const agentId = ROLE_TO_AGENT_ID[role.id];
  if (!agentId) return null;
  return getAgentWithPrompt(agentId);
}

function combinePrompts(role: OrgRole, domainAgent: AgentProfile | null, task: string): string {
  let prompt = role.systemPrompt;

  if (domainAgent) {
    prompt += `\n\nDomain expertise (${domainAgent.name}):\n${domainAgent.systemPrompt}`;
  }

  prompt += `\n\nTask: ${task}`;
  return prompt;
}

export async function buildExecutionPlanWithPrompts(
  teamName: string,
  task: string
): Promise<ExecutionPlan | null> {
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
    const ordered = [...roles].sort((a, b) => levelOrder(a.level) - levelOrder(b.level));

    for (let i = 0; i < ordered.length; i++) {
      const role = ordered[i]!;
      const domainAgent = await findMatchingDomainAgentWithPrompt(role);
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
    for (const role of roles) {
      const domainAgent = await findMatchingDomainAgentWithPrompt(role);
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
    for (const role of roles) {
      steps.push({
        agentId: role.id,
        role: role.title,
        title: role.title,
        systemPrompt: combinePrompts(role, null, task),
        phase: "review",
        parallel: true,
        dependsOn: [],
      });
    }
  } else if (preset.mode === "advisory") {
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
