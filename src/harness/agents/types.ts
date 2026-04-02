export interface AgentProfile {
  id: string;
  role: "tech" | "pm" | "critic";
  name: string;
  specialty: string;
  systemPrompt: string;
}
