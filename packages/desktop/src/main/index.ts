import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  webContents,
  type MenuItemConstructorOptions
} from 'electron';
import Store from 'electron-store';
import { promises as fs, watch, watchFile, unwatchFile, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createOpenCodeSession,
  listOpenCodePendingInterrupts,
  listOpenCodeSessions,
  loadOpenCodeSessionHistory,
  rejectOpenCodeQuestion,
  replyOpenCodePermission,
  replyOpenCodeQuestion,
  runOpenCodeTurn,
  shutdownOpenCodeRuntime,
  type AgentHistoryMessage,
  type OpenCodePendingInterrupts,
  type AgentStreamEvent,
  type OpenCodeSessionSummary
} from './agent/opencodeRuntime.js';
import {
  compileOpenSketchWithArduinoTool,
  getBoardDetails,
  installCore,
  listCatalogCores,
  listConnectedSerialPorts,
  listInstalledBoards,
  listInstalledCores,
  uninstallCore,
  updateCoreIndex,
  uploadOpenSketch
} from './arduinoBridge.js';
import {
  getRequirementsStatus,
  installRequirement,
  isRequirementId,
  type RequirementId
} from './requirements/runtimeRequirements.js';
import { registerProvidersBridge } from './providers/providerBridge.js';
import { SerialMonitorHandler, type SerialMonitorEvent } from './serial/serialHandler.js';

type WorkspaceInfo = {
  id: string;
  name: string;
  rootPath: string;
};

type PersistedTreeItem = {
  path: string;
  isDirectory: boolean;
};

type MonacoThemeId = 'vs-dark' | 'arduino-dark' | 'vs' | 'hc-black' | 'hc-light' | 'gruvbox-dark';
type ChatFontSizePreset = 'small' | 'default' | 'large';

type AppState = {
  version: 1;
  activeWorkspaceRoot: string | null;
  layout: {
    chatWidthPct: number;
    chatCollapsed: boolean;
    editorWidthPct: number;
    fileManagerCollapsed: boolean;
  };
  serial: {
    bufferSize: number;
  };
  appearance: {
    monacoTheme: MonacoThemeId;
    chatFontSize: ChatFontSizePreset;
  };
  providers: {
    openai: {
      selectedModelId: string | null;
    };
  };
};

type PaneTab = 'code' | 'monitor';

type WorkspaceState = {
  rootPath: string;
  workspaceName: string;
  lastOpenedAt: string;
  boardFqbn: string;
  boardOptionSelections: Record<string, string>;
  serialPort: string;
  serialBaudRate: number;
  serialMonitorShowTimestamps: boolean;
  fileTree: PersistedTreeItem[];
  expandedDirKeys: string[];
  activePaneTab: PaneTab;
  openFileOrder: string[];
  activeFilePath: string | null;
  currentSessionId: string | null;
};

type WorkspaceManagerState = {
  version: 1;
  recentWorkspaceRoots: string[];
  favoriteBoardFqbns: string[];
  byRoot: Record<string, WorkspaceState>;
};

type StoreSchema = {
  workspaces: WorkspaceInfo[];
  appState: AppState;
  workspaceState: WorkspaceManagerState;
};

type ArduinoCommandOutputEnvelope = {
  requestId: string;
  operation: 'compile' | 'upload';
  stream: 'stdout' | 'stderr';
  chunk: string;
};

type ArduinoBoardConfigOptionValue = {
  id: string;
  label: string;
  selected: boolean;
};

type ArduinoBoardConfigOption = {
  id: string;
  label: string;
  values: ArduinoBoardConfigOptionValue[];
};

type ArduinoBoardDetails = {
  baseFqbn: string;
  boardName: string;
  configOptions: ArduinoBoardConfigOption[];
};

const CHAT_MIN_WIDTH_PCT = 25;
const CHAT_MAX_WIDTH_PCT = 65;
const EDITOR_MIN_WIDTH_PCT = 45;
const EDITOR_MAX_WIDTH_PCT = 85;
const MAX_RECENT_WORKSPACES = 12;
const APP_NAME = 'Exort';
const SERIAL_BAUD_RATE_DEFAULT = 9600;
const SERIAL_BUFFER_SIZE_DEFAULT = 500;
const SERIAL_BUFFER_SIZE_MIN = 100;
const SERIAL_BUFFER_SIZE_MAX = 5000;

app.setName(APP_NAME);

function configureApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [
        {
          label: APP_NAME,
          submenu: [
            { label: `About ${APP_NAME}`, role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { label: `Hide ${APP_NAME}`, role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { label: `Quit ${APP_NAME}`, role: 'quit' }
          ]
        },
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' }
      ]
    : [
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' }
      ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeSerialBufferSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return SERIAL_BUFFER_SIZE_DEFAULT;
  }

  return clamp(Math.floor(value), SERIAL_BUFFER_SIZE_MIN, SERIAL_BUFFER_SIZE_MAX);
}

function sanitizeMonacoThemeId(value: unknown): MonacoThemeId {
  if (value === 'arduino-dark') return 'arduino-dark';
  if (value === 'vs') return 'vs';
  if (value === 'hc-black') return 'hc-black';
  if (value === 'hc-light') return 'hc-light';
  if (value === 'gruvbox-dark') return 'gruvbox-dark';
  return 'vs-dark';
}

function sanitizeChatFontSizePreset(value: unknown): ChatFontSizePreset {
  if (value === 'small') return 'small';
  if (value === 'large') return 'large';
  return 'default';
}

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidCoreId(value: string): boolean {
  return /^[^:@\s]+:[^:@\s]+$/.test(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean);
}

function asUniqueStringArray(value: unknown): string[] {
  return Array.from(new Set(asStringArray(value)));
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      const normalizedKey = asNonBlankString(key);
      const normalizedValue = asNonBlankString(item);
      if (!normalizedKey || !normalizedValue) return null;
      return [normalizedKey, normalizedValue] as const;
    })
    .filter((item): item is readonly [string, string] => item !== null);

  return Object.fromEntries(entries);
}

