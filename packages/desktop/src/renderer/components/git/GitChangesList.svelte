<script lang="ts">
  import { getIcon } from 'material-file-icons';
  import { ChevronRight } from 'lucide-svelte';
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
  <div class="px-3 py-6 text-center text-xs text-dark-fg3">No changes to show.</div>
{:else}
  <ul class="divide-y divide-dark-border">
    {#each changes as row (row.path)}
      <li>
        <button
          type="button"
          class="group flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-dark-bg1"
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
            <span class="truncate text-dark-fg1">{labelFromPath(row.path)}</span>
            {#if directoryFromPath(row.path)}
              <span class="truncate text-dark-fg3">{directoryFromPath(row.path)}</span>
            {/if}
          </span>

          <span class={`shrink-0 font-medium ${statusColor(row.status)}`}>
            {statusLabel(row.status)}
          </span>
          <span class="shrink-0 font-mono text-dark-green2">+{row.additions}</span>
          <span class="shrink-0 font-mono text-dark-red2">-{row.deletions}</span>
          <ChevronRight class="h-3.5 w-3.5 shrink-0 text-dark-fg3 opacity-0 group-hover:opacity-100" />
        </button>
      </li>
    {/each}
  </ul>
{/if}
