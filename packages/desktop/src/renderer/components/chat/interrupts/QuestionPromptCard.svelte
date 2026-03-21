<script lang="ts">
  import type { AgentQuestionInfo } from "../../../lib/types";

  let {
    requestId,
    questions,
    answers,
    rejected = false,
    busy = false,
    onReply,
    onReject,
  } = $props<{
    requestId: string;
    questions: AgentQuestionInfo[];
    answers?: string[][];
    rejected?: boolean;
    busy?: boolean;
    onReply: (requestId: string, answers: string[][]) => Promise<void> | void;
    onReject: (requestId: string) => Promise<void> | void;
  }>();

  let tabIndex = $state(0);
  let draftAnswers = $state<string[][]>([]);
  let customAnswers = $state<string[]>([]);
  let saving = $state<"reply" | "reject" | null>(null);
  let resetKey = $state("");

  let activeQuestion = $derived(questions[tabIndex] ?? null);
  let isSingleQuickPick = $derived(
    questions.length === 1 && (questions[0]?.multiple ?? false) === false,
  );
  let inConfirmTab = $derived(
    questions.length > 1 && tabIndex === questions.length,
  );
  let hasAnyCustomInput = $derived(
    customAnswers.some((value) => value.trim().length > 0),
  );
  let showSubmit = $derived(
    (questions.length > 1 && inConfirmTab) ||
      (questions.length <= 1 && (!isSingleQuickPick || hasAnyCustomInput)),
  );
  let submitActionLabel = $derived(
    questions.length > 1 ? "Confirm" : "Submit answers",
  );
  let isBusy = $derived(busy || saving !== null);

  function normalizeAnswers(value: string[][]): string[][] {
    return questions.map((_question, index) => {
      const items = value[index] ?? [];
      const deduped = Array.from(
        new Set(items.map((entry) => entry.trim()).filter(Boolean)),
      );
      return deduped;
    });
  }

  function setAnswer(index: number, values: string[]): void {
    const next = normalizeAnswers(draftAnswers);
    next[index] = values;
    draftAnswers = next;
  }

  function mergeAnswersWithCustom(value: string[][]): string[][] {
    const normalized = normalizeAnswers(value);
    return questions.map((question, index) => {
      const selected = normalized[index] ?? [];
      const custom = (customAnswers[index] ?? "").trim();
      if (!custom) return selected;
      if (selected.includes(custom)) return selected;
      if (selected.length === 0) return [custom];
      if (question.multiple) return [...selected, custom];
      return selected;
    });
  }

  let effectiveAnswers = $derived(mergeAnswersWithCustom(draftAnswers));

  function getCurrentAnswers(): string[] {
    return draftAnswers[tabIndex] ?? [];
  }

  function isPicked(label: string): boolean {
    return getCurrentAnswers().includes(label);
  }

  function goToNextQuestion(): void {
    if (tabIndex < questions.length) {
      tabIndex += 1;
    }
  }

  async function submitAll(): Promise<void> {
    if (isBusy || rejected) return;
    saving = "reply";
    try {
      await Promise.resolve(onReply(requestId, effectiveAnswers));
    } finally {
      saving = null;
    }
  }

  async function pickSingle(answer: string): Promise<void> {
    setAnswer(tabIndex, [answer]);

    if (isSingleQuickPick) {
      saving = "reply";
      try {
        await Promise.resolve(onReply(requestId, [[answer]]));
      } finally {
        saving = null;
      }
      return;
    }

    goToNextQuestion();
  }

  function toggleMulti(answer: string): void {
    const current = getCurrentAnswers();
    if (current.includes(answer)) {
      setAnswer(
        tabIndex,
        current.filter((entry) => entry !== answer),
      );
      return;
    }
    setAnswer(tabIndex, [...current, answer]);
  }

  async function selectOption(answer: string): Promise<void> {
    if (!activeQuestion || isBusy || rejected) return;

    if (activeQuestion.multiple) {
      toggleMulti(answer);
      return;
    }

    await pickSingle(answer);
  }

  $effect(() => {
    const nextResetKey = JSON.stringify({
      requestId,
      questions,
      answers,
      rejected,
    });

    if (nextResetKey === resetKey) return;
    resetKey = nextResetKey;

    draftAnswers = normalizeAnswers(answers ?? []);
    customAnswers = questions.map((_question, index) => {
      const selected = answers?.[index] ?? [];
      const knownOptions = new Set(
        (questions[index]?.options ?? []).map((option) => option.label),
      );
      const custom = selected.find((entry) => !knownOptions.has(entry));
      return custom ?? "";
    });
    tabIndex = 0;
  });
