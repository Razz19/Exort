<script lang="ts">
  import { Files, GitBranch } from 'lucide-svelte';
  import type { AgentChangedFile, RightPanelTab } from '../lib/types';
  import type { GitFileDiff } from '../../shared/git';
  import FileTree from './FileTree.svelte';
  import GitPanel from './git/GitPanel.svelte';

  let {
    activeRightPanelTab,
    onActiveRightPanelTabChange = () => {},
    // File tree
    rootPath,
    items,
    activeFilePath,
    expandedDirKeys,
    onExpandedDirKeysChange,
    onSelectFile,
    onCreateEntry = async () => ({ ok: false, error: 'Not implemented' }),
    onRenameEntry = async () => ({ ok: false, error: 'Not implemented' }),
    onOpenInFinder = () => {},
    // Git
    workspaceRoot,
    lastTurnChangedFiles = [],
    gitRefreshToken = 0,
    onOpenGitDiff = () => {}
  } = $props<{
    activeRightPanelTab: RightPanelTab;
    onActiveRightPanelTabChange: (tab: RightPanelTab) => void;
    rootPath: string;
    items: Array<{ path: string; isDirectory: boolean }>;
    activeFilePath: string | null;
    expandedDirKeys: string[];
    onExpandedDirKeysChange: (keys: string[]) => void;
    onSelectFile: (filePath: string) => void | Promise<void>;
    onCreateEntry?: (params: {
      kind: 'file' | 'folder';
      parentPath: string;
      name: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    onRenameEntry?: (params: {
      path: string;
      nextName: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    onOpenInFinder?: () => void | Promise<void>;
    workspaceRoot: string | null;
    lastTurnChangedFiles?: AgentChangedFile[];
    gitRefreshToken?: number;
    onOpenGitDiff: (diff: GitFileDiff) => void;
  }>();

  const tabs: Array<{ id: RightPanelTab; label: string }> = [
    { id: 'files', label: 'Files' },
    { id: 'git', label: 'Git' }
  ];
</script>

<div class="flex h-full min-w-0 flex-col bg-dark-surface">
  <div class="flex items-end border-b border-dark-border bg-dark-surface px-1">
    {#each tabs as tab (tab.id)}
      <button
        class={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
          activeRightPanelTab === tab.id
            ? 'border-primary-500 text-dark-fg0'
            : 'border-transparent text-dark-fg3 hover:text-dark-fg1'
        }`}
        onclick={() => onActiveRightPanelTabChange(tab.id)}
        aria-pressed={activeRightPanelTab === tab.id}
      >
        {#if tab.id === 'files'}
          <Files class="h-4 w-4" />
        {:else}
          <GitBranch class="h-4 w-4" />
        {/if}
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-hidden">
    {#if activeRightPanelTab === 'git'}
      <GitPanel
        {workspaceRoot}
        {lastTurnChangedFiles}
        refreshToken={gitRefreshToken}
        onOpenDiff={onOpenGitDiff}
      />
    {:else}
      <FileTree
        {rootPath}
        {items}
        {activeFilePath}
        {expandedDirKeys}
        {onExpandedDirKeysChange}
        {onSelectFile}
        {onCreateEntry}
        {onRenameEntry}
        {onOpenInFinder}
      />
    {/if}
  </div>
</div>
