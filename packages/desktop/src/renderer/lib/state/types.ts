export const APP_STATE_VERSION = 1 as const;
export const WORKSPACE_STATE_VERSION = 1 as const;

export type PersistedTreeItem = {
  path: string;
  isDirectory: boolean;
};

export type MonacoThemeId =
  | "vs-dark"
  | "arduino-dark"
  | "vs"
  | "hc-black"
  | "hc-light"
  | "gruvbox-dark";

export type ChatFontSizePreset = "small" | "default" | "large";
export type ThinkingLevel = "default" | "low" | "medium" | "high";

export type SelectedModelRef = {
  providerId: string;
  modelId: string;
};

export type ModelCatalogProviderModel = {
  id: string;
  name: string;
  releaseDate: string | null;
  status: 'active' | 'beta' | 'alpha' | 'deprecated' | null;
  reasoning: boolean;
  toolCall: boolean;
  variants?: string[];
  limit?: {
    context?: number;
    output?: number;
  };
};

export type ModelCatalogProvider = {
  providerId: string;
  providerName: string;
  available?: boolean;
  connected: boolean;
  defaultModelId: string | null;
  recommendedModelId: string | null;
  models: ModelCatalogProviderModel[];
};

export type RuntimeModelCatalogState = {
  providers: ModelCatalogProvider[];
  loading: boolean;
  error: string | null;
  loadedAt: string | null;
  requestId: number;
};

export type RuntimeRequirementId = "opencode" | "arduino-cli";

export type RuntimeRequirementStatus = {
  id: RuntimeRequirementId;
  label: string;
  installed: boolean;
  version: string | null;
  checkedAt: string;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath?: string;
  source?: "managed" | "system";
  managedVersion?: string;
  runtimeDataRoot?: string;
  runtimeConfigRoot?: string;
  runtimeStateRoot?: string;
  isolated?: boolean;
  releaseTargetKey?: string;
  releaseArchiveName?: string;
  releaseArchiveSha256?: string;
};

export type AppState = {
  version: typeof APP_STATE_VERSION;
  activeWorkspaceRoot: string | null;
  layout: {
    chatWidthPct: number;
    chatCollapsed: boolean;
    editorWidthPct: number;
    fileManagerCollapsed: boolean;
    showHiddenFiles: boolean;
  };
  serial: {
    bufferSize: number;
  };
  appearance: {
    monacoTheme: MonacoThemeId;
    chatFontSize: ChatFontSizePreset;
  };
  agent: {
    showReasoning: boolean;
    thinkingLevel: ThinkingLevel;
  };
  providers: {
    selectedModel: SelectedModelRef | null;
    hiddenModels: SelectedModelRef[];
    runtimeModelCatalogByWorkspaceRoot: Record<string, RuntimeModelCatalogState>;
  };
};

export type RequirementsState = {
  requirements: RuntimeRequirementStatus[];
  loading: boolean;
  error: string | null;
  checkedAt: string | null;
};

export type PaneTab = "code" | "monitor";
export type SerialMonitorView = "monitor" | "plotter";

export type WorkspaceState = {
  rootPath: string;
  workspaceName: string;
  lastOpenedAt: string;
  agentMode: "build" | "plan";
  boardFqbn: string;
  boardOptionSelections: Record<string, string>;
  serialPort: string;
  serialBaudRate: number;
  serialMonitorShowTimestamps: boolean;
  serialMonitorActiveView: SerialMonitorView;
  fileTree: PersistedTreeItem[];
  expandedDirKeys: string[];
  activePaneTab: PaneTab;
  openFileOrder: string[];
  activeFilePath: string | null;
  currentSessionId: string | null;
};

export type WorkspaceManagerState = {
  version: typeof WORKSPACE_STATE_VERSION;
  recentWorkspaceRoots: string[];
  favoriteBoardFqbns: string[];
  byRoot: Record<string, WorkspaceState>;
};

export type StateBootstrap = {
  appState: AppState;
  workspaceState: WorkspaceManagerState;
};
