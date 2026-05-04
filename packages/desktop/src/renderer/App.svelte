<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import ChatPanel from "./components/ChatPanel.svelte";
  import AppNavbar from "./components/AppNavbar.svelte";
  import OutputWindow from "./components/OutputWindow.svelte";
  import PaneManager from "./components/Panes/PaneManager.svelte";
  import SettingsModal from "./components/settings/SettingsModal.svelte";
  import WorkspaceBar from "./components/WorkspaceBar.svelte";
  import {
    applyRuntimeEventToSyncState,
    createAgentSyncState,
    renameMessageIdInSyncState,
    replaceSessionMessagesInSyncState,
    upsertPendingInterruptsToSyncState,
  } from "./lib/agent-sync/state";
  import { buildRenderMessagesFromSyncState } from "./lib/agent-sync/render";
  import { mergeAssistantContent } from "./lib/agent-sync/contentMerge";
  import {
    resolveSelectedModel,
    sameSelectedModel,
  } from "./lib/modelCatalog";
  import {
    applyInterruptStreamEventInMessages,
    upsertPendingPermissionInMessages,
    upsertPendingQuestionInMessages,
  } from "./lib/agent-sync/eventReducer";
  import {
    upsertMessageStepInMessages,
    updateStepByRequestIdInMessages,
  } from "./lib/agent-sync/store";
  import type {
    AgentRuntimeStreamEvent,
    AgentSyncState,
  } from "./lib/agent-sync/types";
  import {
    CHAT_MAX_WIDTH_PCT,
    CHAT_MIN_WIDTH_PCT,
    EDITOR_MAX_WIDTH_PCT,
    EDITOR_MIN_WIDTH_PCT,
    createDefaultAppState,
    createDefaultWorkspaceManagerState,
  } from "./lib/state/defaults";
  import {
    appStateStore,
    hydrateStateManager,
    patchAppState,
    patchWorkspaceManagerState,
    touchRecentWorkspace,
    upsertWorkspaceState,
    workspaceManagerStore,
  } from "./lib/state/stateManager";
  import type { ChatFontSizePreset, MonacoThemeId } from "./lib/state/types";
  import type {
    AgentPermissionReply,
    AgentPendingInterrupts,
    AgentQuestionInfo,
    AgentSessionSummary,
    AgentStep,
    ArduinoOutputEvent,
    ArduinoOutputRun,
    AppState,
    ChatItem,
    OpenFile,
    PaneTab,
    Workspace,
    WorkspaceManagerState,
    WorkspaceState,
  } from "./lib/types";

  const OUTPUT_WINDOW_HEIGHT_PCT = 20;
  type SettingsTab = "general" | "providers" | "boards";

  function buildEffectiveBoardFqbn(
    baseFqbn: string,
    optionSelections: Record<string, string>,
  ): string {
    const normalizedBase = baseFqbn.trim();
    if (!normalizedBase) return "";

    const optionEntries = Object.entries(optionSelections)
      .map(([optionId, valueId]) => [optionId.trim(), valueId.trim()] as const)
      .filter(([optionId, valueId]) => optionId.length > 0 && valueId.length > 0)
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));

    if (optionEntries.length === 0) return normalizedBase;
    const optionSuffix = optionEntries
      .map(([optionId, valueId]) => `${optionId}=${valueId}`)
      .join(",");
    return `${normalizedBase}:${optionSuffix}`;
  }

  let agentBusy = $state(false);
  let stoppingAgentTurn = $state(false);
  let activeAgentRequestId = $state<string | null>(null);
  let sessionBusy = $state(false);
  let statusText = $state("Local mode");
  let workspacesBootstrapped = false;

  let appStateSnapshot = $state<AppState>(createDefaultAppState());
  let workspaceManagerSnapshot = $state<WorkspaceManagerState>(
    createDefaultWorkspaceManagerState(),
  );
  let unsubscribeAppState: (() => void) | null = null;
  let unsubscribeWorkspaceState: (() => void) | null = null;

  let workspaces = $state<Workspace[]>([]);
  let activeWorkspaceId = $state<string | null>(null);

  let activeFilePath = $state<string | null>(null);
  let openFiles = $state<Record<string, OpenFile>>({});
  let openFileOrder = $state<string[]>([]);
  let autosaveTimer = $state<number | null>(null);

  let messages = $state<ChatItem[]>([]);
  let workspaceMessagesByRoot = $state<Record<string, ChatItem[]>>({});
  let workspaceSyncStateByRoot = $state<Record<string, AgentSyncState>>({});
  let historyLoadedSessionKeyByRoot = $state<Record<string, string>>({});
  let sessionPreviewsByWorkspaceId = $state<
    Record<string, AgentSessionSummary[]>
  >({});
  let sessionListLoadedByRoot = $state<Record<string, true>>({});
  let workspaceTreeLoadedByRoot = $state<Record<string, true>>({});
  let outputExpanded = $state(false);
  let settingsModalOpen = $state(false);
  let navbarOverlayOpen = $state(false);
  let settingsModalTab = $state<SettingsTab>("general");
  let arduinoEnvironmentRefreshKey = $state(0);
  let outputRun = $state<ArduinoOutputRun | null>(null);
  let draggingSplitter = $state<"outer" | "inner" | null>(null);
  let outerSplitContainerEl = $state<HTMLDivElement | null>(null);
  let innerSplitContainerEl = $state<HTMLDivElement | null>(null);
  let watchedWorkspaceRoot: string | null = null;
  let workspaceWatchRequestId = 0;

  let activeWorkspace = $derived(
    workspaces.find((item) => item.id === activeWorkspaceId) ?? null,
  );
  let activeWorkspaceState = $derived(
    activeWorkspace
      ? (workspaceManagerSnapshot.byRoot[activeWorkspace.rootPath] ?? null)
      : null,
  );
  let chatWidthPct = $derived(appStateSnapshot.layout.chatWidthPct);
  let chatCollapsed = $derived(appStateSnapshot.layout.chatCollapsed ?? false);
  let editorWidthPct = $derived(appStateSnapshot.layout.editorWidthPct);
  let chatFontSize = $derived<ChatFontSizePreset>(
    appStateSnapshot.appearance.chatFontSize ?? "default",
  );
  let fileManagerCollapsed = $derived(
    appStateSnapshot.layout.fileManagerCollapsed ?? false,
  );
  let monacoTheme = $derived<MonacoThemeId>(
    appStateSnapshot.appearance.monacoTheme,
  );
  let selectedBoardFqbn = $derived(activeWorkspaceState?.boardFqbn ?? "");
  let boardOptionSelections = $derived(
    activeWorkspaceState?.boardOptionSelections ?? {},
  );
  let effectiveBoardFqbn = $derived.by(() =>
    buildEffectiveBoardFqbn(selectedBoardFqbn, boardOptionSelections),
  );
  let selectedPort = $derived(activeWorkspaceState?.serialPort ?? "");
  let favoriteBoardFqbns = $derived(
    workspaceManagerSnapshot.favoriteBoardFqbns ?? [],
  );
  let activeWorkspaceExpandedDirKeys = $derived(
    activeWorkspaceState?.expandedDirKeys ?? [],
  );
  let activePaneTab = $derived(activeWorkspaceState?.activePaneTab ?? "code");
  let activeFile = $derived(
    activeFilePath ? (openFiles[activeFilePath] ?? null) : null,
  );
  let visibleOpenFileTabs = $derived(
    openFileOrder.filter(
      (filePath) =>
        !!openFiles[filePath] &&
        (activeWorkspace
          ? isPathInWorkspace(filePath, activeWorkspace.rootPath)
          : true),
    ),
  );
  let activeSessionIdByWorkspaceId = $derived.by(() => {
    const byWorkspaceId: Record<string, string | null> = {};
    for (const workspace of workspaces) {
      byWorkspaceId[workspace.id] =
        workspaceManagerSnapshot.byRoot[workspace.rootPath]?.currentSessionId ??
        null;
    }
    return byWorkspaceId;
  });
  let renderedMessages = $derived.by(() => {
    if (!activeWorkspace) return messages;

    const workspaceRoot = activeWorkspace.rootPath;
    const persistedSessionId = normalizeSessionId(
      getPersistedWorkspaceState(workspaceRoot)?.currentSessionId,
    );
    const sessionKey = getHistoryCacheSessionKey(persistedSessionId);
    const syncState = getSyncStateForWorkspaceRoot(workspaceRoot);
    const baseMessages = getMessagesForWorkspaceRoot(workspaceRoot);

    return buildRenderMessagesFromSyncState({
      messages: baseMessages,
      syncState,
      sessionKey,
    });
  });
  let activeChatSessionStatus = $derived.by(() => {
    if (!activeWorkspace) return "idle";

    const workspaceRoot = activeWorkspace.rootPath;
    const persistedSessionId = normalizeSessionId(
      getPersistedWorkspaceState(workspaceRoot)?.currentSessionId,
    );
    const sessionKey = getHistoryCacheSessionKey(persistedSessionId);
    const syncState = getSyncStateForWorkspaceRoot(workspaceRoot);
    const status = syncState.session_status[sessionKey]?.type;
    if (status === "running" || status === "idle" || status === "error") {
      return status;
    }
    return agentBusy ? "running" : "idle";
  });

  const watchedFilePaths: Record<string, true> = {};
  const fileChangedListener = (payload: {
    filePath: string;
    content: string;
  }) => {
    const current = openFiles[payload.filePath];
    if (!current) return;
    if (current.dirty) return;

    openFiles = {
      ...openFiles,
      [payload.filePath]: {
        ...current,
        content: payload.content,
        dirty: false,
      },
    };
  };

  const workspaceTreeChangedListener = (payload: {
    rootPath: string;
    tree: Array<{ path: string; isDirectory: boolean }>;
  }) => {
    applyWorkspaceTreeUpdate(payload.rootPath, payload.tree);
  };

  function applyWorkspaceTreeUpdate(
    rootPath: string,
    tree: Array<{ path: string; isDirectory: boolean }>,
  ): void {
    workspaces = workspaces.map((workspace) =>
      workspace.rootPath === rootPath
        ? {
            ...workspace,
            tree,
          }
        : workspace,
    );

    workspaceTreeLoadedByRoot = {
      ...workspaceTreeLoadedByRoot,
      [rootPath]: true,
    };

    const workspace = workspaces.find((item) => item.rootPath === rootPath);
    upsertWorkspaceState(rootPath, {
      workspaceName: workspace?.name ?? "",
      lastOpenedAt: new Date().toISOString(),
      fileTree: tree,
    });
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function normalizeSessionId(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function getHistoryCacheSessionKey(sessionId: string | null): string {
    return sessionId ?? "auto";
  }

  function isPathInWorkspace(filePath: string, workspaceRoot: string): boolean {
    const normalizedWorkspaceRoot = normalizePath(workspaceRoot).replace(
      /\/$/,
      "",
    );
    const normalizedFilePath = normalizePath(filePath);

    if (normalizedFilePath === normalizedWorkspaceRoot) return true;
    return normalizedFilePath.startsWith(`${normalizedWorkspaceRoot}/`);
  }

  function beginResize(splitter: "outer" | "inner", event: PointerEvent): void {
    event.preventDefault();
    draggingSplitter = splitter;
  }

  function getPersistedWorkspaceState(rootPath: string): WorkspaceState | null {
    return workspaceManagerSnapshot.byRoot[rootPath] ?? null;
  }

  function persistWorkspaceMetadata(
    workspace: Workspace,
    patch: Partial<Omit<WorkspaceState, "rootPath">> = {},
  ): void {
    upsertWorkspaceState(workspace.rootPath, {
      workspaceName: workspace.name,
      lastOpenedAt: new Date().toISOString(),
      ...patch,
    });
  }

  function persistActiveWorkspaceEditorState(
    nextActiveFilePath = activeFilePath,
  ): void {
    if (!activeWorkspace) return;

    const workspaceRoot = activeWorkspace.rootPath;
    const workspaceOpenFileOrder = openFileOrder.filter(
      (filePath) =>
        !!openFiles[filePath] && isPathInWorkspace(filePath, workspaceRoot),
    );
    const normalizedActiveFilePath =
      nextActiveFilePath && workspaceOpenFileOrder.includes(nextActiveFilePath)
        ? nextActiveFilePath
        : (workspaceOpenFileOrder[0] ?? null);

    persistWorkspaceMetadata(activeWorkspace, {
      openFileOrder: workspaceOpenFileOrder,
      activeFilePath: normalizedActiveFilePath,
    });
  }

  async function ensureWatchedFile(filePath: string): Promise<void> {
    if (watchedFilePaths[filePath]) return;
    watchedFilePaths[filePath] = true;
    await window.electronAPI.watchFile(filePath);
  }

  async function restoreWorkspaceOpenFiles(
    workspaceRoot: string,
  ): Promise<void> {
    const persisted = getPersistedWorkspaceState(workspaceRoot);
    const desiredOrder = (persisted?.openFileOrder ?? []).filter((filePath) =>
      isPathInWorkspace(filePath, workspaceRoot),
    );
    const restoredOrder: string[] = [];
    const nextOpenFiles = { ...openFiles };

    for (const filePath of desiredOrder) {
      try {
        if (!nextOpenFiles[filePath]) {
          const result = await window.electronAPI.readFile(filePath);
          nextOpenFiles[filePath] = {
            path: filePath,
            content: result.content,
            dirty: false,
          };
        }
        await ensureWatchedFile(filePath);
        restoredOrder.push(filePath);
      } catch {
        // Ignore stale paths that no longer exist on disk.
      }
    }

    openFiles = nextOpenFiles;
    openFileOrder = restoredOrder;

    const nextActive =
      persisted?.activeFilePath &&
      restoredOrder.includes(persisted.activeFilePath)
        ? persisted.activeFilePath
        : (restoredOrder[0] ?? null);
    activeFilePath = nextActive;

    if (activeWorkspace?.rootPath === workspaceRoot) {
      persistActiveWorkspaceEditorState(nextActive);
    }
  }

  async function syncWorkspaceTreeWatch(
    nextRootPath: string | null,
  ): Promise<void> {
    const requestId = ++workspaceWatchRequestId;
    const previousRootPath = watchedWorkspaceRoot;
    if (previousRootPath === nextRootPath) return;

    if (previousRootPath) {
      await window.electronAPI.unwatchWorkspaceTree(previousRootPath);
    }

    if (requestId !== workspaceWatchRequestId) return;
    watchedWorkspaceRoot = null;

    if (nextRootPath) {
      const result = await window.electronAPI.watchWorkspaceTree(nextRootPath);
      if (!result.ok) return;
    }

    if (requestId !== workspaceWatchRequestId) return;
    watchedWorkspaceRoot = nextRootPath;
  }

  onMount(() => {
    unsubscribeAppState = appStateStore.subscribe((state) => {
      appStateSnapshot = state;
    });
    unsubscribeWorkspaceState = workspaceManagerStore.subscribe((state) => {
      workspaceManagerSnapshot = state;
    });

    window.electronAPI.onFileChanged(fileChangedListener);
    window.electronAPI.onWorkspaceTreeChanged(workspaceTreeChangedListener);

    void initializeApp();
  });

  onDestroy(() => {
    if (unsubscribeAppState) {
      unsubscribeAppState();
      unsubscribeAppState = null;
    }
    if (unsubscribeWorkspaceState) {
      unsubscribeWorkspaceState();
      unsubscribeWorkspaceState = null;
    }

    window.electronAPI.offFileChanged(fileChangedListener);
    window.electronAPI.offWorkspaceTreeChanged(workspaceTreeChangedListener);
    void window.electronAPI.unwatchAllFiles();
    void window.electronAPI.unwatchAllWorkspaceTrees();

    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  });

  $effect(() => {
    void syncWorkspaceTreeWatch(activeWorkspace?.rootPath ?? null);
  });

  $effect(() => {
    if (!activeWorkspace) return;

    if (
      activeFilePath &&
      isPathInWorkspace(activeFilePath, activeWorkspace.rootPath) &&
      openFiles[activeFilePath]
    ) {
      return;
    }

    const nextActive = visibleOpenFileTabs[0] ?? null;
    if (nextActive === activeFilePath) return;
    activeFilePath = nextActive;
    persistActiveWorkspaceEditorState(nextActive);
  });

  $effect(() => {
    if (!draggingSplitter) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (draggingSplitter === "outer") {
        const container = outerSplitContainerEl;
        if (!container) return;
        const bounds = container.getBoundingClientRect();
        if (!bounds.width) return;
        const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
        patchAppState({
          layout: {
            chatWidthPct: clamp(
              nextWidth,
              CHAT_MIN_WIDTH_PCT,
              CHAT_MAX_WIDTH_PCT,
            ),
          },
        });
        return;
      }

      const container = innerSplitContainerEl;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      if (!bounds.width) return;
      const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
      patchAppState({
        layout: {
          editorWidthPct: clamp(
            nextWidth,
            EDITOR_MIN_WIDTH_PCT,
            EDITOR_MAX_WIDTH_PCT,
          ),
        },
      });
    };

    const handlePointerUp = () => {
      draggingSplitter = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  });

  async function initializeApp(): Promise<void> {
    try {
      await hydrateStateManager();
    } catch (error) {
      statusText =
        error instanceof Error ? error.message : "Failed to load app state";
    }

    await initializeSavedWorkspaces();
    if (statusText === "Local mode") {
      statusText = "Local mode ready";
    }
  }

  async function initializeSavedWorkspaces(): Promise<void> {
    if (workspacesBootstrapped) return;

    const saved = await window.electronAPI.listSavedWorkspaces();
    workspaces = saved.map((workspace) => ({
      ...workspace,
      tree: getPersistedWorkspaceState(workspace.rootPath)?.fileTree ?? [],
    }));

    if (workspaces.length > 0) {
      const preferredRoot = appStateSnapshot.activeWorkspaceRoot;
      const targetWorkspace =
        (preferredRoot &&
          workspaces.find((item) => item.rootPath === preferredRoot)) ??
        workspaces[0];
      activeWorkspaceId = targetWorkspace.id;
      patchAppState({ activeWorkspaceRoot: targetWorkspace.rootPath });
      touchRecentWorkspace(targetWorkspace.rootPath);
      persistWorkspaceMetadata(targetWorkspace, {
        fileTree: targetWorkspace.tree,
      });
      messages = workspaceMessagesByRoot[targetWorkspace.rootPath] ?? [];
      await restoreWorkspaceOpenFiles(targetWorkspace.rootPath);
      await ensureWorkspaceTree(targetWorkspace.id);
      await ensureWorkspaceSessions(targetWorkspace.id);
      await loadWorkspaceHistory(targetWorkspace.id);
    } else {
      patchAppState({ activeWorkspaceRoot: null });
      activeFilePath = null;
      openFileOrder = [];
    }

    workspacesBootstrapped = true;
  }

  async function ensureWorkspaceTree(workspaceId: string): Promise<void> {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace || workspaceTreeLoadedByRoot[workspace.rootPath]) return;

    const tree = await window.electronAPI.getWorkspaceTree(workspace.rootPath);
    applyWorkspaceTreeUpdate(workspace.rootPath, tree);
  }

  async function refreshWorkspaceTree(rootPath: string): Promise<void> {
    const tree = await window.electronAPI.getWorkspaceTree(rootPath);
    applyWorkspaceTreeUpdate(rootPath, tree);
  }

  async function ensureWorkspaceSessions(
    workspaceId: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;

    const force = options.force === true;
    if (!force && sessionListLoadedByRoot[workspace.rootPath]) return;

    const result = await window.electronAPI.listAgentSessions({
      workspaceRoot: workspace.rootPath,
    });

    if (!result.ok) {
      statusText = result.error ?? "Failed to load workspace sessions";
      return;
    }

    sessionPreviewsByWorkspaceId = {
      ...sessionPreviewsByWorkspaceId,
      [workspace.id]: result.sessions ?? [],
    };
    sessionListLoadedByRoot = {
      ...sessionListLoadedByRoot,
      [workspace.rootPath]: true,
    };
  }

  async function openFolder() {
    try {
      const result = await window.electronAPI.openFolder();
      if (result.cancelled || !result.workspace || !result.tree) return;

      const nextWorkspace: Workspace = {
        ...result.workspace,
        tree: result.tree,
      };

      workspaces = [
        nextWorkspace,
        ...workspaces.filter(
          (item) => item.rootPath !== nextWorkspace.rootPath,
        ),
      ];
      workspaceTreeLoadedByRoot = {
        ...workspaceTreeLoadedByRoot,
        [nextWorkspace.rootPath]: true,
      };
      touchRecentWorkspace(nextWorkspace.rootPath);
      patchAppState({ activeWorkspaceRoot: nextWorkspace.rootPath });
      persistWorkspaceMetadata(nextWorkspace, {
        fileTree: result.tree,
      });
      activeWorkspaceId = nextWorkspace.id;
      messages = workspaceMessagesByRoot[nextWorkspace.rootPath] ?? [];
      await restoreWorkspaceOpenFiles(nextWorkspace.rootPath);
      await ensureWorkspaceSessions(nextWorkspace.id, { force: true });
      await loadWorkspaceHistory(nextWorkspace.id, { force: true });
      statusText = `Workspace loaded: ${nextWorkspace.rootPath}`;
    } catch (error) {
      statusText =
        error instanceof Error ? error.message : "Failed to open folder";
    }
  }

  function openSettingsModal(initialTab: unknown = "general"): void {
    if (initialTab === "boards") {
      settingsModalTab = "boards";
    } else if (initialTab === "providers") {
      settingsModalTab = "providers";
    } else {
      settingsModalTab = "general";
    }
    settingsModalOpen = true;
  }

  function closeSettingsModal(): void {
    settingsModalOpen = false;
  }

  function handleRequirementsUpdated(requirements: RequirementStatus[]): void {
    const hasArduinoCliStatus = requirements.some(
      (requirement) => requirement.id === "arduino-cli",
    );
    if (!hasArduinoCliStatus) return;
    arduinoEnvironmentRefreshKey += 1;
  }

  async function selectWorkspace(
    workspaceId: string,
    options: {
      sessionId?: string;
      forceHistory?: boolean;
    } = {},
  ): Promise<void> {
    activeWorkspaceId = workspaceId;
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;
    const selectedSessionId = normalizeSessionId(options.sessionId);

    patchAppState({ activeWorkspaceRoot: workspace.rootPath });
    touchRecentWorkspace(workspace.rootPath);
    persistWorkspaceMetadata(
      workspace,
      selectedSessionId ? { currentSessionId: selectedSessionId } : {},
    );
    messages = workspaceMessagesByRoot[workspace.rootPath] ?? [];
    await restoreWorkspaceOpenFiles(workspace.rootPath);
    await ensureWorkspaceTree(workspaceId);
    await ensureWorkspaceSessions(workspaceId);

    if (selectedSessionId) {
      const nextLoaded = { ...historyLoadedSessionKeyByRoot };
      delete nextLoaded[workspace.rootPath];
      historyLoadedSessionKeyByRoot = nextLoaded;
    }

    await loadWorkspaceHistory(workspaceId, {
      sessionId: selectedSessionId ?? undefined,
      force:
        options.forceHistory === true ||
        normalizeSessionId(options.sessionId) !== null,
    });
  }

  async function removeWorkspace(workspaceId: string): Promise<void> {
    const currentWorkspaces = [...workspaces];
    const removeIndex = currentWorkspaces.findIndex(
      (item) => item.id === workspaceId,
    );
    if (removeIndex === -1) return;

    const workspace = currentWorkspaces[removeIndex];
    if (!workspace) return;

    const remainingWorkspaces = currentWorkspaces.filter(
      (item) => item.id !== workspaceId,
    );
    const closingActiveWorkspace = activeWorkspaceId === workspaceId;
    const nextActiveWorkspace =
      closingActiveWorkspace && remainingWorkspaces.length > 0
        ? (remainingWorkspaces[
            Math.min(removeIndex, remainingWorkspaces.length - 1)
          ] ?? null)
        : null;

    const removeResult = await window.electronAPI.removeSavedWorkspace({
      rootPath: workspace.rootPath,
    });
    if (!removeResult.ok) {
      statusText = removeResult.error ?? "Failed to close workspace";
      return;
    }

    const removedWorkspaceFilePaths = Object.keys(openFiles).filter(
      (filePath) => isPathInWorkspace(filePath, workspace.rootPath),
    );

    for (const filePath of removedWorkspaceFilePaths) {
      if (!watchedFilePaths[filePath]) continue;
      delete watchedFilePaths[filePath];
      await window.electronAPI.unwatchFile(filePath).catch(() => undefined);
    }

    const nextOpenFiles = { ...openFiles };
    for (const filePath of removedWorkspaceFilePaths) {
      delete nextOpenFiles[filePath];
    }
    openFiles = nextOpenFiles;

    const nextOpenFileOrder = openFileOrder.filter(
      (filePath) => !isPathInWorkspace(filePath, workspace.rootPath),
    );
    openFileOrder = nextOpenFileOrder;
    if (
      activeFilePath &&
      isPathInWorkspace(activeFilePath, workspace.rootPath)
    ) {
      activeFilePath = nextOpenFileOrder[0] ?? null;
    }

    workspaces = remainingWorkspaces;

    const nextSessionPreviewsByWorkspaceId = {
      ...sessionPreviewsByWorkspaceId,
    };
    delete nextSessionPreviewsByWorkspaceId[workspace.id];
    sessionPreviewsByWorkspaceId = nextSessionPreviewsByWorkspaceId;

    const nextWorkspaceMessagesByRoot = { ...workspaceMessagesByRoot };
    delete nextWorkspaceMessagesByRoot[workspace.rootPath];
    workspaceMessagesByRoot = nextWorkspaceMessagesByRoot;

    const nextWorkspaceSyncStateByRoot = { ...workspaceSyncStateByRoot };
    delete nextWorkspaceSyncStateByRoot[workspace.rootPath];
    workspaceSyncStateByRoot = nextWorkspaceSyncStateByRoot;

    const nextHistoryLoadedSessionKeyByRoot = {
      ...historyLoadedSessionKeyByRoot,
    };
    delete nextHistoryLoadedSessionKeyByRoot[workspace.rootPath];
    historyLoadedSessionKeyByRoot = nextHistoryLoadedSessionKeyByRoot;

    const nextSessionListLoadedByRoot = { ...sessionListLoadedByRoot };
    delete nextSessionListLoadedByRoot[workspace.rootPath];
    sessionListLoadedByRoot = nextSessionListLoadedByRoot;

    const nextWorkspaceTreeLoadedByRoot = { ...workspaceTreeLoadedByRoot };
    delete nextWorkspaceTreeLoadedByRoot[workspace.rootPath];
    workspaceTreeLoadedByRoot = nextWorkspaceTreeLoadedByRoot;

    if (closingActiveWorkspace) {
      if (nextActiveWorkspace) {
        await selectWorkspace(nextActiveWorkspace.id, { forceHistory: true });
      } else {
        activeWorkspaceId = null;
        messages = [];
        activeFilePath = null;
        patchAppState({ activeWorkspaceRoot: null });
      }
    }

    statusText = `Workspace closed: ${workspace.name || workspace.rootPath}`;
  }

  function setMessagesForWorkspaceRoot(
    workspaceRoot: string,
    next: ChatItem[],
  ): void {
    workspaceMessagesByRoot = {
      ...workspaceMessagesByRoot,
      [workspaceRoot]: next,
    };

    if (activeWorkspace?.rootPath === workspaceRoot) {
      messages = next;
    }
  }

  function getMessagesForWorkspaceRoot(workspaceRoot: string): ChatItem[] {
    if (workspaceMessagesByRoot[workspaceRoot]) {
      return workspaceMessagesByRoot[workspaceRoot];
    }

    if (activeWorkspace?.rootPath === workspaceRoot) {
      return messages;
    }

    return [];
  }

  function getSyncStateForWorkspaceRoot(workspaceRoot: string): AgentSyncState {
    return workspaceSyncStateByRoot[workspaceRoot] ?? createAgentSyncState();
  }

  function setSyncStateForWorkspaceRoot(
    workspaceRoot: string,
    nextState: AgentSyncState,
  ): void {
    workspaceSyncStateByRoot = {
      ...workspaceSyncStateByRoot,
      [workspaceRoot]: nextState,
    };
  }

  function applyInterruptEventToSyncWorkspace(
    workspaceRoot: string,
    event: AgentRuntimeStreamEvent,
  ): void {
    const sessionId = normalizeSessionId(
      getPersistedWorkspaceState(workspaceRoot)?.currentSessionId,
    );
    const nextState = applyRuntimeEventToSyncState({
      state: getSyncStateForWorkspaceRoot(workspaceRoot),
      sessionId: getHistoryCacheSessionKey(sessionId),
      assistantMessageId: "__interrupt__",
      event,
    });
    setSyncStateForWorkspaceRoot(workspaceRoot, nextState);
  }

  async function loadWorkspaceHistory(
    workspaceId: string,
    options: {
      sessionId?: string;
      force?: boolean;
    } = {},
  ): Promise<void> {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;
    const force = options.force === true;
    const persistedSessionId = normalizeSessionId(
      getPersistedWorkspaceState(workspace.rootPath)?.currentSessionId,
    );
    const requestedSessionId =
      normalizeSessionId(options.sessionId) ?? persistedSessionId;
    const requestedKey = getHistoryCacheSessionKey(requestedSessionId);
    if (
      !force &&
      historyLoadedSessionKeyByRoot[workspace.rootPath] === requestedKey
    ) {
      return;
    }

    let effectiveSessionId = requestedSessionId;
    let result = await window.electronAPI.getAgentHistory({
      workspaceRoot: workspace.rootPath,
      limit: 100,
      sessionId: requestedSessionId ?? undefined,
    });

    if (!result.ok) {
      if (requestedSessionId) {
        persistWorkspaceMetadata(workspace, {
          currentSessionId: null,
        });
        await ensureWorkspaceSessions(workspaceId, { force: true });
        effectiveSessionId = null;
        result = await window.electronAPI.getAgentHistory({
          workspaceRoot: workspace.rootPath,
          limit: 100,
        });
      }
    }

    if (!result.ok) {
      statusText = result.error ?? "Failed to load session history";
      return;
    }

    const loaded = (result.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));

    const syncSessionId = getHistoryCacheSessionKey(effectiveSessionId);
    const syncState = replaceSessionMessagesInSyncState({
      state: getSyncStateForWorkspaceRoot(workspace.rootPath),
      sessionId: syncSessionId,
      messages: loaded,
    });
    setSyncStateForWorkspaceRoot(workspace.rootPath, syncState);

    setMessagesForWorkspaceRoot(workspace.rootPath, loaded);
    historyLoadedSessionKeyByRoot = {
      ...historyLoadedSessionKeyByRoot,
      [workspace.rootPath]: getHistoryCacheSessionKey(effectiveSessionId),
    };

    await syncWorkspacePendingInterrupts(workspace.id, {
      sessionId: effectiveSessionId ?? undefined,
    });
  }

  async function syncWorkspacePendingInterrupts(
    workspaceId: string,
    options: {
      sessionId?: string;
    } = {},
  ): Promise<void> {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;

    const sessionId =
      normalizeSessionId(options.sessionId) ??
      normalizeSessionId(
        getPersistedWorkspaceState(workspace.rootPath)?.currentSessionId,
      );

    const result = await window.electronAPI.listAgentPendingInterrupts({
      workspaceRoot: workspace.rootPath,
      sessionId: sessionId ?? undefined,
    });

    if (!result.ok) {
      statusText =
        result.error ?? "Failed to load pending permissions/questions";
      return;
    }

    const pending: AgentPendingInterrupts = result.pending ?? {
      permissions: [],
      questions: [],
    };
    const syncSessionId = getHistoryCacheSessionKey(sessionId);
    const syncState = upsertPendingInterruptsToSyncState({
      state: getSyncStateForWorkspaceRoot(workspace.rootPath),
      sessionId: syncSessionId,
      pending,
    });
    setSyncStateForWorkspaceRoot(workspace.rootPath, syncState);

    for (const permission of pending.permissions) {
      upsertPermissionStep(workspace.rootPath, {
        requestId: permission.id,
        sessionId: permission.sessionId,
        toolCallId: permission.toolCallId,
        messageId: permission.messageId,
        title: permission.title,
      });
    }

    for (const question of pending.questions) {
      upsertQuestionStep(workspace.rootPath, {
        requestId: question.id,
        sessionId: question.sessionId,
        toolCallId: question.toolCallId,
        messageId: question.messageId,
        questions: question.questions,
      });
    }
  }

  async function handlePermissionReply(
    requestId: string,
    reply: AgentPermissionReply,
  ): Promise<void> {
    if (!activeWorkspace) return;
    const workspace = activeWorkspace;

    const result = await window.electronAPI.replyAgentPermission({
      workspaceRoot: workspace.rootPath,
      requestId,
      reply,
    });

    if (!result.ok) {
      statusText = result.error ?? "Failed to respond to permission request";
      updateStepByRequestId(workspace.rootPath, requestId, (step) => ({
        ...step,
        status: "error",
        detail: result.error ?? "Permission response failed",
      }));
      return;
    }

    updateStepByRequestId(workspace.rootPath, requestId, (step) => ({
      ...step,
      status: reply === "reject" ? "error" : "ok",
      permission: {
        title: step.permission?.title ?? step.detail ?? "Permission request",
        reply,
      },
      detail:
        reply === "reject"
          ? "Permission rejected"
          : reply === "always"
            ? "Permission allowed for this pattern"
            : "Permission allowed once",
    }));
    applyInterruptEventToSyncWorkspace(workspace.rootPath, {
      type: "permission_replied",
      requestId,
      sessionId:
        normalizeSessionId(
          getPersistedWorkspaceState(workspace.rootPath)?.currentSessionId,
        ) ?? "auto",
      reply,
    });

    statusText = "Permission response sent";
  }

  async function handleQuestionReply(
    requestId: string,
    answers: string[][],
  ): Promise<void> {
    if (!activeWorkspace) return;
    const workspace = activeWorkspace;

    const result = await window.electronAPI.replyAgentQuestion({
      workspaceRoot: workspace.rootPath,
      requestId,
      answers,
    });

    if (!result.ok) {
      statusText = result.error ?? "Failed to submit question answers";
      updateStepByRequestId(workspace.rootPath, requestId, (step) => ({
        ...step,
        status: "error",
        detail: result.error ?? "Question reply failed",
      }));
      return;
    }

    updateStepByRequestId(workspace.rootPath, requestId, (step) => ({
      ...step,
      status: "ok",
      question: {
        questions: step.question?.questions ?? [],
        answers,
        rejected: false,
      },
      detail: "Question answered",
    }));
    applyInterruptEventToSyncWorkspace(workspace.rootPath, {
      type: "question_replied",
      requestId,
      sessionId:
        normalizeSessionId(
          getPersistedWorkspaceState(workspace.rootPath)?.currentSessionId,
        ) ?? "auto",
      answers,
    });

    statusText = "Question answered";
  }

  async function handleQuestionReject(requestId: string): Promise<void> {
    if (!activeWorkspace) return;
    const workspace = activeWorkspace;

    const result = await window.electronAPI.rejectAgentQuestion({
      workspaceRoot: workspace.rootPath,
      requestId,
    });

    if (!result.ok) {
      statusText = result.error ?? "Failed to reject question";
      updateStepByRequestId(workspace.rootPath, requestId, (step) => ({
        ...step,
        status: "error",
        detail: result.error ?? "Question rejection failed",
      }));
      return;
    }

    updateStepByRequestId(workspace.rootPath, requestId, (step) => ({
      ...step,
      status: "error",
      question: {
        questions: step.question?.questions ?? [],
        answers: step.question?.answers,
        rejected: true,
      },
      detail: "Question rejected",
    }));
    applyInterruptEventToSyncWorkspace(workspace.rootPath, {
      type: "question_rejected",
      requestId,
      sessionId:
        normalizeSessionId(
          getPersistedWorkspaceState(workspace.rootPath)?.currentSessionId,
        ) ?? "auto",
    });

    statusText = "Question rejected";
  }

  async function handleSelectWorkspaceSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<void> {
    if (agentBusy || sessionBusy) {
      statusText =
        "Wait for the current turn or session action to finish before switching sessions.";
      return;
    }

    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) return;

    const label = workspace.name || workspace.rootPath;
    const shortSessionId = sessionId.slice(0, 8);
    statusText = `Loading session ${shortSessionId}...`;

    try {
      await selectWorkspace(workspaceId, {
        sessionId,
        forceHistory: true,
      });
      statusText = `Loaded session ${shortSessionId} for ${label}`;
    } catch (error) {
      statusText =
        error instanceof Error ? error.message : "Failed to load session";
    }
  }

  async function createNewSession(): Promise<void> {
    if (!activeWorkspace || agentBusy || sessionBusy) return;

    const workspace = activeWorkspace;
    sessionBusy = true;
    statusText = "Creating new session...";

    try {
      const result = await window.electronAPI.createAgentSession({
        workspaceRoot: workspace.rootPath,
      });

      if (!result.ok) {
        throw new Error(result.error ?? "Failed to create new session");
      }

      setMessagesForWorkspaceRoot(workspace.rootPath, []);
      persistWorkspaceMetadata(workspace, {
        currentSessionId: result.sessionId ?? null,
      });
      const nextHistoryLoaded = { ...historyLoadedSessionKeyByRoot };
      delete nextHistoryLoaded[workspace.rootPath];
      historyLoadedSessionKeyByRoot = nextHistoryLoaded;

      await ensureWorkspaceSessions(workspace.id, { force: true });
      await loadWorkspaceHistory(workspace.id, {
        sessionId: result.sessionId ?? undefined,
        force: true,
      });
      statusText = `New session created for ${workspace.name}`;
    } catch (error) {
      statusText =
        error instanceof Error ? error.message : "Failed to create new session";
    } finally {
      sessionBusy = false;
    }
  }

  async function openFile(filePath: string): Promise<void> {
    const alreadyOpen = openFiles[filePath];
    if (alreadyOpen) {
      openFileOrder = openFileOrder.includes(filePath)
        ? openFileOrder
        : [...openFileOrder, filePath];
      activeFilePath = filePath;
      persistActiveWorkspaceEditorState(filePath);
      return;
    }

    const result = await window.electronAPI.readFile(filePath);
    await ensureWatchedFile(filePath);

    openFiles = {
      ...openFiles,
      [filePath]: {
        path: filePath,
        content: result.content,
        dirty: false,
      },
    };
    openFileOrder = openFileOrder.includes(filePath)
      ? openFileOrder
      : [...openFileOrder, filePath];

    activeFilePath = filePath;
    persistActiveWorkspaceEditorState(filePath);
  }

  async function rebindWatchedFilePath(
    previousPath: string,
    nextPath: string,
  ): Promise<void> {
    if (!watchedFilePaths[previousPath]) return;
    delete watchedFilePaths[previousPath];
    await window.electronAPI.unwatchFile(previousPath).catch(() => undefined);
    await ensureWatchedFile(nextPath).catch(() => undefined);
  }

  function remapPathPrefix(
    currentPath: string,
    previousPath: string,
    nextPath: string,
    isDirectory: boolean,
  ): string | null {
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedPrevious = normalizePath(previousPath);
    const normalizedNext = normalizePath(nextPath);

    if (!isDirectory) {
      return normalizedCurrent === normalizedPrevious ? normalizedNext : null;
    }

    if (normalizedCurrent === normalizedPrevious) return normalizedNext;
    const previousPrefix = `${normalizedPrevious}/`;
    if (!normalizedCurrent.startsWith(previousPrefix)) return null;
    return `${normalizedNext}${normalizedCurrent.slice(normalizedPrevious.length)}`;
  }

  async function remapOpenFilesAfterRename(
    previousPath: string,
    nextPath: string,
    isDirectory: boolean,
  ): Promise<void> {
    const pathRemaps: Array<{ from: string; to: string }> = [];

    for (const filePath of Object.keys(openFiles)) {
      const mapped = remapPathPrefix(
        filePath,
        previousPath,
        nextPath,
        isDirectory,
      );
      if (!mapped || mapped === filePath) continue;
      pathRemaps.push({ from: filePath, to: mapped });
    }

    if (pathRemaps.length === 0) return;

    const remapByFrom = new Map(
      pathRemaps.map((entry) => [entry.from, entry.to]),
    );
    const nextOpenFiles = { ...openFiles };

    for (const { from } of pathRemaps) {
      delete nextOpenFiles[from];
    }
    for (const { from, to } of pathRemaps) {
      const existing = openFiles[from];
      if (!existing) continue;
      nextOpenFiles[to] = {
        ...existing,
        path: to,
      };
    }
    openFiles = nextOpenFiles;

    openFileOrder = openFileOrder.map(
      (filePath) => remapByFrom.get(filePath) ?? filePath,
    );
    if (activeFilePath) {
      activeFilePath = remapByFrom.get(activeFilePath) ?? activeFilePath;
    }

    for (const { from, to } of pathRemaps) {
      await rebindWatchedFilePath(from, to);
    }

    persistActiveWorkspaceEditorState(activeFilePath);
  }

  async function handleOpenWorkspaceInFinder(): Promise<void> {
    const workspace = activeWorkspace;
    if (!workspace) return;
    const result = await window.electronAPI.openWorkspaceInFinder({
      rootPath: workspace.rootPath,
    });
    if (!result.ok) {
      statusText = result.error ?? "Failed to open workspace in Finder";
    }
  }

  async function handleFileTreeCreateEntry(params: {
    kind: "file" | "folder";
    parentPath: string;
    name: string;
  }): Promise<{ ok: boolean; path?: string; error?: string }> {
    const workspace = activeWorkspace;
    if (!workspace) {
      return { ok: false, error: "No active workspace." };
    }

    const result = await window.electronAPI.createWorkspaceEntry({
      workspaceRoot: workspace.rootPath,
      parentPath: params.parentPath,
      kind: params.kind,
      name: params.name,
    });

    if (!result.ok || !result.path) {
      const error = result.error ?? `Failed to create ${params.kind}`;
      statusText = error;
      return { ok: false, error };
    }

    await refreshWorkspaceTree(workspace.rootPath);
    if (params.kind === "file") {
      await openFile(result.path);
    }

    statusText = `${params.kind === "file" ? "File" : "Folder"} created`;
    return { ok: true, path: result.path };
  }

  async function handleFileTreeRenameEntry(params: {
    path: string;
    nextName: string;
  }): Promise<{ ok: boolean; path?: string; error?: string }> {
    const workspace = activeWorkspace;
    if (!workspace) {
      return { ok: false, error: "No active workspace." };
    }

    const sourceEntry = workspace.tree.find(
      (item) => item.path === params.path,
    );
    const sourceIsDirectory = sourceEntry?.isDirectory === true;

    const result = await window.electronAPI.renameWorkspaceEntry({
      workspaceRoot: workspace.rootPath,
      path: params.path,
      nextName: params.nextName,
    });

    if (!result.ok || !result.path) {
      const error = result.error ?? "Failed to rename entry";
      statusText = error;
      return { ok: false, error };
    }

    if (result.path !== params.path) {
      await remapOpenFilesAfterRename(
        params.path,
        result.path,
        sourceIsDirectory,
      );
    }

    await refreshWorkspaceTree(workspace.rootPath);
    statusText = "Renamed";
    return { ok: true, path: result.path };
  }

  async function closeOpenFileTab(filePath: string): Promise<void> {
    const file = openFiles[filePath];
    if (!file) return;

    const currentVisibleTabs = [...visibleOpenFileTabs];
    const closingActive = activeFilePath === filePath;
    const nextOrder = openFileOrder.filter((path) => path !== filePath);

    openFileOrder = nextOrder;

    const nextOpenFiles = { ...openFiles };
    delete nextOpenFiles[filePath];
    openFiles = nextOpenFiles;

    if (closingActive) {
      const nextVisibleTabs = currentVisibleTabs.filter(
        (path) => path !== filePath,
      );
      const closingIndex = currentVisibleTabs.indexOf(filePath);
      const nextIndex =
        closingIndex >= 0
          ? Math.min(closingIndex, nextVisibleTabs.length - 1)
          : nextVisibleTabs.length - 1;
      activeFilePath = nextVisibleTabs[nextIndex] ?? null;
    }

    if (watchedFilePaths[filePath]) {
      delete watchedFilePaths[filePath];
      await window.electronAPI.unwatchFile(filePath);
    }

    persistActiveWorkspaceEditorState(activeFilePath);
  }

  function selectOpenFileTab(filePath: string): void {
    activeFilePath = filePath;
    persistActiveWorkspaceEditorState(filePath);
  }

  function handleBoardChange(fqbn: string): void {
    if (!activeWorkspace) return;
    persistWorkspaceMetadata(activeWorkspace, {
      boardFqbn: fqbn,
      boardOptionSelections: {},
    });
  }

  function handleBoardOptionSelectionsChange(
    nextSelections: Record<string, string>,
  ): void {
    if (!activeWorkspace) return;
    persistWorkspaceMetadata(activeWorkspace, {
      boardOptionSelections: nextSelections,
    });
  }

  function handleToggleFavoriteBoard(fqbn: string): void {
    if (!fqbn) return;

    patchWorkspaceManagerState((current) => {
      const currentFavorites = current.favoriteBoardFqbns ?? [];
      const alreadyFavorite = currentFavorites.includes(fqbn);
      const nextFavorites = alreadyFavorite
        ? currentFavorites.filter((item) => item !== fqbn)
        : [fqbn, ...currentFavorites];

      return {
        favoriteBoardFqbns: nextFavorites,
      };
    });
  }

  function handlePortChange(port: string): void {
    if (!activeWorkspace) return;
    persistWorkspaceMetadata(activeWorkspace, {
      serialPort: port,
    });
  }

  function handleExpandedDirKeysChange(keys: string[]): void {
    if (!activeWorkspace) return;
    persistWorkspaceMetadata(activeWorkspace, {
      expandedDirKeys: keys,
    });
  }

  function handlePaneTabChange(nextTab: PaneTab): void {
    if (!activeWorkspace) return;
    persistWorkspaceMetadata(activeWorkspace, {
      activePaneTab: nextTab,
    });
  }

  function handleInnerSplitContainerElChange(
    nextElement: HTMLDivElement | null,
  ): void {
    innerSplitContainerEl = nextElement;
  }

  function handleInnerResizePointerDown(event: PointerEvent): void {
    beginResize("inner", event);
  }

  function handleFileManagerCollapsedChange(nextCollapsed: boolean): void {
    patchAppState({
      layout: {
        fileManagerCollapsed: nextCollapsed,
      },
    });
  }

  function handleChatCollapsedChange(nextCollapsed: boolean): void {
    patchAppState({
      layout: {
        chatCollapsed: nextCollapsed,
      },
    });
  }

  function handleOutputWindowToggle(nextExpanded: boolean): void {
    outputExpanded = nextExpanded;
  }

  function handleNavbarOverlayOpenChange(open: boolean): void {
    navbarOverlayOpen = open;
  }

  function handleArduinoOutputEvent(event: ArduinoOutputEvent): void {
    if (event.type === "start") {
      outputExpanded = true;
      outputRun = {
        requestId: event.requestId,
        operation: event.operation,
        status: "running",
        startedAt: event.startedAt,
        command: event.command,
        logs: [],
      };
      return;
    }

    if (event.type === "chunk") {
      if (!outputRun || outputRun.requestId !== event.requestId) {
        outputRun = {
          requestId: event.requestId,
          operation: event.operation,
          status: "running",
          startedAt: new Date().toISOString(),
          logs: [
            {
              id: crypto.randomUUID(),
              stream: event.stream,
              chunk: event.chunk,
            },
          ],
        };
        return;
      }

      outputRun = {
        ...outputRun,
        logs: [
          ...outputRun.logs,
          {
            id: crypto.randomUUID(),
            stream: event.stream,
            chunk: event.chunk,
          },
        ],
      };
      return;
    }

    if (!outputRun || outputRun.requestId !== event.requestId) {
      outputRun = {
        requestId: event.requestId,
        operation: event.operation,
        status: event.status,
        startedAt: event.finishedAt,
        finishedAt: event.finishedAt,
        message: event.message,
        command: event.command,
        exitCode: event.exitCode,
        logs: [],
      };
      return;
    }

    outputRun = {
      ...outputRun,
      status: event.status,
      message: event.message,
      exitCode: event.exitCode,
      command: event.command ?? outputRun.command,
      finishedAt: event.finishedAt,
    };
  }

  function editActiveFile(content: string) {
    if (!activeFilePath) return;

    openFiles = {
      ...openFiles,
      [activeFilePath]: {
        path: activeFilePath,
        content,
        dirty: true,
      },
    };

    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer);
    }

    autosaveTimer = window.setTimeout(() => {
      void saveActiveFile();
    }, 500);
  }

  async function saveActiveFile() {
    if (!activeFilePath) return;

    const file = openFiles[activeFilePath];
    if (!file || !file.dirty) return;

    await window.electronAPI.writeFile({
      filePath: file.path,
      content: file.content,
    });

    openFiles = {
      ...openFiles,
      [activeFilePath]: {
        ...file,
        dirty: false,
      },
    };
  }

  function pushMessage(
    role: ChatItem["role"],
    content: string,
    workspaceRoot?: string,
    steps?: AgentStep[],
  ): string {
    const entry: ChatItem = {
      id: crypto.randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
      steps,
    };

    const targetWorkspaceRoot = workspaceRoot ?? activeWorkspace?.rootPath;
    if (!targetWorkspaceRoot) {
      messages = [...messages, entry];
      return entry.id;
    }

    const current = getMessagesForWorkspaceRoot(targetWorkspaceRoot);
    setMessagesForWorkspaceRoot(targetWorkspaceRoot, [...current, entry]);
    return entry.id;
  }

  function updateLastAssistant(content: string, workspaceRoot?: string): void {
    const targetWorkspaceRoot = workspaceRoot ?? activeWorkspace?.rootPath;
    if (!targetWorkspaceRoot) return;

    const current = getMessagesForWorkspaceRoot(targetWorkspaceRoot);
    if (current.length === 0) return;

    const last = current[current.length - 1];
    if (last.role !== "assistant") return;

    const next = [...current];
    next[next.length - 1] = {
      ...last,
      content,
    };
    setMessagesForWorkspaceRoot(targetWorkspaceRoot, next);
  }

  function updateMessageContentById(
    workspaceRoot: string,
    messageId: string,
    content: string,
  ): void {
    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    const index = current.findIndex((item) => item.id === messageId);
    if (index === -1) return;

    const next = [...current];
    next[index] = {
      ...next[index],
      content,
    };
    setMessagesForWorkspaceRoot(workspaceRoot, next);
  }

  function renameMessageIdInWorkspace(
    workspaceRoot: string,
    previousMessageId: string,
    nextMessageId: string,
  ): boolean {
    if (previousMessageId === nextMessageId) return false;

    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    if (current.some((item) => item.id === nextMessageId)) {
      return false;
    }

    const index = current.findIndex((item) => item.id === previousMessageId);
    if (index === -1) return false;

    const next = [...current];
    next[index] = {
      ...next[index],
      id: nextMessageId,
    };
    setMessagesForWorkspaceRoot(workspaceRoot, next);
    return true;
  }

  function updateMessageSteps(
    workspaceRoot: string,
    messageId: string,
    updater: (steps: AgentStep[]) => AgentStep[],
  ): void {
    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    const index = current.findIndex((item) => item.id === messageId);
    if (index === -1) return;

    const message = current[index];
    const nextSteps = updater(message.steps ?? []);
    const next = [...current];
    next[index] = {
      ...message,
      steps: nextSteps,
    };
    setMessagesForWorkspaceRoot(workspaceRoot, next);
  }

  function upsertMessageStep(
    workspaceRoot: string,
    messageId: string,
    step: AgentStep,
  ): void {
    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    const next = upsertMessageStepInMessages(current, messageId, step);
    if (next === current) return;
    setMessagesForWorkspaceRoot(workspaceRoot, next);
  }

  function updateStepByRequestId(
    workspaceRoot: string,
    requestId: string,
    updater: (step: AgentStep) => AgentStep,
  ): boolean {
    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    const result = updateStepByRequestIdInMessages(current, requestId, updater);
    if (result.found) {
      setMessagesForWorkspaceRoot(workspaceRoot, result.messages);
    }
    return result.found;
  }

  function finalizeRunningAuxSteps(
    workspaceRoot: string,
    messageId: string,
    finalStatus: "ok" | "error",
  ): void {
    updateMessageSteps(workspaceRoot, messageId, (steps) =>
      steps.map((step) => {
        if (step.status !== "running") return step;
        if (step.kind !== "task" && step.kind !== "status") return step;
        return {
          ...step,
          status: finalStatus,
        };
      }),
    );
  }

  function upsertPermissionStep(
    workspaceRoot: string,
    params: {
      requestId: string;
      sessionId: string;
      title: string;
      toolCallId?: string;
      messageId?: string;
      reply?: AgentPermissionReply;
      status?: AgentStep["status"];
    },
  ): void {
    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    const next = upsertPendingPermissionInMessages(current, {
      id: params.requestId,
      sessionId: params.sessionId,
      title: params.title,
      toolCallId: params.toolCallId,
      messageId: params.messageId,
    });
    if (next === current) return;

    setMessagesForWorkspaceRoot(workspaceRoot, next);
    if (params.reply) {
      void updateStepByRequestId(workspaceRoot, params.requestId, (step) => ({
        ...step,
        status: params.reply === "reject" ? "error" : "ok",
        permission: {
          title: step.permission?.title ?? params.title,
          reply: params.reply,
        },
      }));
    }
  }

  function upsertQuestionStep(
    workspaceRoot: string,
    params: {
      requestId: string;
      sessionId: string;
      questions: AgentQuestionInfo[];
      toolCallId?: string;
      messageId?: string;
      answers?: string[][];
      rejected?: boolean;
      status?: AgentStep["status"];
    },
  ): void {
    const current = getMessagesForWorkspaceRoot(workspaceRoot);
    const next = upsertPendingQuestionInMessages(current, {
      id: params.requestId,
      sessionId: params.sessionId,
      toolCallId: params.toolCallId,
      messageId: params.messageId,
      questions: params.questions,
    });
    if (next !== current) {
      setMessagesForWorkspaceRoot(workspaceRoot, next);
    }

    if (params.answers || params.rejected || params.status) {
      void updateStepByRequestId(workspaceRoot, params.requestId, (step) => ({
        ...step,
        status:
          params.status ??
          (params.rejected ? "error" : params.answers ? "ok" : step.status),
        question: {
          questions: step.question?.questions ?? params.questions,
          answers: params.answers ?? step.question?.answers,
          rejected: params.rejected ?? step.question?.rejected,
        },
      }));
    }
  }

  function truncateDetail(text?: string, maxLength = 160): string | undefined {
    if (!text) return undefined;
    const compact = text.replace(/\s+/g, " ").trim();
    if (compact.length <= maxLength) return compact;
    return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  function parseTaskMessage(message: string): {
    title: string;
    detail?: string;
    status: "running" | "ok" | "error";
    kind: AgentStep["kind"];
  } | null {
    const trimmed = message.trim();
    if (!trimmed) {
      return { title: "Working", status: "running", kind: "status" };
    }

    if (
      trimmed.startsWith("tool_call") ||
      trimmed.startsWith("tool_result") ||
      trimmed.startsWith("content")
    ) {
      return null;
    }

    if (trimmed.startsWith("command ")) {
      return {
        title: "Running command",
        detail: trimmed.slice("command ".length),
        status: "running",
        kind: "task",
      };
    }

    if (trimmed.startsWith("file edited ")) {
      return null;
    }

    if (trimmed.startsWith("permission ")) {
      return {
        title: "Awaiting permission",
        detail: trimmed.replace("permission ", ""),
        status: "running",
        kind: "status",
      };
    }

    if (trimmed.startsWith("error ")) {
      const rawDetail = trimmed.replace("error ", "").trim();
      const detail = rawDetail.startsWith("message=")
        ? rawDetail.slice("message=".length).trim()
        : rawDetail;
      return {
        title: "Error",
        detail,
        status: "error",
        kind: "error",
      };
    }

    return null;
  }

  async function sendPrompt(prompt: string): Promise<void> {
    if (agentBusy) return;
    if (!activeWorkspace) {
      pushMessage(
        "system",
        "Open a workspace folder first, then send your prompt.",
      );
      return;
    }

    const turnWorkspaceRoot = activeWorkspace.rootPath;
    const turnWorkspaceId = activeWorkspace.id;
    const turnSessionId = normalizeSessionId(
      workspaceManagerSnapshot.byRoot[turnWorkspaceRoot]?.currentSessionId,
    );
    const syncSessionId = getHistoryCacheSessionKey(turnSessionId);
    agentBusy = true;
    let turnModelOverride:
      | {
          providerID: string;
          modelID: string;
        }
      | undefined = undefined;
    pushMessage("user", prompt, turnWorkspaceRoot);
    let assistantMessageId = pushMessage(
      "assistant",
      "",
      turnWorkspaceRoot,
      [],
    );

    const persistedSelectedModel = appStateSnapshot.providers.selectedModel;
    try {
      const catalogResponse = await window.electronAPI.getOpenCodeModelCatalog({
        workspaceRoot: turnWorkspaceRoot,
      });

      if (catalogResponse.ok && catalogResponse.providers) {
        const resolvedSelectedModel = resolveSelectedModel(
          catalogResponse.providers,
          persistedSelectedModel,
        );

        if (
          !sameSelectedModel(resolvedSelectedModel, persistedSelectedModel)
        ) {
          patchAppState({
            providers: {
              selectedModel: resolvedSelectedModel,
            },
          });
        }

        if (resolvedSelectedModel) {
          turnModelOverride = {
            providerID: resolvedSelectedModel.providerId,
            modelID: resolvedSelectedModel.modelId,
          };
        }
      }
    } catch (error) {
      void error;
    }

    let completion = "";
    const requestId = crypto.randomUUID();
    activeAgentRequestId = requestId;
    stoppingAgentTurn = false;
    const toolNameById: Record<string, string> = {};
    let lastStepSignature: string | null = null;
    let promptEchoFiltered = false;
    let lastContentPartId: string | null = null;
    let lastContentPartKind: "reasoning" | "text" | null = null;

    const upsertStep = (step: AgentStep) => {
      updateMessageSteps(
        turnWorkspaceRoot,
        assistantMessageId,
        (currentSteps) => {
          const existingIndex = currentSteps.findIndex(
            (item) => item.id === step.id,
          );
          if (existingIndex >= 0) {
            const existingStep = currentSteps[existingIndex];
            const next = [...currentSteps];
            next[existingIndex] = {
              ...existingStep,
              ...step,
              contentStart: existingStep.contentStart ?? step.contentStart,
            };
            return next;
          }

          const next = [
            ...currentSteps,
            { ...step, contentStart: step.contentStart ?? completion.length },
          ];
          return next;
        },
      );
    };

    const appendStep = (step: AgentStep) => {
      const signature = `${step.kind}|${step.status}|${step.title}|${step.detail ?? ""}`;
      if (signature === lastStepSignature) return;
      lastStepSignature = signature;
      upsertStep(step);
    };

    const streamListener = (payload: {
      requestId: string;
      event: AgentRuntimeStreamEvent;
    }) => {
      if (payload.requestId !== requestId) return;

      const streamEvent = payload.event;
      if (
        streamEvent.type === "message_updated" &&
        streamEvent.role === "assistant" &&
        streamEvent.messageId !== assistantMessageId
      ) {
        const renamed = renameMessageIdInWorkspace(
          turnWorkspaceRoot,
          assistantMessageId,
          streamEvent.messageId,
        );

        if (renamed) {
          const renamedSyncState = renameMessageIdInSyncState({
            state: getSyncStateForWorkspaceRoot(turnWorkspaceRoot),
            sessionId: syncSessionId,
            fromMessageId: assistantMessageId,
            toMessageId: streamEvent.messageId,
          });
          setSyncStateForWorkspaceRoot(turnWorkspaceRoot, renamedSyncState);
          assistantMessageId = streamEvent.messageId;
        }
      }

      const nextSyncState = applyRuntimeEventToSyncState({
        state: getSyncStateForWorkspaceRoot(turnWorkspaceRoot),
        sessionId: syncSessionId,
        assistantMessageId,
        event: streamEvent,
      });
      setSyncStateForWorkspaceRoot(turnWorkspaceRoot, nextSyncState);

      if (streamEvent.type === "content") {
        if (
          streamEvent.partId &&
          lastContentPartId &&
          streamEvent.partId !== lastContentPartId &&
          lastContentPartKind === "reasoning" &&
          streamEvent.contentKind === "text" &&
          completion.length > 0 &&
          !completion.endsWith("\n\n")
        ) {
          completion = `${completion}\n\n`;
        }

        if (streamEvent.partId) {
          lastContentPartId = streamEvent.partId;
        }
        if (streamEvent.contentKind) {
          lastContentPartKind = streamEvent.contentKind;
        }

        const mergedContent = mergeAssistantContent(
          completion,
          streamEvent.content,
        );
        if (!promptEchoFiltered) {
          const candidate = mergedContent.trim();
          if (candidate && candidate === prompt.trim()) {
            promptEchoFiltered = true;
            completion = "";
            updateMessageContentById(turnWorkspaceRoot, assistantMessageId, "");
            return;
          }
        }
        if (mergedContent !== completion) {
          completion = mergedContent;
          updateLastAssistant(completion, turnWorkspaceRoot);
        }
        return;
      }

      if (streamEvent.type === "tool_call") {
        toolNameById[streamEvent.toolCallId] = streamEvent.name;
        const detail = truncateDetail(streamEvent.input);
        const title = `Running ${streamEvent.name}`;
        upsertStep({
          id: `tool:${streamEvent.toolCallId}`,
          title,
          toolName: streamEvent.name,
          detail,
          toolInput: streamEvent.input,
          status: "running",
          kind: "tool",
          contentStart: completion.length,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (streamEvent.type === "tool_result") {
        const stepId = `tool:${streamEvent.toolCallId}`;
        const currentAssistantMessage = getMessagesForWorkspaceRoot(
          turnWorkspaceRoot,
        ).find((item) => item.id === assistantMessageId);
        const existingStep = currentAssistantMessage?.steps?.find(
          (step) => step.id === stepId,
        );
        if (
          !streamEvent.isError &&
          (existingStep?.kind === "question" ||
            existingStep?.kind === "permission")
        ) {
          return;
        }

        const toolName =
          toolNameById[streamEvent.toolCallId] ?? streamEvent.toolCallId;
        const detail = truncateDetail(streamEvent.output);
        const status = streamEvent.isError ? "error" : "ok";
        const title = `Finished ${toolName}`;
        upsertStep({
          id: `tool:${streamEvent.toolCallId}`,
          title,
          toolName,
          detail,
          toolOutput: streamEvent.output,
          status,
          kind: "tool",
          contentStart: completion.length,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (
        streamEvent.type === "permission_asked" ||
        streamEvent.type === "permission_replied" ||
        streamEvent.type === "question_asked" ||
        streamEvent.type === "question_replied" ||
        streamEvent.type === "question_rejected"
      ) {
        const current = getMessagesForWorkspaceRoot(turnWorkspaceRoot);
        const next = applyInterruptStreamEventInMessages({
          messages: current,
          assistantMessageId,
          event: streamEvent,
          contentStart: completion.length,
        });
        if (next !== current) {
          setMessagesForWorkspaceRoot(turnWorkspaceRoot, next);
        }
        return;
      }

      if (streamEvent.type === "session_status") {
        if (streamEvent.statusType === "retry") {
          const attemptLabel =
            typeof streamEvent.attempt === "number"
              ? `Attempt ${streamEvent.attempt}`
              : "Retrying";
          appendStep({
            id: `status:${crypto.randomUUID()}`,
            title: "Retrying request",
            detail: truncateDetail(
              streamEvent.message
                ? `${attemptLabel}. ${streamEvent.message}`
                : attemptLabel,
            ),
            status: "running",
            kind: "status",
            contentStart: completion.length,
            createdAt: new Date().toISOString(),
          });
        }
        return;
      }

      if (streamEvent.type === "message_updated") {
        return;
      }

      if (streamEvent.type === "message_part_removed") {
        return;
      }

      if (streamEvent.type === "task") {
        const parsed = parseTaskMessage(streamEvent.message);
        if (!parsed) return;
        appendStep({
          id: `task:${crypto.randomUUID()}`,
          title: parsed.title,
          detail: truncateDetail(parsed.detail),
          status: parsed.status,
          kind: parsed.kind,
          contentStart: completion.length,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (streamEvent.type === "error") {
        finalizeRunningAuxSteps(turnWorkspaceRoot, assistantMessageId, "error");
        appendStep({
          id: `error:${crypto.randomUUID()}`,
          title: "Error",
          detail: truncateDetail(streamEvent.error),
          status: "error",
          kind: "error",
          contentStart: completion.length,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      if (streamEvent.type === "done") {
        finalizeRunningAuxSteps(turnWorkspaceRoot, assistantMessageId, "ok");
        return;
      }
    };
    window.electronAPI.onAgentStream(streamListener);

    const logListener = (payload: { requestId: string; line: string }) => {
      if (payload.requestId !== requestId) return;
      const line = payload.line.trim();
      if (!line.startsWith("task:")) return;
      const parsed = parseTaskMessage(line.replace(/^task:/, ""));
      if (!parsed) return;
      appendStep({
        id: `task:${crypto.randomUUID()}`,
        title: parsed.title,
        detail: truncateDetail(parsed.detail),
        status: parsed.status,
        kind: parsed.kind,
        contentStart: completion.length,
        createdAt: new Date().toISOString(),
      });
    };
    window.electronAPI.onAgentLog(logListener);

    try {
      const run = await window.electronAPI.startAgentTurn({
        requestId,
        workspaceRoot: activeWorkspace.rootPath,
        prompt,
        sessionId: turnSessionId ?? undefined,
        model: turnModelOverride,
      });

      if (!run.ok) {
        throw new Error(run.error ?? "Agent runtime failed");
      }
      if (completion.trim().length === 0) {
        const history = await window.electronAPI.getAgentHistory({
          workspaceRoot: turnWorkspaceRoot,
          limit: 5,
          sessionId: turnSessionId ?? undefined,
        });
        if (history.ok) {
          const lastAssistant = [...(history.messages ?? [])]
            .reverse()
            .find(
              (message) =>
                message.role === "assistant" &&
                message.content.trim().length > 0,
            );
          if (lastAssistant) {
            completion = lastAssistant.content;
            updateMessageContentById(
              turnWorkspaceRoot,
              assistantMessageId,
              completion,
            );
          }
        }
      }

    } catch (error) {
      const cancelledByUser = stoppingAgentTurn;
      const reason =
        error instanceof Error ? error.message : "Agent turn failed";
      if (cancelledByUser) {
        if (completion.trim().length === 0) {
          completion = "Stopped.";
          updateMessageContentById(
            turnWorkspaceRoot,
            assistantMessageId,
            completion,
          );
        }
      } else {
        updateLastAssistant(`Blocked: ${reason}`, turnWorkspaceRoot);
      }

      if (cancelledByUser) {
        void syncWorkspacePendingInterrupts(turnWorkspaceId, {
          sessionId: turnSessionId ?? undefined,
        }).catch(() => undefined);
      }
    } finally {
      window.electronAPI.offAgentStream(streamListener);
      window.electronAPI.offAgentLog(logListener);
      if (activeAgentRequestId === requestId) {
        activeAgentRequestId = null;
      }
      stoppingAgentTurn = false;
      agentBusy = false;
      void ensureWorkspaceSessions(turnWorkspaceId, { force: true }).catch(
        () => undefined,
      );
    }
  }

  async function stopAgentTurn(): Promise<void> {
    if (!agentBusy || !activeAgentRequestId || stoppingAgentTurn) return;

    const requestId = activeAgentRequestId;
    stoppingAgentTurn = true;
    try {
      const result = await window.electronAPI.cancelAgentTurn(requestId);
      if (!result.ok) {
        stoppingAgentTurn = false;
      }
    } catch {
      stoppingAgentTurn = false;
    }
  }
</script>

<div class="flex h-screen flex-col bg-dark-bg text-gray-100">
  <AppNavbar
    userEmail={null}
    {statusText}
    activeWorkspaceRoot={activeWorkspace?.rootPath ?? null}
    {activeFilePath}
    activeFileDirty={activeFile?.dirty ?? false}
    {selectedBoardFqbn}
    {boardOptionSelections}
    {effectiveBoardFqbn}
    {selectedPort}
    {favoriteBoardFqbns}
    onBoardChange={handleBoardChange}
    onBoardOptionSelectionsChange={handleBoardOptionSelectionsChange}
    onPortChange={handlePortChange}
    onToggleFavoriteBoard={handleToggleFavoriteBoard}
    onOpenBoardsManager={() => openSettingsModal("boards")}
    onSaveActiveFile={saveActiveFile}
    onArduinoOutputEvent={handleArduinoOutputEvent}
    onOverlayOpenChange={handleNavbarOverlayOpenChange}
    {arduinoEnvironmentRefreshKey}
    {chatCollapsed}
    onToggleChatCollapsed={() => handleChatCollapsedChange(!chatCollapsed)}
  />

  <div
    class={`flex flex-1 overflow-hidden ${draggingSplitter ? "select-none" : ""}`}
    bind:this={outerSplitContainerEl}
  >
    <div
      class={`flex border-r border-dark-border ${
        chatCollapsed ? "shrink-0" : "min-w-0"
      }`}
      style={chatCollapsed ? undefined : `width: ${chatWidthPct}%`}
    >
      <div class="w-14 shrink-0 border-r border-dark-border bg-dark-surface">
            <WorkspaceBar
              {workspaces}
              {activeWorkspaceId}
              {sessionPreviewsByWorkspaceId}
              {activeSessionIdByWorkspaceId}
          onSelect={selectWorkspace}
          onCloseWorkspace={removeWorkspace}
          onOpenFolder={openFolder}
              onOpenSettings={openSettingsModal}
              onPreviewWorkspace={ensureWorkspaceSessions}
              onSelectWorkspaceSession={handleSelectWorkspaceSession}
            />
          </div>

      {#if !chatCollapsed}
        <div class="min-w-0 flex-1">
          <ChatPanel
            messages={renderedMessages}
            workspaceTitle={activeWorkspace?.name?.trim() || "Agent Chat"}
            activeWorkspaceRoot={activeWorkspace?.rootPath ?? null}
            {chatFontSize}
            busy={agentBusy}
            stopping={stoppingAgentTurn}
            sessionStatus={activeChatSessionStatus}
            onSend={sendPrompt}
            onStop={stopAgentTurn}
            onNewSession={createNewSession}
            newSessionDisabled={sessionBusy ||
              agentBusy ||
              !activeWorkspace}
            onPermissionReply={handlePermissionReply}
            onQuestionReply={handleQuestionReply}
            onQuestionReject={handleQuestionReject}
          />
        </div>
      {/if}
    </div>

    {#if !chatCollapsed}
      <div
        class="w-0.5 cursor-col-resize bg-dark-border hover:bg-dark-fg3/50"
        role="separator"
        tabindex="-1"
        aria-label="Resize chat and workspace panels"
        onpointerdown={(event) => beginResize("outer", event)}
      ></div>
    {/if}

    <div
      class={`flex min-w-0 flex-col overflow-hidden ${chatCollapsed ? "flex-1" : ""}`}
      style={chatCollapsed ? undefined : `width: ${100 - chatWidthPct}%`}
    >
      <div
        class={`min-h-0 overflow-hidden ${outputExpanded ? "shrink-0" : "flex-1"}`}
        style={outputExpanded
          ? `height: ${100 - OUTPUT_WINDOW_HEIGHT_PCT}%`
          : undefined}
      >
        <PaneManager
          {activePaneTab}
          onPaneTabChange={handlePaneTabChange}
          {editorWidthPct}
          {fileManagerCollapsed}
          {monacoTheme}
          {activeWorkspace}
          {workspaces}
          {activeWorkspaceId}
          {selectedPort}
          {activeFilePath}
          {activeFile}
          {openFiles}
          {visibleOpenFileTabs}
          {activeWorkspaceExpandedDirKeys}
          onSelectOpenFileTab={selectOpenFileTab}
          onCloseOpenFileTab={closeOpenFileTab}
          onSaveActiveFile={saveActiveFile}
          onEditActiveFile={editActiveFile}
          onOpenFile={openFile}
          onCreateFileTreeEntry={handleFileTreeCreateEntry}
          onRenameFileTreeEntry={handleFileTreeRenameEntry}
          onOpenWorkspaceInFinder={handleOpenWorkspaceInFinder}
          onExpandedDirKeysChange={handleExpandedDirKeysChange}
          onFileManagerCollapsedChange={handleFileManagerCollapsedChange}
          onBeginInnerResize={handleInnerResizePointerDown}
          onInnerSplitContainerElChange={handleInnerSplitContainerElChange}
        />
      </div>

      <OutputWindow
        expanded={outputExpanded}
        run={outputRun}
        heightPct={OUTPUT_WINDOW_HEIGHT_PCT}
        onToggle={handleOutputWindowToggle}
      />
    </div>
  </div>

  {#if settingsModalOpen}
    <SettingsModal
      onClose={closeSettingsModal}
      initialTab={settingsModalTab}
      activeWorkspaceRoot={activeWorkspace?.rootPath ?? null}
      onRequirementsUpdated={handleRequirementsUpdated}
    />
  {/if}
</div>
