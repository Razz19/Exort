import type { AgentStep } from "../../../lib/types";

export type ToolInputRecord = Record<string, unknown>;

export function normalizeToolName(name: AgentStep["toolName"]): string {
  if (!name) return "";
  return name.trim().toLowerCase();
}

export function parseToolInput(input: string | undefined): ToolInputRecord {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ToolInputRecord;
    }
  } catch {
    // Ignore malformed tool input and render fallback text.
  }

  return {};
}

export function parseToolOutput(output: string | undefined): unknown {
  if (!output) return "";
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

export function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function inputValue(input: ToolInputRecord, key: string): string | null {
  return asText(input[key]);
}

export function markdownBody(step: AgentStep): string {
  const output = step.toolOutput?.trim();
  if (output) return output;
  return step.detail?.trim() ?? "";
}

export function inputArgs(input: ToolInputRecord, keys: string[]): string[] {
  const args: string[] = [];
  for (const key of keys) {
    const value = inputValue(input, key);
    if (!value) continue;
    args.push(`${key}=${value}`);
  }
  return args;
}

export function outputAsString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
