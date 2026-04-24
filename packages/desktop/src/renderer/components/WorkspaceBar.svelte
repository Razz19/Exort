<script lang="ts">
  import { Plus, Settings } from "lucide-svelte";
  import WorkspacePreviewFlyout from "./WorkspacePreviewFlyout.svelte";
  import type { AgentSessionSummary } from "../lib/types";

  type WorkspaceEntry = {
    id: string;
    name: string;
    rootPath: string;
    tree: Array<{ path: string; isDirectory: boolean }>;
  };
  type WorkspaceContextMenuState = {
    workspaceId: string;
    x: number;
    y: number;
  };
  const workspaceContextMenuWidthPx = 160;
  const workspaceContextMenuEstimatedHeightPx = 48;
  const workspaceContextMenuViewportPaddingPx = 8;

  let {
    workspaces,
    activeWorkspaceId,
    sessionPreviewsByWorkspaceId,
    activeSessionIdByWorkspaceId,
    onSelect,
    onOpenFolder,
    onOpenSettings,
    onPreviewWorkspace,
    onSelectWorkspaceSession,
    onCloseWorkspace,
  } = $props<{
    workspaces: WorkspaceEntry[];
    activeWorkspaceId: string | null;
    sessionPreviewsByWorkspaceId: Record<string, AgentSessionSummary[]>;
    activeSessionIdByWorkspaceId: Record<string, string | null>;
    onSelect: (id: string) => void;
    onOpenFolder: () => void;
    onOpenSettings: () => void;
    onPreviewWorkspace?: (workspaceId: string) => Promise<void> | void;
    onSelectWorkspaceSession?: (
      workspaceId: string,
      sessionId: string,
    ) => Promise<void> | void;
    onCloseWorkspace?: (workspaceId: string) => Promise<void> | void;
  }>();

  let hoveredWorkspaceId = $state<string | null>(null);
  let hoveredAnchorRect = $state<DOMRect | null>(null);
  let previewLoadingById = $state<Record<string, true>>({});
  let previewCloseTimer = $state<number | null>(null);
  let workspaceContextMenu = $state<WorkspaceContextMenuState | null>(null);
  let workspaceContextMenuElement = $state<HTMLDivElement | null>(null);
  let hoveredWorkspace = $derived(
    workspaces.find((workspace) => workspace.id === hoveredWorkspaceId) ?? null,
  );

  function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function getRootDirectoryName(rootPath: string): string {
    const normalized = normalizePath(rootPath).replace(/\/$/, "");
    const segments = normalized.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? rootPath;
  }

  function getWorkspaceDisplayName(workspace: WorkspaceEntry): string {
    const trimmedName = workspace.name?.trim();
    if (trimmedName) return trimmedName;
    return getRootDirectoryName(workspace.rootPath);
  }

  function getWorkspaceInitial(workspace: WorkspaceEntry): string {
    const source = getWorkspaceDisplayName(workspace).trim();
    if (!source) return "?";
    return source.charAt(0).toUpperCase();
  }

  async function startPreview(
    workspace: WorkspaceEntry,
    anchorElement: HTMLElement,
  ): Promise<void> {
    if (previewCloseTimer) {
      window.clearTimeout(previewCloseTimer);
      previewCloseTimer = null;
    }

    hoveredWorkspaceId = workspace.id;
    hoveredAnchorRect = anchorElement.getBoundingClientRect();
    if (!onPreviewWorkspace || previewLoadingById[workspace.id]) return;

    previewLoadingById = {
      ...previewLoadingById,
      [workspace.id]: true,
    };

    try {
      await onPreviewWorkspace(workspace.id);
    } finally {
      const next = { ...previewLoadingById };
      delete next[workspace.id];
      previewLoadingById = next;
    }
  }

  function stopPreview(workspaceId: string, immediate = false): void {
    if (previewCloseTimer) {
      window.clearTimeout(previewCloseTimer);
      previewCloseTimer = null;
    }

    if (hoveredWorkspaceId === workspaceId) {
      if (immediate) {
        hoveredWorkspaceId = null;
        hoveredAnchorRect = null;
        return;
      }

      previewCloseTimer = window.setTimeout(() => {
        hoveredWorkspaceId = null;
        hoveredAnchorRect = null;
        previewCloseTimer = null;
      }, 120);
    }
  }

  function keepPreviewOpen(): void {
    if (previewCloseTimer) {
      window.clearTimeout(previewCloseTimer);
      previewCloseTimer = null;
    }
  }

  async function handleSelectHoveredWorkspaceSession(
    sessionId: string,
  ): Promise<void> {
    if (!hoveredWorkspaceId || !onSelectWorkspaceSession) return;
    await onSelectWorkspaceSession(hoveredWorkspaceId, sessionId);
    hoveredWorkspaceId = null;
    hoveredAnchorRect = null;
  }

  function openWorkspaceContextMenu(
    workspaceId: string,
    event: MouseEvent,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    const left = clamp(
      Math.round(event.clientX),
      workspaceContextMenuViewportPaddingPx,
      Math.max(
        workspaceContextMenuViewportPaddingPx,
        window.innerWidth -
          workspaceContextMenuWidthPx -
          workspaceContextMenuViewportPaddingPx,
      ),
    );
    const top = clamp(
      Math.round(event.clientY),
      workspaceContextMenuViewportPaddingPx,
      Math.max(
        workspaceContextMenuViewportPaddingPx,
        window.innerHeight -
          workspaceContextMenuEstimatedHeightPx -
          workspaceContextMenuViewportPaddingPx,
      ),
    );

    workspaceContextMenu = {
      workspaceId,
      x: left,
      y: top,
    };
  }

  async function closeWorkspaceFromContextMenu(): Promise<void> {
    const menu = workspaceContextMenu;
    if (!menu) return;
    workspaceContextMenu = null;
    if (!onCloseWorkspace) return;
    await onCloseWorkspace(menu.workspaceId);

    if (hoveredWorkspaceId === menu.workspaceId) {
      hoveredWorkspaceId = null;
      hoveredAnchorRect = null;
    }
  }

  $effect(() => {
    if (!workspaceContextMenu) return;

    const onWindowPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        workspaceContextMenuElement &&
        workspaceContextMenuElement.contains(target)
      ) {
        return;
      }
      workspaceContextMenu = null;
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        workspaceContextMenu = null;
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
    if (!workspaceContextMenu) return;
    const exists = workspaces.some(
      (workspace) => workspace.id === workspaceContextMenu?.workspaceId,
    );
    if (!exists) {
      workspaceContextMenu = null;
    }
  });
