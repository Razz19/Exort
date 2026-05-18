<script lang="ts">
  import DocsSidebarSections from "$lib/components/docs/DocsSidebarSections.svelte";
  import DocsToc from "$lib/components/docs/DocsToc.svelte";
  import { docsCodeCopy } from "$lib/components/docs/actions/codeCopy";
  import { loadDocComponent } from "$lib/docs/registry";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  let mobileMenuMode = $state<"nav" | "toc">("nav");
  let mobileMenuWrap: HTMLElement | null = null;
  let sidebarWrap: HTMLElement | null = null;
  let articleWrap: HTMLElement | null = null;
  let tocWrap: HTMLElement | null = null;

  const handleMobileMenuToggle = (event: Event) => {
    const target = event.currentTarget as HTMLDetailsElement;
    if (target.open) {
      mobileMenuMode = "nav";
    }
  };
</script>

<svelte:head>
  <title>{data.doc.title} | Exort Docs</title>
  {#if data.doc.description}
    <meta name="description" content={data.doc.description} />
  {/if}
</svelte:head>

<main
  class="grid min-h-[calc(100vh-5rem)] w-full items-start gap-0 pl-0 pr-0 pt-0 lg:grid-cols-[280px,minmax(0,1fr)] lg:gap-8 lg:pr-8 xl:grid-cols-[280px,minmax(0,1fr),240px]"
>
  <div bind:this={mobileMenuWrap} class="sticky top-20 z-20 overflow-visible lg:hidden">
    <details
      class="mobile-docs-menu relative border-b border-white bg-gruvbox-ink"
      ontoggle={handleMobileMenuToggle}
    >
      <summary
        class="flex min-w-0 cursor-pointer list-none items-center justify-between gap-4 overflow-hidden px-4 py-4 text-left [&::-webkit-details-marker]:hidden"
      >
        <span class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <span
            class="shrink-0 text-[0.72rem] uppercase tracking-[0.24em] text-gruvbox-muted/80"
          >
            Docs
          </span>
          <span class="shrink-0 text-gruvbox-muted/60">›</span>
          <span class="min-w-0 truncate text-sm text-gruvbox-fg0"
            >{data.doc.title}</span
          >
          <span class="shrink-0 text-gruvbox-muted/60">›</span>
          <span
            class="shrink-0 text-[0.72rem] uppercase tracking-[0.24em] text-gruvbox-muted/80"
          >
            On this page
          </span>
        </span>

        <svg
          class="mobile-docs-chevron h-4 w-4 shrink-0 text-gruvbox-muted/70 transition-transform duration-150"
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

      <div
        class="absolute left-0 right-0 top-full z-30 max-h-[70vh] overflow-y-auto bg-gruvbox-ink px-4 pb-4 shadow-lg"
      >
        {#if mobileMenuMode === "nav"}
          <DocsSidebarSections
            sections={data.sidebar}
            currentPath={data.doc.href}
            compact
          />
          <div class="mt-3 border-t border-white/10 pt-2">
            <button
              type="button"
              onclick={() => (mobileMenuMode = "toc")}
              class="flex w-full items-center justify-between gap-3 px-2 py-2 text-left"
            >
              <span
                class="text-[0.72rem] uppercase tracking-[0.24em] text-gruvbox-muted/80"
              >
                On this page
              </span>
              <svg
                class="h-4 w-4 shrink-0 text-gruvbox-muted/70"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        {:else}
          <div class="mt-3 border-t border-white/10 pt-2">
            <button
              type="button"
              onclick={() => (mobileMenuMode = "nav")}
              class="mb-2 flex w-full items-center justify-between gap-3 px-2 py-2 text-left"
            >
              <span
                class="text-[0.72rem] uppercase tracking-[0.24em] text-gruvbox-muted/80"
              >
                Docs Navigation
              </span>
              <svg
                class="h-4 w-4 shrink-0 text-gruvbox-muted/70"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M10 4L6 8L10 12"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <DocsToc bare />
          </div>
        {/if}
      </div>
    </details>
  </div>

  <aside
    bind:this={sidebarWrap}
    class="hidden self-stretch bg-gruvbox-ink py-5 pl-10 pr-0 lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-5rem)] lg:overflow-y-auto"
  >
    <DocsSidebarSections sections={data.sidebar} currentPath={data.doc.href} />
  </aside>

  <article
    bind:this={articleWrap}
    use:docsCodeCopy
    class="docs-prose min-w-0 px-5 pb-8 pt-6 sm:px-8 lg:px-0 lg:pb-8 lg:pt-5"
  >
    {#key data.doc.modulePath}
      {#await loadDocComponent(data.doc.modulePath) then DocComponent}
        <DocComponent />
      {:catch loadError}
        <p class="text-sm text-red-300">
          Failed to load this documentation page:
          {loadError instanceof Error ? loadError.message : "Unknown error"}
        </p>
      {/await}
    {/key}
  </article>

  <div bind:this={tocWrap} class="hidden self-start pt-5 xl:sticky xl:top-20 xl:block">
    <DocsToc />
  </div>
</main>

<style>
  :global(.docs-prose h1),
  :global(.docs-prose h2),
  :global(.docs-prose h3),
  :global(.docs-prose h4),
  :global(.docs-prose h5),
  :global(.docs-prose h6) {
    font-family:
      "Baloo Bhai 2", "SF Pro Display", "Segoe UI", "Helvetica Neue", Arial,
      sans-serif;
    text-transform: uppercase;
  }

  :global(.docs-prose h1) {
    margin: 0;
    color: #fbf1c7;
    font-size: clamp(2rem, 1.5rem + 1vw, 2.6rem);
    line-height: 1.08;
  }

  :global(.docs-prose h2) {
    margin-top: 2.25rem;
    margin-bottom: 0.75rem;
    color: #fabd2f;
    font-size: 1.35rem;
  }

  :global(.docs-prose h3) {
    margin-top: 1.5rem;
    margin-bottom: 0.6rem;
    color: #ebdbb2;
    font-size: 1.1rem;
  }

  :global(.docs-prose h2),
  :global(.docs-prose h3) {
    scroll-margin-top: 6.25rem;
  }

  :global(.docs-prose p) {
    margin: 0.8rem 0;
    color: rgba(235, 219, 178, 0.88);
    line-height: 1.7;
  }

  :global(.docs-prose ul),
  :global(.docs-prose ol) {
    margin: 0.9rem 0;
    padding-left: 1.3rem;
    color: rgba(235, 219, 178, 0.88);
  }

  :global(.docs-prose li) {
    margin: 0.35rem 0;
  }

  :global(.docs-prose a) {
    color: #83a598;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }

  :global(.docs-prose pre) {
    margin: 1rem 0;
    overflow-x: auto;
    background: rgba(29, 32, 33, 0.86);
    padding: 0.95rem 1rem;
    color: #fbf1c7;
  }

  :global(.docs-prose pre.docs-code-copy-target) {
    position: relative;
    padding-right: 3rem;
  }

  :global(.docs-prose :not(pre) > code) {
    background: rgba(29, 32, 33, 0.7);
    padding: 0.14rem 0.4rem;
    color: #fabd2f;
  }

  :global(.docs-prose blockquote) {
    margin: 1rem 0;
    border-left: 3px solid rgba(254, 128, 25, 0.5);
    padding-left: 0.8rem;
    color: rgba(213, 196, 161, 0.9);
  }

  :global(.docs-prose table) {
    width: 100%;
    margin: 1rem 0;
    border-collapse: collapse;
    border: 1px solid rgba(251, 241, 199, 0.18);
    background: rgba(29, 32, 33, 0.45);
  }

  :global(.docs-prose thead tr) {
    background: rgba(80, 73, 69, 0.45);
  }

  :global(.docs-prose th),
  :global(.docs-prose td) {
    border: 1px solid rgba(251, 241, 199, 0.14);
    padding: 0.62rem 0.78rem;
    text-align: left;
    vertical-align: top;
  }

  :global(.docs-prose th) {
    color: #ebdbb2;
    font-weight: 700;
  }

  :global(.docs-prose td) {
    color: rgba(235, 219, 178, 0.9);
  }

  :global(.docs-prose tbody tr:nth-child(even)) {
    background: rgba(40, 40, 40, 0.42);
  }

  :global(details.mobile-docs-menu[open] > summary .mobile-docs-chevron) {
    transform: rotate(180deg);
  }

  :global(.docs-prose ul) {
    list-style: none;
    padding-left: 1.5rem;
  }

  :global(.docs-prose ul li::marker) {
    content: "-  ";
  }
</style>
