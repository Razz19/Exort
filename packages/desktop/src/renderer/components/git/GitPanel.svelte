<script lang="ts">
  import { untrack } from 'svelte';
  import {
    ArrowDown,
    ArrowUp,
    Check,
    ChevronDown,
    GitBranch,
    GitCommit,
    Loader2,
    Plus,
    RefreshCw,
    RotateCw
  } from 'lucide-svelte';
  import type { AgentChangedFile } from '../../lib/types';
  import type { GitFileDiff, GitRepoStatus } from '../../../shared/git';
  import { patchToOriginalModified } from '../../lib/git/patchDiff';
  import GitChangesList, { type GitChangeRow } from './GitChangesList.svelte';

  let {
    workspaceRoot,
    lastTurnChangedFiles = [],
    refreshToken = 0,
    onOpenDiff = () => {},
    onChangeCountChange = () => {}
  } = $props<{
    workspaceRoot: string | null;
    lastTurnChangedFiles: AgentChangedFile[];
    refreshToken?: number;
    onOpenDiff: (diff: GitFileDiff) => void;
    onChangeCountChange?: (count: number) => void;
  }>();

  type ChangeSource = 'git' | 'lastTurn';

  let status = $state<GitRepoStatus | null>(null);
  let branches = $state<string[]>([]);
  let loading = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let source = $state<ChangeSource>('git');
  let commitMessage = $state('');
  let sourceMenuOpen = $state(false);
  let branchMenuOpen = $state(false);
  let newBranchOpen = $state(false);
  let newBranchName = $state('');

  async function refresh(): Promise<void> {
    const root = workspaceRoot;
    if (!root) {
      status = null;
      return;
    }
    loading = true;
    error = null;
    try {
      const result = await window.electronAPI.gitStatus({ workspaceRoot: root });
      if (!result.ok || !result.status) {
        error = result.error ?? 'Failed to read Git status.';
        status = null;
        return;
      }
      status = result.status;
      if (status.isRepo) {
        const branchResult = await window.electronAPI.gitListBranches({ workspaceRoot: root });
        branches = branchResult.ok && branchResult.branches ? branchResult.branches.branches : [];
      } else {
        branches = [];
      }
    } finally {
      loading = false;
    }
  }

  // Refresh only when the workspace or the parent refresh token actually changes. The key guard is a
  // plain (non-reactive) variable so spurious effect re-runs — e.g. from unrelated app re-renders
  // caused by the workspace file watcher reacting to `.git` churn — become no-ops instead of
  // re-spawning git and making the panel flicker.
  let lastRefreshKey: string | null = null;
  let lastRefreshWorkspaceRoot: string | null = null;
  $effect(() => {
    const key = `${workspaceRoot ?? ''}::${refreshToken}`;
    if (key === lastRefreshKey) return;
    lastRefreshKey = key;
    if (workspaceRoot !== lastRefreshWorkspaceRoot) {
      status = null;
      branches = [];
      error = null;
      lastRefreshWorkspaceRoot = workspaceRoot;
    }
    untrack(() => {
      void refresh();
    });
  });

  async function runOp(op: () => Promise<{ ok: boolean; error?: string }>): Promise<boolean> {
    busy = true;
    error = null;
    try {
      const result = await op();
      if (!result.ok) {
        error = result.error ?? 'Git operation failed.';
        return false;
      }
      await refresh();
      return true;
    } finally {
      busy = false;
    }
  }

  async function initRepo(): Promise<void> {
    if (!workspaceRoot) return;
    await runOp(() => window.electronAPI.gitInit({ workspaceRoot: workspaceRoot! }));
  }

  async function commit(): Promise<void> {
    const root = workspaceRoot;
    const message = commitMessage.trim();
    if (!root || message.length === 0) return;
    const ok = await runOp(() => window.electronAPI.gitCommitAll({ workspaceRoot: root, message }));
    if (ok) commitMessage = '';
  }

  async function switchBranch(name: string): Promise<void> {
    const root = workspaceRoot;
    if (!root) return;
    branchMenuOpen = false;
    await runOp(() => window.electronAPI.gitCheckoutBranch({ workspaceRoot: root, name }));
  }

  async function createBranch(): Promise<void> {
    const root = workspaceRoot;
    const name = newBranchName.trim();
    if (!root || name.length === 0) return;
    const ok = await runOp(() => window.electronAPI.gitCreateBranch({ workspaceRoot: root, name }));
    if (ok) {
      newBranchName = '';
      newBranchOpen = false;
    }
  }

  async function push(): Promise<void> {
    if (!workspaceRoot) return;
    await runOp(() => window.electronAPI.gitPush({ workspaceRoot: workspaceRoot! }));
  }

  async function pull(): Promise<void> {
    if (!workspaceRoot) return;
    await runOp(() => window.electronAPI.gitPull({ workspaceRoot: workspaceRoot! }));
  }

  let gitRows = $derived<GitChangeRow[]>(
    (status?.changes ?? []).map((change) => ({
      path: change.path,
      status: change.status,
      additions: change.additions,
      deletions: change.deletions
    }))
  );

  let lastTurnRows = $derived<GitChangeRow[]>(
    lastTurnChangedFiles.map((change: AgentChangedFile) => ({
      path: change.file,
      status: null,
      additions: change.additions,
      deletions: change.deletions
    }))
  );

  let rows = $derived(source === 'git' ? gitRows : lastTurnRows);

  $effect(() => {
    onChangeCountChange(rows.length);
  });

  async function openDiff(row: GitChangeRow): Promise<void> {
    const root = workspaceRoot;
    if (!root) return;

    if (source === 'lastTurn') {
      const entry = lastTurnChangedFiles.find((change: AgentChangedFile) => change.file === row.path);
      const { original, modified } = patchToOriginalModified(entry?.patch ?? '');
      onOpenDiff({ path: row.path, original, modified });
      return;
    }

    const result = await window.electronAPI.gitFileDiff({ workspaceRoot: root, filePath: row.path });
    if (!result.ok) {
      error = result.error ?? 'Failed to load diff.';
      return;
    }
    onOpenDiff({ path: row.path, original: result.original ?? '', modified: result.modified ?? '' });
  }

  const sourceLabel = (value: ChangeSource): string =>
    value === 'git' ? 'Git changes' : 'Last turn changes';

  function closeMenus(): void {
    branchMenuOpen = false;
    sourceMenuOpen = false;
    newBranchOpen = false;
  }
