<script lang="ts">
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
</script>

<svelte:head>
  <title>Download Exort</title>
  <meta
    name="description"
    content="Download Exort for macOS, Windows, or Linux, or run it locally from the repository."
  />
</svelte:head>

<div
  class="site-shell min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
>
  <nav class="site-nav sticky top-0 z-30 bg-[color:var(--color-nav)]/80 backdrop-blur-2xl">
    <div
      class="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
    >
      <a href="/" class="flex items-center gap-3">
        <img
          src="/exort-logo.png"
          alt="Exort"
          class="h-12 w-12 object-contain"
        />
        <span class="brand-wordmark pt-2 font-mono">Exort</span>
      </a>

      <div class="flex items-center gap-4">
        <a
          href="/"
          class="text-sm text-[color:var(--color-text-muted)] transition hover:text-white"
        >
          Home
        </a>
        <a
          href="https://github.com/Razz19/Exort"
          target="_blank"
          rel="noreferrer"
          class="text-sm text-[color:var(--color-text-muted)] transition hover:text-white"
        >
          View on GitHub
        </a>
      </div>
    </div>
  </nav>

  <main class="pt-8 sm:pt-12">
    <DownloadSection />
  </main>
</div>
