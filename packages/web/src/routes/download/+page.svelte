<script lang="ts">
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
  import SiteNav from "$lib/components/landing/SiteNav.svelte";
</script>

<svelte:head>
  <title>Download Exort</title>
  <meta
    name="description"
    content="Download Exort for macOS, Windows, or Linux, or run it locally from the repository."
  />
</svelte:head>

<div class="relative isolate min-h-screen bg-gruvbox-bg text-gruvbox-text">
  <SiteNav />

  <main class="pt-8 sm:pt-12">
    <DownloadSection />
  </main>
</div>