function sanitizePaneTab(value: unknown): PaneTab {
  if (value === 'monitor') return 'monitor';
  return 'code';
}

function sanitizeTree(items: unknown): PersistedTreeItem[] {
  if (!Array.isArray(items)) return [];

  const next: PersistedTreeItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const pathValue = asNonBlankString((item as { path?: unknown }).path);
    if (!pathValue) continue;
    next.push({
      path: pathValue,
      isDirectory: Boolean((item as { isDirectory?: unknown }).isDirectory)
    });
  }

  return next;
}

function createDefaultAppState(): AppState {
  return {
    version: 1,
    activeWorkspaceRoot: null,
    layout: {
      chatWidthPct: 40,
      chatCollapsed: false,
      editorWidthPct: 70,
      fileManagerCollapsed: false
    },
    serial: {
      bufferSize: SERIAL_BUFFER_SIZE_DEFAULT
    },
    appearance: {
      monacoTheme: 'vs-dark',
      chatFontSize: 'default'
    },
    providers: {
      openai: {
        selectedModelId: null
      }
    }
  };
}

function createDefaultWorkspaceState(rootPath: string, workspaceName = ''): WorkspaceState {
  return {
    rootPath,
    workspaceName,
    lastOpenedAt: new Date(0).toISOString(),
    boardFqbn: '',
    boardOptionSelections: {},
    serialPort: '',
    serialBaudRate: SERIAL_BAUD_RATE_DEFAULT,
    serialMonitorShowTimestamps: true,
    fileTree: [],
    expandedDirKeys: [],
    activePaneTab: 'code',
    openFileOrder: [],
    activeFilePath: null,
    currentSessionId: null
  };
}

function createDefaultWorkspaceManagerState(): WorkspaceManagerState {
  return {
    version: 1,
    recentWorkspaceRoots: [],
    favoriteBoardFqbns: [],
    byRoot: {}
  };
}

function sanitizeAppState(input: unknown): AppState {
  const defaults = createDefaultAppState();
  if (!input || typeof input !== 'object') return defaults;

  const candidate = input as Partial<AppState>;
  const layoutCandidate =
    candidate.layout && typeof candidate.layout === 'object' ? (candidate.layout as Partial<AppState['layout']>) : undefined;

  const chatWidthPct =
    typeof layoutCandidate?.chatWidthPct === 'number'
      ? clamp(layoutCandidate.chatWidthPct, CHAT_MIN_WIDTH_PCT, CHAT_MAX_WIDTH_PCT)
      : defaults.layout.chatWidthPct;
  const chatCollapsed =
    typeof layoutCandidate?.chatCollapsed === 'boolean'
      ? layoutCandidate.chatCollapsed
      : defaults.layout.chatCollapsed;
  const editorWidthPct =
    typeof layoutCandidate?.editorWidthPct === 'number'
      ? clamp(layoutCandidate.editorWidthPct, EDITOR_MIN_WIDTH_PCT, EDITOR_MAX_WIDTH_PCT)
      : defaults.layout.editorWidthPct;
  const fileManagerCollapsed =
    typeof layoutCandidate?.fileManagerCollapsed === 'boolean'
      ? layoutCandidate.fileManagerCollapsed
      : defaults.layout.fileManagerCollapsed;
  const providersCandidate =
    candidate.providers && typeof candidate.providers === 'object'
      ? (candidate.providers as Partial<AppState['providers']>)
      : undefined;
  const appearanceCandidate =
    candidate.appearance && typeof candidate.appearance === 'object'
      ? (candidate.appearance as Partial<AppState['appearance']>)
      : undefined;
  const openAICandidate =
    providersCandidate?.openai && typeof providersCandidate.openai === 'object'
      ? (providersCandidate.openai as Partial<AppState['providers']['openai']>)
      : undefined;

  return {
    version: 1,
    activeWorkspaceRoot: asNonBlankString(candidate.activeWorkspaceRoot) ?? null,
    layout: {
      chatWidthPct,
      chatCollapsed,
      editorWidthPct,
      fileManagerCollapsed
    },
    serial: {
      bufferSize: sanitizeSerialBufferSize(candidate.serial?.bufferSize ?? defaults.serial.bufferSize)
    },
    appearance: {
      monacoTheme: sanitizeMonacoThemeId(appearanceCandidate?.monacoTheme ?? defaults.appearance.monacoTheme),
      chatFontSize: sanitizeChatFontSizePreset(
        appearanceCandidate?.chatFontSize ?? defaults.appearance.chatFontSize
      )
    },
    providers: {
      openai: {
        selectedModelId: asNonBlankString(openAICandidate?.selectedModelId) ?? null
      }
    }
  };
}

