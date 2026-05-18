<script lang="ts">
  import SiteNav from "$lib/components/landing/SiteNav.svelte";

  let { error, status }: { error: App.Error; status: number } = $props();

  const isNotFound = status === 404;
</script>

<div class="relative isolate flex min-h-screen flex-col">
  <SiteNav />

  <main
    class="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 pb-16 pt-10 md:px-6 lg:px-8"
  >
    <section
      class="relative flex w-fit max-w-full flex-col items-center gap-5 bg-gruvbox-ink/90 p-6 text-center sm:p-8 lg:p-10"
    >
      <p
        class="font-mono text-xs uppercase tracking-[0.24em] text-gruvbox-muted"
      >
        Error {status}
      </p>

      <h1
        class="font-heading text-2xl font-bold leading-tight text-gruvbox-fg0 sm:text-4xl"
      >
        {isNotFound ? "Page not found" : "Something went wrong"}
      </h1>

      <p class="max-w-2xl text-sm leading-7 text-gruvbox-muted sm:text-base">
        {#if isNotFound}
          Page not found.
        {:else}
          {error?.message ??
            "An unexpected error occurred while loading this page."}
        {/if}
      </p>

      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <a
          href="/"
          class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full bg-gruvbox-ink-strong px-3 py-3 text-sm font-medium backdrop-blur transition motion-reduce:transition-none sm:px-6 sm:py-3.5"
        >
          <span
            class="absolute inset-0 translate-x-full bg-gruvbox-green transition-transform duration-300 ease-out group-hover:translate-x-0"
            aria-hidden="true"
          ></span>
          <span
            class="relative z-10 transition-colors duration-300 group-hover:text-gruvbox-ink"
          >
            Back to home
          </span>
        </a>
      </div>
    </section>
  </main>
</div>
