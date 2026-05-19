<script lang="ts">
  import {
    ChevronDown,
    ChevronUp,
    FileDiff,
    Files,
    Redo2,
  } from "lucide-svelte";
  let {
    summary,
    workspaceRoot = null,
    busy = false,
    onUndoAll,
  } = $props<{
    summary: {
      files: Array<{
        file: string;
        additions: number;
        deletions: number;
        lines: Array<{
          kind: "meta" | "context" | "add" | "remove";
          text: string;
        }>;
        detailsAvailable: boolean;
      }>;
      totalAdditions: number;
      totalDeletions: number;
    };
    workspaceRoot?: string | null;
    busy?: boolean;
    onUndoAll?: (files: string[]) => Promise<void> | void;
  }>();

  let expandedByFile = $state<Record<string, boolean>>({});
  let visibleLinesByFile = $state<Record<string, number>>({});

  let files = $derived(summary.files);
  let previewLineLimit = 100;
  let totalAdditions = $derived(summary.totalAdditions);
  let totalDeletions = $derived(summary.totalDeletions);
  let undoing = $state(false);
  let filePaths = $derived(files.map((file) => file.file));

  function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function displayPath(value: string, root: string | null): string {
    const normalizedValue = normalizePath(value);
    const normalizedRoot = root ? normalizePath(root).replace(/\/$/, "") : "";
    if (!normalizedRoot) return normalizedValue;
    if (normalizedValue === normalizedRoot) return ".";
    const prefix = `${normalizedRoot}/`;
    if (normalizedValue.startsWith(prefix)) {
      return normalizedValue.slice(prefix.length);
    }
    return normalizedValue;
  }

  function fileKey(file: string, index: number): string {
    return `${file}:${index}`;
  }

  function isExpanded(key: string): boolean {
    return expandedByFile[key] ?? false;
  }

  function toggleExpanded(key: string): void {
    expandedByFile = {
      ...expandedByFile,
      [key]: !expandedByFile[key],
    };
  }

  function visibleLineCount(key: string, limit: number): number {
    return visibleLinesByFile[key] ?? limit;
  }

  function showMore(key: string, limit: number, total: number): void {
    const current = visibleLinesByFile[key] ?? limit;
    visibleLinesByFile = {
      ...visibleLinesByFile,
      [key]: Math.min(total, current + limit),
    };
  }

  function lineClass(kind: "meta" | "context" | "add" | "remove"): string {
    if (kind === "add") return "bg-dark-green/10 text-dark-green";
    if (kind === "remove") return "bg-dark-red/10 text-dark-red2";
    if (kind === "meta") return "text-dark-aqua";
    return "text-dark-fg2";
  }

  async function handleUndoAll(): Promise<void> {
    if (!onUndoAll || undoing || busy || filePaths.length === 0) return;
    undoing = true;
    try {
      await onUndoAll(filePaths);
    } finally {
      undoing = false;
    }
  }
</script>

{#if files.length > 0}
  <div class="overflow-hidden rounded-xl border border-dark-border bg-dark-bgS">
    <div
      class="flex items-center justify-between gap-3 border-b border-dark-border px-3 py-2.5"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-dark-bg1 text-dark-fg2"
        >
          <FileDiff class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="truncate text-sm font-medium text-dark-fg1">
            Edited {files.length} file{files.length === 1 ? "" : "s"}
          </div>
          <div class="text-xs text-dark-fg3">
            <span class="text-dark-green">+{totalAdditions}</span>
            <span class="ml-2 text-dark-red2">-{totalDeletions}</span>
          </div>
        </div>
      </div>
      <button
        class="inline-flex shrink-0 items-center rounded-md borderpx-2.5 py-1 text-xs text-dark-fg2 hover:text-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
        onclick={handleUndoAll}
        disabled={busy || undoing || !onUndoAll || filePaths.length === 0}
      >
        <Redo2 class="h-4 w-4 mr-1" />{undoing ? "Undoing..." : "Undo"}
      </button>
    </div>

    <div class="divide-y divide-dark-border">
      {#each files as file, index (`${file.file}:${index}`)}
        {@const key = fileKey(file.file, index)}
        <div class="px-3 py-2">
          <button
            class="flex w-full items-center justify-between gap-3 text-left"
            onclick={() => toggleExpanded(key)}
          >
            <span class="min-w-0 truncate text-sm text-dark-fg1">
              {displayPath(file.file, workspaceRoot)}
            </span>
            <span class="flex shrink-0 items-center gap-2 text-xs">
              <span class="text-dark-green">+{file.additions}</span>
              <span class="text-dark-red2">-{file.deletions}</span>
              {#if isExpanded(key)}
                <ChevronUp class="h-3.5 w-3.5 text-dark-fg3" />
              {:else}
                <ChevronDown class="h-3.5 w-3.5 text-dark-fg3" />
              {/if}
            </span>
          </button>

          {#if isExpanded(key)}
            <div class="mt-2">
              {#if file.detailsAvailable && file.lines && file.lines.length > 0}
                {@const visible = visibleLineCount(key, previewLineLimit)}
                <div
                  class="overflow-x-auto rounded-lg border border-dark-border bg-dark-bg1"
                >
                  <div
                    class="min-w-full whitespace-pre p-2 font-mono text-[11px] leading-5"
                  >
                    {#each file.lines
                      .slice(0, visible)
                      .filter((line) => !line.text
                            .trimStart()
                            .startsWith("@@")) as line, lineIndex (`${key}:${lineIndex}`)}
                      <div class={lineClass(line.kind)}>{line.text}</div>
                    {/each}
                  </div>
                </div>
                {#if file.lines.length > visible}
                  <button
                    class="mt-2 rounded border border-dark-border px-2 py-1 text-[11px] text-dark-fg2 hover:border-primary-500 hover:text-primary-300"
                    onclick={() =>
                      showMore(
                        key,
                        previewLineLimit,
                        file.lines?.length ?? visible,
                      )}
                  >
                    ... load more ({(file.lines?.length ?? visible) - visible} lines)
                  </button>
                {/if}
              {:else}
                <div
                  class="rounded border border-dark-border bg-dark-bg1 px-2 py-1.5 text-[11px] text-dark-fg3"
                >
                  Diff details not available from runtime.
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
