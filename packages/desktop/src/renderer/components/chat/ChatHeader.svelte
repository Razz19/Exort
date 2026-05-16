<script lang="ts">
  import { SquarePen } from "lucide-svelte";

  type ChatHeaderContextUsage = {
    hasData: boolean;
    usedTokens: number;
    percentage: number;
    rawPercentage: number;
    contextLimit: number;
    outputLimit: number;
  } | null;

  const RING_RADIUS = 8;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  let {
    workspaceTitle,
    contextUsage = null,
    onNewSession,
    newSessionDisabled,
  } = $props<{
    workspaceTitle: string;
    contextUsage?: ChatHeaderContextUsage;
    onNewSession: () => void;
    newSessionDisabled: boolean;
  }>();

  let ringPercent = $derived(
    Math.min(Math.max(contextUsage?.percentage ?? 0, 0), 100),
  );
  let ringDashOffset = $derived.by(() => {
    if (!contextUsage?.hasData) return RING_CIRCUMFERENCE;
    return RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * ringPercent) / 100;
  });
  let hasContextData = $derived(!!contextUsage?.hasData);
  let isCritical = $derived(
    !!contextUsage?.hasData && contextUsage.rawPercentage >= 90,
  );
  let isWarn = $derived(
    !!contextUsage?.hasData &&
      contextUsage.rawPercentage >= 75 &&
      contextUsage.rawPercentage < 90,
  );
  let isNormal = $derived(
    !!contextUsage?.hasData && contextUsage.rawPercentage < 75,
  );

  function formatTokens(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return `${Math.round(value)}`;
  }
</script>

<div class="border-b border-dark-border px-4 py-1">
  <div class="flex items-center justify-between gap-2">
    <div class="min-w-0">
      <div class="inline-flex items-center gap-2">
        <h2
          class="min-w-0 truncate text-[15px] font-semibold leading-6 text-dark-fg0"
        >
          {workspaceTitle}
        </h2>

        <div class="relative group/context-indicator">
          <button
            type="button"
            class="relative top-[3px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-dark-fg3 focus:outline-none
            focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Context usage"
          >
            <svg viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="text-dark-fg4"
              />
              <circle
                cx="12"
                cy="12"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                transform="rotate(-90 12 12)"
                stroke-dasharray={RING_CIRCUMFERENCE}
                stroke-dashoffset={ringDashOffset}
                class:text-dark-fg4={!hasContextData}
                class:text-dark-fg1={isNormal}
                class:text-dark-yellow2={isWarn}
                class:text-dark-red2={isCritical}
              />
            </svg>
          </button>

          <div
            class="pointer-events-none absolute left-1/2 top-[calc(100%+0.35rem)] z-20 w-max max-w-[18rem] -translate-x-1/2
            rounded-md border border-dark-border bg-dark-bgS px-2 py-1 text-[11px] text-dark-fg2 opacity-0 shadow-lg
            transition-opacity duration-150 group-hover/context-indicator:opacity-100 group-focus-within/context-indicator:opacity-100"
            role="tooltip"
          >
            {#if contextUsage?.hasData}
              <div>Used: {formatTokens(contextUsage.usedTokens)} tokens</div>
              <div>
                Context limit: {formatTokens(contextUsage.contextLimit)} tokens
              </div>
              <div>
                Output limit: {formatTokens(contextUsage.outputLimit)} tokens
              </div>
              <div>Usage: {contextUsage.rawPercentage.toFixed(1)}%</div>
            {:else}
              <div>Context data is not available yet.</div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded text-dark-fg3 transition-colors
         hover:bg-dark-bg1/60 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
         disabled:opacity-40"
        disabled={newSessionDisabled}
        onclick={onNewSession}
        title="Start a new session"
        aria-label="Start a new session"
      >
        <SquarePen class="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
