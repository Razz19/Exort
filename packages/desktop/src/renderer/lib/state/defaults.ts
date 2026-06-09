import {
  APP_STATE_VERSION,
  type ModelCatalogProvider,
  type ModelCatalogProviderModel,
  type RuntimeModelCatalogState,
  type SelectedModelRef,
  WORKSPACE_STATE_VERSION,
  type AppState,
  type ChatFontSizePreset,
  type MonacoThemeId,
  type PaneTab,
  type PersistedTreeItem,
  type SerialMonitorView,
  type ThinkingLevel,
  type WorkspaceManagerState,
  type WorkspaceState
} from './types';
import {
  SERIAL_BUFFER_SIZE_DEFAULT,
  sanitizeSerialBufferSize
} from '../serial/bufferSettings';

export const CHAT_MIN_WIDTH_PCT = 30;
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

function sanitizeSelectedModelRef(value: unknown): SelectedModelRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Partial<SelectedModelRef>;
  const providerId = asNonBlankString(candidate.providerId);
  const modelId = asNonBlankString(candidate.modelId);
  if (!providerId || !modelId) return null;

  return {
    providerId,
    modelId
  };
}

function sanitizeCatalogProviderModel(value: unknown): ModelCatalogProviderModel | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Partial<ModelCatalogProviderModel>;
  const id = asNonBlankString(candidate.id);
  const name = asNonBlankString(candidate.name);
  if (!id || !name) return null;

  const status =
    candidate.status === 'active' ||
    candidate.status === 'beta' ||
    candidate.status === 'alpha' ||
    candidate.status === 'deprecated'
      ? candidate.status
      : null;
  const releaseDate = asNonBlankString(candidate.releaseDate) ?? null;
  const variants = asUniqueStringArray(candidate.variants);

  const contextLimit =
    typeof candidate.limit?.context === 'number' && Number.isFinite(candidate.limit.context)
      ? Math.max(0, Math.floor(candidate.limit.context))
      : undefined;
  const outputLimit =
    typeof candidate.limit?.output === 'number' && Number.isFinite(candidate.limit.output)
      ? Math.max(0, Math.floor(candidate.limit.output))
      : undefined;

  return {
    id,
    name,
    releaseDate,
    status,
    reasoning: candidate.reasoning !== false,
    toolCall: candidate.toolCall !== false,
    variants: variants.length > 0 ? variants : undefined,
    limit:
      contextLimit !== undefined || outputLimit !== undefined
        ? {
            context: contextLimit,
            output: outputLimit
          }
        : undefined
  };
}

function sanitizeCatalogProvider(value: unknown): ModelCatalogProvider | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Partial<ModelCatalogProvider>;
  const providerId = asNonBlankString(candidate.providerId);
  if (!providerId) return null;

  const providerName = asNonBlankString(candidate.providerName) ?? providerId;
  const defaultModelId = asNonBlankString(candidate.defaultModelId) ?? null;
  const recommendedModelId = asNonBlankString(candidate.recommendedModelId) ?? null;
  const models = Array.isArray(candidate.models)
    ? candidate.models.map((item) => sanitizeCatalogProviderModel(item)).filter((item): item is ModelCatalogProviderModel => item !== null)
    : [];

  return {
    providerId,
    providerName,
    available: candidate.available === false ? false : true,
    connected: candidate.connected === true,
    defaultModelId,
    recommendedModelId,
    models
  };
}

function sanitizeRuntimeModelCatalogState(value: unknown): RuntimeModelCatalogState {
  const defaults = createDefaultRuntimeModelCatalogState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;

  const candidate = value as Partial<RuntimeModelCatalogState>;
  const providers = Array.isArray(candidate.providers)
    ? candidate.providers.map((item) => sanitizeCatalogProvider(item)).filter((item): item is ModelCatalogProvider => item !== null)
    : [];
  const loadedAt = asNonBlankString(candidate.loadedAt) ?? null;
  const requestId =
    typeof candidate.requestId === 'number' && Number.isFinite(candidate.requestId)
      ? Math.max(0, Math.floor(candidate.requestId))
      : 0;

  return {
    providers,
    loading: candidate.loading === true,
    error: asNonBlankString(candidate.error) ?? null,
    loadedAt,
    requestId
  };
}

function sanitizeRuntimeModelCatalogByWorkspaceRoot(value: unknown): Record<string, RuntimeModelCatalogState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: Record<string, RuntimeModelCatalogState> = {};
  for (const [workspaceRoot, state] of Object.entries(value as Record<string, unknown>)) {
    const root = asNonBlankString(workspaceRoot);
    if (!root) continue;
    result[root] = sanitizeRuntimeModelCatalogState(state);
  }

  return result;
}

