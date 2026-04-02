/**
 * Task Classifier — identifies work type and routes to the right org structure
 *
 * Work types:
 * - feature: new functionality → Squad (fast, parallel)
 * - refactor: restructure existing code → Hierarchy (CTO approves architecture)
 * - bugfix: fix broken behavior → Squad (focused, fast)
 * - docs: documentation, i18n → Docs Team (writer + translator)
 * - security: auth, encryption, vulnerabilities → Security Team (CISO approval)
 * - infra: CI/CD, deployment, cloud → Infra Squad
 * - architecture: system design, major decisions → Architecture Review (advisory)
 * - ideation: brainstorming, exploring options → Advisory + Junior (fresh ideas)
 * - testing: add/fix tests → Squad with QA Lead
 * - performance: optimization, profiling → Hierarchy with Sr. Performance focus
 */

export type WorkType =
  | "feature"
  | "refactor"
  | "bugfix"
  | "docs"
  | "security"
  | "infra"
  | "architecture"
  | "ideation"
  | "testing"
  | "performance";

export interface ClassifiedTask {
  type: WorkType;
  confidence: "high" | "medium" | "low";
  teamPreset: string;
  teamMode: "hierarchy" | "squad" | "review" | "advisory";
  reason: string;
  extras?: {
    i18n?: boolean;
    languages?: string[];
  };
}

/**
 * Signal-based classifier for the smart gateway agent.
 * Returns a structured prompt section that tells the gateway HOW to classify.
 */
export function getClassifierPrompt(): string {
  return `
TASK CLASSIFICATION — analyze the user's request and classify it:

WORK TYPES AND ROUTING:

1. FEATURE (new functionality)
   Signals: "add", "implement", "create", "build", "new"
   Route: Squad → Feature Squad (fast parallel execution)

2. REFACTOR (restructure existing code)
   Signals: "refactor", "restructure", "reorganize", "clean up", "rewrite", "migrate"
   Route: Hierarchy → Full Team (CTO approves architecture changes)

3. BUGFIX (fix broken behavior)
   Signals: "fix", "bug", "broken", "error", "crash", "failing", "doesn't work"
   Route: Squad → Feature Squad (focused, fast turnaround)

4. DOCS (documentation, i18n, translation)
   Signals: "document", "readme", "docs", "translate", "i18n", "localize", language names
   Route: Squad with writer focus
   Special: if multiple languages mentioned → enable i18n mode, translate naturally (not literally)

5. SECURITY (auth, encryption, vulnerabilities)
   Signals: "auth", "security", "encrypt", "vulnerability", "OWASP", "permission", "access control"
   Route: Hierarchy → Security Team (CISO has final call)

6. INFRA (CI/CD, deployment, cloud, Docker)
   Signals: "deploy", "CI", "CD", "docker", "kubernetes", "cloud", "pipeline", "monitoring"
   Route: Squad → Infra Squad

7. ARCHITECTURE (system design, major decisions)
   Signals: "architecture", "design", "system", "scale", "microservice", "monolith"
   Route: Advisory → Architecture Review (CTO + Tech Lead + EM, direction only)

8. IDEATION (brainstorming, exploring options)
   Signals: "idea", "brainstorm", "explore", "what if", "should we", "options", "approach"
   Route: Advisory with Junior included (fresh perspective generates unexpected ideas)

9. TESTING (add/fix tests)
   Signals: "test", "coverage", "TDD", "E2E", "integration test", "unit test"
   Route: Squad with QA Lead + Testing specialist

10. PERFORMANCE (optimization, profiling)
    Signals: "slow", "optimize", "performance", "latency", "memory", "profile", "cache"
    Route: Hierarchy → Backend Team with performance focus

CLASSIFICATION OUTPUT — when you identify the work type, announce it:
"[bestwork: classified as {TYPE} → {TEAM_PRESET} ({MODE} mode)]"
Then proceed with execution using the selected team structure.

I18N RULES — when the task involves documentation or translation:
- Translate NATURALLY, not literally. Match the tone of the target language.
- Korean: use casual developer tone (반말 OK for comments, 존댓말 for user-facing text)
- Japanese: use です/ます for docs, casual for code comments
- Don't just swap words — restructure sentences to sound native.
`;
}
