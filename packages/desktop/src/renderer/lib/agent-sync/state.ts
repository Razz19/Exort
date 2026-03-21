import type { AgentPendingInterrupts, ChatItem } from "../types";
import type {
  AgentInterruptStreamEvent,
  AgentRuntimeStreamEvent,
  AgentSessionStatus,
  AgentSyncPart,
  AgentSyncPermission,
  AgentSyncQuestion,
  AgentSyncState,
} from "./types";
import { parseAgentPermissionReply } from "./types";

function cloneState(state: AgentSyncState): AgentSyncState {
  return {
    message: { ...state.message },
    part: { ...state.part },
    session_status: { ...state.session_status },
    permission: { ...state.permission },
    question: { ...state.question },
  };
}

function upsertPermission(
  list: AgentSyncPermission[],
  next: AgentSyncPermission,
): AgentSyncPermission[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...list, next];
  }

  const copy = [...list];
  copy[index] = {
    ...copy[index],
    ...next,
  };
  return copy;
}

function upsertQuestion(
  list: AgentSyncQuestion[],
  next: AgentSyncQuestion,
): AgentSyncQuestion[] {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...list, next];
  }

  const copy = [...list];
  copy[index] = {
    ...copy[index],
    ...next,
  };
  return copy;
}

function upsertPart(list: AgentSyncPart[], next: AgentSyncPart): AgentSyncPart[] {
  const index = list.findIndex((part) => part.id === next.id);
  if (index === -1) {
    return [...list, next];
  }

  const copy = [...list];
  copy[index] = {
    ...copy[index],
    ...next,
  };
  return copy;
}

function getMessageContentStart(
  state: AgentSyncState,
  messageId: string | undefined,
): number | undefined {
  if (!messageId) return undefined;

  const parts = state.part[messageId] ?? [];
  const liveText = parts.find(
    (part) => part.id === `${messageId}:live-text` && part.type === "text",
  );
  if (typeof liveText?.text !== "string") return undefined;
  return liveText.text.length;
}

export function createAgentSyncState(): AgentSyncState {
  return {
    message: {},
    part: {},
    session_status: {},
    permission: {},
    question: {},
  };
}

export function replaceSessionMessagesInSyncState(params: {
  state: AgentSyncState;
  sessionId: string;
  messages: ChatItem[];
}): AgentSyncState {
  const { state, sessionId, messages } = params;
  const next = cloneState(state);

  next.message[sessionId] = messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));

  const partByMessage: Record<string, AgentSyncPart[]> = { ...next.part };
  for (const message of messages) {
    const parts: AgentSyncPart[] = [];
    if (message.content.trim().length > 0) {
      parts.push({
        id: `${message.id}:text`,
        type: "text",
        text: message.content,
      });
    }

    for (const step of message.steps ?? []) {
      if (step.kind !== "tool") continue;
      parts.push({
        id: step.id,
        type: "tool",
        toolName: step.toolName,
        toolCallId: step.id.startsWith("tool:") ? step.id.slice("tool:".length) : undefined,
        input: step.toolInput,
        output: step.toolOutput,
        status: step.status,
      });
    }

    partByMessage[message.id] = parts;
  }

  next.part = partByMessage;
  return next;
}

