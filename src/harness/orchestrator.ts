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
import type { ProjectConfig } from "./notify.js";

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
  /^(docker (run|build|pull|push|compose|exec|stop|rm|ps|images|logs) |kubectl (get|apply|delete|describe|logs) |terraform (plan|apply|init|destroy) |python \S+\.py|ruby \S+\.rb)/i,
  /^(exit|quit|bye|thanks|thank|ok|yes|no|y|n|sure|sounds good|go ahead)$/i,
  /^\/\w/,  // slash commands
  /^\.\//,  // dot commands
  // Korean passthrough commands
  /^(커밋|푸시|풀|머지|체크아웃|빌드|테스트 돌려|배포해|실행해)$/i,
];

// Patterns that indicate lightweight work (solo agent)
const SOLO_PATTERNS = [
  /fix (a |the |this )?(typo|bug|error|issue|warning)/i,
  /(버그|에러|오류|타입).*(수정|고쳐|잡아|fix)/i,
  /(수정|고쳐|잡아).*(버그|에러|오류|타입)/i,
  /rename|delete|remove|add (a |the )?comment/i,
  /(이름|변수).*(바꿔|변경|수정)/i,
  /update (the |a )?(version|readme|docs|changelog)/i,
  /(버전|readme|문서).*(업데이트|올려|수정)/i,
  /format|lint|prettier|eslint/i,
  /최적화해|정리해|깔끔하게/i,
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

export interface TaskAllocation {
  description: string;
  agents: string[];
  parallel: boolean;
}

export interface RoutingSignals {
  /** Number of sub-tasks detected from splitTasks */
  taskCount: number;
  /** Domains detected across all sub-tasks */
  domains: string[];
  /** Total keyword matches across domains (higher = stronger domain signal) */
  domainMatchCount: number;
  /** Which weight classifier fired: passthrough / solo / standard */
  weight: "passthrough" | "solo" | "standard";
  /** Which complexity regexes fired (refactor, migrate, etc.) */
  complexitySignals: string[];
  /** Whether project config overrode the default mode */
  configOverride: boolean;
}

export interface IntentClassification {
  mode: ExecutionMode;
  tasks: string[];
  reasoning: string;
  confidence: "high" | "medium" | "low";
  /** Numeric 0-100 confidence score derived from signals */
  confidenceScore: number;
  /** Raw signals that produced the decision — useful for telemetry/debugging */
  signals: RoutingSignals;
  suggestedAgents: string[];
  /** Dynamic task+agent breakdown — replaces fixed team structures */
  taskAllocations: TaskAllocation[];
  totalAgents: number;
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  backend:  ["api", "server", "endpoint", "database", "db", "query", "rest", "graphql", "auth", "authentication", "authorization", "middleware", "route", "controller", "서버", "백엔드", "엔드포인트", "라우트", "미들웨어"],
  frontend: ["ui", "component", "page", "css", "style", "button", "modal", "form", "dark mode", "toggle", "layout", "react", "vue", "angular", "html", "프론트", "컴포넌트", "페이지", "스타일", "레이아웃", "화면"],
  infra:    ["deploy", "docker", "kubernetes", "k8s", "ci", "cd", "pipeline", "terraform", "cloud", "aws", "gcp", "azure", "nginx", "devops", "배포", "인프라", "파이프라인"],
  security: ["auth", "oauth", "jwt", "token", "permission", "role", "acl", "xss", "csrf", "encryption", "hash", "ssl", "tls", "vulnerability", "인증", "보안", "권한", "암호화", "취약점"],
  data:     ["data", "analytics", "etl", "pipeline", "warehouse", "schema", "migration", "seed", "report", "dashboard", "metrics", "데이터", "분석", "마이그레이션", "스키마"],
  ml:       ["ml", "ai", "model", "training", "inference", "embedding", "vector", "llm", "neural", "dataset", "prediction", "모델", "학습", "추론"],
  testing:  ["test", "testing", "spec", "e2e", "unit test", "integration test", "coverage", "jest", "vitest", "mocha", "pytest", "tdd", "bug", "debug", "테스트", "버그", "디버그", "テスト", "バグ"],
  agent:    ["agent", "orchestrat", "prompt engineer", "multi-agent", "hook system", "gateway", "harness", "bestwork", "agent lifecycle", "quality gate", "에이전트", "오케스트", "프롬프트"],
  plugin:   ["plugin", "skill", "hud", "statusline", "marketplace", "plugin.json", "hooks.json", "slash command", "플러그인", "스킬"],
  docs:     ["readme", "document", "docs", "changelog", "문서", "최신화", "documentation", "ドキュメント"],
};

const DOMAIN_TO_AGENT: Record<string, string> = {
  backend:  "sr-backend",
  frontend: "sr-frontend",
  infra:    "sr-infra",
  security: "sr-security",
  data:     "sr-backend",
  ml:       "sr-backend",
  testing:  "qa-lead",
  agent:    "agent-engineer",
  plugin:   "tech-plugin",
  docs:     "tech-writer",
};

function splitTasks(task: string): string[] {
  // Split by "|" — but only if parts look like separate tasks (each part > 5 chars)
  // Avoids false splits on: "true | false | null", "grep foo | wc -l", "success | failure"
  if (task.includes("|")) {
    const parts = task.split("|").map((t) => t.trim()).filter(Boolean);
    // Filter out trivial splits: if most parts are single words under 3 chars, it's likely
    // a value list (true | false | null), not separate tasks
    const looksLikeTasks = parts.length >= 2 && parts.filter((p) => p.length > 1).length >= 2;
    if (looksLikeTasks) return parts;
  }

  // Split by explicit sequential conjunctions only
  // "그리고" and "하고" removed — too common in Korean, causes false splits
  const conjunctionPattern = /\band then\b|다음에\s|그다음\s|してから/i;
  if (conjunctionPattern.test(task)) {
    const parts = task.split(conjunctionPattern).map((t) => t.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.every((p) => p.length > 5)) return parts;
  }

  // Split by numbered list: "1. ... 2. ... 3. ..."
  const numberedMatch = task.match(/\d+\.\s+.+?(?=\s+\d+\.|$)/g);
  if (numberedMatch && numberedMatch.length > 1) {
    return numberedMatch.map((t) => t.replace(/^\d+\.\s+/, "").trim()).filter(Boolean);
  }

  return [task.trim()];
}

function detectDomains(task: string): string[] {
  const { domains } = detectDomainsWithScore(task);
  return domains;
}

function detectDomainsWithScore(task: string): { domains: string[]; matchCount: number } {
  const lower = task.toLowerCase();
  const found: string[] = [];
  let matchCount = 0;
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let hit = false;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matchCount++;
        hit = true;
      }
    }
    if (hit) found.push(domain);
  }
  if (found.length === 0) {
    return { domains: ["backend"], matchCount: 0 };
  }
  return { domains: [...new Set(found)], matchCount };
}

