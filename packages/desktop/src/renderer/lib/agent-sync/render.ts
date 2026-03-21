import type { AgentStep, ChatItem } from "../types";
import type {
  AgentSyncPart,
  AgentSyncPermission,
  AgentSyncQuestion,
  AgentSyncState,
} from "./types";

function buildAssistantContentParts(parts: AgentSyncPart[]): ChatItem["assistantContentParts"] {
  const textLike = parts.filter((part) => {
    if (part.type !== "text" && part.type !== "reasoning") return false;
    if (!part.text || part.text.length === 0) return false;
    if (part.id.endsWith(":live-text")) return false;
    return true;
  });

  if (textLike.length === 0) return undefined;

  const normalized = textLike.map((part) => ({
    id: part.id,
    kind: (part.type === "reasoning" ? "reasoning" : "text") as
      | "reasoning"
      | "text",
    text: part.text ?? "",
  }));

  const merged: NonNullable<ChatItem["assistantContentParts"]> = [];
  for (const part of normalized) {
    const previous = merged[merged.length - 1];
    if (previous && previous.kind === part.kind) {
      previous.text += part.text;
      continue;
    }
    merged.push({ ...part });
  }

  return merged.length > 0 ? merged : undefined;
}

function isRenderableRole(role: string | undefined): role is ChatItem["role"] {
  return role === "user" || role === "assistant" || role === "system";
}

function normalizeToolStatus(
  status: AgentSyncPart["status"],
): AgentStep["status"] {
  if (status === "ok" || status === "error" || status === "running") {
    return status;
  }
  return "running";
}

function summarizeDetail(value?: string): string | undefined {
  if (!value) return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function isGenericPermissionTitle(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === "permission" || normalized === "permission request";
}

function parseJsonRecord(value: string | undefined): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore malformed tool input.
  }

  return {};
}

function getRecordString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function summarizeToolPermissionContext(part: AgentSyncPart | undefined): string | null {
  if (!part?.toolName) return null;

  const input = parseJsonRecord(part.input);
  const target = getRecordString(input, [
    "filePath",
    "path",
    "url",
    "command",
    "pattern",
    "description",
  ]);

  const phrase = target ? `${part.toolName} ${target}` : part.toolName;
  return summarizeDetail(phrase) ?? null;
}

function toolStepTitle(
  toolName: string | undefined,
  status: AgentStep["status"],
): string {
  const displayName = toolName?.trim() || "tool";
  if (status === "running") return `Running ${displayName}`;
  if (status === "ok") return `Finished ${displayName}`;
  return `Failed ${displayName}`;
}

function resolveToolStepId(
  message: ChatItem,
  part: AgentSyncPart,
  index: number,
): string {
  const toolCallId =
    part.toolCallId ??
    (part.id.startsWith("tool:") ? part.id.slice("tool:".length) : undefined);
  return (
    part.id ||
    (toolCallId
      ? `tool:${toolCallId}`
      : `${message.id}:tool:${String(index + 1)}`)
  );
}

function buildToolStep(
  message: ChatItem,
  part: AgentSyncPart,
  stepId: string,
  existingStep?: AgentStep,
): AgentStep {
  const toolCallId =
    part.toolCallId ??
    (part.id.startsWith("tool:") ? part.id.slice("tool:".length) : undefined);
  const status = normalizeToolStatus(part.status);

  return {
    id: stepId,
    title: toolStepTitle(part.toolName, status),
    toolName: part.toolName,
    detail: summarizeDetail(part.output) ?? summarizeDetail(part.input),
    toolInput: part.input,
    toolOutput: part.output,
    status,
    kind: "tool",
    contentStart: existingStep?.contentStart,
    createdAt: message.createdAt,
  };
}

function buildPermissionStep(
  message: ChatItem,
  permission: AgentSyncPermission,
  existingStep?: AgentStep,
  relatedToolPart?: AgentSyncPart,
): AgentStep {
  const status: AgentStep["status"] = permission.reply
    ? permission.reply === "reject"
      ? "error"
      : "ok"
    : "running";
  const fallbackFromTool = summarizeToolPermissionContext(relatedToolPart);
  const resolvedTitle = isGenericPermissionTitle(permission.title)
    ? (fallbackFromTool ?? permission.title)
    : permission.title;

  return {
    id: permission.toolCallId
      ? `tool:${permission.toolCallId}`
      : `permission:${permission.id}`,
    title: "Permission required",
    detail: permission.title,
    status,
    kind: "permission",
    requestId: permission.id,
    sessionId: permission.sessionId,
    permission: {
      title: resolvedTitle,
      reply: permission.reply,
    },
    contentStart: existingStep?.contentStart ?? permission.contentStart,
    createdAt: message.createdAt,
  };
}

