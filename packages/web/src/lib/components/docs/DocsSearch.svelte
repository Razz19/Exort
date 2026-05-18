<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { FileText, Search, X } from "lucide-svelte";
  import {
    docsSearchOpen,
    closeDocsSearch,
    openDocsSearch,
  } from "$lib/components/docs/docs-search-state";
  import { getDocsCatalog } from "$lib/docs/registry";

  import type { DocsEntry } from "$lib/docs/registry";

  interface RankedResult {
    doc: DocsEntry;
    score: number;
  }

  interface GroupedResults {
    section: string;
    items: RankedResult[];
  }

  let query = $state("");
  let docs = $state<DocsEntry[]>([]);
  let inputEl = $state<HTMLInputElement | null>(null);

  const normalizedQuery = $derived(query.trim().toLowerCase());
  const queryTokens = $derived(
    normalizedQuery
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );

  const matchedDocs = $derived.by(() => {
    if (docs.length === 0) {
      return [] as RankedResult[];
    }

    if (queryTokens.length === 0) {
      return [] as RankedResult[];
    }

    const ranked = docs
      .map((doc) => {
        const score = scoreDoc(doc, queryTokens);
        return { doc, score };
      })
      .filter((result) => result.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }

        if (a.doc.order !== b.doc.order) {
          return a.doc.order - b.doc.order;
        }

        return a.doc.title.localeCompare(b.doc.title);
      });

    return ranked;
  });

  const groupedResults = $derived.by(() => {
    const bySection = new Map<string, RankedResult[]>();

    for (const result of matchedDocs) {
      const section = result.doc.section || "General";
      const existing = bySection.get(section);
      if (existing) {
        existing.push(result);
      } else {
        bySection.set(section, [result]);
      }
    }

    return Array.from(bySection.entries())
      .map(
        ([section, items]): GroupedResults => ({
          section,
          items,
        }),
      )
      .sort((a, b) => a.section.localeCompare(b.section));
  });

  const totalResults = $derived(matchedDocs.length);
  const hasQuery = $derived(normalizedQuery.length > 0);

  onMount(() => {
    void hydrateDocs();

    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
        return;
      }

      if (event.key === "Escape" && $docsSearchOpen) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  $effect(() => {
    if (!browser || !$docsSearchOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = window.requestAnimationFrame(() => {
      inputEl?.focus();
    });

    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
    };
  });

  async function hydrateDocs() {
    const { docs: docsCatalog } = await getDocsCatalog();
    docs = docsCatalog;
  }

  function openSearch() {
    query = "";
    openDocsSearch();
  }

  function closeSearch() {
    closeDocsSearch();
    query = "";
  }

  function toResultCopy(doc: DocsEntry) {
    if (doc.description && doc.description.length > 0) {
      return doc.description;
    }

    return doc.href === "/docs" ? "Introduction to Exort docs." : doc.href;
  }

  function scoreDoc(doc: DocsEntry, tokens: string[]) {
    const title = doc.title.toLowerCase();
    const description = (doc.description ?? "").toLowerCase();
    const section = doc.section.toLowerCase();
    const slugWords = doc.slug.replaceAll("/", " ").toLowerCase();
    const haystack = `${title} ${description} ${section} ${slugWords}`.trim();

    let score = 0;

    for (const token of tokens) {
      if (!haystack.includes(token)) {
        return -1;
      }

      if (title.startsWith(token)) {
        score += 10;
      } else if (title.includes(token)) {
        score += 8;
      } else if (description.includes(token)) {
        score += 6;
      } else if (section.includes(token)) {
        score += 4;
      } else {
        score += 2;
      }
    }

    if (doc.href === "/docs") {
      score += 0.25;
    }

    return score;
  }
</script>

{#if $docsSearchOpen}
  <div
    class="fixed inset-0 z-[80] bg-gruvbox-bg/85 p-4 pt-20 backdrop-blur-[4px] sm:p-8 sm:pt-24"
    role="presentation"
    onclick={closeSearch}
  >
    <div
      class="mx-auto flex max-h-[calc(100vh-7rem)] w-full max-w-5xl flex-col bg-gruvbox-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <div class="p-4 sm:p-6">
        <div class="flex items-center gap-3 bg-gruvbox-bg px-4 py-3">
          <Search
            size={20}
            strokeWidth={2.1}
            class="shrink-0 text-gruvbox-fg1"
          />
          <input
            bind:this={inputEl}
            bind:value={query}
            type="text"
            placeholder="Search docs..."
            class="w-full bg-transparent text-2xl text-gruvbox-fg0 placeholder:text-gruvbox-muted/70 focus:outline-none"
            autocomplete="off"
            spellcheck={false}
            aria-label="Search docs"
          />
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center text-gruvbox-muted transition-colors duration-150 hover:bg-gruvbox-surface hover:text-gruvbox-fg0 focus-visible:bg-gruvbox-surface focus-visible:outline-none"
            aria-label="Close search"
            onclick={closeSearch}
          >
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-4 pb-5 sm:px-6 sm:pb-6">
        {#if hasQuery}
          <p
            class="pb-4 font-mono text-xs tracking-[0.18em] text-gruvbox-muted/90"
          >
            {totalResults} result{totalResults === 1 ? "" : "s"} for "{normalizedQuery}"
          </p>

          {#if totalResults === 0}
            <div class="bg-gruvbox-bg px-4 py-5 text-sm text-gruvbox-muted">
              No matches found.
            </div>
          {:else}
            <div class="flex flex-col gap-4">
              {#each groupedResults as group}
                <section class="overflow-hidden bg-gruvbox-bg">
                  <header
                    class="flex items-center gap-3 bg-gruvbox-ink px-4 py-3 text-gruvbox-fg0"
                  >
                    <FileText
                      size={18}
                      strokeWidth={1.9}
                      class="shrink-0 text-gruvbox-muted"
                    />
                    <h2 class="text-[1.05rem] font-heading tracking-[0.08em]">
                      {group.section}
                    </h2>
                  </header>

                  <div>
                    {#each group.items as result}
                      <a
                        href={result.doc.href}
                        class="group block px-4 py-3 transition-colors duration-150 hover:bg-gruvbox-surface focus-visible:bg-gruvbox-surface focus-visible:outline-none"
                        onclick={closeSearch}
                      >
                        <p
                          class="font-mono text-[1.3rem] font-semibold leading-tight text-gruvbox-fg0"
                        >
                          {result.doc.title}
                        </p>
                        <p class="mt-1 text-sm text-gruvbox-muted/95">
                          {toResultCopy(result.doc)}
                        </p>
                      </a>
                    {/each}
                  </div>
                </section>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