function applyInterruptEvent(
  state: AgentSyncState,
  sessionId: string,
  assistantMessageId: string | undefined,
  event: AgentInterruptStreamEvent,
): AgentSyncState {
  const next = cloneState(state);

  const permissions = next.permission[sessionId] ?? [];
  const questions = next.question[sessionId] ?? [];
  const resolvedMessageId =
    assistantMessageId && assistantMessageId !== "__interrupt__"
      ? assistantMessageId
      : undefined;
  const resolvedContentStart = getMessageContentStart(next, resolvedMessageId);

  if (event.type === "permission_asked") {
    const existing = permissions.find((item) => item.id === event.requestId);
    next.permission[sessionId] = upsertPermission(permissions, {
      id: event.requestId,
      sessionId: event.sessionId,
      title: event.title,
      toolCallId: event.toolCallId,
      messageId: existing?.messageId ?? resolvedMessageId,
      contentStart: existing?.contentStart ?? resolvedContentStart,
    });
    return next;
  }

  if (event.type === "permission_replied") {
    const existing = permissions.find((item) => item.id === event.requestId);
    next.permission[sessionId] = upsertPermission(permissions, {
      id: event.requestId,
      sessionId: event.sessionId,
      title:
        permissions.find((item) => item.id === event.requestId)?.title ??
        "Permission request",
      reply: parseAgentPermissionReply(event.reply),
      toolCallId: existing?.toolCallId,
      messageId: existing?.messageId ?? resolvedMessageId,
      contentStart: existing?.contentStart ?? resolvedContentStart,
    });
    return next;
  }

  if (event.type === "question_asked") {
    const existing = questions.find((item) => item.id === event.requestId);
    next.question[sessionId] = upsertQuestion(questions, {
      id: event.requestId,
      sessionId: event.sessionId,
      questions: event.questions,
      toolCallId: event.toolCallId,
      messageId: existing?.messageId ?? resolvedMessageId,
      contentStart: existing?.contentStart ?? resolvedContentStart,
    });
    return next;
  }

  if (event.type === "question_replied") {
    const existing = questions.find((item) => item.id === event.requestId);
    next.question[sessionId] = upsertQuestion(questions, {
      id: event.requestId,
      sessionId: event.sessionId,
      questions:
        questions.find((item) => item.id === event.requestId)?.questions ?? [],
      answers: event.answers,
      rejected: false,
      toolCallId: existing?.toolCallId,
      messageId: existing?.messageId ?? resolvedMessageId,
      contentStart: existing?.contentStart ?? resolvedContentStart,
    });
    return next;
  }

  const existing = questions.find((item) => item.id === event.requestId);
  next.question[sessionId] = upsertQuestion(questions, {
    id: event.requestId,
    sessionId: event.sessionId,
    questions: questions.find((item) => item.id === event.requestId)?.questions ?? [],
    answers: questions.find((item) => item.id === event.requestId)?.answers,
    rejected: true,
    toolCallId: existing?.toolCallId,
    messageId: existing?.messageId ?? resolvedMessageId,
    contentStart: existing?.contentStart ?? resolvedContentStart,
  });

  return next;
}

function normalizeMessageRole(value: string | undefined): "user" | "assistant" | "system" {
  if (value === "user" || value === "assistant" || value === "system") {
    return value;
  }
  return "assistant";
}

export function renameMessageIdInSyncState(params: {
  state: AgentSyncState;
  sessionId: string;
  fromMessageId: string;
  toMessageId: string;
}): AgentSyncState {
  const { state, sessionId, fromMessageId, toMessageId } = params;
  if (!fromMessageId || !toMessageId || fromMessageId === toMessageId) {
    return state;
  }

  const next = cloneState(state);

  const previousParts = next.part[fromMessageId];
  if (previousParts) {
    next.part[toMessageId] = next.part[toMessageId]
      ? [...(next.part[toMessageId] ?? []), ...previousParts]
      : previousParts;
    delete next.part[fromMessageId];
  }

  const sessionMessages = next.message[sessionId] ?? [];
  if (sessionMessages.length > 0) {
    next.message[sessionId] = sessionMessages.map((message) =>
      message.id === fromMessageId ? { ...message, id: toMessageId } : message,
    );
  }

  const permissions = next.permission[sessionId] ?? [];
  if (permissions.length > 0) {
    next.permission[sessionId] = permissions.map((permission) =>
      permission.messageId === fromMessageId
        ? { ...permission, messageId: toMessageId }
        : permission,
    );
  }

  const questions = next.question[sessionId] ?? [];
  if (questions.length > 0) {
    next.question[sessionId] = questions.map((question) =>
      question.messageId === fromMessageId
        ? { ...question, messageId: toMessageId }
        : question,
    );
  }

  return next;
}

