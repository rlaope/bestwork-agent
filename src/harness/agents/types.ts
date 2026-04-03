export type CostTier = "low" | "medium" | "high";

export interface AgentProfile {
  id: string;
  role: "tech" | "pm" | "critic";
  name: string;
  specialty: string;
  systemPrompt: string;
  costTier: CostTier;
  useWhen: string[];
  avoidWhen: string[];
}