const COMPLEXITY_SIGNAL_DEFS: Array<{ name: string; pattern: RegExp }> = [
  { name: "refactor", pattern: /refactor|리팩토링|リファクタ/i },
  { name: "redesign", pattern: /redesign|재설계|再設計/i },
  { name: "migrate", pattern: /migrate|마이그레이션|マイグレーション/i },
  { name: "architect", pattern: /architect|아키텍처|アーキテクチャ/i },
  { name: "implement-system", pattern: /implement.*system|시스템.*구현/i },
  { name: "build-platform", pattern: /build.*platform|플랫폼.*구축/i },
];

function detectComplexitySignals(task: string): string[] {
  return COMPLEXITY_SIGNAL_DEFS.filter((s) => s.pattern.test(task)).map((s) => s.name);
}

/**
 * Score routing confidence 0-100 from raw signals.
 * Numeric counterpart to the categorical confidence level — never used to
 * pick the mode, only to surface how strong the signal was for telemetry.
 */
function scoreConfidence(signals: RoutingSignals): number {
  if (signals.weight === "passthrough") return 95;
  let score = 40; // baseline
  if (signals.taskCount >= 3) score += 30;
  else if (signals.taskCount === 2) score += 20;
  if (signals.domainMatchCount >= 3) score += 20;
  else if (signals.domainMatchCount >= 1) score += 10;
  if (signals.complexitySignals.length > 0) score += 15;
  if (signals.domains.length >= 2) score += 10;
  if (signals.weight === "solo") score += 10;
  if (signals.configOverride) score += 5;
  if (score > 100) score = 100;
  return score;
}

