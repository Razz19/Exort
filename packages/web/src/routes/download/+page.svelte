<script lang="ts">
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
  import RunLocallySection from "$lib/components/landing/RunLocallySection.svelte";
  import SiteNav from "$lib/components/landing/SiteNav.svelte";
</script>

<svelte:head>
  <title>Download Exort</title>
  <meta
    name="description"
    content="Download Exort for macOS, Windows, or Linux, or run it locally from the repository."
  />
</svelte:head>

<div class="relative isolate">
  <SiteNav />
  <main class="flex w-full flex-col items-stretch">
    <DownloadSection />
    <div class="mx-auto mt-16 w-full max-w-7xl">
      <p
        class="text-sm uppercase text-center tracking-[0.24em] text-gruvbox-accent-soft w-full"
      >
        Clone Exort
      </p>
      <RunLocallySection />
    </div>
  </main>
</div>