function sanitizeWorkspaceState(input: unknown, rootPath: string): WorkspaceState {
  const defaults = createDefaultWorkspaceState(rootPath);
  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const candidate = input as Partial<WorkspaceState>;
  const persistedRoot = asNonBlankString(candidate.rootPath) ?? rootPath;

  return {
    rootPath: persistedRoot,
    workspaceName: asNonBlankString(candidate.workspaceName) ?? '',
    lastOpenedAt: asNonBlankString(candidate.lastOpenedAt) ?? defaults.lastOpenedAt,
    boardFqbn: asNonBlankString(candidate.boardFqbn) ?? '',
    boardOptionSelections: asStringRecord(candidate.boardOptionSelections),
    serialPort: asNonBlankString(candidate.serialPort) ?? '',
    serialBaudRate:
      typeof candidate.serialBaudRate === 'number' && Number.isFinite(candidate.serialBaudRate)
        ? Math.max(1, Math.floor(candidate.serialBaudRate))
        : defaults.serialBaudRate,
    serialMonitorShowTimestamps:
      typeof candidate.serialMonitorShowTimestamps === 'boolean'
        ? candidate.serialMonitorShowTimestamps
        : defaults.serialMonitorShowTimestamps,
    fileTree: sanitizeTree(candidate.fileTree),
    expandedDirKeys: asStringArray(candidate.expandedDirKeys),
    activePaneTab: sanitizePaneTab(candidate.activePaneTab),
    openFileOrder: asStringArray(candidate.openFileOrder),
    activeFilePath: asNonBlankString(candidate.activeFilePath) ?? null,
    currentSessionId: asNonBlankString(candidate.currentSessionId) ?? null
  };
}

function sanitizeWorkspaceManagerState(input: unknown): WorkspaceManagerState {
  const defaults = createDefaultWorkspaceManagerState();
  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const candidate = input as Partial<WorkspaceManagerState>;
  const byRootInput = candidate.byRoot && typeof candidate.byRoot === 'object' ? candidate.byRoot : {};
  const recentRoots = asStringArray(candidate.recentWorkspaceRoots).slice(0, MAX_RECENT_WORKSPACES);
  const favoriteBoardFqbns = asUniqueStringArray(candidate.favoriteBoardFqbns);
  const byRoot: Record<string, WorkspaceState> = {};

  for (const rootPath of recentRoots) {
    const raw = (byRootInput as Record<string, unknown>)[rootPath];
    byRoot[rootPath] = sanitizeWorkspaceState(raw, rootPath);
  }

  return {
    version: 1,
    recentWorkspaceRoots: recentRoots,
    favoriteBoardFqbns,
    byRoot
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    workspaces: [],
    appState: createDefaultAppState(),
    workspaceState: createDefaultWorkspaceManagerState()
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ICON_PATH = path.join(__dirname, '../../resources/exort_logo.png');
const activeAgentTurns = new Map<string, AbortController>();
const activeArduinoUploads = new Map<string, AbortController>();
type WatchedWorkspaceTree = {
  subscribers: Set<number>;
  watcher: FSWatcher;
  debounceTimer: NodeJS.Timeout | null;
  refreshTree: () => Promise<void>;
};
const watchedFiles = new Map<
  string,
  {
    subscribers: Set<number>;
    listener: (current: { mtimeMs: number; size: number }, previous: { mtimeMs: number; size: number }) => void;
    debounceTimer: NodeJS.Timeout | null;
  }
>();
const watchedWorkspaceTrees = new Map<string, WatchedWorkspaceTree>();
const serialMonitor = new SerialMonitorHandler((serialEvent: SerialMonitorEvent) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('serial:monitor-event', serialEvent);
  }
});
serialMonitor.setMaxEntries(sanitizeAppState(store.get('appState')).serial.bufferSize);

function logOpenCodeLine(line: string): void {
  const output = `[OpenCode] ${line}`;
  if (line.includes(':error')) {
    safeConsoleWrite('error', output);
    return;
  }

  safeConsoleWrite('log', output);
}

function isIgnorableConsoleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError.code === 'EIO') return true;
  return error.message.toUpperCase().includes('EIO');
}

function safeConsoleWrite(level: 'log' | 'error', message: string): void {
  try {
    if (level === 'error') {
      console.error(message);
      return;
    }

    console.log(message);
  } catch (error) {
    if (!isIgnorableConsoleError(error)) {
      throw error;
    }
  }
}

function isPathWithinRoot(rootPath: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === '') return true;
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function validateWorkspaceEntryName(value: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = asNonBlankString(value);
  if (!name) {
    return { ok: false, error: 'Name is required.' };
  }
  if (name === '.' || name === '..') {
    return { ok: false, error: 'Invalid name.' };
  }
  if (/[\\/]/.test(name)) {
    return { ok: false, error: 'Name cannot contain path separators.' };
  }
  return { ok: true, name };
}

