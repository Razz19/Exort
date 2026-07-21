<script lang="ts">
  import type {
    AgentPermissionReply,
    ChatAttachment,
    ChatItem,
  } from "../../lib/types";
  import ChatMessageCard from "./ChatMessageCard.svelte";

  let {
    message,
    showReasoning = false,
    workspaceRoot = null,
    busy = false,
    onUndoChangedFiles,
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
    onOpenFile,
    onPreviewAttachment,
  } = $props<{
    message: ChatItem;
    showReasoning?: boolean;
    workspaceRoot?: string | null;
    busy?: boolean;
    onUndoChangedFiles?: (files: string[], messageId: string) => Promise<void> | void;
    onPermissionReply?: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
    onQuestionReply?: (requestId: string, answers: string[][]) => Promise<void> | void;
    onQuestionReject?: (requestId: string) => Promise<void> | void;
    onOpenFile?: (filePath: string) => Promise<void> | void;
    onPreviewAttachment?: (attachment: ChatAttachment) => void;
  }>();
</script>

<div data-component="session-turn" class="space-y-2">
  <ChatMessageCard
    {message}
    {showReasoning}
    {workspaceRoot}
    {busy}
    {onUndoChangedFiles}
    {onPermissionReply}
    {onQuestionReply}
    {onQuestionReject}
    {onOpenFile}
    {onPreviewAttachment}
  />
</div>