export function applyRuntimeEventToSyncState(params: {
  state: AgentSyncState;
  sessionId: string;
  assistantMessageId: string;
  event: AgentRuntimeStreamEvent;
}): AgentSyncState {
  const { state, sessionId, assistantMessageId, event } = params;

  if (
    event.type === "permission_asked" ||
    event.type === "permission_replied" ||
    event.type === "question_asked" ||
    event.type === "question_replied" ||
    event.type === "question_rejected"
  ) {
    return applyInterruptEvent(state, sessionId, assistantMessageId, event);
  }

  const next = cloneState(state);
  const currentParts = next.part[assistantMessageId] ?? [];

  if (event.type === "content") {
    const textPart = currentParts.find((part) => part.id === `${assistantMessageId}:live-text`);
    let updatedParts = upsertPart(currentParts, {
      id: `${assistantMessageId}:live-text`,
      type: "text",
      text: (textPart?.text ?? "") + event.content,
    });
    if (event.partId) {
      const syncPartId = `${assistantMessageId}:part:${event.partId}`;
      const existingStructuredPart = updatedParts.find((part) => part.id === syncPartId);
      const nextType =
        event.contentKind ??
        (existingStructuredPart?.type === "reasoning" ? "reasoning" : "text");
      updatedParts = upsertPart(updatedParts, {
        id: syncPartId,
        type: nextType,
        text: (existingStructuredPart?.text ?? "") + event.content,
      });
    }
    next.part[assistantMessageId] = updatedParts;
    next.session_status[sessionId] = { type: "running" };
    return next;
  }

  if (event.type === "tool_call") {
    next.part[assistantMessageId] = upsertPart(currentParts, {
      id: `tool:${event.toolCallId}`,
      type: "tool",
      toolName: event.name,
      toolCallId: event.toolCallId,
      input: event.input,
      status: "running",
    });
    next.session_status[sessionId] = { type: "running" };
    return next;
  }

  if (event.type === "tool_result") {
    next.part[assistantMessageId] = upsertPart(currentParts, {
      id: `tool:${event.toolCallId}`,
      type: "tool",
      toolCallId: event.toolCallId,
      output: event.output,
      status: event.isError ? "error" : "ok",
    });
    next.session_status[sessionId] = { type: "running" };
    return next;
  }

  if (event.type === "session_status") {
    const status: AgentSessionStatus = {
      type:
        event.statusType === "error"
          ? "error"
          : event.statusType === "idle"
            ? "idle"
            : "running",
      message: event.message,
    };
    next.session_status[sessionId] = status;
    return next;
  }

  if (event.type === "message_updated") {
    const sessionMessages = next.message[sessionId] ?? [];
    if (!sessionMessages.some((message) => message.id === event.messageId)) {
      next.message[sessionId] = [
        ...sessionMessages,
        {
          id: event.messageId,
          role: normalizeMessageRole(event.role),
          content: "",
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return next;
  }

  if (event.type === "message_part_removed") {
    const targetMessageId = next.part[event.messageId]
      ? event.messageId
      : assistantMessageId;
    if (!targetMessageId) return next;

    const current = next.part[targetMessageId] ?? [];
    if (current.length === 0) return next;
    next.part[targetMessageId] = current.filter(
      (part) =>
        part.id !== event.partId &&
        part.id !== `${targetMessageId}:part:${event.partId}`,
    );
    return next;
  }

  if (event.type === "task") {
    next.session_status[sessionId] = { type: "running", message: event.message };
    return next;
  }

  if (event.type === "error") {
    next.session_status[sessionId] = {
      type: "error",
      message: event.error,
    };
    return next;
  }

  if (event.type === "done") {
    const status: AgentSessionStatus = {
      type: "idle",
    };
    next.session_status[sessionId] = status;
    return next;
  }

  return next;
}

export function upsertPendingInterruptsToSyncState(params: {
  state: AgentSyncState;
  sessionId: string;
  pending: AgentPendingInterrupts;
}): AgentSyncState {
  const { state, sessionId, pending } = params;
  const next = cloneState(state);

  next.permission[sessionId] = pending.permissions.map((permission) => ({
    id: permission.id,
    sessionId: permission.sessionId,
    title: permission.title,
    toolCallId: permission.toolCallId,
    messageId: permission.messageId,
    contentStart: undefined,
  }));

  next.question[sessionId] = pending.questions.map((question) => ({
    id: question.id,
    sessionId: question.sessionId,
    questions: question.questions,
    toolCallId: question.toolCallId,
    messageId: question.messageId,
    contentStart: undefined,
  }));

  return next;
}
