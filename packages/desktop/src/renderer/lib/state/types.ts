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

export type SelectedModelRef = {
  providerId: string;
  modelId: string;
};

export type AppState = {
  version: typeof APP_STATE_VERSION;
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
    selectedModel: SelectedModelRef | null;
  };
};

export type PaneTab = "code" | "monitor";

export type WorkspaceState = {
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
