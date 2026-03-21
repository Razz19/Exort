<script lang="ts">
  import type { AgentPermissionReply, ChatItem } from "../../lib/types";
  import ChatMessageCard from "./ChatMessageCard.svelte";

  let {
    message,
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } = $props<{
    message: ChatItem;
    onPermissionReply?: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
    onQuestionReply?: (requestId: string, answers: string[][]) => Promise<void> | void;
    onQuestionReject?: (requestId: string) => Promise<void> | void;
  }>();
</script>

<div data-component="session-turn" class="space-y-2">
  <ChatMessageCard
    {message}
    {onPermissionReply}
    {onQuestionReply}
    {onQuestionReject}
  />
</div>
