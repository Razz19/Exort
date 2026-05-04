<script lang="ts">
  import { getIcon } from "material-file-icons";
  import {
    Code,
    Monitor,
    PanelRightClose,
    PanelLeftClose,
    X,
  } from "lucide-svelte";

  import type {
    OpenFile,
    PaneTab,
    Workspace,
  } from "../../lib/types";
  import type { MonacoThemeId } from "../../lib/state/types";
  import FileTree from "../FileTree.svelte";
  import MonacoPane from "./MonacoPane.svelte";
  import SerialMonitorPane from "./SerialMonitorPane.svelte";

  let {
    activePaneTab,
    onPaneTabChange = () => {},
    editorWidthPct,
    fileManagerCollapsed = false,
    monacoTheme,
    activeWorkspace,
    workspaces,
    activeWorkspaceId,
    selectedPort,
    activeFilePath,
    activeFile,
    openFiles,
    visibleOpenFileTabs,
    activeWorkspaceExpandedDirKeys,
    onSelectOpenFileTab = () => {},
    onCloseOpenFileTab = () => {},
    onSaveActiveFile = () => {},
    onEditActiveFile = () => {},
    onOpenFile = () => {},
    onCreateFileTreeEntry = async () => ({
      ok: false,
      error: "Not implemented",
    }),
    onRenameFileTreeEntry = async () => ({
      ok: false,
      error: "Not implemented",
    }),
    onOpenWorkspaceInFinder = () => {},
    onExpandedDirKeysChange = () => {},
    onFileManagerCollapsedChange = () => {},
    onBeginInnerResize = () => {},
    onInnerSplitContainerElChange = () => {},
  } = $props<{
    activePaneTab: PaneTab;
    onPaneTabChange: (tab: PaneTab) => void;
    editorWidthPct: number;
    fileManagerCollapsed: boolean;
    monacoTheme: MonacoThemeId;
    activeWorkspace: Workspace | null;
    workspaces: Workspace[];
    activeWorkspaceId: string | null;
    selectedPort: string;
    activeFilePath: string | null;
    activeFile: OpenFile | null;
    openFiles: Record<string, OpenFile>;
    visibleOpenFileTabs: string[];
    activeWorkspaceExpandedDirKeys: string[];
    onSelectOpenFileTab: (filePath: string) => void;
    onCloseOpenFileTab: (filePath: string) => Promise<void> | void;
    onSaveActiveFile: () => Promise<void> | void;
    onEditActiveFile: (content: string) => void;
    onOpenFile: (filePath: string) => Promise<void> | void;
    onCreateFileTreeEntry: (params: {
      kind: "file" | "folder";
      parentPath: string;
      name: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    onRenameFileTreeEntry: (params: {
      path: string;
      nextName: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    onOpenWorkspaceInFinder: () => Promise<void> | void;
    onExpandedDirKeysChange: (keys: string[]) => void;
    onFileManagerCollapsedChange: (collapsed: boolean) => void;
    onBeginInnerResize: (event: PointerEvent) => void;
    onInnerSplitContainerElChange: (element: HTMLDivElement | null) => void;
  }>();

  function labelFromPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] ?? filePath;
  }

  function getTabIconDataUri(filePath: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(getIcon(labelFromPath(filePath)).svg)}`;
  }

  function reportInnerSplitContainer(node: HTMLDivElement) {
    onInnerSplitContainerElChange(node);

    return {
      destroy() {
        onInnerSplitContainerElChange(null);
      },
    };
  }
</script>

<div class="flex h-full min-w-0 flex-col bg-dark-bg">
  <div
    class="flex items-end justify-between border-b border-dark-border bg-dark-surface px-2"
  >
    <div class="flex items-end">
      <button
        class={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
          activePaneTab === "code"
            ? "border-primary-500 text-dark-fg0"
            : "border-transparent text-dark-fg3 hover:text-dark-fg1"
        }`}
        onclick={() => onPaneTabChange("code")}
        aria-pressed={activePaneTab === "code"}
        title="Code pane"
      >
        <Code class="h-4 w-4" />
        <span>Code</span>
      </button>

      <button
        class={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
          activePaneTab === "monitor"
            ? "border-primary-500 text-dark-fg0"
            : "border-transparent text-dark-fg3 hover:text-dark-fg1"
        }`}
        onclick={() => onPaneTabChange("monitor")}
        aria-pressed={activePaneTab === "monitor"}
        title="Monitor pane"
      >
        <Monitor class="h-4 w-4" />
        <span>Monitor</span>
      </button>
    </div>

    {#if activePaneTab === "code"}
      <button
        type="button"
        class="mb-1 inline-flex h-7 w-7 items-center justify-center rounded text-dark-fg3 transition-colors hover:bg-dark-bg1/60 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        onclick={() => onFileManagerCollapsedChange(!fileManagerCollapsed)}
        aria-label={fileManagerCollapsed
          ? "Expand file manager"
          : "Collapse file manager"}
        title={fileManagerCollapsed
          ? "Expand file manager"
          : "Collapse file manager"}
      >
        {#if fileManagerCollapsed}
          <PanelLeftClose class="h-4 w-4" />
        {:else}
          <PanelRightClose class="h-4 w-4" />
        {/if}
      </button>
    {/if}
  </div>

  {#if activePaneTab === "code"}
    <div class="min-h-0 flex-1 overflow-hidden">
      <div
        class="flex h-full min-w-0 overflow-hidden"
        use:reportInnerSplitContainer
      >
        <div
          class={`flex min-w-0 flex-col bg-dark-bg ${
            fileManagerCollapsed ? "flex-1" : ""
          }`}
          style={fileManagerCollapsed ? undefined : `width: ${editorWidthPct}%`}
        >
          <div
            class="flex items-center border-b border-dark-border bg-dark-surface"
          >
            <div class="flex min-w-0 flex-1 overflow-x-auto">
              {#if visibleOpenFileTabs.length === 0}
                <div class="truncate px-3 py-2 text-xs text-dark-fg3">
                  No file selected
                </div>
              {:else}
                {#each visibleOpenFileTabs as tabPath (tabPath)}
                  <div
                    class={`group flex min-w-0 max-w-64 items-center gap-2 border-r border-dark-border px-2 py-2 text-left text-xs  ${
                      tabPath === activeFilePath
                        ? "bg-dark-fg4/20 text-dark-fg0 border-b border-b-dark-yellow"
                        : "bg-dark-surface text-dark-fg3 hover:bg-dark-bg1 hover:text-dark-fg1"
                    }`}
                    role="button"
                    tabindex="0"
                    aria-label={`Open ${labelFromPath(tabPath)}`}
                    onclick={() => onSelectOpenFileTab(tabPath)}
                    onkeydown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectOpenFileTab(tabPath);
                      }
                    }}
                  >
                    <div
                      class="flex min-w-0 flex-1 items-center gap-2"
                      title={tabPath}
                    >
                      <img
                        class="h-4 w-4 shrink-0 opacity-90"
                        src={getTabIconDataUri(tabPath)}
                        alt=""
                        aria-hidden="true"
                        draggable="false"
                      />
                      <span class="truncate">{labelFromPath(tabPath)}</span>
                    </div>

                    <button
                      class="shrink-0 rounded-md text-dark-fg3 opacity-0 transition hover:bg-dark-bg2 hover:text-dark-fg1 group-hover:opacity-100"
                      aria-label={`Close ${labelFromPath(tabPath)}`}
                      title={`Close ${tabPath}`}
                      onclick={(event) => {
                        event.stopPropagation();
                        void onCloseOpenFileTab(tabPath);
                      }}
                    >
                      <X class="h-4 w-4" aria-hidden="true" />
                    </button>
                    {#if openFiles[tabPath]?.dirty}
                      <span class="shrink-0 text-primary-300 group-hover:hidden"
                        >●</span
                      >
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>

            <!-- <div class="border-l border-dark-border p-1">
              <button
                class="btn-secondary px-3 py-1.5"
                disabled={!activeFile?.dirty}
                onclick={() => void onSaveActiveFile()}
              >
                Save
              </button>
            </div> -->
          </div>

          <div class="flex-1 overflow-hidden">
            {#if activeFile}
              <MonacoPane
                filePath={activeFile.path}
                value={activeFile.content}
                readonly={false}
                {monacoTheme}
                onChange={onEditActiveFile}
                onSave={onSaveActiveFile}
              />
            {:else}
              <div
                class="flex h-full items-center justify-center text-sm text-dark-fg3"
              >
                Select a file from the workspace tree.
              </div>
            {/if}
          </div>
        </div>

        {#if !fileManagerCollapsed}
          <div
            class="w-0.5 cursor-col-resize bg-dark-border hover:bg-dark-fg3/50"
            role="separator"
            tabindex="-1"
            aria-label="Resize editor and file manager panels"
            onpointerdown={onBeginInnerResize}
          ></div>

          <div
            class="min-w-0 border-l border-dark-border bg-dark-surface"
            style={`width: ${100 - editorWidthPct}%`}
          >
            <div class="h-full min-w-0">
              {#if activeWorkspace}
                <FileTree
                  rootPath={activeWorkspace.rootPath}
                  items={activeWorkspace.tree}
                  {activeFilePath}
                  expandedDirKeys={activeWorkspaceExpandedDirKeys}
                  {onExpandedDirKeysChange}
                  onSelectFile={onOpenFile}
                  onCreateEntry={onCreateFileTreeEntry}
                  onRenameEntry={onRenameFileTreeEntry}
                  onOpenInFinder={onOpenWorkspaceInFinder}
                  onCollapseFileManager={() =>
                    onFileManagerCollapsedChange(true)}
                />
              {:else}
                <div class="p-4 text-sm text-dark-fg3">
                  Open a folder to begin.
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else if activePaneTab === "monitor"}
    <div class="min-h-0 flex-1">
      <SerialMonitorPane
        {selectedPort}
        activeWorkspaceRoot={activeWorkspace?.rootPath ?? null}
      />
    </div>
  {:else}
    <div class="flex h-full items-center justify-center text-sm text-dark-fg3">
      Unsupported pane.
    </div>
  {/if}
</div>