</script>

<div
  class="flex h-full min-h-0 flex-col items-center border-r border-dark-border bg-dark-surface py-3"
>
  <button
    class="my-3 flex h-10 w-10 items-center justify-center
    rounded-md border border-dark-yellow bg-dark-surface text-lg leading-none
     text-dark-yellow transition-colors hover:bg-dark-yellow/20 focus:outline-none
     focus:ring-2 focus:ring-primary-500"
    onclick={onOpenFolder}
    aria-label="Open workspace folder"
    title="Open folder"
  >
    <Plus class=" h-5 w-5" />
  </button>
  <div
    class="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-2"
  >
    {#each workspaces as workspace (workspace.id)}
      <div class="relative w-full">
        <button
          class={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-semibold transition-colors  ${
            workspace.id === activeWorkspaceId
              ? "border-primary-500 bg-primary-600/20 text-gray-300"
              : "border-dark-border bg-dark-bg text-gray-300 hover:bg-dark-blue/20"
          }`}
          onclick={() => onSelect(workspace.id)}
          onmouseenter={(event) =>
            void startPreview(
              workspace,
              event.currentTarget as HTMLButtonElement,
            )}
          onmouseleave={() => stopPreview(workspace.id)}
          onfocus={(event) =>
            void startPreview(
              workspace,
              event.currentTarget as HTMLButtonElement,
            )}
          onblur={() => stopPreview(workspace.id)}
          oncontextmenu={(event) =>
            openWorkspaceContextMenu(workspace.id, event)}
          title={workspace.rootPath}
          aria-label={`Select workspace ${getWorkspaceDisplayName(workspace)}`}
        >
          {getWorkspaceInitial(workspace)}
        </button>
      </div>
    {/each}
  </div>
  <div class="mt-3 flex w-full justify-center px-2">
    <button
      class="flex h-10 w-10 items-center justify-center rounded-md border border-dark-border
      bg-dark-bg text-dark-fg2 transition-colors hover:bg-dark-blue/20 hover:text-dark-fg"
      onclick={() => onOpenSettings()}
      aria-label="Open settings"
      title="Settings"
    >
      <Settings class="h-4 w-4" />
    </button>
  </div>
</div>

{#if workspaceContextMenu}
  <div
    class="fixed z-[60] w-40 rounded-md border border-dark-border bg-dark-surface p-1 shadow-lg shadow-dark-bg/40"
    style={`left: ${workspaceContextMenu.x}px; top: ${workspaceContextMenu.y}px;`}
    bind:this={workspaceContextMenuElement}
    role="menu"
    aria-label="Workspace actions"
  >
    <button
      type="button"
      class="w-full rounded-md px-2 py-1.5 text-left text-xs text-dark-fg2 transition-colors hover:bg-dark-red/20 hover:text-dark-red"
      role="menuitem"
      onclick={() => void closeWorkspaceFromContextMenu()}
    >
      Close Workspace
    </button>
  </div>
{/if}

<WorkspacePreviewFlyout
  workspace={hoveredWorkspace}
  sessions={hoveredWorkspaceId
    ? (sessionPreviewsByWorkspaceId[hoveredWorkspaceId] ?? [])
    : []}
  activeSessionId={hoveredWorkspaceId
    ? (activeSessionIdByWorkspaceId[hoveredWorkspaceId] ?? null)
    : null}
  anchorRect={hoveredAnchorRect}
  onHover={keepPreviewOpen}
  onLeave={() => hoveredWorkspaceId && stopPreview(hoveredWorkspaceId, true)}
  onSelectSession={handleSelectHoveredWorkspaceSession}
  loading={hoveredWorkspaceId
    ? !!previewLoadingById[hoveredWorkspaceId]
    : false}
/>