function sanitizeHiddenModelRefs(value: unknown): SelectedModelRef[] {
  if (!Array.isArray(value)) return [];

  const dedupe = new Set<string>();
  const next: SelectedModelRef[] = [];
  for (const item of value) {
    const ref = sanitizeSelectedModelRef(item);
    if (!ref) continue;

    const key = `${ref.providerId}\u0000${ref.modelId}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    next.push(ref);
  }

  return next;
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

function sanitizeSerialMonitorView(value: unknown): SerialMonitorView {
  if (value === 'plotter') return 'plotter';
  return 'monitor';
}

function sanitizeMonacoThemeId(value: unknown): MonacoThemeId {
  if (value === 'arduino-dark') return 'arduino-dark';
  if (value === 'vs') return 'vs';
  if (value === 'hc-black') return 'hc-black';
  if (value === 'hc-light') return 'hc-light';
  if (value === 'gruvbox-dark') return 'gruvbox-dark';
  return 'gruvbox-dark';
}

function sanitizeChatFontSizePreset(value: unknown): ChatFontSizePreset {
  if (value === 'small') return 'small';
  if (value === 'large') return 'large';
  return 'default';
}

function sanitizeThinkingLevel(value: unknown): ThinkingLevel {
  if (value === 'low') return 'low';
  if (value === 'medium') return 'medium';
  if (value === 'high') return 'high';
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

export function createDefaultRuntimeModelCatalogState(): RuntimeModelCatalogState {
  return {
    providers: [],
    loading: false,
    error: null,
    loadedAt: null,
    requestId: 0
  };
}

export function createDefaultAppState(): AppState {
  return {
    version: APP_STATE_VERSION,
    activeWorkspaceRoot: null,
    layout: {
      chatWidthPct: 40,
      chatCollapsed: false,
      editorWidthPct: 70,
      fileManagerCollapsed: false,
      showHiddenFiles: false
    },
    serial: {
      bufferSize: SERIAL_BUFFER_SIZE_DEFAULT
    },
    appearance: {
      monacoTheme: 'gruvbox-dark',
      chatFontSize: 'default'
    },
    agent: {
      showReasoning: false,
      thinkingLevel: 'default'
    },
    providers: {
      selectedModel: null,
      hiddenModels: [],
      runtimeModelCatalogByWorkspaceRoot: {}
    }
  };
}

export function createDefaultWorkspaceState(rootPath: string, workspaceName = ''): WorkspaceState {
  return {
    rootPath,
    workspaceName,
    lastOpenedAt: new Date(0).toISOString(),
    agentMode: 'build',
    boardFqbn: '',
    boardOptionSelections: {},
    serialPort: '',
    serialBaudRate: SERIAL_BAUD_RATE_DEFAULT,
    serialMonitorShowTimestamps: true,
    serialMonitorActiveView: 'monitor',
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
  const showHiddenFiles =
    typeof layoutCandidate?.showHiddenFiles === 'boolean'
      ? layoutCandidate.showHiddenFiles
      : defaults.layout.showHiddenFiles;
  const providersCandidate =
    candidate.providers && typeof candidate.providers === 'object'
      ? (candidate.providers as Partial<AppState['providers']> & {
          openai?: { selectedModelId?: unknown };
        })
      : undefined;
  const appearanceCandidate =
    candidate.appearance && typeof candidate.appearance === 'object'
      ? (candidate.appearance as Partial<AppState['appearance']>)
      : undefined;
  const agentCandidate =
    candidate.agent && typeof candidate.agent === 'object'
      ? (candidate.agent as Partial<AppState['agent']>)
      : undefined;
  const selectedModelCandidate = sanitizeSelectedModelRef(providersCandidate?.selectedModel);
  const openAICandidate =
    providersCandidate?.openai && typeof providersCandidate.openai === 'object' ? providersCandidate.openai : undefined;
  const legacyOpenAIModelId = asNonBlankString(openAICandidate?.selectedModelId);

  return {
    version: APP_STATE_VERSION,
    activeWorkspaceRoot: asNonBlankString(candidate.activeWorkspaceRoot) ?? null,
    layout: {
      chatWidthPct,
      chatCollapsed,
      editorWidthPct,
      fileManagerCollapsed,
      showHiddenFiles
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
    agent: {
      showReasoning:
        typeof agentCandidate?.showReasoning === 'boolean'
          ? agentCandidate.showReasoning
          : defaults.agent.showReasoning,
      thinkingLevel: sanitizeThinkingLevel(agentCandidate?.thinkingLevel)
    },
    providers: {
      hiddenModels: sanitizeHiddenModelRefs(providersCandidate?.hiddenModels),
      selectedModel:
        selectedModelCandidate ??
        (legacyOpenAIModelId
          ? {
              providerId: 'openai',
              modelId: legacyOpenAIModelId
            }
          : null),
      runtimeModelCatalogByWorkspaceRoot: sanitizeRuntimeModelCatalogByWorkspaceRoot(
        providersCandidate?.runtimeModelCatalogByWorkspaceRoot
      )
    }
  };
}

export function stripRuntimeAppStateForPersistence(input: AppState): AppState {
  return {
    ...input,
    providers: {
      ...input.providers,
      runtimeModelCatalogByWorkspaceRoot: {}
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
  const agentMode = candidate.agentMode === 'plan' ? 'plan' : 'build';
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
  const serialMonitorActiveView = sanitizeSerialMonitorView(candidate.serialMonitorActiveView);
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
    agentMode,
    boardFqbn,
    boardOptionSelections,
    serialPort,
    serialBaudRate,
    serialMonitorShowTimestamps,
    serialMonitorActiveView,
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
