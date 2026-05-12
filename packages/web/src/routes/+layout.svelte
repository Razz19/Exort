<script lang="ts">
  import '../app.css';
  import SiteFooter from '$lib/components/landing/SiteFooter.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <script
    defer
    src="/script.js"
    data-website-id="73a79857-bd77-4c8e-ac64-7df7bbceae53"
  ></script>
</svelte:head>

<div class="flex min-h-screen flex-col bg-gruvbox-bg text-gruvbox-text">
  <div class="flex-1">
    {@render children()}
  </div>
  <SiteFooter />
</div>
