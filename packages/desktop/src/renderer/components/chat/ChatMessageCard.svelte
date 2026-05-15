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
  import {
    getLeadingAssistantContent,
    getStepAssistantContent,
    hasStepOffsets,
    looksLikeAssistantPlanningContent,
    splitAssistantPlanningContent,
  } from "./chatContentSegments";
  import { renderMarkdown } from "./chatMarkdown";
  import ChatStepCard from "./ChatStepCard.svelte";

  let { message, onPermissionReply, onQuestionReply, onQuestionReject } =
    $props<{
      message: ChatItem;
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
  let structuredBodyAssistantSplit = $derived.by(() => {
    if (
      !isAssistant ||
      (isAssistant && stepCount > 0 && hasStepOffsets(message))
    ) {
      return null;
    }
    if (structuredAssistantContentParts.length < 2) return null;

    const firstResponseIndex = structuredAssistantContentParts.findIndex(
      (part) => part.kind === "text",
    );
    if (firstResponseIndex <= 0) return null;

    const planningParts = structuredAssistantContentParts.slice(
      0,
      firstResponseIndex,
    );
    if (!planningParts.some((part) => part.kind === "reasoning")) return null;

    const planning = planningParts.map((part) => part.text).join("");
    const response = structuredAssistantContentParts
      .slice(firstResponseIndex)
      .map((part) => part.text)
      .join("");

    if (!planning.trim() || !response.trim()) return null;
    return {
      planning,
      response,
    };
  });
  let segmentedAssistantContent = $derived(
    isAssistant && stepCount > 0 && hasStepOffsets(message),
  );
  let leadingAssistantContent = $derived(
    segmentedAssistantContent ? getLeadingAssistantContent(message) : "",
  );
  let shouldRenderBody = $derived(
    !isAssistant ||
      (!segmentedAssistantContent && message.content.trim().length > 0),
  );
  let leadingAssistantSplit = $derived(
    isAssistant && leadingAssistantContent.trim().length > 0
      ? splitAssistantPlanningContent(leadingAssistantContent)
      : null,
  );
  let bodyAssistantSplit = $derived(
    isAssistant &&
      !segmentedAssistantContent &&
      message.content.trim().length > 0
      ? splitAssistantPlanningContent(message.content)
      : null,
  );
  let leadingAssistantLooksPlanning = $derived(
    isAssistant && leadingAssistantContent.trim().length > 0
      ? looksLikeAssistantPlanningContent(leadingAssistantContent)
      : false,
  );
  let bodyAssistantLooksPlanning = $derived(
    isAssistant &&
      !segmentedAssistantContent &&
      message.content.trim().length > 0
      ? looksLikeAssistantPlanningContent(message.content)
      : false,
  );
  let planningPreviewText = $derived.by(() => {
    const parts: string[] = [];

    if (structuredBodyAssistantSplit?.planning) {
      parts.push(structuredBodyAssistantSplit.planning);
      return parts.join("\n\n").trim();
    }

    if (leadingAssistantSplit?.planning) {
      parts.push(leadingAssistantSplit.planning);
    } else if (
      leadingAssistantLooksPlanning &&
      leadingAssistantContent.trim().length > 0
    ) {
      parts.push(leadingAssistantContent);
    }

    if (bodyAssistantSplit?.planning) {
      parts.push(bodyAssistantSplit.planning);
    } else if (
      bodyAssistantLooksPlanning &&
      !bodyAssistantSplit &&
      message.content.trim().length > 0
    ) {
      parts.push(message.content);
    }

    return parts.join("\n\n").trim();
  });
  let hasPlanningContent = $derived(planningPreviewText.length > 0);
  let planningIsLong = $derived.by(() => {
    if (!planningPreviewText) return false;
    return (
      planningPreviewText.length > 260 ||
      (planningPreviewText.match(/\n/g)?.length ?? 0) >= 4
    );
  });
  let collapsePlanning = $derived(
    hasPlanningContent && planningIsLong && !showPlanningFull,
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
    if (!copyResetTimer) return;
    window.clearTimeout(copyResetTimer);
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

  {#if isAssistant && segmentedAssistantContent && leadingAssistantContent.trim().length > 0}
    {#if leadingAssistantSplit}
      <div
        class={`chat-markdown chat-markdown-planning mb-2 ${collapsePlanning ? "chat-markdown-planning-collapsed" : ""}`}
      >
        {@html renderMarkdown(leadingAssistantSplit.planning)}
      </div>
      {#if hasPlanningContent && planningIsLong}
        <button
          class="mb-2 inline-flex items-center gap-1 px-0 py-0 text-[11px] text-dark-fg4 hover:text-dark-fg2"
          onclick={() => (showPlanningFull = !showPlanningFull)}
          title={showPlanningFull
            ? "Collapse planning notes"
            : "Expand planning notes"}
        >
          {#if showPlanningFull}
            <ChevronUp class="h-3 w-3" />
            Hide Reasoning
          {:else}
            <ChevronDown class="h-3 w-3" />
            Show Reasoning
          {/if}
        </button>
      {/if}
      <div class="chat-markdown mb-2">
        {@html renderMarkdown(leadingAssistantSplit.response)}
      </div>
    {:else if leadingAssistantLooksPlanning}
      <div
        class={`chat-markdown chat-markdown-planning mb-2 ${collapsePlanning ? "chat-markdown-planning-collapsed" : ""}`}
      >
        {@html renderMarkdown(leadingAssistantContent)}
      </div>
      {#if hasPlanningContent && planningIsLong}
        <button
          class="mb-2 inline-flex items-center gap-1 px-0 py-0 text-[11px] text-dark-fg4 hover:text-dark-fg2"
          onclick={() => (showPlanningFull = !showPlanningFull)}
          title={showPlanningFull
            ? "Collapse planning notes"
            : "Expand planning notes"}
        >
          {#if showPlanningFull}
            <ChevronUp class="h-3 w-3" />
            Hide Reasoning
          {:else}
            <ChevronDown class="h-3 w-3" />
            Show Reasoning
          {/if}
        </button>
      {/if}
    {:else}
      <div class="chat-markdown mb-2">
        {@html renderMarkdown(leadingAssistantContent)}
      </div>
    {/if}
  {/if}

  {#if isAssistant && showSteps && stepCount > 0}
    <div class="space-y-2">
      {#each message.steps as step, index (step.id)}
        <ChatStepCard
          {step}
          content={segmentedAssistantContent
            ? getStepAssistantContent(message, index)
            : ""}
          {onPermissionReply}
          {onQuestionReply}
          {onQuestionReject}
        />
      {/each}
    </div>
  {/if}

  {#if shouldRenderBody}
    {#if isAssistant}
      {#if structuredBodyAssistantSplit}
        <div
          class={`chat-markdown chat-markdown-planning ${stepCount > 0 ? "mt-2" : ""} ${collapsePlanning ? "chat-markdown-planning-collapsed" : ""}`}
        >
          {@html renderMarkdown(structuredBodyAssistantSplit.planning)}
        </div>
        {#if hasPlanningContent && planningIsLong}
          <button
            class="mb-1 inline-flex items-center gap-1 px-0 py-0 text-[11px] text-dark-fg4 hover:text-dark-fg2"
            onclick={() => (showPlanningFull = !showPlanningFull)}
            title={showPlanningFull
              ? "Collapse planning notes"
              : "Expand planning notes"}
          >
            {#if showPlanningFull}
              <ChevronUp class="h-3 w-3" />
              Hide Reasoning
            {:else}
              <ChevronDown class="h-3 w-3" />
              Show Reasoning
            {/if}
          </button>
        {/if}
        <div class={`chat-markdown ${stepCount > 0 ? "mt-2" : "mt-1"}`}>
          {@html renderMarkdown(structuredBodyAssistantSplit.response)}
        </div>
      {:else if bodyAssistantSplit}
        <div
          class={`chat-markdown chat-markdown-planning ${stepCount > 0 ? "mt-2" : ""} ${collapsePlanning ? "chat-markdown-planning-collapsed" : ""}`}
        >
          {@html renderMarkdown(bodyAssistantSplit.planning)}
        </div>
        {#if hasPlanningContent && planningIsLong}
          <button
            class="mb-1 inline-flex items-center gap-1 px-0 py-0 text-[11px] text-dark-fg4 hover:text-dark-fg2"
            onclick={() => (showPlanningFull = !showPlanningFull)}
            title={showPlanningFull
              ? "Collapse planning notes"
              : "Expand planning notes"}
          >
            {#if showPlanningFull}
              <ChevronUp class="h-3 w-3" />
              Hide Reasoning
            {:else}
              <ChevronDown class="h-3 w-3" />
              Show Reasoning
            {/if}
          </button>
        {/if}
        <div class={`chat-markdown ${stepCount > 0 ? "mt-2" : "mt-1"}`}>
          {@html renderMarkdown(bodyAssistantSplit.response)}
        </div>
      {:else if bodyAssistantLooksPlanning}
        <div
          class={`chat-markdown chat-markdown-planning ${stepCount > 0 ? "mt-2" : ""} ${collapsePlanning ? "chat-markdown-planning-collapsed" : ""}`}
        >
          {@html renderMarkdown(message.content)}
        </div>
        {#if hasPlanningContent && planningIsLong}
          <button
            class="mb-1 inline-flex items-center gap-1 px-0 py-0 text-[11px] text-dark-fg4 hover:text-dark-fg2"
            onclick={() => (showPlanningFull = !showPlanningFull)}
            title={showPlanningFull
              ? "Collapse planning notes"
              : "Expand planning notes"}
          >
            {#if showPlanningFull}
              <ChevronUp class="h-3 w-3" />
              Hide Reasoning
            {:else}
              <ChevronDown class="h-3 w-3" />
              Show Reasoning
            {/if}
          </button>
        {/if}
      {:else}
        <div class={`chat-markdown ${stepCount > 0 ? "mt-2" : ""}`}>
          {@html renderMarkdown(message.content)}
        </div>
    {/if}
  {:else}
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
        class="whitespace-pre-wrap rounded-2xl border border-dark-bg3/50 bg-dark-bg1 px-3 py-2 text-sm leading-relaxed text-white"
      >
        {message.content}
      </p>
    {/if}
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
