import {
  APP_STATE_VERSION,
  WORKSPACE_STATE_VERSION,
  type AppState,
  type ChatFontSizePreset,
  type MonacoThemeId,
  type PaneTab,
  type PersistedTreeItem,
  type WorkspaceManagerState,
  type WorkspaceState
} from './types';
import {
  SERIAL_BUFFER_SIZE_DEFAULT,
  sanitizeSerialBufferSize
} from '../serial/bufferSettings';

export const CHAT_MIN_WIDTH_PCT = 25;
export const CHAT_MAX_WIDTH_PCT = 65;
export const EDITOR_MIN_WIDTH_PCT = 45;
export const EDITOR_MAX_WIDTH_PCT = 85;
export const MAX_RECENT_WORKSPACES = 12;
export const SERIAL_BAUD_RATE_DEFAULT = 9600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function sanitizeTree(items: unknown): PersistedTreeItem[] {
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

export function createDefaultAppState(): AppState {
  return {
    version: APP_STATE_VERSION,
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
    },
  };
}

export function createDefaultWorkspaceState(rootPath: string, workspaceName = ''): WorkspaceState {
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

export function createDefaultWorkspaceManagerState(): WorkspaceManagerState {
  return {
    version: WORKSPACE_STATE_VERSION,
    recentWorkspaceRoots: [],
    favoriteBoardFqbns: [],
    byRoot: {}
  };
}

export function sanitizeAppState(input: unknown): AppState {
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
    version: APP_STATE_VERSION,
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

export function sanitizeWorkspaceState(input: unknown, rootPath: string): WorkspaceState {
  const defaults = createDefaultWorkspaceState(rootPath);
  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const candidate = input as Partial<WorkspaceState>;
  const persistedRoot = asNonBlankString(candidate.rootPath) ?? rootPath;
  const workspaceName = asNonBlankString(candidate.workspaceName) ?? '';
  const lastOpenedAt = asNonBlankString(candidate.lastOpenedAt) ?? defaults.lastOpenedAt;
  const boardFqbn = asNonBlankString(candidate.boardFqbn) ?? '';
  const boardOptionSelections = asStringRecord(candidate.boardOptionSelections);
  const serialPort = asNonBlankString(candidate.serialPort) ?? '';
  const serialBaudRate =
    typeof candidate.serialBaudRate === 'number' && Number.isFinite(candidate.serialBaudRate)
      ? Math.max(1, Math.floor(candidate.serialBaudRate))
      : defaults.serialBaudRate;
  const serialMonitorShowTimestamps =
    typeof candidate.serialMonitorShowTimestamps === 'boolean'
      ? candidate.serialMonitorShowTimestamps
      : defaults.serialMonitorShowTimestamps;
  const activeFilePath = asNonBlankString(candidate.activeFilePath) ?? null;
  const currentSessionId = asNonBlankString(candidate.currentSessionId) ?? null;
  const expandedDirKeys = asStringArray(candidate.expandedDirKeys);
  const activePaneTab = sanitizePaneTab(candidate.activePaneTab);
  const openFileOrder = asStringArray(candidate.openFileOrder);
  const fileTree = sanitizeTree(candidate.fileTree);

  return {
    rootPath: persistedRoot,
    workspaceName,
    lastOpenedAt,
    boardFqbn,
    boardOptionSelections,
    serialPort,
    serialBaudRate,
    serialMonitorShowTimestamps,
    fileTree,
    expandedDirKeys,
    activePaneTab,
    openFileOrder,
    activeFilePath,
    currentSessionId
  };
}

export function sanitizeWorkspaceManagerState(input: unknown): WorkspaceManagerState {
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
    version: WORKSPACE_STATE_VERSION,
    recentWorkspaceRoots: recentRoots,
    favoriteBoardFqbns,
    byRoot
  };
}
