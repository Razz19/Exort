<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    ChevronDown,
    ChevronUp,
    Copy,
    CopyCheck,
    FileText,
  } from "lucide-svelte";

  import type { AgentPermissionReply, ChatItem } from "../../lib/types";
  import { formatChatTime } from "./chatDate";
  import { renderMarkdown } from "./chatMarkdown";
  import ChatStepCard from "./ChatStepCard.svelte";

  let {
    message,
    showReasoning = false,
    workspaceRoot = null,
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } =
    $props<{
      message: ChatItem;
      showReasoning?: boolean;
      workspaceRoot?: string | null;
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

  let showSteps = $state(true);
  let showPlanningFull = $state(false);
  let copied = $state(false);
  let copyResetTimer = $state<number | null>(null);
  let lastMessageId = $state<string | null>(null);

  let isUser = $derived(message.role === "user");
  let isAssistant = $derived(message.role === "assistant");
  let createdAtLabel = $derived(formatChatTime(message.createdAt));
  let stepCount = $derived(message.steps?.length ?? 0);
  let userAttachments = $derived(isUser ? (message.attachments ?? []) : []);
  let structuredAssistantContentParts = $derived(
    isAssistant
      ? (message.assistantContentParts ?? []).filter(
          (part) => part.text.trim().length > 0,
        )
      : [],
  );
  let orderedAssistantParts = $derived(isAssistant ? (message.assistantParts ?? []) : []);
  let lastToolPartIndex = $derived.by(() => {
    for (let index = orderedAssistantParts.length - 1; index >= 0; index -= 1) {
      if (orderedAssistantParts[index]?.type === "tool") return index;
    }
    return -1;
  });
  let answerPartCandidate = $derived.by(() => {
    if (!isAssistant || stepCount === 0 || lastToolPartIndex < 0) return null;
    const textParts = orderedAssistantParts
      .slice(lastToolPartIndex + 1)
      .filter(
        (part): part is Extract<NonNullable<ChatItem["assistantParts"]>[number], { type: "text" }> =>
          part.type === "text" && part.text.trim().length > 0,
    );
    return textParts[textParts.length - 1] ?? null;
  });
  let fallbackAnswerText = $derived.by(() => {
    if (!isAssistant || stepCount === 0 || answerPartCandidate) return "";
    const steps = message.steps ?? [];
    const lastStep = steps[steps.length - 1];
    if (!lastStep || lastStep.kind !== "tool" || lastStep.status === "running") {
      return "";
    }
    if (
      typeof lastStep.contentEnd !== "number" ||
      !Number.isFinite(lastStep.contentEnd)
    ) {
      return "";
    }
    const start = Math.max(
      0,
      Math.min(message.content.length, Math.trunc(lastStep.contentEnd)),
    );
    return message.content.slice(start).trim();
  });
  let answerCandidateId = $derived(
    answerPartCandidate?.id ??
      (fallbackAnswerText ? `${message.id}:fallback-answer` : null),
  );
  let answerCandidateText = $derived(
    answerPartCandidate?.text.trim() ?? fallbackAnswerText,
  );
  let answerPartText = $derived.by(() => {
    if (!answerCandidateId || !answerCandidateText) return "";
    return answerCandidateText;
  });
  let assistantBodyText = $derived.by(() => {
    if (!isAssistant || stepCount > 0) return "";
    if (structuredAssistantContentParts.length > 0) {
      return structuredAssistantContentParts
        .filter((part) => showReasoning || part.kind === "text")
        .map((part) => part.text)
        .join("")
        .trim();
    }
    return message.content.trim();
  });
  let shouldRenderBody = $derived(
    !isAssistant || (stepCount === 0 && assistantBodyText.length > 0),
  );

  function isImageAttachment(attachment: { name: string; mime: string }): boolean {
    if (attachment.mime.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(attachment.name);
  }

  function fileUrl(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const withLeadingSlash = normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;
    const encodedPath = withLeadingSlash
      .split("/")
      .map((segment, index) => {
        if (index === 0) return "";
        if (/^[A-Za-z]:$/.test(segment)) return segment;
        return encodeURIComponent(segment);
      })
      .join("/");
    return `file://${encodedPath}`;
  }

  function attachmentPreviewUrl(attachment: { path: string; url?: string }): string {
    if (attachment.url?.startsWith("data:") || attachment.url?.startsWith("blob:")) {
      return attachment.url;
    }
    return fileUrl(attachment.path);
  }

  $effect(() => {
    if (lastMessageId === message.id) return;
    lastMessageId = message.id;
    showSteps = true;
    showPlanningFull = false;
    copied = false;
  });

  onDestroy(() => {
    if (copyResetTimer) {
      window.clearTimeout(copyResetTimer);
    }
  });

  async function copyMessage(): Promise<void> {
    if (!message.content.trim().length) return;
    try {
      await navigator.clipboard.writeText(message.content);
      copied = true;
      if (copyResetTimer) {
        window.clearTimeout(copyResetTimer);
      }
      copyResetTimer = window.setTimeout(() => {
        copied = false;
      }, 1200);
    } catch {
      copied = false;
    }
  }
</script>

<div
  class={`${isUser ? "group my-7 relative ml-auto flex w-fit max-w-[calc(100%-2rem)] flex-col items-end gap-2" : "px-2 py-2"}`}
>
  {#if !isUser}
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <!-- <span
          class={`h-2 w-2 rounded-full ${isUser ? "bg-dark-blue2" : "bg-dark-aqua2"}`}
        ></span> -->
        <!-- <span class="text-xs font-medium uppercase tracking-wide text-dark-fg3">
          {isUser ? "You" : "Exort"}
        </span> -->
        {#if createdAtLabel}
          <span class="text-[11px] text-dark-fg4">{createdAtLabel}</span>
        {/if}
      </div>

      {#if isAssistant}
        <div class="flex items-center gap-1">
          {#if stepCount > 0}
            <button
              class="inline-flex items-center gap-1 rounded border border-dark-border px-1.5 py-0.5 text-[11px] text-dark-fg2 hover:border-primary-500 hover:text-primary-300"
              onclick={() => (showSteps = !showSteps)}
            >
              {#if showSteps}
                <ChevronUp class="h-3.5 w-3.5" />
              {:else}
                <ChevronDown class="h-3.5 w-3.5" />
              {/if}
              Steps {stepCount}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if isAssistant && showSteps && stepCount > 0}
    <div class="space-y-2">
      {#each message.steps as step (step.id)}
        <ChatStepCard
          {step}
          content=""
          {workspaceRoot}
          {onPermissionReply}
          {onQuestionReply}
          {onQuestionReject}
        />
      {/each}
    </div>
  {/if}

  {#if isAssistant && stepCount > 0 && showReasoning}
    {#each orderedAssistantParts as part (part.id)}
      {#if part.type !== "tool" && part.text.trim().length > 0}
        <div
          class={`chat-markdown mt-2 ${part.type === "reasoning" ? "chat-markdown-planning" : ""}`}
        >
          {@html renderMarkdown(part.text)}
        </div>
      {/if}
    {/each}
  {/if}

  {#if isAssistant && stepCount > 0 && !showReasoning && answerPartText}
    <div class="chat-markdown mt-2">
      {@html renderMarkdown(answerPartText)}
    </div>
  {/if}

  {#if shouldRenderBody && isAssistant}
    <div class="chat-markdown">
      {@html renderMarkdown(assistantBodyText)}
    </div>
  {/if}

  {#if isUser}
      {#if userAttachments.length > 0}
        <div class="flex max-w-full flex-wrap justify-end gap-2 self-end">
          {#each userAttachments as attachment (attachment.id)}
            <div
              class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dark-border bg-dark-bgS p-1 text-dark-fg3"
              title={attachment.name}
              aria-label={attachment.name}
            >
              {#if isImageAttachment(attachment)}
                <img
                  class="h-7 w-7 rounded object-cover"
                  src={attachmentPreviewUrl(attachment)}
                  alt={attachment.name}
                />
              {:else}
                <span
                  class="inline-flex h-7 w-7 items-center justify-center rounded bg-dark-bg1"
                  aria-hidden="true"
                >
                  <FileText class="h-4 w-4" />
                </span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <p
        class="whitespace-pre-wrap rounded-2xl border border-dark-bg3/50 bg-dark-bg1 px-3 py-2 text-sm leading-relaxed text-dark-fg0"
      >
        {message.content}
      </p>
  {/if}
  {#if isUser}
    <button
      class={`absolute right-0 top-full mt-1 inline-flex h-7 w-7 items-center
       justify-center rounded opacity-0 transition-opacity duration-150 
       disabled:cursor-not-allowed disabled:opacity-40 group-hover:opacity-100 
       focus-visible:opacity-100 ${copied ? "text-dark-fg1" : "text-dark-fg3 hover:text-dark-fg1 focus-visible:text-dark-fg1"}`}
      onclick={copyMessage}
      disabled={!message.content.trim().length}
      aria-label={copied ? "Copied prompt" : "Copy prompt"}
      title={copied ? "Copied" : "Copy"}
    >
      {#if copied}
        <CopyCheck class="h-4 w-4" />
      {:else}
        <Copy class="h-4 w-4" />
      {/if}
    </button>
  {/if}
</div>