</script>

<div class="flex h-full min-w-0 flex-col bg-dark-bg">
  {#if !workspaceRoot}
    <div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-dark-bg1 text-dark-fg3">
        <GitBranch class="h-5 w-5" />
      </span>
      <p class="text-xs text-dark-fg3">Open a folder to use Git.</p>
    </div>
  {:else if loading && !status}
    <div class="flex h-full items-center justify-center gap-2 p-4 text-xs text-dark-fg3">
      <Loader2 class="h-4 w-4 animate-spin" /> Loading…
    </div>
  {:else if status && !status.isRepo}
    <div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-dark-bg1 text-dark-fg3">
        <GitBranch class="h-5 w-5" />
      </span>
      <div class="space-y-1">
        <p class="text-sm font-medium text-dark-fg1">No Git repository</p>
        <p class="text-xs text-dark-fg3">Initialize one to start tracking changes.</p>
      </div>
      <button class="btn-primary px-3 py-1.5 text-xs" disabled={busy} onclick={initRepo}>
        Initialize repository
      </button>
      {#if error}<p class="text-xs text-dark-red2">{error}</p>{/if}
    </div>
  {:else if status}
    <!-- Changes source selector -->
    <div class="relative flex items-center justify-between border-b border-dark-border px-3 py-2">
      <button
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-dark-fg1 transition-colors hover:bg-dark-bg1"
        onclick={() => (sourceMenuOpen = !sourceMenuOpen)}
      >
        {sourceLabel(source)}
        <ChevronDown class="h-4 w-4 text-dark-fg3" />
      </button>
      <span class="rounded-full bg-dark-bg1 px-2 py-0.5 text-[11px] font-medium text-dark-fg2">
        {rows.length}
      </span>

      {#if sourceMenuOpen}
        <div
          class="absolute left-3 top-full z-30 mt-1.5 w-48 rounded-lg border border-dark-border bg-dark-surface p-1 shadow-xl"
        >
          {#each ['git', 'lastTurn'] as const as value (value)}
            <button
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-dark-fg1 transition-colors hover:bg-dark-bg1"
              onclick={() => {
                source = value;
                sourceMenuOpen = false;
              }}
            >
              {#if source === value}
                <Check class="h-3.5 w-3.5 shrink-0 text-dark-green" />
              {:else}
                <span class="w-3.5 shrink-0"></span>
              {/if}
              {sourceLabel(value)}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if error}
      <div class="mx-3 mt-2 rounded-md border border-dark-red/30 bg-dark-red/10 px-3 py-1.5 text-xs text-dark-red2">
        {error}
      </div>
    {/if}

    <!-- Change list -->
    <div class="panel-scroll min-h-0 flex-1 overflow-y-auto">
      <GitChangesList changes={rows} onOpenDiff={openDiff} />
    </div>

    <div class="space-y-2 border-t border-dark-border p-3">
      {#if source === 'git'}
        <div
          class="rounded-xl border border-dark-border bg-dark-bgS/80 px-3 py-2 transition-colors duration-150 focus-within:border-dark-yellow/50"
        >
          <textarea
            class="chat-timeline-scroll allow-text-selection min-h-9 w-full resize-none border-0 bg-transparent p-0 text-xs text-dark-fg1 placeholder:text-dark-fg4 focus:outline-none focus:ring-0"
            rows="2"
            placeholder="Commit message"
            bind:value={commitMessage}
            onkeydown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void commit();
              }
            }}
          ></textarea>
          <div class="mt-1.5 flex items-center justify-between gap-2">
            <span class="truncate text-[11px] text-dark-fg4">
              {gitRows.length > 0
                ? `${gitRows.length} file${gitRows.length === 1 ? '' : 's'} ready`
                : 'No Git changes'}
            </span>
            <button
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dark-fg2 bg-dark-fg2 text-dark-border transition-colors duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || commitMessage.trim().length === 0 || gitRows.length === 0}
              onclick={commit}
              aria-label="Commit all changes"
              title="Commit all changes"
            >
              {#if busy}
                <RotateCw class="h-4 w-4 animate-spin" />
              {:else}
                <GitCommit class="h-4 w-4" />
              {/if}
            </button>
          </div>
        </div>
      {/if}

      <div class="relative flex items-center gap-1">
        <div class="relative min-w-0 flex-1">
          <button
            class="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-dark-fg1 transition-colors hover:bg-dark-bg1"
            onclick={() => (branchMenuOpen = !branchMenuOpen)}
            title="Switch branch"
          >
            <GitBranch class="h-3.5 w-3.5 shrink-0 text-dark-fg3" />
            <span class="truncate">{status.branch ?? 'detached HEAD'}</span>
            <ChevronDown class="h-3.5 w-3.5 shrink-0 text-dark-fg3" />
          </button>

          {#if branchMenuOpen}
            <div
              class="absolute bottom-full left-0 z-30 mb-1.5 max-h-64 w-60 overflow-y-auto rounded-lg border border-dark-border bg-dark-surface p-1 shadow-xl"
            >
              {#each branches as branch (branch)}
                <button
                  class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-dark-fg1 transition-colors hover:bg-dark-bg1"
                  onclick={() => switchBranch(branch)}
                >
                  {#if branch === status.branch}
                    <Check class="h-3.5 w-3.5 shrink-0 text-dark-green" />
                  {:else}
                    <span class="w-3.5 shrink-0"></span>
                  {/if}
                  <span class="truncate">{branch}</span>
                </button>
              {/each}
              <div class="my-1 border-t border-dark-border"></div>
              {#if newBranchOpen}
                <div class="flex items-center gap-1.5 p-1">
                  <input
                    class="min-w-0 flex-1 rounded-md border border-dark-border bg-dark-bg px-2 py-1 text-xs text-dark-fg1 placeholder:text-dark-fg4 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="New branch name"
                    bind:value={newBranchName}
                    onkeydown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void createBranch();
                      }
                    }}
                  />
                  <button
                    class="btn-primary px-2.5 py-1 text-xs"
                    disabled={busy || newBranchName.trim().length === 0}
                    onclick={createBranch}
                  >
                    Create
                  </button>
                </div>
              {:else}
                <button
                  class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-dark-fg2 transition-colors hover:bg-dark-bg1"
                  onclick={() => (newBranchOpen = true)}
                >
                  <Plus class="h-3.5 w-3.5" /> New branch
                </button>
              {/if}
            </div>
          {/if}
        </div>

        <button
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-dark-fg2 transition-colors hover:bg-dark-bg1 hover:text-dark-fg1 disabled:opacity-40 disabled:hover:bg-transparent"
          title="Pull"
          disabled={busy || !status.hasRemote}
          onclick={pull}
        >
          <ArrowDown class="h-3.5 w-3.5" />
          {#if status.behind > 0}<span class="font-mono text-[10px]">{status.behind}</span>{/if}
        </button>
        <button
          class="inline-flex items-center gap-1 rounded-md px-1.5 py-1.5 text-dark-fg2 transition-colors hover:bg-dark-bg1 hover:text-dark-fg1 disabled:opacity-40 disabled:hover:bg-transparent"
          title="Push"
          disabled={busy || !status.hasRemote}
          onclick={push}
        >
          <ArrowUp class="h-3.5 w-3.5" />
          {#if status.ahead > 0}<span class="font-mono text-[10px]">{status.ahead}</span>{/if}
        </button>
        <button
          class="inline-flex items-center justify-center rounded-md p-1.5 text-dark-fg3 transition-colors hover:bg-dark-bg1 hover:text-dark-fg1 disabled:opacity-40 disabled:hover:bg-transparent"
          title="Refresh"
          disabled={loading || busy}
          onclick={refresh}
        >
          <RefreshCw class={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>

    {#if branchMenuOpen || sourceMenuOpen}
      <!-- Outside-click catcher to close open menus -->
      <button
        type="button"
        class="fixed inset-0 z-20 cursor-default"
        aria-label="Close menu"
        tabindex="-1"
        onclick={closeMenus}
      ></button>
    {/if}
  {/if}
</div>
