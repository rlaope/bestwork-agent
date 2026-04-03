/**
 * Config Validator — hand-written validation for bestwork config files.
 * No external dependencies (no Zod).
 *
 * Validates both:
 * - Global config: ~/.bestwork/config.json
 * - Project config: .bestwork/config.json
 */

export interface ConfigError {
  field: string;
  message: string;
}

const VALID_MODES = ["solo", "pair", "trio", "squad", "hierarchy"] as const;

/**
 * Validate a parsed config object and return all errors found.
 * Returns an empty array if config is valid.
 */
export function validateConfig(config: unknown): ConfigError[] {
  const errors: ConfigError[] = [];

  if (!config || typeof config !== "object") {
    return errors;
  }

  const c = config as Record<string, unknown>;

  // --- notify section ---
  if (c.notify !== undefined) {
    if (typeof c.notify !== "object" || c.notify === null) {
      errors.push({ field: "notify", message: "Must be an object" });
    } else {
      const n = c.notify as Record<string, unknown>;

      if (n.discord !== undefined) {
        if (typeof n.discord !== "object" || n.discord === null) {
          errors.push({ field: "notify.discord", message: "Must be an object" });
        } else {
          const url = (n.discord as Record<string, unknown>).webhookUrl;
          if (url !== undefined) {
            if (typeof url !== "string") {
              errors.push({ field: "notify.discord.webhookUrl", message: "Must be a string" });
            } else if (url && !url.startsWith("https://discord.com/api/webhooks/")) {
              errors.push({
                field: "notify.discord.webhookUrl",
                message: "Must start with https://discord.com/api/webhooks/",
              });
            }
          }
        }
      }

      if (n.slack !== undefined) {
        if (typeof n.slack !== "object" || n.slack === null) {
          errors.push({ field: "notify.slack", message: "Must be an object" });
        } else {
          const url = (n.slack as Record<string, unknown>).webhookUrl;
          if (url !== undefined) {
            if (typeof url !== "string") {
              errors.push({ field: "notify.slack.webhookUrl", message: "Must be a string" });
            } else if (url && !url.startsWith("https://hooks.slack.com/")) {
              errors.push({
                field: "notify.slack.webhookUrl",
                message: "Must start with https://hooks.slack.com/",
              });
            }
          }
        }
      }

      if (n.telegram !== undefined) {
        if (typeof n.telegram !== "object" || n.telegram === null) {
          errors.push({ field: "notify.telegram", message: "Must be an object" });
        } else {
          const t = n.telegram as Record<string, unknown>;
          if (t.botToken !== undefined && typeof t.botToken !== "string") {
            errors.push({ field: "notify.telegram.botToken", message: "Must be a string" });
          }
          if (t.chatId !== undefined && typeof t.chatId !== "string") {
            errors.push({ field: "notify.telegram.chatId", message: "Must be a string" });
          }
        }
      }
    }
  }

  // --- project-level fields ---
  if (c.defaultMode !== undefined) {
    if (typeof c.defaultMode !== "string" || !VALID_MODES.includes(c.defaultMode as typeof VALID_MODES[number])) {
      errors.push({
        field: "defaultMode",
        message: `Invalid mode: ${c.defaultMode}. Must be solo|pair|trio|squad|hierarchy`,
      });
    }
  }

  if (c.preferredAgents !== undefined) {
    if (!Array.isArray(c.preferredAgents)) {
      errors.push({ field: "preferredAgents", message: "Must be an array of agent IDs" });
    } else {
      for (let i = 0; i < c.preferredAgents.length; i++) {
        if (typeof c.preferredAgents[i] !== "string") {
          errors.push({ field: `preferredAgents[${i}]`, message: "Each agent ID must be a string" });
        }
      }
    }
  }

  if (c.disabledAgents !== undefined) {
    if (!Array.isArray(c.disabledAgents)) {
      errors.push({ field: "disabledAgents", message: "Must be an array of agent IDs" });
    } else {
      for (let i = 0; i < c.disabledAgents.length; i++) {
        if (typeof c.disabledAgents[i] !== "string") {
          errors.push({ field: `disabledAgents[${i}]`, message: "Each agent ID must be a string" });
        }
      }
    }
  }

  if (c.testCommand !== undefined && typeof c.testCommand !== "string") {
    errors.push({ field: "testCommand", message: "Must be a string" });
  }

  if (c.buildCommand !== undefined && typeof c.buildCommand !== "string") {
    errors.push({ field: "buildCommand", message: "Must be a string" });
  }

  // --- nested project section (global config wraps project fields inside "project") ---
  if (c.project !== undefined) {
    if (typeof c.project !== "object" || c.project === null) {
      errors.push({ field: "project", message: "Must be an object" });
    } else {
      const nested = validateConfig(c.project);
      for (const err of nested) {
        errors.push({ field: `project.${err.field}`, message: err.message });
      }
    }
  }

  return errors;
}

/**
 * Format config errors into a human-readable string for logging.
 */
export function formatConfigErrors(errors: ConfigError[]): string {
  return errors.map((e) => `  - ${e.field}: ${e.message}`).join("\n");
}
