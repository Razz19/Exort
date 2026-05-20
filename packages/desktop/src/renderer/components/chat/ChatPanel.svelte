<script lang="ts">
  import { Plus } from "lucide-svelte";
  import type {
    AgentPermissionReply,
    ChatItem,
    ChatSendPayload,
  } from "../../lib/types";
  import type { ChatFontSizePreset } from "../../lib/state/types";
  import ChatComposer from "./ChatComposer.svelte";
  import ChatHeader from "./ChatHeader.svelte";
  import HistoryLoading from "./HistoryLoading.svelte";
  import ChatTimeline from "./ChatTimeline.svelte";
  import {
    filePathFromChatClickTarget,
    resolveChatFilePath,
  } from "./chatMarkdown";

  type ChatHeaderContextUsage = {
    hasData: boolean;
    usedTokens: number;
    percentage: number;
    rawPercentage: number;
    contextLimit: number;
    outputLimit: number;
  } | null;

  let {
    messages,
    workspaceTitle,
    activeWorkspaceRoot,
    contextUsage = null,
    chatFontSize = "default",
    showReasoning = false,
    bootstrapping = false,
    historyLoading = false,
    busy,
    stopping,
    sessionStatus,
    onSend,
    agentMode = "build",
    onAgentModeChange,
    onStop,
    onUndoChangedFiles,
    onNewSession,
    onOpenWorkspace,
    newSessionDisabled,
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } =
    $props<{
      messages: ChatItem[];
      workspaceTitle: string;
      activeWorkspaceRoot: string | null;
      contextUsage?: ChatHeaderContextUsage;
      chatFontSize?: ChatFontSizePreset;
      showReasoning?: boolean;
      bootstrapping?: boolean;
      historyLoading?: boolean;
      busy: boolean;
      stopping: boolean;
      sessionStatus: "running" | "idle" | "error";
      onSend: (payload: ChatSendPayload) => void;
      agentMode?: "build" | "plan";
      onAgentModeChange: (mode: "build" | "plan") => void;
      onStop: () => Promise<void> | void;
      onUndoChangedFiles?: (files: string[], messageId: string) => Promise<void> | void;
      onNewSession: () => void;
      onOpenWorkspace: () => Promise<void> | void;
      newSessionDisabled: boolean;
      onPermissionReply: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
      onQuestionReply: (requestId: string, answers: string[][]) => Promise<void> | void;
      onQuestionReject: (requestId: string) => Promise<void> | void;
    }>();

  async function handleChatPanelClick(event: MouseEvent): Promise<void> {
    const taggedPath = filePathFromChatClickTarget(event.target);
    if (!taggedPath) return;

    event.preventDefault();
    event.stopPropagation();

    const resolvedPath = resolveChatFilePath(taggedPath, activeWorkspaceRoot);
    if (!resolvedPath) return;
    await window.electronAPI.revealPathInFileManager({ path: resolvedPath });
  }
</script>

<div
  class="chat-panel-root flex h-full flex-col bg-dark-bg"
  data-chat-font-size={chatFontSize}
  onclick={handleChatPanelClick}
>
  <ChatHeader
    {workspaceTitle}
    {contextUsage}
    {onNewSession}
    {newSessionDisabled}
  />
  {#if activeWorkspaceRoot}
    <ChatTimeline
      {messages}
      {showReasoning}
      workspaceRoot={activeWorkspaceRoot}
      {busy}
      {sessionStatus}
      {historyLoading}
      {onUndoChangedFiles}
      {onPermissionReply}
      {onQuestionReply}
      {onQuestionReject}
    />
    <ChatComposer
      {activeWorkspaceRoot}
      {busy}
      {stopping}
      {onSend}
      {onStop}
      {agentMode}
      {onAgentModeChange}
    />
  {:else if bootstrapping}
    <HistoryLoading />
  {:else}
    <div class="flex min-h-0 flex-1 items-center justify-center p-4">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md border border-dark-yellow bg-dark-surface px-3 py-2 text-sm font-medium text-dark-yellow transition-colors hover:bg-dark-yellow/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        onclick={() => void onOpenWorkspace()}
      >
        <Plus class="h-4 w-4" />
        <span>Open workspace</span>
      </button>
    </div>
  {/if}
</div>
