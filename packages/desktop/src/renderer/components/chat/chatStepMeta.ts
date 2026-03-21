import {
  Activity,
  Code,
  ExternalLink,
  Hammer,
  KeyRound,
  MessageCircle,
  Search,
  Terminal,
} from "lucide-svelte";

import type { AgentStep } from "../../lib/types";

type IconComponent = typeof Hammer;

type ToolMeta = {
  icon: IconComponent;
  runningLabel: string;
};

const TOOL_META: Record<string, ToolMeta> = {
  read: { icon: Search, runningLabel: "Gathering context" },
  grep: { icon: Search, runningLabel: "Searching codebase" },
  glob: { icon: Search, runningLabel: "Searching codebase" },
  list: { icon: Search, runningLabel: "Searching codebase" },
  webfetch: { icon: ExternalLink, runningLabel: "Searching web" },
  edit: { icon: Code, runningLabel: "Making edits" },
  write: { icon: Code, runningLabel: "Making edits" },
  apply_patch: { icon: Code, runningLabel: "Making edits" },
  bash: { icon: Terminal, runningLabel: "Running commands" },
  task: { icon: Hammer, runningLabel: "Delegating task" },
  todowrite: { icon: Activity, runningLabel: "Planning" },
  todoread: { icon: Activity, runningLabel: "Reviewing plan" },
  question: { icon: MessageCircle, runningLabel: "Waiting for answer" },
};

function parseToolName(step: AgentStep): string | null {
  if (typeof step.toolName === "string" && step.toolName.trim().length > 0) {
    return step.toolName.trim().toLowerCase();
  }

  const match = step.title.match(/^(running|finished)\s+([a-zA-Z0-9_:-]+)/i);
  if (!match) return null;
  const parsed = match[2];
  if (!parsed) return null;
  return parsed.toLowerCase();
}

export function getStepIcon(step: AgentStep): IconComponent {
  if (step.kind === "permission") {
    return KeyRound;
  }
  if (step.kind === "question") {
    return MessageCircle;
  }

  const toolName = parseToolName(step);
  if (toolName && TOOL_META[toolName]) {
    return TOOL_META[toolName].icon;
  }
  return Hammer;
}

export function getStepStatusLabel(
  step: AgentStep,
): "Running" | "Done" | "Failed" {
  if (step.status === "running") return "Running";
  if (step.status === "ok") return "Done";
  return "Failed";
}

export function getStepSummary(step: AgentStep): string {
  if (step.kind === "permission") {
    if (step.status === "running") return "Waiting for approval";
    if (step.permission?.reply === "once") return "Allowed once";
    if (step.permission?.reply === "always") return "Always allowed";
    return "Permission rejected";
  }

  if (step.kind === "question") {
    if (step.status === "running") return "Waiting for answer";
    if (step.question?.rejected) return "Question rejected";
    return "Question answered";
  }

  const toolName = parseToolName(step);
  if (step.status === "running" && toolName && TOOL_META[toolName]) {
    return TOOL_META[toolName].runningLabel;
  }
  if (step.status === "running") return "Working";
  if (step.status === "ok") return "Step completed";
  return "Step failed";
}
