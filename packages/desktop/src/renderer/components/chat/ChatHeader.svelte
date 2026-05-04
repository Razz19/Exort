<script lang="ts">
  import { SquarePen } from "lucide-svelte";

  let {
    workspaceTitle,
    onNewSession,
    newSessionDisabled,
  } = $props<{
    workspaceTitle: string;
    onNewSession: () => void;
    newSessionDisabled: boolean;
  }>();
</script>

<div class="border-b border-dark-border px-4 py-1">
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      <h2 class="truncate text-[15px] p-1 font-semibold text-dark-fg0">
        {workspaceTitle}
      </h2>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded text-dark-fg3 transition-colors hover:bg-dark-bg1/60 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
        disabled={newSessionDisabled}
        onclick={onNewSession}
        title="Start a new session"
        aria-label="Start a new session"
      >
        <SquarePen class="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
