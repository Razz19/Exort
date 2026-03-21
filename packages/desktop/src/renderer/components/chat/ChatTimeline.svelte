<script lang="ts">
  import { ChevronDown } from "lucide-svelte";
  import type { AgentPermissionReply, ChatItem } from "../../lib/types";
  import SessionTurn from "./SessionTurn.svelte";

  const AUTO_SCROLL_THRESHOLD_PX = 80;

  let {
    messages,
    busy,
    sessionStatus,
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } = $props<{
    messages: ChatItem[];
    busy: boolean;
    sessionStatus: "running" | "idle" | "error";
    onPermissionReply?: (
      requestId: string,
      reply: AgentPermissionReply,
    ) => Promise<void> | void;
    onQuestionReply?: (
      requestId: string,
      answers: string[][],
    ) => Promise<void> | void;
    onQuestionReject?: (requestId: string) => Promise<void> | void;
  }>();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let pinnedToBottom = $state(true);

  let visibleMessages = $derived(
    messages.filter(
      (message) =>
        message.role !== "assistant" ||
        message.content.trim().length > 0 ||
        (message.steps?.length ?? 0) > 0,
    ),
  );
  let showJumpToLatest = $derived(
    visibleMessages.length > 0 && !pinnedToBottom,
  );
  let thinkingTextClass = $derived.by(() => {
    if (sessionStatus === "running") return "text-dark-aqua";
    if (sessionStatus === "error") return "text-dark-red";
    return "text-dark-yellow";
  });
  let thinkingDotClass = $derived.by(() => {
    if (sessionStatus === "running") return "bg-dark-aqua";
    if (sessionStatus === "error") return "bg-dark-red";
    return "bg-dark-yellow";
  });

  function updatePinnedState(): void {
    if (!scrollEl) {
      pinnedToBottom = true;
      return;
    }

    const remaining =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    pinnedToBottom = remaining <= AUTO_SCROLL_THRESHOLD_PX;
  }

  function scrollToBottom(): void {
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    pinnedToBottom = true;
  }

  $effect(() => {
    messages;
    busy;
    if (!scrollEl) return;
    if (!pinnedToBottom) return;
    queueMicrotask(() => scrollToBottom());
  });
</script>

<div class="relative min-h-0 flex-1">
  <div
    class="chat-timeline-scroll h-full space-y-3 overflow-y-auto p-4"
    bind:this={scrollEl}
    onscroll={updatePinnedState}
  >
    {#if visibleMessages.length === 0}
      <div class="card p-4 text-sm text-dark-fg3">
        Start by asking Exort Agent to inspect your workspace.
      </div>
    {/if}

    {#each visibleMessages as message (message.id)}
      <SessionTurn
        {message}
        {onPermissionReply}
        {onQuestionReply}
        {onQuestionReject}
      />
    {/each}

    {#if busy}
      <div
        class="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-bgS px-3 py-2 text-xs text-dark-fg3"
      >
        <span class={`h-2 w-2 rounded-full animate-pulse ${thinkingDotClass}`}
        ></span>
        <span class={thinkingTextClass}>Thinking</span>
        <span class="flex items-center gap-1">
          <span
            class="h-1.5 w-1.5 rounded-full bg-dark-fg4 animate-bounce"
            style="animation-delay: 0ms;"
          ></span>
          <span
            class="h-1.5 w-1.5 rounded-full bg-dark-fg4 animate-bounce"
            style="animation-delay: 120ms;"
          ></span>
          <span
            class="h-1.5 w-1.5 rounded-full bg-dark-fg4 animate-bounce"
            style="animation-delay: 240ms;"
          ></span>
        </span>
      </div>
    {/if}
  </div>

  {#if showJumpToLatest}
    <button
      class="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md border border-dark-border bg-dark-bgS px-2 py-1 text-xs text-dark-fg2 shadow-md hover:border-dark-fg2 hover:text-dark-fg2"
      onclick={scrollToBottom}
    >
      <ChevronDown class="h-3.5 w-3.5 " />
    </button>
  {/if}
</div>
