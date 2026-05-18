<script lang="ts">
  import DocsSearch from '$lib/components/docs/DocsSearch.svelte';
  import DocsNav from '$lib/components/docs/DocsNav.svelte';

  let { children } = $props();
</script>

<div class="relative isolate">
  <DocsNav />
  {@render children()}
  <DocsSearch />
</div>
