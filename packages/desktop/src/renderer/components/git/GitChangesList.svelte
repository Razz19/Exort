<script lang="ts">
  import { getIcon } from 'material-file-icons';
  import { ChevronRight, FileDiff } from 'lucide-svelte';
  import type { GitChangeStatus } from '../../../shared/git';

  export type GitChangeRow = {
    path: string;
    status: GitChangeStatus | null;
    additions: number;
    deletions: number;
  };

  let { changes, onOpenDiff = () => {} } = $props<{
    changes: GitChangeRow[];
    onOpenDiff: (row: GitChangeRow) => void;
  }>();

  function labelFromPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] ?? filePath;
  }

  function directoryFromPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    parts.pop();
    return parts.join('/');
  }

  function getIconDataUri(filePath: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(getIcon(labelFromPath(filePath)).svg)}`;
  }

  function statusLabel(status: GitChangeStatus | null): string {
    switch (status) {
      case 'added':
        return 'Added';
      case 'deleted':
        return 'Deleted';
      case 'renamed':
        return 'Renamed';
      case 'untracked':
        return 'Added';
      case 'conflicted':
        return 'Conflict';
      case 'modified':
        return 'Modified';
      default:
        return 'Changed';
    }
  }

  function statusColor(status: GitChangeStatus | null): string {
    switch (status) {
      case 'added':
      case 'untracked':
        return 'text-dark-green2';
      case 'deleted':
        return 'text-dark-red2';
      case 'conflicted':
        return 'text-dark-orange2';
      default:
        return 'text-dark-fg3';
    }
  }
</script>

{#if changes.length === 0}
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-dark-bg1 text-dark-fg3">
      <FileDiff class="h-5 w-5" />
    </span>
    <p class="text-xs text-dark-fg3">No changes to show.</p>
  </div>
{:else}
  <ul class="divide-y divide-dark-border/60">
    {#each changes as row (row.path)}
      <li>
        <button
          type="button"
          class="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-dark-bg1/60"
          onclick={() => onOpenDiff(row)}
          title={row.path}
        >
          <img
            class="h-4 w-4 shrink-0 opacity-90"
            src={getIconDataUri(row.path)}
            alt=""
            aria-hidden="true"
            draggable="false"
          />
          <span class="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span class="truncate text-[13px] text-dark-fg1">{labelFromPath(row.path)}</span>
            {#if directoryFromPath(row.path)}
              <span class="truncate text-[11px] text-dark-fg4">{directoryFromPath(row.path)}</span>
            {/if}
          </span>

          <span class={`shrink-0 text-[11px] font-medium ${statusColor(row.status)}`}>
            {statusLabel(row.status)}
          </span>
          <span class="shrink-0 font-mono text-[11px] text-dark-green">+{row.additions}</span>
          <span class="shrink-0 font-mono text-[11px] text-dark-red2">-{row.deletions}</span>
          <ChevronRight
            class="h-3.5 w-3.5 shrink-0 text-dark-fg3 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </button>
      </li>
    {/each}
  </ul>
{/if}
