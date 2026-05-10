<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title = "EXORT",
    frameClass = "",
    contentClass = "",
    children,
  }: {
    title?: string;
    frameClass?: string;
    contentClass?: string;
    children?: Snippet;
  } = $props();
</script>

<div
  class={`relative flex h-full min-h-0 flex-col overflow-hidden bg-gruvbox-bg/20 shadow-card-md ${frameClass}`.trim()}
  style="border-radius: 14px !important;"
>
  <div
    class="absolute inset-x-0 top-0 h-px bg-gruvbox-muted/30"
    aria-hidden="true"
  ></div>
  <div
    class="relative flex h-full min-h-0 flex-col overflow-hidden bg-gruvbox-bg"
    style="border-radius: 13px !important;"
  >
    <div
      class="relative shrink-0 flex items-center justify-center bg-gruvbox-ink/40 uppercase tracking-[0.24em] text-gruvbox-muted sm:px-5 py-1 sm:py-3"
    >
      <div
        class="absolute left-4 flex items-center gap-1.5 sm:gap-2 sm:left-5"
        aria-hidden="true"
      >
        <span
          class="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 bg-gruvbox-accent shadow-outline-subtle"
          style="border-radius: 999px !important;"
        ></span>
        <span
          class="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 bg-gruvbox-accent-soft shadow-outline-subtle"
          style="border-radius: 999px !important;"
        ></span>
        <span
          class="h-1.5 w-1.5 sm:h-2.5 sm:w-2.5 bg-gruvbox-green shadow-outline-subtle"
          style="border-radius: 999px !important;"
        ></span>
      </div>
      <span
        class="truncate px-16 text-center text-[8px] sm:text-xs text-gruvbox-fg1/30 sm:px-24"
      >
        {title}
      </span>
    </div>
    <div class={`flex-1 min-h-0 bg-gruvbox-ink-strong ${contentClass}`.trim()}>
      {@render children?.()}
    </div>
  </div>
</div>
