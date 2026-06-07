<script lang="ts">
  import type {
    AgentPermissionReply,
    ChatItem,
    PendingOutputErrorContext,
    ChatSendPayload,
  } from "../lib/types";
  import type { ChatFontSizePreset } from "../lib/state/types";
  import ChatPanelImpl from "./chat/ChatPanel.svelte";

  type ChatHeaderContextUsage = {
    hasData: boolean;
    usedTokens: number;
    percentage: number;
    rawPercentage: number;
    contextLimit: number;
    outputLimit: number;
  } | null;
  type PendingPlanApproval = {
    messageId: string;
    planText: string;
    createdAt: string;
  };

  let props = $props<{
    messages: ChatItem[];
    workspaceTitle: string;
    activeWorkspaceRoot: string | null;
    contextUsage?: ChatHeaderContextUsage;
    chatFontSize: ChatFontSizePreset;
    showReasoning?: boolean;
    busy: boolean;
    stopping: boolean;
    sessionStatus: "running" | "idle" | "error";
    onSend: (payload: ChatSendPayload) => void;
    agentMode?: "build" | "plan";
    onAgentModeChange?: (mode: "build" | "plan") => void;
    onStop: () => Promise<void> | void;
    onNewSession: () => void;
    onOpenWorkspace: () => Promise<void> | void;
    onCollapse?: () => Promise<void> | void;
    newSessionDisabled: boolean;
    bootstrapping?: boolean;
    historyLoading?: boolean;
    pendingOutputErrorContext?: PendingOutputErrorContext | null;
    onDismissPendingOutputErrorContext?: () => void;
    pendingPlanApproval?: PendingPlanApproval | null;
    onImplementPendingPlan?: () => Promise<void> | void;
    onRevisePendingPlan?: (feedback: string) => Promise<void> | void;
    onDismissPendingPlan?: () => void;
    onOpenFile?: (filePath: string) => Promise<void> | void;
    onUndoChangedFiles?: (
      files: string[],
      messageId: string,
    ) => Promise<void> | void;
    onPermissionReply: (
      requestId: string,
      reply: AgentPermissionReply,
    ) => Promise<void> | void;
    onQuestionReply: (
      requestId: string,
      answers: string[][],
    ) => Promise<void> | void;
    onQuestionReject: (requestId: string) => Promise<void> | void;
  }>();
</script>

<ChatPanelImpl {...props} />
