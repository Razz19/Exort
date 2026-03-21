<script lang="ts">
  import { ChevronDown, ChevronUp } from "lucide-svelte";
  import type { AgentPermissionReply, AgentStep } from "../../lib/types";
  import { formatChatTime } from "./chatDate";
  import { renderMarkdown } from "./chatMarkdown";
  import { getStepIcon, getStepStatusLabel, getStepSummary } from "./chatStepMeta";
  import PermissionPromptCard from "./interrupts/PermissionPromptCard.svelte";
  import QuestionPromptCard from "./interrupts/QuestionPromptCard.svelte";
  import MessagePart from "./parts/MessagePart.svelte";

  let {
    step,
    content = "",
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } = $props<{
    step: AgentStep;
    content?: string;
    onPermissionReply?: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
    onQuestionReply?: (requestId: string, answers: string[][]) => Promise<void> | void;
    onQuestionReject?: (requestId: string) => Promise<void> | void;
  }>();

  let expanded = $state(false);
  let lastStepId = $state<string | null>(null);
  let lastResolvedQuestionKey = $state<string | null>(null);

  let StepIcon = $derived(getStepIcon(step));
  let statusLabel = $derived(getStepStatusLabel(step));
  let summary = $derived(getStepSummary(step));
  let createdAtLabel = $derived(formatChatTime(step.createdAt));
  let hasInterruptUI = $derived(step.kind === "permission" || step.kind === "question");
  let hasToolBody = $derived.by(() => {
    if (step.kind !== "tool") return false;
    return Boolean(
      step.toolInput?.trim() ||
        step.toolOutput?.trim() ||
        step.detail?.trim(),
    );
  });
  let hasBody = $derived(
    hasToolBody ||
      Boolean(step.detail?.trim()) ||
      (!hasInterruptUI && content.trim().length > 0),
  );

  let statusBadgeClass = $derived.by(() => {
    if (step.status === "running") {
      return "border-dark-yellow/40 text-dark-yellow";
    }
    if (step.status === "ok") {
      return "border-dark-aqua/40 text-dark-aqua";
    }
    return "border-dark-red/40 text-dark-red2";
  });
  let iconClass = $derived.by(() => {
    if (step.status === "running") return "text-dark-yellow";
    if (step.status === "ok") return "text-dark-aqua";
    return "text-dark-red2";
  });

  $effect(() => {
    if (lastStepId === step.id) return;
    lastStepId = step.id;
    expanded =
      step.status === "running" ||
      content.trim().length > 0 ||
      Boolean(step.detail?.trim());
  });

  $effect(() => {
    if (step.status === "running") {
      expanded = true;
    }
  });

  $effect(() => {
    if (step.kind !== "question") return;
    if (step.status === "running") return;

    const nextKey = `${step.id}:${step.status}:${step.question?.rejected === true ? "rejected" : "answered"}`;
    if (lastResolvedQuestionKey === nextKey) return;

    lastResolvedQuestionKey = nextKey;
    expanded = false;
  });
</script>

{#if step.kind === "tool"}
  <div class="space-y-2">
    <MessagePart {step} />
    {#if step.status !== "running" && content.trim().length > 0}
      <div class="chat-markdown px-2.5 pb-1">
        {@html renderMarkdown(content)}
      </div>
    {/if}
  </div>
{:else}
  <div class="overflow-hidden rounded-md">
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left"
      onclick={() => (expanded = !expanded)}
    >
      <StepIcon class={`h-4 w-4 shrink-0 ${iconClass}`} />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-dark-fg1">{step.title}</div>
        <div class="truncate text-[11px] text-dark-fg3">{summary}</div>
      </div>
      <span class={`rounded border px-1.5 py-0.5 text-[10px] ${statusBadgeClass}`}>
        {statusLabel}
      </span>
      {#if expanded}
        <ChevronUp class="h-3.5 w-3.5 text-dark-fg3" />
      {:else}
        <ChevronDown class="h-3.5 w-3.5 text-dark-fg3" />
      {/if}
    </button>

    {#if expanded && (hasInterruptUI || hasBody)}
      <div class="px-3 py-2">
        {#if step.kind === "permission" && step.permission && step.requestId && onPermissionReply}
          <PermissionPromptCard
            requestId={step.requestId}
            title={step.permission.title}
            reply={step.permission.reply}
            busy={step.status !== "running"}
            onReply={onPermissionReply}
          />
        {/if}
        {#if step.kind === "question" && step.question && step.requestId && onQuestionReply && onQuestionReject}
          <QuestionPromptCard
            requestId={step.requestId}
            questions={step.question.questions}
            answers={step.question.answers}
            rejected={step.question.rejected}
            busy={step.status !== "running"}
            onReply={onQuestionReply}
            onReject={onQuestionReject}
          />
        {/if}
        {#if step.kind !== "permission" && step.kind !== "question" && step.detail}
          <div class="whitespace-pre-wrap break-words text-xs text-dark-fg2">
            {step.detail}
          </div>
        {/if}
        {#if content.trim().length > 0}
          <div class={`chat-markdown ${step.detail ? "mt-2 pt-2" : ""}`}>
            {@html renderMarkdown(content)}
          </div>
        {/if}
        {#if createdAtLabel}
          <div class="mt-2 text-[10px] text-dark-fg4">{createdAtLabel}</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
