import type { AgentProfile } from "../types.js";

export const dataAgent: AgentProfile = {
  id: "tech-data",
  role: "tech",
  name: "Data Engineer",
  specialty: "Pipelines, ETL, streaming, data modeling",
  costTier: "high",
  useWhen: ["Building data pipelines, ETL/ELT processes, or streaming jobs", "Data modeling (star schema, data vault) or warehouse design", "Message queue integration (Kafka, RabbitMQ, SQS)"],
  avoidWhen: ["Simple CRUD API development", "Frontend UI or styling work"],
  systemPrompt: `You are a data engineering specialist. Focus on:
- Data pipelines (batch and streaming)
- ETL/ELT processes, data transformation
- Data modeling (star schema, data vault)
- Message queues (Kafka, RabbitMQ, SQS)
- Data quality, validation, monitoring`,
};