function formatWorkspaceFsError(error: unknown, fallback: string): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;

  if (code === 'EEXIST') return 'Name already exists.';
  if (code === 'ENOENT') return 'Path does not exist.';
  if (code === 'ENOTDIR') return 'Target parent is not a folder.';
  if (code === 'EISDIR') return 'Cannot create a file because a folder exists with that name.';
  if (code === 'ENOTEMPTY') return 'Folder is not empty.';

  return error instanceof Error ? error.message : fallback;
}

async function readTree(rootPath: string, depth = 0): Promise<Array<{ path: string; isDirectory: boolean }>> {
  if (depth > 6) return [];

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const list: Array<{ path: string; isDirectory: boolean }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;

    const fullPath = path.join(rootPath, entry.name);

    list.push({
      path: fullPath,
      isDirectory: entry.isDirectory()
    });

    if (entry.isDirectory()) {
      const nested = await readTree(fullPath, depth + 1);
      list.push(...nested);
    }
  }

  return list;
}

function clearWorkspaceTreeWatch(rootPath: string, entry: WatchedWorkspaceTree): void {
  entry.watcher.close();
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  watchedWorkspaceTrees.delete(rootPath);
}

function createSerialExportFilename(port: string | null): string {
  const normalizedPort = (port ?? 'unknown-port').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `exort-serial-monitor-${normalizedPort}-${timestamp}.csv`;
}

