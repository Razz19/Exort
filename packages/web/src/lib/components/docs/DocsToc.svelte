<script lang="ts">
  import { onMount } from "svelte";

  interface TocItem {
    id: string;
    text: string;
    level: number;
  }

  interface Props {
    contentSelector?: string;
    headingSelector?: string;
    compact?: boolean;
    bare?: boolean;
  }

  let {
    contentSelector = ".docs-prose",
    headingSelector = "h2, h3",
    compact = false,
    bare = false,
  }: Props = $props();

  let items = $state<TocItem[]>([]);
  let activeId = $state("");

  const getActiveItem = () => items.find((item) => item.id === activeId) ?? items[0];

  const updateActiveFromHash = () => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      activeId = decodeURIComponent(hash);
    }
  };

  onMount(() => {
    let intersectionObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const readHeadings = () => {
      const contentRoot = document.querySelector(contentSelector);
      if (!contentRoot) {
        items = [];
        activeId = "";
        return;
      }

      const headings = Array.from(
        contentRoot.querySelectorAll<HTMLElement>(headingSelector),
      ).filter((heading) => heading.id.length > 0);

      items = headings.map((heading) => {
        const level = Number(heading.tagName.slice(1));
        return {
          id: heading.id,
          text: heading.textContent?.trim() || heading.id,
          level,
        };
      });

      if (!activeId && items.length > 0) {
        activeId = items[0].id;
      }

      updateActiveFromHash();

      intersectionObserver?.disconnect();
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            );

          if (visible.length > 0) {
            activeId = (visible[0].target as HTMLElement).id;
            return;
          }

          const topVisible = entries
            .filter((entry) => entry.boundingClientRect.top <= 120)
            .sort(
              (a, b) => b.boundingClientRect.top - a.boundingClientRect.top,
            );

          if (topVisible.length > 0) {
            activeId = (topVisible[0].target as HTMLElement).id;
          }
        },
        {
          root: null,
          rootMargin: "-20% 0px -65% 0px",
          threshold: [0, 1],
        },
      );

      for (const heading of headings) {
        intersectionObserver.observe(heading);
      }
    };

    const contentRoot = document.querySelector(contentSelector);
    if (contentRoot) {
      mutationObserver = new MutationObserver(() => {
        readHeadings();
      });

      mutationObserver.observe(contentRoot, {
        childList: true,
        subtree: true,
      });
    }

    readHeadings();
    window.addEventListener("hashchange", updateActiveFromHash);

    return () => {
      window.removeEventListener("hashchange", updateActiveFromHash);
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  });
</script>

{#if items.length > 0}
  {#if bare}
    <ul class="space-y-1 border-l border-white/10 pl-3">
      {#each items as item}
        <li>
          <a
            href={`#${item.id}`}
            class={`block px-2 py-1 text-sm transition-colors duration-150 ${
              activeId === item.id
                ? "text-gruvbox-fg0"
                : "text-gruvbox-muted/70 hover:text-gruvbox-blue"
            } ${item.level >= 3 ? "ml-4" : ""}`}
            aria-current={activeId === item.id ? "location" : undefined}
          >
            {item.text}
          </a>
        </li>
      {/each}
    </ul>
  {:else if compact}
    <details class="group border-b border-white/10 bg-[rgba(29,32,33,0.5)]">
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left [&::-webkit-details-marker]:hidden"
      >
        <span class="flex min-w-0 items-center gap-3">
          <span
            class="shrink-0 text-[0.72rem] uppercase tracking-[0.24em] text-gruvbox-muted/80"
          >
            On this page
          </span>
          <span class="text-gruvbox-muted/60">›</span>
          <span class="truncate text-sm text-gruvbox-fg0">
            {getActiveItem()?.text ?? "Overview"}
          </span>
        </span>

        <svg
          class="h-4 w-4 shrink-0 text-gruvbox-muted/70 transition-transform duration-150 group-open:rotate-180"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </summary>

      <div class="px-4 pb-4">
        <ul class="space-y-1 border-l border-white/10 pl-3">
          {#each items as item}
            <li>
              <a
                href={`#${item.id}`}
                class={`block px-2 py-1 text-sm transition-colors duration-150 ${
                  activeId === item.id
                    ? "text-gruvbox-fg0"
                    : "text-gruvbox-muted/70 hover:text-gruvbox-blue"
                } ${item.level >= 3 ? "ml-4" : ""}`}
                aria-current={activeId === item.id ? "location" : undefined}
              >
                {item.text}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </details>
  {:else}
    <aside class="sticky top-24">
      <p class="mb-4 text-sm text-gruvbox-fg1">On this page</p>
      <ul class="space-y-1">
        {#each items as item}
          <li>
            <a
              href={`#${item.id}`}
              class={`block px-2 py-1 text-sm transition-colors duration-150 ${
                activeId === item.id
                  ? "relative text-gruvbox-text after:absolute after:left-0 after:top-0 after:h-full after:w-0.5 after:bg-gruvbox-blue"
                  : "text-gruvbox-muted/60 hover:font-semibold hover:text-gruvbox-blue"
              } ${item.level >= 3 ? "ml-4" : ""}`}
              aria-current={activeId === item.id ? "location" : undefined}
            >
              {item.text}
            </a>
          </li>
        {/each}
      </ul>
    </aside>
  {/if}
{/if}
