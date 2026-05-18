<script lang="ts">
  import { Search } from "lucide-svelte";
  import { onMount } from "svelte";
  import { openDocsSearch } from "$lib/components/docs/docs-search-state";

  let isMac = $state(false);
  const shortcutLabel = $derived(isMac ? "⌘K" : "Ctrl K");

  onMount(() => {
    isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  });
</script>

<button
  type="button"
  class="inline-flex h-10 w-10 items-center justify-center text-gruvbox-text transition-colors duration-200 hover:border-gruvbox-orange/40 bg-gruvbox-ink hover:text-gruvbox-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gruvbox-orange/50 motion-reduce:transition-none lg:h-auto lg:w-auto lg:justify-start lg:gap-3 :bg-gruvbox-ink lg:p-2 lg:text-gruvbox-fg1 lg:hover:bg-gruvbox-surface lg:hover:text-gruvbox-fg0 lg:focus-visible:ring-0 lg:focus-visible:bg-gruvbox-surface-strong"
  aria-label="Search docs"
  onclick={openDocsSearch}
>
  <Search size={22} strokeWidth={2} />
  <span class="hidden text-sm lg:inline">Search</span>
  <span
    class="hidden text-xs uppercase tracking-[0.14em] text-gruvbox-muted/90 xl:inline"
  >
    {shortcutLabel}
  </span>
</button>
