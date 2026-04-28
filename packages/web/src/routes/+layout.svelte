<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <script
    defer
    src="/script.js"
    data-website-id="73a79857-bd77-4c8e-ac64-7df7bbceae53"
  ></script>
</svelte:head>

{@render children()}
