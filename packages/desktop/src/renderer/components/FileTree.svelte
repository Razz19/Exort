<script lang="ts">
  import { getIcon } from "material-file-icons";
  import {
    FilePlus,
    Folder,
    FolderOpen,
    FolderPlus,
    FolderSearch,
  } from "lucide-svelte";

  type TreeRow = {
    key: string;
    absolutePath: string;
    name: string;
    parentKey: string;
    isDirectory: boolean;
    depth: number;
  };

  type TreeData = {
    childrenByParent: Record<string, TreeRow[]>;
    directoryKeys: Record<string, true>;
    relativeByAbsolute: Record<string, string>;
    absoluteByKey: Record<string, string>;
  };

  type VisibleRow =
    | {
        kind: "row";
        key: string;
        row: TreeRow;
      }
    | {
        kind: "create";
        key: string;
        parentKey: string;
        parentPath: string;
        depth: number;
      };

  type RowContextMenuState = {
    absolutePath: string;
    key: string;
    isDirectory: boolean;
    x: number;
    y: number;
  };

  const rowContextMenuWidthPx = 148;
  const rowContextMenuEstimatedHeightPx = 44;
  const rowContextMenuViewportPaddingPx = 8;

  let {
    rootPath,
    items,
    activeFilePath,
    expandedDirKeys,
    onExpandedDirKeysChange,
    onSelectFile,
    onCreateEntry = async () => ({ ok: false, error: "Not implemented" }),
    onRenameEntry = async () => ({ ok: false, error: "Not implemented" }),
    onOpenInFinder = () => {},
  } = $props<{
    rootPath: string;
    items: Array<{ path: string; isDirectory: boolean }>;
    activeFilePath: string | null;
    expandedDirKeys: string[];
    onExpandedDirKeysChange: (keys: string[]) => void;
    onSelectFile: (filePath: string) => void | Promise<void>;
    onCreateEntry?: (params: {
      kind: "file" | "folder";
      parentPath: string;
      name: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    onRenameEntry?: (params: {
      path: string;
      nextName: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    onOpenInFinder?: () => void | Promise<void>;
  }>();

  let selectedRowPath = $state<string | null>(null);
  let selectedRowIsDirectory = $state<boolean | null>(null);
  let rowContextMenu = $state<RowContextMenuState | null>(null);
  let rowContextMenuElement = $state<HTMLDivElement | null>(null);

  let renamingPath = $state<string | null>(null);
  let renameDraft = $state("");
  let renameError = $state<string | null>(null);
  let renameInputElement = $state<HTMLInputElement | null>(null);

  let pendingCreateKind = $state<"file" | "folder" | null>(null);
  let pendingCreateParentPath = $state<string | null>(null);
  let createDraft = $state("");
  let createError = $state<string | null>(null);
  let createInputElement = $state<HTMLInputElement | null>(null);

  let inlineBusy = $state(false);

  let expandedDirs = $derived.by(() => {
    const source = expandedDirKeys ?? [];
    const next: Record<string, true> = {};
    for (const key of source) {
      if (!key) continue;
      next[key] = true;
    }
    return next;
  });

  function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function toRelativePath(root: string, target: string): string {
    const normalizedRoot = normalizePath(root).replace(/\/$/, "");
    const normalizedTarget = normalizePath(target);

    if (normalizedTarget === normalizedRoot) return "";
    if (!normalizedTarget.startsWith(`${normalizedRoot}/`))
      return normalizedTarget;
    return normalizedTarget.slice(normalizedRoot.length + 1);
  }

  function sortRows(a: TreeRow, b: TreeRow): number {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  function buildTreeData(
    nextRootPath: string,
    nextItems: Array<{ path: string; isDirectory: boolean }>,
  ): TreeData {
    const childrenByParent: Record<string, TreeRow[]> = {};
    const directoryKeys: Record<string, true> = {};
    const relativeByAbsolute: Record<string, string> = {};
    const absoluteByKey: Record<string, string> = {};

    for (const item of nextItems) {
      const relativePath = toRelativePath(nextRootPath, item.path);
      if (!relativePath) continue;

      const segments = relativePath.split("/").filter(Boolean);
      if (segments.length === 0) continue;

      const key = segments.join("/");
      const parentKey = segments.slice(0, -1).join("/");
      const row: TreeRow = {
        key,
        absolutePath: item.path,
        name: segments[segments.length - 1] ?? item.path,
        parentKey,
        isDirectory: item.isDirectory,
        depth: segments.length - 1,
      };

      const bucket = childrenByParent[parentKey] ?? [];
      bucket.push(row);
      childrenByParent[parentKey] = bucket;
      relativeByAbsolute[item.path] = key;
      absoluteByKey[key] = item.path;

      if (item.isDirectory) {
        directoryKeys[key] = true;
      }
    }

    for (const parentKey of Object.keys(childrenByParent)) {
      childrenByParent[parentKey]?.sort(sortRows);
    }

    return {
      childrenByParent,
      directoryKeys,
      relativeByAbsolute,
      absoluteByKey,
    };
  }

  function buildVisibleRows(
    treeData: TreeData,
    openDirs: Record<string, true>,
    createRow:
      | {
          active: true;
          parentKey: string;
          parentPath: string;
        }
      | { active: false }
      | null,
  ): VisibleRow[] {
    const visible: VisibleRow[] = [];

    const visit = (parentKey: string) => {
      if (createRow?.active && createRow.parentKey === parentKey) {
        visible.push({
          kind: "create",
          key: `__create__:${parentKey || "root"}`,
          parentKey,
          parentPath: createRow.parentPath,
          depth: parentKey ? parentKey.split("/").filter(Boolean).length : 0,
        });
      }

      const children = treeData.childrenByParent[parentKey] ?? [];
      for (const child of children) {
        visible.push({
          kind: "row",
          key: child.absolutePath,
          row: child,
        });
        if (child.isDirectory && openDirs[child.key]) {
          visit(child.key);
        }
      }
    };

    visit("");
    return visible;
  }

  function toggleDirectory(rowKey: string): void {
    if (expandedDirs[rowKey]) {
      const next = { ...expandedDirs };
      delete next[rowKey];
      onExpandedDirKeysChange(Object.keys(next));
      return;
    }

    onExpandedDirKeysChange(
      Object.keys({
        ...expandedDirs,
        [rowKey]: true,
      }),
    );
  }

  function ensureDirectoryExpanded(rowKey: string): void {
    if (!rowKey || expandedDirs[rowKey]) return;
    onExpandedDirKeysChange(
      Object.keys({
        ...expandedDirs,
        [rowKey]: true,
      }),
    );
  }

  function getRowIconDataUri(row: TreeRow): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(getIcon(row.name).svg)}`;
  }

  function buildIndentGuides(depth: number): number[] {
    if (depth <= 0) return [];
    return Array.from({ length: depth }, (_, index) => index);
  }

  function resolveAbsolutePathFromKey(key: string): string {
    if (!key) return rootPath;
    return treeData.absoluteByKey[key] ?? rootPath;
  }

  function getSelectedParentTarget(): { parentPath: string; parentKey: string } {
    if (!selectedRowPath) {
      return { parentPath: rootPath, parentKey: "" };
    }

    const selectedKey = treeData.relativeByAbsolute[selectedRowPath];
    if (!selectedKey) {
      return { parentPath: rootPath, parentKey: "" };
    }

    if (selectedRowIsDirectory) {
      return { parentPath: selectedRowPath, parentKey: selectedKey };
    }

    const parentKey = selectedKey.split("/").slice(0, -1).join("/");
    return {
      parentPath: resolveAbsolutePathFromKey(parentKey),
      parentKey,
    };
  }

  function clearRowContextMenu(): void {
    rowContextMenu = null;
  }

  function cancelRename(): void {
    renamingPath = null;
    renameDraft = "";
    renameError = null;
    inlineBusy = false;
  }

  function cancelCreate(): void {
    pendingCreateKind = null;
    pendingCreateParentPath = null;
    createDraft = "";
    createError = null;
    inlineBusy = false;
  }

  function cancelInlineEditors(): void {
    cancelRename();
    cancelCreate();
  }

  function selectRow(row: TreeRow): void {
    selectedRowPath = row.absolutePath;
    selectedRowIsDirectory = row.isDirectory;
  }

  function startCreate(kind: "file" | "folder"): void {
    const target = getSelectedParentTarget();
    if (target.parentKey) {
      ensureDirectoryExpanded(target.parentKey);
    }

    clearRowContextMenu();
    cancelRename();
    pendingCreateKind = kind;
    pendingCreateParentPath = target.parentPath;
    createDraft = "";
    createError = null;
  }

  function openRowContextMenu(row: TreeRow, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    selectRow(row);
    cancelInlineEditors();

    const left = clamp(
      Math.round(event.clientX),
      rowContextMenuViewportPaddingPx,
      Math.max(
        rowContextMenuViewportPaddingPx,
        window.innerWidth -
          rowContextMenuWidthPx -
          rowContextMenuViewportPaddingPx,
      ),
    );
    const top = clamp(
      Math.round(event.clientY),
      rowContextMenuViewportPaddingPx,
      Math.max(
        rowContextMenuViewportPaddingPx,
        window.innerHeight -
          rowContextMenuEstimatedHeightPx -
          rowContextMenuViewportPaddingPx,
      ),
    );

    rowContextMenu = {
      absolutePath: row.absolutePath,
      key: row.key,
      isDirectory: row.isDirectory,
      x: left,
      y: top,
    };
  }

  function startRenameForRow(row: TreeRow): void {
    clearRowContextMenu();
    cancelCreate();
    renamingPath = row.absolutePath;
    renameDraft = row.name;
    renameError = null;
    selectRow(row);
  }

  function startRenameFromContextMenu(): void {
    const menu = rowContextMenu;
    if (!menu) return;
    const row = rows.find(
      (entry): entry is Extract<VisibleRow, { kind: "row" }> =>
        entry.kind === "row" && entry.row.absolutePath === menu.absolutePath,
    )?.row;
    if (!row) {
      clearRowContextMenu();
      return;
    }
    startRenameForRow(row);
  }

  async function submitCreate(): Promise<void> {
    if (inlineBusy || !pendingCreateKind || !pendingCreateParentPath) return;

    const name = createDraft.trim();
    if (!name) {
      createError = "Name is required.";
      return;
    }

    inlineBusy = true;
    createError = null;
    try {
      const result = await onCreateEntry({
        kind: pendingCreateKind,
        parentPath: pendingCreateParentPath,
        name,
      });

      if (!result.ok || !result.path) {
        createError = result.error ?? "Failed to create entry.";
        return;
      }

      selectedRowPath = result.path;
      selectedRowIsDirectory = pendingCreateKind === "folder";
      cancelCreate();
    } finally {
      inlineBusy = false;
    }
  }

  async function submitRename(): Promise<void> {
    if (inlineBusy || !renamingPath) return;

    const row = rows.find(
      (entry): entry is Extract<VisibleRow, { kind: "row" }> =>
        entry.kind === "row" && entry.row.absolutePath === renamingPath,
    )?.row;
    if (!row) {
      cancelRename();
      return;
    }

    const nextName = renameDraft.trim();
    if (!nextName) {
      renameError = "Name is required.";
      return;
    }

    if (nextName === row.name) {
      cancelRename();
      return;
    }

    inlineBusy = true;
    renameError = null;
    try {
      const result = await onRenameEntry({
        path: renamingPath,
        nextName,
      });

      if (!result.ok || !result.path) {
        renameError = result.error ?? "Failed to rename entry.";
        return;
      }

      selectedRowPath = result.path;
      selectedRowIsDirectory = row.isDirectory;
      cancelRename();
    } finally {
      inlineBusy = false;
    }
  }

  function handleCreateKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitCreate();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelCreate();
    }
  }

  function handleRenameKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  }

  function handleRowClick(row: TreeRow): void {
    clearRowContextMenu();
    cancelInlineEditors();
    selectRow(row);
    if (row.isDirectory) {
      toggleDirectory(row.key);
      return;
    }
    void onSelectFile(row.absolutePath);
  }

  function isSelectedRow(row: TreeRow): boolean {
    return selectedRowPath === row.absolutePath;
  }

  function rowClassName(row: TreeRow): string {
    const base = "relative flex w-full min-w-0 rounded-md pr-2 text-left text-xs";
    const selected = isSelectedRow(row);
    const hasSelection = !!selectedRowPath;
    const activeFile =
      !hasSelection && !row.isDirectory && row.absolutePath === activeFilePath;

    if (selected) {
      return row.isDirectory
        ? `${base} bg-dark-bg1/70 text-dark-fg1`
        : `${base} bg-dark-bg1/70 font-mono text-dark-fg0`;
    }

    if (row.isDirectory) {
      return `${base} text-dark-fg1 hover:bg-dark-bg1`;
    }

    if (activeFile) {
      return `${base} bg-dark-bg1 text-dark-aqua font-mono font-bold`;
    }

    return `${base} font-mono text-dark-fg2 hover:bg-dark-bg1`;
  }

  let treeData = $derived(buildTreeData(rootPath, items));
  let pendingCreateParentKey = $derived.by(() => {
    if (!pendingCreateKind || !pendingCreateParentPath) return null;
    if (normalizePath(pendingCreateParentPath) === normalizePath(rootPath)) {
      return "";
    }
    return treeData.relativeByAbsolute[pendingCreateParentPath] ?? null;
  });
  let rows = $derived(
    buildVisibleRows(
      treeData,
      expandedDirs,
      pendingCreateKind && pendingCreateParentPath && pendingCreateParentKey !== null
        ? {
            active: true as const,
            parentKey: pendingCreateParentKey,
            parentPath: pendingCreateParentPath,
          }
        : { active: false as const },
    ),
  );

  $effect(() => {
    const currentKeys = Object.keys(expandedDirs);
    if (currentKeys.length === 0) return;

    let changed = false;
    const next: Record<string, true> = {};

    for (const key of currentKeys) {
      if (!treeData.directoryKeys[key]) {
        changed = true;
        continue;
      }
      next[key] = true;
    }

    if (changed) {
      onExpandedDirKeysChange(Object.keys(next));
    }
  });

  $effect(() => {
    if (!activeFilePath) return;
    const relativePath = treeData.relativeByAbsolute[activeFilePath];
    if (!relativePath) return;

    const segments = relativePath.split("/");
    if (segments.length <= 1) return;

    const next = { ...expandedDirs };
    let changed = false;
    let parentKey = "";

    for (let index = 0; index < segments.length - 1; index += 1) {
      parentKey = parentKey
        ? `${parentKey}/${segments[index]}`
        : (segments[index] ?? "");
      if (!parentKey || !treeData.directoryKeys[parentKey]) continue;

      if (!next[parentKey]) {
        next[parentKey] = true;
        changed = true;
      }
    }

    if (changed) {
      onExpandedDirKeysChange(Object.keys(next));
    }
  });

  $effect(() => {
    if (!rowContextMenu) return;

    const onWindowPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        rowContextMenuElement &&
        rowContextMenuElement.contains(target)
      ) {
        return;
      }
      rowContextMenu = null;
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rowContextMenu = null;
      }
    };

    window.addEventListener("pointerdown", onWindowPointerDown);
    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  });

  $effect(() => {
    if (!rowContextMenu) return;
    const stillExists = rows.some(
      (entry) =>
        entry.kind === "row" &&
        entry.row.absolutePath === rowContextMenu?.absolutePath,
    );
    if (!stillExists) {
      rowContextMenu = null;
    }
  });

  $effect(() => {
    if (!renamingPath || !renameInputElement) return;
    queueMicrotask(() => {
      renameInputElement?.focus();
      renameInputElement?.select();
    });
  });

  $effect(() => {
    if (!pendingCreateKind || !createInputElement) return;
    queueMicrotask(() => {
      createInputElement?.focus();
      createInputElement?.select();
    });
  });
</script>

<div class="h-full overflow-y-auto bg-dark-bg p-3">
  <div class="mb-2 flex items-center justify-between gap-2">
    <div class="text-xs uppercase tracking-wide text-dark-fg4">Files</div>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded text-dark-fg3 transition-colors hover:bg-dark-bg1/60 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        onclick={() => startCreate("file")}
        title="New file"
        aria-label="Create file"
      >
        <FilePlus class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded text-dark-fg3 transition-colors hover:bg-dark-bg1/60 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        onclick={() => startCreate("folder")}
        title="New folder"
        aria-label="Create folder"
      >
        <FolderPlus class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded text-dark-fg3 transition-colors hover:bg-dark-bg1/60 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        onclick={() => void onOpenInFinder()}
        title="Open in Finder"
        aria-label="Open in Finder"
      >
        <FolderSearch class="h-4 w-4" />
      </button>
    </div>
  </div>

  {#if rows.length === 0 && !pendingCreateKind}
    <div
      class="rounded-lg border border-dark-border bg-dark-bg p-3 text-sm text-dark-fg3"
    >
      Open a folder to load files.
    </div>
  {:else}
    <div class="flex flex-col gap-0">
      {#each rows as entry (entry.key)}
        {#if entry.kind === "create"}
          <div>
            <div
              class="relative flex w-full min-w-0 rounded-md bg-dark-bg1/50 pr-2 text-left text-xs"
            >
              {#if entry.depth > 0}
                <span
                  class="pointer-events-none absolute inset-y-0 flex items-stretch"
                  style={`left: 8px; width: ${entry.depth * 12}px`}
                  aria-hidden="true"
                >
                  {#each buildIndentGuides(entry.depth) as _, index (`${entry.key}-indent-${index}`)}
                    <span class="flex w-3 justify-center">
                      <span class="h-full w-px bg-dark-bg4"></span>
                    </span>
                  {/each}
                </span>
              {/if}
              <span
                class="flex min-w-0 flex-1 items-center gap-1 py-1"
                style={`padding-left: ${8 + entry.depth * 12}px`}
              >
                {#if pendingCreateKind === "folder"}
                  <Folder class="h-4 w-4 shrink-0 text-dark-yellow2/80" />
                {:else}
                  <FilePlus class="h-4 w-4 shrink-0 text-dark-aqua2/80" />
                {/if}
                <input
                  bind:this={createInputElement}
                  type="text"
                  class="min-w-0 flex-1 bg-transparent text-xs text-dark-fg0 outline-none placeholder:text-dark-fg4"
                  bind:value={createDraft}
                  placeholder={pendingCreateKind === "folder"
                    ? "new-folder"
                    : "new-file.txt"}
                  onkeydown={handleCreateKeydown}
                  onblur={() => {
                    if (!inlineBusy) cancelCreate();
                  }}
                  aria-label={pendingCreateKind === "folder"
                    ? "New folder name"
                    : "New file name"}
                />
              </span>
            </div>
            {#if createError}
              <div
                class="px-2 pt-1 text-[11px] text-dark-red2"
                style={`padding-left: ${10 + entry.depth * 12}px`}
              >
                {createError}
              </div>
            {/if}
          </div>
        {:else}
          {@const row = entry.row}
          <div>
            {#if renamingPath === row.absolutePath}
              <div
                class={`relative flex w-full min-w-0 rounded-md bg-dark-bg1/50 pr-2 text-left text-xs ${row.isDirectory ? "text-dark-fg1" : "font-mono text-dark-fg0"}`}
                title={row.absolutePath}
              >
                {#if row.depth > 0}
                  <span
                    class="pointer-events-none absolute inset-y-0 flex items-stretch"
                    style={`left: 8px; width: ${row.depth * 12}px`}
                    aria-hidden="true"
                  >
                    {#each buildIndentGuides(row.depth) as _, index (`${row.key}-indent-${index}`)}
                      <span class="flex w-3 justify-center">
                        <span class="h-full w-px bg-dark-bg4"></span>
                      </span>
                    {/each}
                  </span>
                {/if}
                <span
                  class="flex min-w-0 flex-1 items-center gap-1 py-1"
                  style={`padding-left: ${8 + row.depth * 12}px`}
                >
                  {#if row.isDirectory}
                    {#if expandedDirs[row.key]}
                      <FolderOpen class="h-4 w-4 shrink-0 text-dark-yellow2/80" />
                    {:else}
                      <Folder class="h-4 w-4 shrink-0 text-dark-yellow2/80" />
                    {/if}
                  {:else}
                    <img
                      class="h-4 w-4 shrink-0"
                      src={getRowIconDataUri(row)}
                      alt=""
                      aria-hidden="true"
                      draggable="false"
                    />
                  {/if}
                  <input
                    bind:this={renameInputElement}
                    type="text"
                    class="min-w-0 flex-1 bg-transparent text-xs text-dark-fg0 outline-none placeholder:text-dark-fg4"
                    bind:value={renameDraft}
                    onkeydown={handleRenameKeydown}
                    onblur={() => {
                      if (!inlineBusy) cancelRename();
                    }}
                    aria-label={`Rename ${row.name}`}
                  />
                </span>
              </div>
              {#if renameError}
                <div
                  class="px-2 pt-1 text-[11px] text-dark-red2"
                  style={`padding-left: ${10 + row.depth * 12}px`}
                >
                  {renameError}
                </div>
              {/if}
            {:else}
              <button
                class={rowClassName(row)}
                onclick={() => handleRowClick(row)}
                oncontextmenu={(event) => openRowContextMenu(row, event)}
                title={row.absolutePath}
              >
                {#if row.depth > 0}
                  <span
                    class="pointer-events-none absolute inset-y-0 flex items-stretch"
                    style={`left: 8px; width: ${row.depth * 12}px`}
                    aria-hidden="true"
                  >
                    {#each buildIndentGuides(row.depth) as _, index (`${row.key}-indent-${index}`)}
                      <span class="flex w-3 justify-center">
                        <span class="h-full w-px bg-dark-bg4"></span>
                      </span>
                    {/each}
                  </span>
                {/if}
                <span
                  class="flex min-w-0 items-center gap-1 py-1"
                  style={`padding-left: ${8 + row.depth * 12}px`}
                >
                  {#if row.isDirectory}
                    {#if expandedDirs[row.key]}
                      <FolderOpen class="h-4 w-4 shrink-0 text-dark-yellow2/80" />
                    {:else}
                      <Folder class="h-4 w-4 shrink-0 text-dark-yellow2/80" />
                    {/if}
                  {:else}
                    <img
                      class="h-4 w-4 shrink-0"
                      src={getRowIconDataUri(row)}
                      alt=""
                      aria-hidden="true"
                      draggable="false"
                    />
                  {/if}
                  <span class="truncate">{row.name}</span>
                </span>
              </button>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

{#if rowContextMenu}
  <div
    class="fixed z-[60] w-[148px] rounded-md border border-dark-border bg-dark-surface p-1 shadow-lg shadow-dark-bg/40"
    style={`left: ${rowContextMenu.x}px; top: ${rowContextMenu.y}px;`}
    bind:this={rowContextMenuElement}
    role="menu"
    aria-label="File actions"
  >
    <button
      type="button"
      class="w-full rounded-md px-2 py-1.5 text-left text-xs text-dark-fg2 transition-colors hover:bg-dark-bg1 hover:text-dark-fg0"
      role="menuitem"
      onclick={() => startRenameFromContextMenu()}
    >
      Rename
    </button>
  </div>
{/if}
