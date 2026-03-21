<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    Hammer,
    Terminal,
    Upload,
  } from "lucide-svelte";
  import type { ArduinoOutputRun } from "../lib/types";

  let {
    expanded = false,
    run = null,
    heightPct = 20,
    onToggle = () => {},
  } = $props<{
    expanded: boolean;
    run: ArduinoOutputRun | null;
    heightPct: number;
    onToggle: (nextExpanded: boolean) => void;
  }>();

  let outputContainerEl = $state<HTMLDivElement | null>(null);
  let runningProgressPct = $state(0);

  let runLogCount = $derived(run?.logs.length ?? 0);
  let operationLabel = $derived.by(() => {
    if (run?.operation === "upload") return "Upload";
    return "Compile";
  });
  let statusLabel = $derived.by(() => {
    if (!run) return "Idle";
    if (run.status === "running") return "Running";
    if (run.status === "ok") return "Success";
    if (run.status === "cancelled") return "Cancelled";
    return "Failed";
  });
  let statusClass = $derived.by(() => {
    if (!run) return "text-dark-fg3 border-dark-border";
    if (run.status === "running")
      return "text-dark-yellow border-dark-yellow/40";
    if (run.status === "ok") return "text-dark-green border-dark-green/40";
    if (run.status === "cancelled")
      return "text-dark-orange border-dark-orange/40";
    return "text-dark-red border-dark-red/40";
  });
  let messageClass = $derived.by(() => {
    if (!run) return "text-dark-fg3";
    if (run.status === "running") return "text-dark-yellow";
    if (run.status === "ok") return "text-dark-green";
    if (run.status === "cancelled") return "text-dark-orange";
    return "text-dark-red";
  });
  let progressPct = $derived.by(() => {
    if (!run) return 0;
    if (run.status === "running") return runningProgressPct;
    return 100;
  });

  $effect(() => {
    if (!expanded || !outputContainerEl || runLogCount === 0) return;

    queueMicrotask(() => {
      if (!outputContainerEl) return;
      outputContainerEl.scrollTop = outputContainerEl.scrollHeight;
    });
  });

  $effect(() => {
    if (!run) {
      runningProgressPct = 0;
      return;
    }

    if (run.status !== "running") {
      runningProgressPct = 100;
      return;
    }

    const startedAtMs = Date.parse(run.startedAt);
    runningProgressPct = 6;

    const timer = window.setInterval(() => {
      const elapsedMs = Math.max(0, Date.now() - startedAtMs);
      const next = Math.min(94, 6 + 88 * (1 - Math.exp(-elapsedMs / 7000)));
      runningProgressPct = Math.max(runningProgressPct, next);
    }, 150);

    return () => {
      window.clearInterval(timer);
    };
  });
</script>

<div
  class={`border-t border-dark-border bg-dark-bgS ${expanded ? "min-h-0" : ""}`}
  style={expanded ? `height: ${heightPct}%` : undefined}
>
  {#if expanded}
    <div class="flex h-full min-h-0 flex-col">
      <div
        class="flex items-center justify-between border-b border-dark-border px-3 py-2"
      >
        <div class="flex min-w-0 items-center gap-2 text-xs text-dark-fg1">
          {#if run?.operation === "upload"}
            <Upload class="h-3.5 w-3.5 text-dark-aqua" />
          {:else}
            <Hammer class="h-3.5 w-3.5 text-dark-aqua" />
          {/if}
          <span class="truncate font-medium">{operationLabel} Output</span>
          <span class={`rounded border px-1.5 py-0.5 ${statusClass}`}
            >{statusLabel}</span
          >
          {#if run && run.exitCode !== undefined && run.exitCode !== null}
            <span class="text-dark-fg3">exit {run.exitCode}</span>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <div
            class="relative h-2.5 w-28 overflow-hidden rounded-full border border-dark-border bg-dark-bg"
            title={`${operationLabel} progress`}
            aria-label={`${operationLabel} progress`}
          >
            {#if run?.status === "running"}
              <div
                class="h-full bg-dark-yellow transition-[width] duration-150"
                style={`width: ${progressPct}%`}
              ></div>
            {:else if run?.status === "ok"}
              <div
                class="h-full bg-dark-green"
                style={`width: ${progressPct}%`}
              ></div>
            {:else if run?.status === "cancelled"}
              <div
                class="h-full bg-dark-orange"
                style={`width: ${progressPct}%`}
              ></div>
            {:else if run?.status === "error"}
              <div
                class="h-full bg-dark-red"
                style={`width: ${progressPct}%`}
              ></div>
            {/if}
          </div>

          <button
            class="inline-flex h-6 w-6 items-center justify-center rounded border border-dark-border text-dark-fg2 transition-colors hover:border-primary-500 hover:text-primary-300"
            onclick={() => onToggle(false)}
            title="Collapse output window"
            aria-label="Collapse output window"
          >
            <ChevronDown class="h-4 w-4" />
          </button>
        </div>
      </div>

      {#if run}
        <!-- <div class={`border-b border-dark-border px-3 py-1.5 text-xs ${messageClass}`}
        >
          {run.message ?? "Waiting for compile/upload output..."}
        </div> -->

        {#if run.command && run.command.length > 0}
          <div
            class="border-b border-dark-border px-3 py-1.5 font-mono text-[11px] text-dark-fg3"
          >
            {run.command.join(" ")}
          </div>
        {/if}

        <div
          class="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-xs bg-dark-bg"
          bind:this={outputContainerEl}
        >
          {#if run.logs.length === 0}
            <div class="text-dark-fg3">Waiting for command output...</div>
          {:else}
            {#each run.logs as entry (entry.id)}
              <div class="whitespace-pre-wrap break-words">
                <span
                  class={entry.stream === "stderr"
                    ? "text-dark-red2"
                    : "text-dark-blue2"}
                  >[{entry.stream}]
                </span>
                <span class="text-dark-fg1">{entry.chunk}</span>
              </div>
            {/each}
          {/if}
        </div>
      {:else}
        <div
          class="flex min-h-0 flex-1 items-center justify-center px-4 text-sm text-dark-fg3"
        >
          No compile or upload output yet.
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex h-8 items-center justify-between px-3">
      <div class="flex min-w-0 items-center gap-2 text-xs text-dark-fg2">
        <Terminal class="h-3.5 w-3.5 text-dark-aqua2" />
        <span class="truncate font-medium">Output Window</span>
        {#if run}
          <span class="truncate text-dark-fg3"
            >{operationLabel}: {statusLabel}</span
          >
        {/if}
      </div>

      <button
        class="inline-flex h-6 w-6 items-center justify-center rounded border border-dark-border text-dark-fg2 transition-colors hover:border-primary-500 hover:text-primary-300"
        onclick={() => onToggle(true)}
        title="Expand output window"
        aria-label="Expand output window"
      >
        <ChevronUp class="h-4 w-4" />
      </button>
    </div>
  {/if}
</div>
