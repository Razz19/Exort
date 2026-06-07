<script lang="ts">
  import {
    Check,
    CornerDownLeft,
    MessageSquareText,
    X,
  } from "lucide-svelte";
  import { onMount } from "svelte";

  let {
    planText,
    busy = false,
    onImplement,
    onRevise,
    onDismiss,
  } = $props<{
    planText: string;
    busy?: boolean;
    onImplement: () => Promise<void> | void;
    onRevise: (feedback: string) => Promise<void> | void;
    onDismiss: () => void;
  }>();

  type ActionId = "implement" | "revise";

  let selectedAction = $state<ActionId>("implement");
  let feedback = $state("");
  let editingFeedback = $state(false);
  let submitting = $state<ActionId | null>(null);
  let rootEl = $state<HTMLDivElement | null>(null);
  let feedbackEl = $state<HTMLTextAreaElement | null>(null);

  let isBusy = $derived(busy || submitting !== null);
  let canSubmitRevision = $derived(feedback.trim().length > 0);
  let planPreview = $derived(planText.slice(0, 240));

  function focusFeedback(): void {
    editingFeedback = true;
    selectedAction = "revise";
    queueMicrotask(() => {
      feedbackEl?.focus();
    });
  }

  async function submitImplement(): Promise<void> {
    if (isBusy) return;
    submitting = "implement";
    try {
      await Promise.resolve(onImplement());
    } finally {
      submitting = null;
    }
  }

  async function submitRevision(): Promise<void> {
    if (isBusy) return;
    if (!canSubmitRevision) {
      focusFeedback();
      return;
    }

    submitting = "revise";
    try {
      await Promise.resolve(onRevise(feedback));
    } finally {
      submitting = null;
    }
  }

  async function submitSelected(): Promise<void> {
    if (selectedAction === "implement") {
      await submitImplement();
      return;
    }

    await submitRevision();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      selectedAction = selectedAction === "implement" ? "revise" : "implement";
      if (selectedAction === "revise") {
        focusFeedback();
      } else {
        editingFeedback = false;
        rootEl?.focus();
      }
      return;
    }

    if (event.key !== "Enter") return;
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && event.shiftKey) return;
    event.preventDefault();
    void submitSelected();
  }

  onMount(() => {
    rootEl?.focus();
  });
</script>

<div
  class="border-t border-dark-border bg-dark-bg px-3 pb-3"
  data-component="plan-approval-prompt"
>
  <div
    class="rounded-lg border border-dark-border bg-dark-surface shadow-lg shadow-dark-bg/40 outline-none"
    bind:this={rootEl}
    tabindex="0"
    role="dialog"
    aria-label="Implement this plan"
    title={planPreview}
    onkeydown={handleKeydown}
  >
    <div class="flex items-center justify-between gap-3 border-b border-dark-border px-3 py-2.5">
      <h2 class="text-sm font-semibold text-dark-fg0">Implement this plan?</h2>
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-dark-fg3 transition-colors hover:bg-dark-bg1 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        disabled={isBusy}
        onclick={onDismiss}
        aria-label="Dismiss plan approval"
        title="Dismiss"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <div class="space-y-1 p-2">
      <button
        type="button"
        class={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
          selectedAction === "implement"
            ? "border-primary-500/60 bg-dark-bg1 text-dark-fg0"
            : "border-transparent text-dark-fg2 hover:bg-dark-bg1 hover:text-dark-fg1"
        }`}
        disabled={isBusy}
        aria-pressed={selectedAction === "implement"}
        onclick={() => {
          selectedAction = "implement";
          editingFeedback = false;
        }}
        ondblclick={() => void submitImplement()}
      >
        <span class="w-5 shrink-0 text-xs text-dark-fg3">1.</span>
        <Check class="h-4 w-4 shrink-0 text-dark-green" />
        <span class="min-w-0 font-medium">Yes, implement this plan</span>
      </button>

      <button
        type="button"
        class={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
          selectedAction === "revise"
            ? "border-primary-500/60 bg-dark-bg1 text-dark-fg0"
            : "border-transparent text-dark-fg2 hover:bg-dark-bg1 hover:text-dark-fg1"
        }`}
        disabled={isBusy}
        aria-pressed={selectedAction === "revise"}
        onclick={focusFeedback}
      >
        <span class="w-5 shrink-0 text-xs text-dark-fg3">2.</span>
        <MessageSquareText class="h-4 w-4 shrink-0 text-dark-aqua" />
        <span class="min-w-0 font-medium">
          No, tell Exort what to do differently
        </span>
      </button>

      {#if editingFeedback}
        <textarea
          class="chat-timeline-scroll mt-2 min-h-20 w-full resize-none rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-fg0 placeholder:text-dark-fg4 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          bind:this={feedbackEl}
          bind:value={feedback}
          disabled={isBusy}
          placeholder="Tell Exort what to change in the plan..."
          aria-label="Plan revision feedback"
          onkeydown={(event) => {
            event.stopPropagation();
            handleKeydown(event);
          }}
        ></textarea>
      {/if}
    </div>

    <div class="flex items-center justify-end gap-2 border-t border-dark-border px-3 py-2">
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs font-medium text-dark-fg3 transition-colors hover:bg-dark-bg1 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        disabled={isBusy}
        onclick={onDismiss}
        title="Esc"
      >
        Dismiss <span class="ml-1 rounded bg-dark-bg px-1 text-[10px]">ESC</span>
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy || (selectedAction === "revise" && !canSubmitRevision)}
        onclick={() => void submitSelected()}
      >
        {submitting === "implement"
          ? "Starting..."
          : submitting === "revise"
            ? "Sending..."
            : "Submit"}
        <CornerDownLeft class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</div>