</script>

<div class="mt-2 rounded-md border border-dark-yellow/70 bg-dark-surface p-2.5">
  <p class="text-xs text-dark-fg2">Question</p>

  {#if !rejected && questions.length > 1}
    <div class="mt-2 flex flex-wrap gap-1">
      {#each questions as question, index (`tab:${question.header}:${index}`)}
        <button
          class={`rounded border px-2 py-0.5 text-[11px] ${index === tabIndex ? "border-primary-500 text-primary-300" : "border-dark-border text-dark-fg3 hover:border-primary-500"}`}
          disabled={isBusy}
          onclick={() => {
            tabIndex = index;
          }}
        >
          {question.header}
        </button>
      {/each}
    </div>
  {/if}

  {#if rejected}
    <div class="mt-1 text-sm text-dark-red2">Question was rejected.</div>
  {:else if inConfirmTab}
    <div class="mt-2 space-y-2">
      {#each questions as question, index (`review:${question.header}:${index}`)}
        <div
          class="rounded border border-dark-border bg-dark-bg px-2 py-1.5 text-xs"
        >
          <div class="text-dark-fg3">{question.question}</div>
          <div class="mt-1 text-dark-fg1">
            {(effectiveAnswers[index] ?? []).join(", ") || "Not answered"}
          </div>
        </div>
      {/each}
    </div>
  {:else if activeQuestion}
    <div class="mt-2 space-y-2">
      <div class="text-sm text-dark-fg1">{activeQuestion.question}</div>

      <div class="space-y-1.5">
        {#each activeQuestion.options as option (`opt:${option.label}`)}
          <button
            class={`w-full rounded border px-2 py-1.5 text-left text-xs ${isPicked(option.label) ? "border-primary-500 bg-primary-500/15 text-primary-200" : "border-dark-border bg-dark-bg text-dark-fg2 hover:border-dark-fg2"}`}
            disabled={isBusy}
            onclick={() => selectOption(option.label)}
          >
            <div class="font-medium text-sm">{option.label}</div>
            {#if option.description}
              <div class="mt-0.5 text-[11px] text-dark-fg3">
                {option.description}
              </div>
            {/if}
          </button>
        {/each}

        {#if activeQuestion.custom}
          <input
            class="input-field w-full text-dark-fg2 placeholder:text-dark-fg2 focus:border-dark-fg2"
            placeholder="Enter answer"
            value={customAnswers[tabIndex] ?? ""}
            disabled={isBusy}
            oninput={(event) => {
              customAnswers = customAnswers.map((value, index) =>
                index === tabIndex ? event.currentTarget.value : value,
              );
            }}
          />
        {/if}
      </div>
    </div>
  {/if}

  <div class="mt-2 flex flex-wrap gap-1.5">
    {#if !rejected}
      {#if questions.length > 1 && !inConfirmTab}
        <button
          class="btn-secondary ml-auto px-1.5 py-0.5 text-[10px]"
          disabled={isBusy}
          onclick={goToNextQuestion}
        >
          Next
        </button>
      {/if}
      {#if showSubmit}
        <button
          class="btn-primary ml-auto px-2 py-0.5 text-[11px]"
          disabled={isBusy}
          onclick={submitAll}
        >
          {saving === "reply"
            ? questions.length > 1
              ? "Confirming..."
              : "Submitting..."
            : submitActionLabel}
        </button>
      {/if}
    {:else}
      <div class="text-xs text-dark-fg3">No response needed.</div>
    {/if}
  </div>
</div>
