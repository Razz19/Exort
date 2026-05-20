<script lang="ts">
  let { compact = false } = $props<{ compact?: boolean }>();
</script>

<div
  class={compact
    ? "flex items-center justify-center p-1"
    : "flex min-h-0 flex-1 items-center justify-center p-4"}
>
  <div
    class="inline-flex items-center rounded-lg px-3 py-3"
    role="status"
    aria-live="polite"
    aria-label="Loading"
  >
    <span class="flex items-center gap-1.5" aria-hidden="true">
      <span
        class="h-2 w-2 rounded-full bg-dark-fg4 animate-bounce"
        style="animation-delay: 0ms;"
      ></span>
      <span
        class="h-2 w-2 rounded-full bg-dark-fg4 animate-bounce"
        style="animation-delay: 120ms;"
      ></span>
      <span
        class="h-2 w-2 rounded-full bg-dark-fg4 animate-bounce"
        style="animation-delay: 240ms;"
      ></span>
    </span>
  </div>
</div>
