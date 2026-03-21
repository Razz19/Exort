import type {
  AgentPermissionReply,
  AgentPermissionRequest,
  AgentQuestionRequest,
  AgentStep,
  ChatItem,
} from "../types";
import {
  ensureAssistantMessageForInterruptInMessages,
  upsertMessageStepInMessages,
  updateStepByRequestIdInMessages,
} from "./store";
import {
  parseAgentPermissionReply,
  type AgentInterruptStreamEvent,
} from "./types";

function buildPermissionStep(input: {
  requestId: string;
  sessionId: string;
  title: string;
  toolCallId?: string;
  reply?: AgentPermissionReply;
  status?: AgentStep["status"];
  contentStart?: number;
}): AgentStep {
  const fallbackStatus: AgentStep["status"] = input.reply
    ? input.reply === "reject"
      ? "error"
      : "ok"
    : "running";

  return {
    id: input.toolCallId ? `tool:${input.toolCallId}` : `permission:${input.requestId}`,
    title: "Permission required",
    detail: input.title,
    status: input.status ?? fallbackStatus,
    kind: "permission",
    requestId: input.requestId,
    sessionId: input.sessionId,
    permission: {
      title: input.title,
      reply: input.reply,
    },
    contentStart: input.contentStart,
    createdAt: new Date().toISOString(),
  };
}

function buildQuestionStep(input: {
  requestId: string;
  sessionId: string;
  questions: AgentQuestionRequest["questions"];
  toolCallId?: string;
  answers?: string[][];
  rejected?: boolean;
  status?: AgentStep["status"];
  contentStart?: number;
}): AgentStep {
  const fallbackStatus: AgentStep["status"] = input.rejected
    ? "error"
    : input.answers
      ? "ok"
      : "running";

  return {
    id: input.toolCallId ? `tool:${input.toolCallId}` : `question:${input.requestId}`,
    title: "Running question",
    detail:
      input.questions[0]?.question ??
      input.questions[0]?.header ??
      "Waiting for response",
    status: input.status ?? fallbackStatus,
    kind: "question",
    requestId: input.requestId,
    sessionId: input.sessionId,
    question: {
      questions: input.questions,
      answers: input.answers,
      rejected: input.rejected,
    },
    contentStart: input.contentStart,
    createdAt: new Date().toISOString(),
  };
}

export function upsertPendingPermissionInMessages(
  messages: ChatItem[],
  pending: AgentPermissionRequest,
): ChatItem[] {
  const withAssistant = ensureAssistantMessageForInterruptInMessages(
    messages,
    pending.messageId,
  );

  return upsertMessageStepInMessages(
    withAssistant.messages,
    withAssistant.messageId,
    buildPermissionStep({
      requestId: pending.id,
      sessionId: pending.sessionId,
      title: pending.title,
      toolCallId: pending.toolCallId,
    }),
  );
}

export function upsertPendingQuestionInMessages(
  messages: ChatItem[],
  pending: AgentQuestionRequest,
): ChatItem[] {
  const withAssistant = ensureAssistantMessageForInterruptInMessages(
    messages,
    pending.messageId,
  );

  return upsertMessageStepInMessages(
    withAssistant.messages,
    withAssistant.messageId,
    buildQuestionStep({
      requestId: pending.id,
      sessionId: pending.sessionId,
      questions: pending.questions,
      toolCallId: pending.toolCallId,
    }),
  );
}

export function applyInterruptStreamEventInMessages(params: {
  messages: ChatItem[];
  assistantMessageId: string;
  event: AgentInterruptStreamEvent;
  contentStart?: number;
}): ChatItem[] {
  const { messages, assistantMessageId, event, contentStart } = params;

  if (event.type === "permission_asked") {
    const withAssistant = ensureAssistantMessageForInterruptInMessages(
      messages,
      assistantMessageId,
    );

    return upsertMessageStepInMessages(
      withAssistant.messages,
      withAssistant.messageId,
      buildPermissionStep({
        requestId: event.requestId,
        sessionId: event.sessionId,
        title: event.title,
        toolCallId: event.toolCallId,
        contentStart,
      }),
    );
  }

  if (event.type === "permission_replied") {
    const reply = parseAgentPermissionReply(event.reply);
    const updated = updateStepByRequestIdInMessages(
      messages,
      event.requestId,
      (step) => ({
        ...step,
        status: reply === "reject" ? "error" : "ok",
        permission: {
          title: step.permission?.title ?? "Permission request",
          reply,
        },
      }),
    );

    if (updated.found) {
      return updated.messages;
    }

    const withAssistant = ensureAssistantMessageForInterruptInMessages(
      messages,
      assistantMessageId,
    );

    return upsertMessageStepInMessages(
      withAssistant.messages,
      withAssistant.messageId,
      buildPermissionStep({
        requestId: event.requestId,
        sessionId: event.sessionId,
        title: "Permission request",
        reply,
        contentStart,
      }),
    );
  }

  if (event.type === "question_asked") {
    const withAssistant = ensureAssistantMessageForInterruptInMessages(
      messages,
      assistantMessageId,
    );

    return upsertMessageStepInMessages(
      withAssistant.messages,
      withAssistant.messageId,
      buildQuestionStep({
        requestId: event.requestId,
        sessionId: event.sessionId,
        questions: event.questions,
        toolCallId: event.toolCallId,
        contentStart,
      }),
    );
  }

  if (event.type === "question_replied") {
    const updated = updateStepByRequestIdInMessages(
      messages,
      event.requestId,
      (step) => ({
        ...step,
        status: "ok",
        question: {
          questions: step.question?.questions ?? [],
          answers: event.answers,
          rejected: false,
        },
        detail: "Question answered",
      }),
    );

    if (updated.found) {
      return updated.messages;
    }

    const withAssistant = ensureAssistantMessageForInterruptInMessages(
      messages,
      assistantMessageId,
    );

    return upsertMessageStepInMessages(
      withAssistant.messages,
      withAssistant.messageId,
      buildQuestionStep({
        requestId: event.requestId,
        sessionId: event.sessionId,
        questions: [],
        answers: event.answers,
        status: "ok",
        contentStart,
      }),
    );
  }

  const updated = updateStepByRequestIdInMessages(
    messages,
    event.requestId,
    (step) => ({
      ...step,
      status: "error",
      question: {
        questions: step.question?.questions ?? [],
        answers: step.question?.answers,
        rejected: true,
      },
      detail: "Question rejected",
    }),
  );

  if (updated.found) {
    return updated.messages;
  }

  const withAssistant = ensureAssistantMessageForInterruptInMessages(
    messages,
    assistantMessageId,
  );

  return upsertMessageStepInMessages(
    withAssistant.messages,
    withAssistant.messageId,
    buildQuestionStep({
      requestId: event.requestId,
      sessionId: event.sessionId,
      questions: [],
      rejected: true,
      status: "error",
      contentStart,
    }),
  );
}
