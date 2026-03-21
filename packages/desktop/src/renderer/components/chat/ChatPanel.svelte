<script lang="ts">
  import type { AgentPermissionReply, ChatItem } from "../../lib/types";
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
    onCollapse = () => {},
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
      onSend: (prompt: string) => void;
      onStop: () => Promise<void> | void;
      onNewSession: () => void;
      onCollapse?: () => Promise<void> | void;
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
    {onCollapse}
  />
  <ChatTimeline
    {messages}
    {busy}
    {sessionStatus}
    {onPermissionReply}
    {onQuestionReply}
    {onQuestionReject}
  />
  <ChatComposer {activeWorkspaceRoot} {busy} {stopping} {onSend} {onStop} />
</div>