function buildQuestionStep(
  message: ChatItem,
  question: AgentSyncQuestion,
  existingStep?: AgentStep,
): AgentStep {
  const status: AgentStep["status"] = question.rejected
    ? "error"
    : question.answers
      ? "ok"
      : "running";

  return {
    id: question.toolCallId ? `tool:${question.toolCallId}` : `question:${question.id}`,
    title: "Running question",
    detail:
      question.questions[0]?.question ??
      question.questions[0]?.header ??
      "Waiting for response",
    status,
    kind: "question",
    requestId: question.id,
    sessionId: question.sessionId,
    question: {
      questions: question.questions,
      answers: question.answers,
      rejected: question.rejected,
    },
    contentStart: existingStep?.contentStart ?? question.contentStart,
    createdAt: message.createdAt,
  };
}

function matchesInterruptMessage(
  params: {
    messageId: string;
    lastAssistantMessageId: string | null;
    toolCallIds: Set<string>;
  },
  interrupt: { messageId?: string; toolCallId?: string },
): boolean {
  if (interrupt.messageId) {
    return interrupt.messageId === params.messageId;
  }

  if (interrupt.toolCallId) {
    return params.toolCallIds.has(interrupt.toolCallId);
  }

  return params.lastAssistantMessageId === params.messageId;
}

export function buildRenderMessagesFromSyncState(params: {
  messages: ChatItem[];
  syncState: AgentSyncState;
  sessionKey: string;
  maxSteps?: number;
}): ChatItem[] {
  const { messages, syncState, sessionKey } = params;
  const maxSteps = params.maxSteps;

  const permissions = syncState.permission[sessionKey] ?? [];
  const questions = syncState.question[sessionKey] ?? [];
  const lastAssistantMessageId =
    [...messages].reverse().find((item) => item.role === "assistant")?.id ??
    null;

  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    const allParts = syncState.part[message.id] ?? [];
    const assistantContentParts = buildAssistantContentParts(allParts);
    const parts = allParts.filter(
      (part) => part.type === "tool",
    );
    const toolPartByCallId = new Map<string, AgentSyncPart>();
    for (const part of parts) {
      if (part.toolCallId) {
        toolPartByCallId.set(part.toolCallId, part);
      }
    }
    const toolCallIds = new Set(
      parts
        .map((part) => part.toolCallId)
        .filter((toolCallId): toolCallId is string => !!toolCallId),
    );

    const orderedIds: string[] = [];
    const stepById = new Map<string, AgentStep>();
    const existingStepById = new Map<string, AgentStep>();
    for (const existingStep of message.steps ?? []) {
      existingStepById.set(existingStep.id, existingStep);
    }

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part) continue;
      const stepId = resolveToolStepId(message, part, index);
      const step = buildToolStep(
        message,
        part,
        stepId,
        existingStepById.get(stepId),
      );
      orderedIds.push(step.id);
      stepById.set(step.id, step);
    }

    const attachContext = {
      messageId: message.id,
      lastAssistantMessageId,
      toolCallIds,
    };

    for (const permission of permissions) {
      if (!matchesInterruptMessage(attachContext, permission)) continue;
      const relatedToolPart = permission.toolCallId
        ? toolPartByCallId.get(permission.toolCallId)
        : undefined;
      const step = buildPermissionStep(
        message,
        permission,
        existingStepById.get(
          permission.toolCallId
            ? `tool:${permission.toolCallId}`
            : `permission:${permission.id}`,
        ),
        relatedToolPart,
      );
      if (!orderedIds.includes(step.id)) {
        orderedIds.push(step.id);
      }
      stepById.set(step.id, step);
    }

    for (const question of questions) {
      if (!matchesInterruptMessage(attachContext, question)) continue;
      if (question.answers || question.rejected) continue;
      const step = buildQuestionStep(
        message,
        question,
        existingStepById.get(
          question.toolCallId
            ? `tool:${question.toolCallId}`
            : `question:${question.id}`,
        ),
      );
      if (!orderedIds.includes(step.id)) {
        orderedIds.push(step.id);
      }
      stepById.set(step.id, step);
    }

    const existingSteps = message.steps ?? [];
    const seenIds = new Set<string>();
    const nextOrdered: AgentStep[] = [];

    for (const existingStep of existingSteps) {
      if (
        existingStep.kind === "tool" ||
        existingStep.kind === "permission" ||
        existingStep.kind === "question"
      ) {
        const derived = stepById.get(existingStep.id);
        if (derived) {
          nextOrdered.push(derived);
          seenIds.add(existingStep.id);
        }
        continue;
      }

      nextOrdered.push(existingStep);
      seenIds.add(existingStep.id);
    }

    for (const id of orderedIds) {
      if (seenIds.has(id)) continue;
      const step = stepById.get(id);
      if (!step) continue;
      nextOrdered.push(step);
      seenIds.add(id);
    }

    let nextSteps = nextOrdered;
    if (
      typeof maxSteps === "number" &&
      Number.isFinite(maxSteps) &&
      maxSteps > 0 &&
      nextSteps.length > maxSteps
    ) {
      nextSteps = nextSteps.slice(nextSteps.length - maxSteps);
    }

    return {
      ...message,
      assistantContentParts,
      steps: nextSteps,
      role: isRenderableRole(message.role) ? message.role : "assistant",
    };
  });
}