function pruneMissingWorkspace(rootPath: string): void {
  const normalized = path.resolve(rootPath);
  const nextWorkspaces = (store.get('workspaces') ?? []).filter((workspace) => path.resolve(workspace.rootPath) !== normalized);
  store.set('workspaces', nextWorkspaces);

  const workspaceState = sanitizeWorkspaceManagerState(store.get('workspaceState'));
  const nextRecentRoots = workspaceState.recentWorkspaceRoots.filter((entry) => path.resolve(entry) !== normalized);
  const nextByRoot = { ...workspaceState.byRoot };
  delete nextByRoot[normalized];
  delete nextByRoot[rootPath];

  store.set('workspaceState', {
    ...workspaceState,
    recentWorkspaceRoots: nextRecentRoots,
    byRoot: nextByRoot
  });

  const appState = sanitizeAppState(store.get('appState'));
  if (appState.activeWorkspaceRoot && path.resolve(appState.activeWorkspaceRoot) === normalized) {
    store.set('appState', {
      ...appState,
      activeWorkspaceRoot: null
    });
  }
}

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 680,
    backgroundColor: '#0f1117',
    icon: APP_ICON_PATH,
    title: APP_NAME,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: APP_NAME
  });
  configureApplicationMenu();

  if (process.platform === 'darwin') {
    const appIcon = nativeImage.createFromPath(APP_ICON_PATH);
    if (!appIcon.isEmpty()) {
      app.dock?.setIcon(appIcon);
    }
  }

  ipcMain.handle('app:open-browser-url', async (_event, payload: { url: string }) => {
    const url = asNonBlankString(payload?.url);
    if (!url) {
      return { ok: false, error: 'A URL is required.' };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: 'Invalid URL.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'Only HTTP/HTTPS URLs are allowed.' };
    }

    try {
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to open URL.'
      };
    }
  });
  ipcMain.handle('state:get-bootstrap', () => {
    const appState = sanitizeAppState(store.get('appState'));
    const workspaceState = sanitizeWorkspaceManagerState(store.get('workspaceState'));
    store.set('appState', appState);
    store.set('workspaceState', workspaceState);
    serialMonitor.setMaxEntries(appState.serial.bufferSize);
    return { appState, workspaceState };
  });
  ipcMain.handle('state:set-app', (_event, appState: AppState) => {
    const sanitized = sanitizeAppState(appState);
    store.set('appState', sanitized);
    serialMonitor.setMaxEntries(sanitized.serial.bufferSize);
    return { ok: true };
  });
  ipcMain.handle('state:set-workspace-manager', (_event, workspaceState: WorkspaceManagerState) => {
    const sanitized = sanitizeWorkspaceManagerState(workspaceState);
    store.set('workspaceState', sanitized);
    return { ok: true };
  });
  registerProvidersBridge({
    onOpenCodeLog: logOpenCodeLine
  });

  ipcMain.handle('workspace:open-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select workspace folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }

    const selectedPath = result.filePaths[0];
    if (!selectedPath) {
      return { cancelled: true };
    }
    const workspace: WorkspaceInfo = {
      id: crypto.randomUUID(),
      name: path.basename(selectedPath),
      rootPath: selectedPath
    };

    const current = store.get('workspaces') ?? [];
    const deduped = current.filter((item) => item.rootPath !== workspace.rootPath);
    store.set('workspaces', [workspace, ...deduped].slice(0, 12));

    const tree = await readTree(selectedPath);

    return {
      cancelled: false,
      workspace,
      tree
    };
  });

  ipcMain.handle('workspace:list-saved', () => {
    return store.get('workspaces') ?? [];
  });

  ipcMain.handle(
    'workspace:remove-saved',
    async (
      _event,
      payload: { rootPath: string }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const rootPath = asNonBlankString(payload?.rootPath);
        if (!rootPath) {
          return { ok: false, error: 'rootPath is required.' };
        }

        const normalized = path.resolve(rootPath);
        const watchedEntry = watchedWorkspaceTrees.get(normalized);
        if (watchedEntry) {
          clearWorkspaceTreeWatch(normalized, watchedEntry);
        }

        pruneMissingWorkspace(normalized);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to remove saved workspace.';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle('workspace:tree', async (_event, rootPath: string) => {
    try {
      const tree = await readTree(rootPath);
      return tree;
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        pruneMissingWorkspace(rootPath);
        return [];
      }
      throw error;
    }
  });

  ipcMain.handle(
    'workspace:open-in-finder',
    async (
      _event,
      payload: { rootPath: string }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const rootPath = asNonBlankString(payload?.rootPath);
        if (!rootPath) {
          return { ok: false, error: 'rootPath is required.' };
        }

        const resolvedRoot = path.resolve(rootPath);
        const stat = await fs.stat(resolvedRoot);
        if (!stat.isDirectory()) {
          return { ok: false, error: 'Workspace path is not a folder.' };
        }

        const result = await shell.openPath(resolvedRoot);
        if (result) {
          return { ok: false, error: result };
        }

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: formatWorkspaceFsError(error, 'Failed to open folder in Finder.')
        };
      }
    }
  );

  ipcMain.handle(
    'workspace:create-entry',
    async (
      _event,
      payload: {
        workspaceRoot: string;
        parentPath: string;
        kind: 'file' | 'folder';
        name: string;
      }
    ): Promise<{ ok: boolean; path?: string; error?: string }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot);
        const parentPath = asNonBlankString(payload?.parentPath);
        const kind = payload?.kind === 'folder' ? 'folder' : payload?.kind === 'file' ? 'file' : null;
        const nameResult = validateWorkspaceEntryName(payload?.name);

        if (!workspaceRoot) {
          return { ok: false, error: 'workspaceRoot is required.' };
        }
        if (!parentPath) {
          return { ok: false, error: 'parentPath is required.' };
        }
        if (!kind) {
          return { ok: false, error: 'Invalid entry type.' };
        }
        if (!nameResult.ok) {
          return { ok: false, error: nameResult.error };
        }

        const resolvedRoot = path.resolve(workspaceRoot);
        const resolvedParent = path.resolve(parentPath);
        if (!isPathWithinRoot(resolvedRoot, resolvedParent)) {
          return { ok: false, error: 'Parent path must be inside the workspace.' };
        }

        const parentStat = await fs.stat(resolvedParent);
        if (!parentStat.isDirectory()) {
          return { ok: false, error: 'Parent path is not a folder.' };
        }

        const targetPath = path.join(resolvedParent, nameResult.name);
        if (!isPathWithinRoot(resolvedRoot, targetPath)) {
          return { ok: false, error: 'Target path must be inside the workspace.' };
        }

        if (kind === 'folder') {
          await fs.mkdir(targetPath);
        } else {
          await fs.writeFile(targetPath, '', { flag: 'wx' });
        }

        return { ok: true, path: targetPath };
      } catch (error) {
        return {
          ok: false,
          error: formatWorkspaceFsError(error, 'Failed to create entry.')
        };
      }
    }
  );

  ipcMain.handle(
    'workspace:rename-entry',
    async (
      _event,
      payload: { workspaceRoot: string; path: string; nextName: string }
    ): Promise<{ ok: boolean; path?: string; error?: string }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot);
        const sourcePath = asNonBlankString(payload?.path);
        const nameResult = validateWorkspaceEntryName(payload?.nextName);

        if (!workspaceRoot) {
          return { ok: false, error: 'workspaceRoot is required.' };
        }
        if (!sourcePath) {
          return { ok: false, error: 'path is required.' };
        }
        if (!nameResult.ok) {
          return { ok: false, error: nameResult.error };
        }

        const resolvedRoot = path.resolve(workspaceRoot);
        const resolvedSource = path.resolve(sourcePath);
        if (!isPathWithinRoot(resolvedRoot, resolvedSource)) {
          return { ok: false, error: 'Path must be inside the workspace.' };
        }
        if (resolvedSource === resolvedRoot) {
          return { ok: false, error: 'Cannot rename the workspace root.' };
        }

        await fs.stat(resolvedSource);
        const targetPath = path.join(path.dirname(resolvedSource), nameResult.name);
        if (!isPathWithinRoot(resolvedRoot, targetPath)) {
          return { ok: false, error: 'Target path must be inside the workspace.' };
        }

        if (targetPath === resolvedSource) {
          return { ok: true, path: resolvedSource };
        }

        await fs.rename(resolvedSource, targetPath);
        return { ok: true, path: targetPath };
      } catch (error) {
        return {
          ok: false,
          error: formatWorkspaceFsError(error, 'Failed to rename entry.')
        };
      }
    }
  );

  ipcMain.handle('workspace:watch-tree', async (event, rootPath: string) => {
    const normalized = path.resolve(rootPath);
    const senderId = event.sender.id;
    let entry = watchedWorkspaceTrees.get(normalized);

    if (!entry) {
      const subscribers = new Set<number>();
      const refreshTree = async () => {
        try {
          const tree = await readTree(normalized);
          for (const id of subscribers) {
            webContents.fromId(id)?.send('workspace:tree-changed', { rootPath: normalized, tree });
          }
        } catch (error) {
          const fsError = error as NodeJS.ErrnoException;
          if (fsError.code !== 'ENOENT') return;

          for (const id of subscribers) {
            webContents.fromId(id)?.send('workspace:tree-changed', { rootPath: normalized, tree: [] });
          }
        }
      };

      let watcher: FSWatcher;
      try {
        watcher = watch(normalized, { recursive: true }, () => {
          if (entry?.debounceTimer) clearTimeout(entry.debounceTimer);
          entry!.debounceTimer = setTimeout(() => {
            void entry!.refreshTree();
          }, 120);
        });
      } catch {
        return { ok: false };
      }

      entry = {
        subscribers,
        watcher,
        debounceTimer: null,
        refreshTree
      };
      watchedWorkspaceTrees.set(normalized, entry);
    }

    entry.subscribers.add(senderId);
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.debounceTimer = setTimeout(() => {
      void entry!.refreshTree();
    }, 0);
    return { ok: true };
  });

  ipcMain.handle('workspace:unwatch-tree', async (event, rootPath: string) => {
    const normalized = path.resolve(rootPath);
    const entry = watchedWorkspaceTrees.get(normalized);
    if (!entry) return { ok: true };

    entry.subscribers.delete(event.sender.id);
    if (entry.subscribers.size === 0) {
      clearWorkspaceTreeWatch(normalized, entry);
    }

    return { ok: true };
  });

  ipcMain.handle('workspace:unwatch-all-trees', async (event) => {
    const senderId = event.sender.id;

    for (const [rootPath, entry] of watchedWorkspaceTrees.entries()) {
      entry.subscribers.delete(senderId);
      if (entry.subscribers.size === 0) {
        clearWorkspaceTreeWatch(rootPath, entry);
      }
    }

    return { ok: true };
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf8');
    return { content };
  });

  ipcMain.handle('file:read-if-exists', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return { ok: true, content, missing: false };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === 'ENOENT') {
        return { ok: true, content: null, missing: true };
      }

      return {
        ok: false,
        content: null,
        missing: false,
        error: error instanceof Error ? error.message : 'Failed to read file.'
      };
    }
  });

  ipcMain.handle('file:write', async (_event, payload: { filePath: string; content: string }) => {
    await fs.writeFile(payload.filePath, payload.content, 'utf8');
    return { ok: true };
  });

  ipcMain.handle('file:watch', async (event, filePath: string) => {
    const normalized = path.resolve(filePath);
    const senderId = event.sender.id;

    let entry = watchedFiles.get(normalized);
    if (!entry) {
      const subscribers = new Set<number>();
      const listener = (current: { mtimeMs: number; size: number }, previous: { mtimeMs: number; size: number }) => {
        if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) return;

        const run = async () => {
          try {
            const content = await fs.readFile(normalized, 'utf8');
            for (const id of subscribers) {
              webContents.fromId(id)?.send('file:changed', { filePath: normalized, content });
            }
          } catch {
            // Ignore transient read errors (renames, permission race, etc.)
          }
        };

        if (entry?.debounceTimer) clearTimeout(entry.debounceTimer);
        entry!.debounceTimer = setTimeout(() => {
          void run();
        }, 120);
      };

      entry = { subscribers, listener, debounceTimer: null };
      watchedFiles.set(normalized, entry);
      watchFile(normalized, { interval: 250 }, listener);
    }

    entry.subscribers.add(senderId);
    return { ok: true };
  });

  ipcMain.handle('file:unwatch', async (event, filePath: string) => {
    const normalized = path.resolve(filePath);
    const entry = watchedFiles.get(normalized);
    if (!entry) return { ok: true };

    entry.subscribers.delete(event.sender.id);
    if (entry.subscribers.size === 0) {
      unwatchFile(normalized, entry.listener);
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
      watchedFiles.delete(normalized);
    }

    return { ok: true };
  });

  ipcMain.handle('file:unwatch-all', async (event) => {
    const senderId = event.sender.id;

    for (const [filePath, entry] of watchedFiles.entries()) {
      entry.subscribers.delete(senderId);
      if (entry.subscribers.size === 0) {
        unwatchFile(filePath, entry.listener);
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
        watchedFiles.delete(filePath);
      }
    }

    return { ok: true };
  });

  ipcMain.handle('requirements:get-status', async () => {
    try {
      const requirements = await getRequirementsStatus();
      return { ok: true, requirements };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load requirements status.'
      };
    }
  });

  ipcMain.handle('requirements:install', async (_event, payload: { id: RequirementId }) => {
    const id = asNonBlankString(payload?.id);
    if (!id || !isRequirementId(id)) {
      return { ok: false, error: 'Invalid requirement id.' };
    }

    try {
      const result = await installRequirement(id);
      if (id === 'opencode' && result.ok) {
        await shutdownOpenCodeRuntime();
      }
      return { ok: true, result };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : `Failed to install requirement: ${id}`
      };
    }
  });

  ipcMain.handle('arduino:list-ports', async () => {
    return listConnectedSerialPorts();
  });

  ipcMain.handle('arduino:list-boards', async () => {
    return listInstalledBoards();
  });

  ipcMain.handle(
    'arduino:get-board-details',
    async (
      _event,
      payload: {
        fqbn: string;
      }
    ): Promise<{ ok: boolean; details?: ArduinoBoardDetails; error?: string }> => {
      return getBoardDetails(payload?.fqbn);
    }
  );

  ipcMain.handle('arduino:list-installed-cores', async () => {
    return listInstalledCores();
  });

  ipcMain.handle('arduino:list-catalog-cores', async () => {
    return listCatalogCores();
  });

  ipcMain.handle('arduino:update-core-index', async () => {
    return updateCoreIndex();
  });

  ipcMain.handle('arduino:install-core', async (_event, payload: { id: string }) => {
    const id = asNonBlankString(payload?.id);
    if (!id) {
      return { ok: false, error: 'Core id is required.' };
    }
    if (!isValidCoreId(id)) {
      return { ok: false, error: 'Invalid core id. Expected format "packager:arch".' };
    }

    return installCore(id);
  });

  ipcMain.handle('arduino:uninstall-core', async (_event, payload: { id: string }) => {
    const id = asNonBlankString(payload?.id);
    if (!id) {
      return { ok: false, error: 'Core id is required.' };
    }
    if (!isValidCoreId(id)) {
      return { ok: false, error: 'Invalid core id. Expected format "packager:arch".' };
    }

    return uninstallCore(id);
  });

  ipcMain.handle(
    'arduino:compile-open-sketch',
    async (
      event,
      payload: {
        requestId: string;
        workspaceRoot: string;
        activeFilePath: string;
        fqbn: string;
      }
    ) => {
      const requestId = payload.requestId?.trim();
      if (!requestId) {
        return { ok: false, error: 'requestId is required.' };
      }

      const emitOutput = (chunk: { stream: 'stdout' | 'stderr'; chunk: string }) => {
        const envelope: ArduinoCommandOutputEnvelope = {
          requestId,
          operation: 'compile',
          stream: chunk.stream,
          chunk: chunk.chunk
        };
        event.sender.send('arduino:command-output', envelope);
      };

      return compileOpenSketchWithArduinoTool(payload, emitOutput);
    }
  );

  ipcMain.handle(
    'arduino:upload-open-sketch',
    async (
      event,
      payload: {
        requestId: string;
        workspaceRoot: string;
        activeFilePath: string;
        fqbn: string;
        port: string;
      }
    ) => {
      const requestId = payload.requestId?.trim();
      if (!requestId) {
        return { ok: false, error: 'requestId is required.' };
      }

      if (activeArduinoUploads.has(requestId)) {
        return { ok: false, error: `Upload already running for requestId ${requestId}` };
      }

      const abortController = new AbortController();
      activeArduinoUploads.set(requestId, abortController);
      safeConsoleWrite(
        'log',
        `[ArduinoUpload] start requestId=${requestId} fqbn=${payload.fqbn ?? 'unknown'} port=${payload.port ?? 'unknown'} sketch=${payload.activeFilePath ?? 'unknown'}`
      );

      try {
        const emitOutput = (chunk: { stream: 'stdout' | 'stderr'; chunk: string }) => {
          const envelope: ArduinoCommandOutputEnvelope = {
            requestId,
            operation: 'upload',
            stream: chunk.stream,
            chunk: chunk.chunk
          };
          event.sender.send('arduino:command-output', envelope);
        };
        const result = await uploadOpenSketch(payload, abortController.signal, emitOutput);
        const status = result.ok ? result.result.status : 'error';
        const exitCode = result.ok ? result.result.exitCode ?? 'null' : 'null';
        safeConsoleWrite('log', `[ArduinoUpload] done requestId=${requestId} status=${status} exitCode=${exitCode}`);
        return result;
      } finally {
        activeArduinoUploads.delete(requestId);
      }
    }
  );

  ipcMain.handle('arduino:cancel-upload', async (_event, requestId: string) => {
    const normalizedRequestId = requestId?.trim();
    if (!normalizedRequestId) {
      return { ok: false, cancelled: false, error: 'requestId is required.' };
    }

    const running = activeArduinoUploads.get(normalizedRequestId);
    if (!running) {
      return { ok: false, cancelled: false, error: 'No active upload for requestId' };
    }

    safeConsoleWrite('log', `[ArduinoUpload] cancel requestId=${normalizedRequestId}`);
    running.abort();
    return { ok: true, cancelled: true };
  });

  ipcMain.handle(
    'serial:connect',
    async (
      _event,
      payload: {
        port: string;
        baudRate: number;
      }
    ) => {
      return serialMonitor.connect(payload);
    }
  );

  ipcMain.handle(
    'serial:disconnect',
    async (
      _event,
      payload?: {
        reason?: string;
      }
    ) => {
      return serialMonitor.disconnect(payload);
    }
  );

  ipcMain.handle(
    'serial:send',
    async (
      _event,
      payload: {
        text: string;
        appendNewline?: boolean;
      }
    ) => {
      return serialMonitor.send(payload);
    }
  );

  ipcMain.handle('serial:get-snapshot', async () => {
    return {
      ok: true,
      snapshot: serialMonitor.getSnapshot()
    };
  });

  ipcMain.handle('serial:clear', async () => {
    return serialMonitor.clearEntries();
  });

  ipcMain.handle('serial:export-csv', async (event) => {
    try {
      const snapshot = serialMonitor.getSnapshot();
      const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const defaultFilename = createSerialExportFilename(snapshot.port);
      const defaultPath = path.join(app.getPath('documents'), defaultFilename);
      const saveDialogOptions = {
        title: 'Export Serial Monitor CSV',
        defaultPath,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      };
      const result = owner
        ? await dialog.showSaveDialog(owner, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions);

      if (result.canceled || !result.filePath) {
        return { ok: true };
      }

      await fs.writeFile(result.filePath, serialMonitor.toCsv(), 'utf8');
      return { ok: true, path: result.filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export serial monitor CSV.';
      return { ok: false, error: message };
    }
  });
  ipcMain.handle(
    'agent:list-sessions',
    async (
      _event,
      payload: {
        workspaceRoot: string;
      }
    ): Promise<{ ok: boolean; sessions?: OpenCodeSessionSummary[]; error?: string }> => {
      try {
        const sessions = await listOpenCodeSessions({
          workspaceRoot: payload.workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, sessions };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list OpenCode sessions';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:get-history',
    async (
      _event,
      payload: {
        workspaceRoot: string;
        limit?: number;
        sessionId?: string;
      }
    ): Promise<{ ok: boolean; messages?: AgentHistoryMessage[]; error?: string }> => {
      try {
        const messages = await loadOpenCodeSessionHistory({
          workspaceRoot: payload.workspaceRoot,
          limit: payload.limit,
          sessionId: payload.sessionId,
          onLog: logOpenCodeLine
        });
        return { ok: true, messages };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load OpenCode history';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:list-pending-interrupts',
    async (
      _event,
      payload: {
        workspaceRoot: string;
        sessionId?: string;
      }
    ): Promise<{ ok: boolean; pending?: OpenCodePendingInterrupts; error?: string }> => {
      try {
        const pending = await listOpenCodePendingInterrupts({
          workspaceRoot: payload.workspaceRoot,
          sessionId: payload.sessionId,
          onLog: logOpenCodeLine
        });
        return { ok: true, pending };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list pending OpenCode interrupts';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:permission-reply',
    async (
      _event,
      payload: {
        workspaceRoot: string;
        requestId: string;
        reply: 'once' | 'always' | 'reject';
        message?: string;
      }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        await replyOpenCodePermission({
          workspaceRoot: payload.workspaceRoot,
          requestId: payload.requestId,
          reply: payload.reply,
          message: payload.message,
          onLog: logOpenCodeLine
        });
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reply to OpenCode permission';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:question-reply',
    async (
      _event,
      payload: {
        workspaceRoot: string;
        requestId: string;
        answers: string[][];
      }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        await replyOpenCodeQuestion({
          workspaceRoot: payload.workspaceRoot,
          requestId: payload.requestId,
          answers: payload.answers,
          onLog: logOpenCodeLine
        });
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reply to OpenCode question';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:question-reject',
    async (
      _event,
      payload: {
        workspaceRoot: string;
        requestId: string;
      }
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        await rejectOpenCodeQuestion({
          workspaceRoot: payload.workspaceRoot,
          requestId: payload.requestId,
          onLog: logOpenCodeLine
        });
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reject OpenCode question';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:new-session',
    async (
      _event,
      payload: {
        workspaceRoot: string;
      }
    ): Promise<{ ok: boolean; sessionId?: string; error?: string }> => {
      try {
        const sessionId = await createOpenCodeSession({
          workspaceRoot: payload.workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, sessionId };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create OpenCode session';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'agent:run-turn',
    async (
      event,
      payload: {
        requestId: string;
        workspaceRoot: string;
        prompt: string;
        sessionId?: string;
        model?: {
          providerID: string;
          modelID: string;
        };
      }
    ) => {
      if (activeAgentTurns.has(payload.requestId)) {
        return { ok: false, error: 'Turn already running for this request id' };
      }

      const abortController = new AbortController();
      activeAgentTurns.set(payload.requestId, abortController);

      const sendEvent = (streamEvent: AgentStreamEvent) => {
        event.sender.send('agent:stream', {
          requestId: payload.requestId,
          event: streamEvent
        });
      };
      const sendLog = (line: string) => {
        logOpenCodeLine(line);
        event.sender.send('agent:log', {
          requestId: payload.requestId,
          line
        });
      };

      try {
        await runOpenCodeTurn({
          workspaceRoot: payload.workspaceRoot,
          prompt: payload.prompt,
          sessionId: payload.sessionId,
          model: payload.model,
          signal: abortController.signal,
          onEvent: sendEvent,
          onLog: sendLog
        });

        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OpenCode execution failed';
        return { ok: false, error: message };
      } finally {
        activeAgentTurns.delete(payload.requestId);
      }
    }
  );

  ipcMain.handle('agent:cancel-turn', async (_event, requestId: string) => {
    const running = activeAgentTurns.get(requestId);
    if (!running) return { ok: false };

    running.abort();
    return { ok: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  void serialMonitor.dispose();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void shutdownOpenCodeRuntime();
  void serialMonitor.dispose();
});
