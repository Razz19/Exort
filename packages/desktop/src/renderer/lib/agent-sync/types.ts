import type { AgentPermissionReply, AgentQuestionInfo } from "../types";

export type AgentRuntimeStreamEvent =
  | {
      type: "content";
      content: string;
      partId?: string;
      contentKind?: "reasoning" | "text";
    }
  | { type: "tool_call"; toolCallId: string; name: string; input?: string }
  | {
      type: "tool_result";
      toolCallId: string;
      output: string;
      isError?: boolean;
    }
  | {
      type: "session_status";
      statusType: string;
      message?: string;
      attempt?: number;
      next?: number;
    }
  | {
      type: "message_updated";
      messageId: string;
      role?: string;
      sessionId?: string;
    }
  | {
      type: "message_part_removed";
      messageId: string;
      partId: string;
      sessionId?: string;
    }
  | {
      type: "permission_asked";
      requestId: string;
      sessionId: string;
      toolCallId?: string;
      title: string;
    }
  | {
      type: "permission_replied";
      requestId: string;
      sessionId: string;
      reply: string;
    }
  | {
      type: "question_asked";
      requestId: string;
      sessionId: string;
      toolCallId?: string;
      questions: AgentQuestionInfo[];
    }
  | {
      type: "question_replied";
      requestId: string;
      sessionId: string;
      answers: string[][];
    }
  | { type: "question_rejected"; requestId: string; sessionId: string }
  | { type: "task"; message: string }
  | { type: "done" }
  | { type: "error"; error: string };

export type AgentInterruptStreamEvent = Extract<
  AgentRuntimeStreamEvent,
  { type: "permission_asked" | "permission_replied" | "question_asked" | "question_replied" | "question_rejected" }
>;

export type AgentSyncPart = {
  id: string;
  type: "text" | "tool" | "reasoning";
  toolName?: string;
  toolCallId?: string;
  text?: string;
  input?: string;
  output?: string;
  status?: "running" | "ok" | "error";
};

export type AgentSessionStatus = {
  type: "idle" | "running" | "error";
  message?: string;
};

export type AgentSyncPermission = {
  id: string;
  sessionId: string;
  title: string;
  reply?: AgentPermissionReply;
  toolCallId?: string;
  messageId?: string;
  contentStart?: number;
};

export type AgentSyncQuestion = {
  id: string;
  sessionId: string;
  questions: AgentQuestionInfo[];
  answers?: string[][];
  rejected?: boolean;
  toolCallId?: string;
  messageId?: string;
  contentStart?: number;
};

export type AgentSyncState = {
  message: Record<string, Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string }>>;
  part: Record<string, AgentSyncPart[]>;
  session_status: Record<string, AgentSessionStatus>;
  permission: Record<string, AgentSyncPermission[]>;
  question: Record<string, AgentSyncQuestion[]>;
};

export function parseAgentPermissionReply(value: string): AgentPermissionReply {
  if (value === "once" || value === "always" || value === "reject") {
    return value;
  }

  return "reject";
}
