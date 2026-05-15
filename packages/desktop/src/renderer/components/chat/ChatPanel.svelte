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
  import ChatTimeline from "./ChatTimeline.svelte";

  let {
    messages,
    workspaceTitle,
    activeWorkspaceRoot,
    chatFontSize = "default",
    busy,
    stopping,
    sessionStatus,
    onSend,
    onStop,
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
      chatFontSize?: ChatFontSizePreset;
      busy: boolean;
      stopping: boolean;
      sessionStatus: "running" | "idle" | "error";
      onSend: (payload: ChatSendPayload) => void;
      onStop: () => Promise<void> | void;
      onNewSession: () => void;
      onOpenWorkspace: () => Promise<void> | void;
      newSessionDisabled: boolean;
      onPermissionReply: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
      onQuestionReply: (requestId: string, answers: string[][]) => Promise<void> | void;
      onQuestionReject: (requestId: string) => Promise<void> | void;
    }>();
</script>

<div
  class="chat-panel-root flex h-full flex-col bg-dark-bg"
  data-chat-font-size={chatFontSize}
>
  <ChatHeader
    {workspaceTitle}
    {onNewSession}
    {newSessionDisabled}
  />
  {#if activeWorkspaceRoot}
    <ChatTimeline
      {messages}
      {busy}
      {sessionStatus}
      {onPermissionReply}
      {onQuestionReply}
      {onQuestionReject}
    />
    <ChatComposer {activeWorkspaceRoot} {busy} {stopping} {onSend} {onStop} />
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