/**
 * Resolve an agent ID respecting project config: filter disabled, prefer preferred.
 */
function resolveAgent(agentId: string, config?: ProjectConfig): string | null {
  if (config?.disabledAgents?.includes(agentId)) return null;
  return agentId;
}

/**
 * Filter agent list, removing disabled agents and preferring preferred ones.
 */
function applyAgentConfig(agents: string[], config?: ProjectConfig): string[] {
  let filtered = config?.disabledAgents
    ? agents.filter((a) => !config.disabledAgents!.includes(a))
    : [...agents];

  // If preferred agents are set, move them to front
  if (config?.preferredAgents?.length) {
    const preferred = config.preferredAgents.filter((a) => !config.disabledAgents?.includes(a));
    const existing = new Set(filtered);
    const boosted = preferred.filter((a) => existing.has(a));
    const rest = filtered.filter((a) => !boosted.includes(a));
    filtered = [...boosted, ...rest];
  }

  return filtered;
}

/**
 * Build dynamic task allocations: for each sub-task, assign agents based on
 * what's actually needed (just tech, tech+critic, tech+pm+critic, etc.)
 */
function buildTaskAllocations(tasks: string[], mode: ExecutionMode, config?: ProjectConfig): TaskAllocation[] {
  return tasks.map((t) => {
    const domains = detectDomains(t);
    let techAgent = DOMAIN_TO_AGENT[domains[0]!] ?? "sr-fullstack";

    // Replace with preferred agent if the current one is disabled
    if (resolveAgent(techAgent, config) === null) {
      techAgent = config?.preferredAgents?.[0] ?? "sr-fullstack";
    }

    // Determine agents per task based on overall mode complexity
    if (mode === "passthrough" || mode === "solo") {
      return { description: t, agents: applyAgentConfig([techAgent], config), parallel: false };
    }
    if (mode === "hierarchy") {
      // Complex: tech + pm + critic + lead + verifier (post-completion pass)
      return { description: t, agents: applyAgentConfig([techAgent, "pm-product", "critic-code", "tech-lead", "critic-verifier"], config), parallel: true };
    }
    // pair/trio/squad: tech + critic per task
    return { description: t, agents: applyAgentConfig([techAgent, "critic-code"], config), parallel: true };
  });
}

