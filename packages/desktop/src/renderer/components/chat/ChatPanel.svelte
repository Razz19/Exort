<script lang="ts">
  import { Plus } from "lucide-svelte";
  import type {
    AgentPermissionReply,
    ChatItem,
    PendingOutputErrorContext,
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
  type PendingPlanApproval = {
    messageId: string;
    planText: string;
    createdAt: string;
  };

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
    onOpenFile,
    pendingOutputErrorContext = null,
    onDismissPendingOutputErrorContext = () => {},
    pendingPlanApproval = null,
    onImplementPendingPlan,
    onRevisePendingPlan,
    onDismissPendingPlan,
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
      onOpenFile?: (filePath: string) => Promise<void> | void;
      pendingOutputErrorContext?: PendingOutputErrorContext | null;
      onDismissPendingOutputErrorContext?: () => void;
      pendingPlanApproval?: PendingPlanApproval | null;
      onImplementPendingPlan?: () => Promise<void> | void;
      onRevisePendingPlan?: (feedback: string) => Promise<void> | void;
      onDismissPendingPlan?: () => void;
    }>();

  function normalizePathSeparators(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function basename(value: string): string {
    const normalized = normalizePathSeparators(value).replace(/\/+$/, "");
    const segments = normalized.split("/");
    return segments[segments.length - 1] ?? normalized;
  }

  function trimRelativePrefix(value: string): string {
    return normalizePathSeparators(value)
      .replace(/^\.\/+/, "")
      .replace(/^\/+/, "");
  }

  async function resolveExistingEditorPath(
    taggedPath: string,
    workspaceRoot: string | null,
  ): Promise<string | null> {
    const directCandidate = resolveChatFilePath(taggedPath, workspaceRoot);
    if (directCandidate) {
      const direct = await window.electronAPI.readFileIfExists(directCandidate);
      if (direct.ok && !direct.missing) {
        console.debug("[ChatFileLink] direct path exists", { directCandidate });
        return directCandidate;
      }
      console.debug("[ChatFileLink] direct path missing", {
        directCandidate,
        error: direct.error ?? null,
      });
    }

    if (!workspaceRoot) return null;

    const hint = trimRelativePrefix(taggedPath);
    const hintBase = basename(hint);
    if (!hintBase) return null;

    const tree = await window.electronAPI.getWorkspaceTree(workspaceRoot);
    const filePaths = tree.filter((entry) => !entry.isDirectory).map((entry) => entry.path);
    const ranked = filePaths
      .map((filePath) => {
        const normalizedFile = normalizePathSeparators(filePath);
        const normalizedHint = normalizePathSeparators(hint);
        const fileBase = basename(normalizedFile);

        let rank = Number.POSITIVE_INFINITY;
        if (normalizedFile === normalizedHint) rank = 0;
        else if (normalizedFile.endsWith(`/${normalizedHint}`)) rank = 1;
        else if (fileBase === hintBase) rank = 2;

        return { filePath, rank };
      })
      .filter((candidate) => Number.isFinite(candidate.rank))
      .sort((a, b) => a.rank - b.rank || a.filePath.length - b.filePath.length);

    const resolved = ranked[0]?.filePath ?? null;
    console.debug("[ChatFileLink] workspace lookup", {
      taggedPath,
      hint,
      hintBase,
      candidates: ranked.slice(0, 3),
      selected: resolved,
    });
    return resolved;
  }

  async function handleChatPanelClick(event: MouseEvent): Promise<void> {
    const targetElement =
      event.target instanceof Element
        ? event.target
        : event.target instanceof Node
          ? event.target.parentElement
          : null;
    const clickedAnchor = targetElement?.closest("a");

    const taggedPath = filePathFromChatClickTarget(event.target);
    if (!taggedPath) {
      if (clickedAnchor) {
        console.debug("[ChatFileLink] click ignored: no tagged path", {
          href: clickedAnchor.getAttribute("href"),
          text: clickedAnchor.textContent?.trim() ?? "",
          className: clickedAnchor.className,
        });
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const resolvedPath = resolveChatFilePath(taggedPath, activeWorkspaceRoot);
    if (!resolvedPath) {
      console.warn("[ChatFileLink] could not resolve path", {
        taggedPath,
        activeWorkspaceRoot,
      });
      return;
    }

    console.debug("[ChatFileLink] attempting editor open", {
      taggedPath,
      resolvedPath,
    });

    try {
      const existingPath = await resolveExistingEditorPath(
        taggedPath,
        activeWorkspaceRoot,
      );
      if (!existingPath) {
        console.warn("[ChatFileLink] no existing file found to open", {
          taggedPath,
          resolvedPath,
        });
        return;
      }

      if (!onOpenFile) {
        console.warn("[ChatFileLink] onOpenFile is not available", {
          existingPath,
        });
        return;
      }

      await onOpenFile(existingPath);
      console.debug("[ChatFileLink] opened in editor", {
        existingPath,
      });
    } catch (error) {
      console.error("[ChatFileLink] editor open failed", {
        taggedPath,
        resolvedPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
      {onOpenFile}
    />
    <ChatComposer
      {activeWorkspaceRoot}
      {busy}
      {stopping}
      {onSend}
      {onStop}
      {agentMode}
      {onAgentModeChange}
      {pendingOutputErrorContext}
      {onDismissPendingOutputErrorContext}
      {pendingPlanApproval}
      {onImplementPendingPlan}
      {onRevisePendingPlan}
      {onDismissPendingPlan}
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
