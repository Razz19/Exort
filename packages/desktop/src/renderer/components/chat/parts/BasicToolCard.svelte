<script lang="ts">
  import { ChevronDown, ChevronUp } from "lucide-svelte";

  import type { Component, Snippet } from "svelte";

  let {
    icon: Icon,
    title,
    subtitle,
    args = [],
    status = "running",
    defaultOpen = false,
    locked = false,
    children,
  } = $props<{
    icon: Component;
    title: string;
    subtitle?: string;
    args?: string[];
    status?: "running" | "ok" | "error";
    defaultOpen?: boolean;
    locked?: boolean;
    children?: Snippet;
  }>();

  let expanded = $state(false);
  let initialized = $state(false);

  let statusLabel = $derived.by(() => {
    if (status === "running") return "Running";
    if (status === "ok") return "Done";
    return "Failed";
  });

  let statusClass = $derived.by(() => {
    if (status === "running") return "border-dark-yellow/50 text-dark-yellow";
    if (status === "ok") return "border-dark-aqua/50 text-dark-aqua";
    return "border-dark-red/50 text-dark-red2";
  });

  function toggle(): void {
    if (locked) return;
    expanded = !expanded;
  }

  $effect(() => {
    if (initialized) return;
    initialized = true;
    expanded = defaultOpen;
  });
</script>

<div class="overflow-hidden rounded-md">
  <button
    class="flex w-full items-center gap-2 px-2.5 py-2 text-left"
    onclick={toggle}
  >
    <Icon class="h-4 w-4 shrink-0 text-dark-fg2" />
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium text-dark-fg1">{title}</div>
      {#if subtitle}
        <div class="truncate text-[11px] text-dark-fg3">{subtitle}</div>
      {/if}
      {#if args.length > 0}
        <div class="mt-1 flex flex-wrap gap-1">
          {#each args as arg (`arg:${arg}`)}
            <span
              class="rounded border border-dark-border bg-dark-bgS px-1.5 py-0.5 text-[10px] text-dark-fg3"
            >
              {arg}
            </span>
          {/each}
        </div>
      {/if}
    </div>
    <span class={`rounded border px-1.5 py-0.5 text-[10px] ${statusClass}`}>
      {statusLabel}
    </span>
    {#if expanded}
      <ChevronUp class="h-3.5 w-3.5 text-dark-fg3" />
    {:else}
      <ChevronDown class="h-3.5 w-3.5 text-dark-fg3" />
    {/if}
  </button>

  {#if expanded}
    <div class="px-2.5 pb-0.5 pt-0">
      {@render children?.()}
    </div>
  {/if}
</div>