export function classifyIntent(task: string, config?: ProjectConfig): IntentClassification {
  const tasks = splitTasks(task);
  const taskCount = tasks.length;
  const weight = classifyWeight(task);

  // Build a reusable signals object incrementally; final score computed per branch
  const complexitySignals = detectComplexitySignals(task);
  const { domains: allDomains, matchCount: domainMatchCount } = (() => {
    const perTask = tasks.map((t) => detectDomainsWithScore(t));
    const merged = [...new Set(perTask.flatMap((p) => p.domains))];
    const total = perTask.reduce((s, p) => s + p.matchCount, 0);
    return { domains: merged, matchCount: total };
  })();

  const baseSignals = (mode: IntentClassification["mode"]): RoutingSignals => ({
    taskCount,
    domains: allDomains,
    domainMatchCount,
    weight: weight === "passthrough" ? "passthrough" : weight === "solo" ? "solo" : "standard",
    complexitySignals,
    configOverride: Boolean(config?.defaultMode && mode === config.defaultMode),
  });

  // Check passthrough first
  if (weight === "passthrough") {
    const signals = baseSignals("passthrough");
    const allocations = buildTaskAllocations(tasks, "passthrough", config);
    return {
      mode: "passthrough",
      tasks,
      reasoning: "Task matches passthrough pattern (git/shell/npm command or simple acknowledgement) — no agent allocation needed.",
      confidence: "high",
      confidenceScore: scoreConfidence(signals),
      signals,
      suggestedAgents: [],
      taskAllocations: allocations,
      totalAgents: 0,
    };
  }

  // Suggested agents from detected domains
  let suggestedAgents = allDomains
    .map((d) => DOMAIN_TO_AGENT[d] ?? "sr-fullstack")
    .filter((a, i, arr) => arr.indexOf(a) === i);
  suggestedAgents = applyAgentConfig(suggestedAgents, config);

  // Multi-task path
  if (taskCount >= 3) {
    const mode = config?.defaultMode ?? "trio";
    const allocations = buildTaskAllocations(tasks, mode, config);
    const total = allocations.reduce((sum, a) => sum + a.agents.length, 0);
    const signals = baseSignals(mode);
    return {
      mode,
      tasks,
      reasoning: `Task contains ${taskCount} separable sub-tasks ("${tasks.join(" | ")}") spanning domains: ${allDomains.join(", ")}. ${taskCount} parallel tasks with ${total} total agents.`,
      confidence: "high",
      confidenceScore: scoreConfidence(signals),
      signals,
      suggestedAgents,
      taskAllocations: allocations,
      totalAgents: total,
    };
  }

  if (taskCount === 2) {
    const mode = config?.defaultMode ?? "pair";
    const allocations = buildTaskAllocations(tasks, mode, config);
    const total = allocations.reduce((sum, a) => sum + a.agents.length, 0);
    const signals = baseSignals(mode);
    return {
      mode,
      tasks,
      reasoning: `Task splits into 2 sub-tasks covering domains: ${allDomains.join(", ")}. Pair mode with one agent per task.`,
      confidence: "high",
      confidenceScore: scoreConfidence(signals),
      signals,
      suggestedAgents,
      taskAllocations: allocations,
      totalAgents: total,
    };
  }

  // Single task — use autoAllocate signals
  if (weight === "solo" && !config?.defaultMode) {
    const allocations = buildTaskAllocations(tasks, "solo", config);
    const signals = baseSignals("solo");
    return {
      mode: "solo",
      tasks,
      reasoning: `Single lightweight task matching solo pattern (typo fix, rename, format, or minor update). One senior developer sufficient.`,
      confidence: "high",
      confidenceScore: scoreConfidence(signals),
      signals,
      suggestedAgents: applyAgentConfig(["sr-fullstack"], config),
      taskAllocations: allocations,
      totalAgents: 1,
    };
  }

  // Infer complexity from domain count + keywords
  const isComplex = complexitySignals.length > 0 || allDomains.length >= 3;

  if (isComplex) {
    const mode = config?.defaultMode ?? "hierarchy";
    const allocations = buildTaskAllocations(tasks, mode, config);
    const total = allocations.reduce((sum, a) => sum + a.agents.length, 0);
    const signals = baseSignals(mode);
    return {
      mode,
      tasks,
      reasoning: `Complex single task touching ${allDomains.length} domain(s) (${allDomains.join(", ")}) with structural complexity signals. Hierarchy mode with senior → lead → CTO chain.`,
      confidence: allDomains.length >= 2 ? "high" : "medium",
      confidenceScore: scoreConfidence(signals),
      signals,
      suggestedAgents,
      taskAllocations: allocations,
      totalAgents: total,
    };
  }

  // Fallback: use autoAllocate to decide pair vs solo
  const allocation = autoAllocate(task, { domains: allDomains });
  let finalMode: ExecutionMode = allocation.mode === "passthrough" || allocation.mode === "solo"
    ? allocation.mode
    : allDomains.length >= 2 ? "pair" : "solo";

  // Apply defaultMode override from project config
  if (config?.defaultMode && finalMode !== "passthrough") {
    finalMode = config.defaultMode;
  }

  const allocations = buildTaskAllocations(tasks, finalMode, config);
  const total = allocations.reduce((sum, a) => sum + a.agents.length, 0);
  const signals = baseSignals(finalMode);

  return {
    mode: finalMode,
    tasks,
    reasoning: `Single task in domain(s): ${allDomains.join(", ")}. ${allocation.reasoning}`,
    confidence: "medium",
    confidenceScore: scoreConfidence(signals),
    signals,
    suggestedAgents,
    taskAllocations: allocations,
    totalAgents: total,
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
