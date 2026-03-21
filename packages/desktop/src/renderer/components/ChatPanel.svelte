<script lang="ts">
  import type { AgentPermissionReply, ChatItem } from "../lib/types";
  import type { ChatFontSizePreset } from "../lib/state/types";
  import ChatPanelImpl from "./chat/ChatPanel.svelte";

  let props = $props<{
    messages: ChatItem[];
    workspaceTitle: string;
    activeWorkspaceRoot: string | null;
    chatFontSize: ChatFontSizePreset;
    busy: boolean;
    stopping: boolean;
    sessionStatus: "running" | "idle" | "error";
    onSend: (prompt: string) => void;
    onStop: () => Promise<void> | void;
    onNewSession: () => void;
    onCollapse?: () => Promise<void> | void;
    newSessionDisabled: boolean;
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
