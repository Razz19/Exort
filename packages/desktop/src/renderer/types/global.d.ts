/// <reference types="vite/client" />

export {};

type AgentStreamEvent =
  | { type: 'content'; content: string; partId?: string; contentKind?: 'reasoning' | 'text' }
  | { type: 'tool_call'; toolCallId: string; name: string; input?: string }
  | { type: 'tool_result'; toolCallId: string; output: string; isError?: boolean }
  | {
      type: 'session_status';
      statusType: string;
      message?: string;
      attempt?: number;
      next?: number;
    }
  | {
      type: 'message_updated';
      messageId: string;
      role?: string;
      sessionId?: string;
    }
  | {
      type: 'message_part_removed';
      messageId: string;
      partId: string;
      sessionId?: string;
    }
  | { type: 'permission_asked'; requestId: string; sessionId: string; toolCallId?: string; title: string }
  | { type: 'permission_replied'; requestId: string; sessionId: string; reply: string }
  | {
      type: 'question_asked';
      requestId: string;
      sessionId: string;
      toolCallId?: string;
      questions: AgentQuestionInfo[];
    }
  | { type: 'question_replied'; requestId: string; sessionId: string; answers: string[][] }
  | { type: 'question_rejected'; requestId: string; sessionId: string }
  | { type: 'task'; message: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

type AgentStreamEnvelope = {
  requestId: string;
  event: AgentStreamEvent;
};
type AgentLogEnvelope = {
  requestId: string;
  line: string;
};
type ArduinoCommandOutputEnvelope = {
  requestId: string;
  operation: 'compile' | 'upload';
  stream: 'stdout' | 'stderr';
  chunk: string;
};
type FileChangedEnvelope = {
  filePath: string;
  content: string;
};
type WorkspaceTreeChangedEnvelope = {
  rootPath: string;
  tree: Array<{ path: string; isDirectory: boolean }>;
};
type AgentHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
type AgentSessionSummary = {
  id: string;
  title: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
};
type OpenAIProviderModel = {
  id: string;
  name: string;
  releaseDate: string | null;
  status: 'active' | 'beta' | 'alpha' | 'deprecated' | null;
  reasoning: boolean;
  toolCall: boolean;
};
type OpenAIProviderAuthMethod = {
  index: number;
  type: 'oauth' | 'api' | 'unknown';
  label: string;
};
type OpenAIProviderState = {
  providerId: 'openai';
  available: boolean;
  connected: boolean;
  defaultModelId: string | null;
  recommendedModelId: string | null;
  models: OpenAIProviderModel[];
  authMethods: OpenAIProviderAuthMethod[];
  oauthMethodIndices: number[];
  recommendedOAuthMethodIndex: number | null;
  apiKeyMethodIndex: number | null;
};
type OpenAIOAuthStartResult = {
  providerId: 'openai';
  methodIndex: number;
  url: string;
  method: 'auto' | 'code';
  instructions: string;
};
type OpenAIOAuthCompleteResult = {
  providerId: 'openai';
  methodIndex: number;
  ok: boolean;
};
type AgentQuestionOption = {
  label: string;
  description: string;
};
type AgentQuestionInfo = {
  header: string;
  question: string;
  options: AgentQuestionOption[];
  multiple: boolean;
  custom: boolean;
};
type AgentQuestionRequest = {
  id: string;
  sessionId: string;
  toolCallId?: string;
  messageId?: string;
  questions: AgentQuestionInfo[];
};
type AgentPermissionRequest = {
  id: string;
  sessionId: string;
  title: string;
  toolCallId?: string;
  messageId?: string;
};
type AgentPendingInterrupts = {
  permissions: AgentPermissionRequest[];
  questions: AgentQuestionRequest[];
};
type ArduinoPortOption = {
  address: string;
  label: string;
  protocol: string;
};
type ArduinoBoardOption = {
  name: string;
  fqbn: string;
  platform: string;
};
type ArduinoCoreTier = 'official' | 'certified' | 'partner' | 'community';
type ArduinoCorePackage = {
  id: string;
  name: string;
  maintainer: string;
  website: string | null;
  installedVersion: string | null;
  latestVersion: string | null;
  boardCount: number;
  types: string[];
  deprecated: boolean;
  tier: ArduinoCoreTier;
};
type ArduinoCompileResult = {
  ok: boolean;
  status?: string;
  message?: string;
  workspaceRoot?: string;
  sketchDirectory?: string;
  fqbn?: string;
  command?: string[];
  exitCode?: number | null;
  aborted?: boolean;
  errorSummary?: string[];
  stdout?: string | null;
  stderr?: string | null;
  inferred?: Record<string, unknown>;
};
type ArduinoUploadResult = {
  ok: boolean;
  status: 'uploaded' | 'upload_failed' | 'upload_cancelled';
  message: string;
  workspaceRoot: string;
  sketchDirectory: string;
  fqbn: string;
  port: string;
  command: string[];
  exitCode: number | null;
  aborted: boolean;
  stdout: string;
  stderr: string;
  error?: string;
};
type RequirementId = 'opencode' | 'arduino-cli';
type RequirementStatus = {
  id: RequirementId;
  label: string;
  installed: boolean;
  version: string | null;
  checkedAt: string;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath?: string;
  source?: 'managed' | 'system';
  managedVersion?: string;
  runtimeDataRoot?: string;
  runtimeConfigRoot?: string;
  runtimeStateRoot?: string;
  isolated?: boolean;
};
type RequirementInstallResult = {
  id: RequirementId;
  ok: boolean;
  installedAfter: boolean;
  versionAfter: string | null;
  strategyTried: string | null;
  message: string;
  manualCommands: string[];
  logs: string[];
};
type SerialMonitorStatus = 'disconnected' | 'connected' | 'streaming';
type SerialLogDirection = 'rx' | 'tx' | 'system';
type SerialLogEntry = {
  id: string;
  timestamp: string;
  direction: SerialLogDirection;
  text: string;
};
type SerialMonitorSnapshot = {
  status: SerialMonitorStatus;
  port: string | null;
  baudRate: number | null;
  entries: SerialLogEntry[];
};
type SerialMonitorEvent =
  | {
      type: 'status';
      status: SerialMonitorStatus;
      port: string | null;
      baudRate: number | null;
    }
  | {
      type: 'entry';
      entry: SerialLogEntry;
    }
  | {
      type: 'cleared';
    }
  | {
      type: 'error';
      message: string;
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
type StateBootstrap = {
  appState: AppState;
  workspaceState: WorkspaceManagerState;
};

declare global {
  interface Window {
    electronAPI: {
      getStateBootstrap: () => Promise<StateBootstrap>;
      setAppState: (appState: AppState) => Promise<{ ok: boolean }>;
      setWorkspaceManagerState: (workspaceState: WorkspaceManagerState) => Promise<{ ok: boolean }>;
      openFolder: () => Promise<{
        cancelled: boolean;
        workspace?: { id: string; name: string; rootPath: string };
        tree?: Array<{ path: string; isDirectory: boolean }>;
      }>;
      listSavedWorkspaces: () => Promise<Array<{ id: string; name: string; rootPath: string }>>;
      removeSavedWorkspace: (payload: {
        rootPath: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      getWorkspaceTree: (rootPath: string) => Promise<Array<{ path: string; isDirectory: boolean }>>;
      openWorkspaceInFinder: (payload: {
        rootPath: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      createWorkspaceEntry: (payload: {
        workspaceRoot: string;
        parentPath: string;
        kind: 'file' | 'folder';
        name: string;
      }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      renameWorkspaceEntry: (payload: {
        workspaceRoot: string;
        path: string;
        nextName: string;
      }) => Promise<{ ok: boolean; path?: string; error?: string }>;
      watchWorkspaceTree: (rootPath: string) => Promise<{ ok: boolean }>;
      unwatchWorkspaceTree: (rootPath: string) => Promise<{ ok: boolean }>;
      unwatchAllWorkspaceTrees: () => Promise<{ ok: boolean }>;
      readFile: (filePath: string) => Promise<{ content: string }>;
      readFileIfExists: (filePath: string) => Promise<{
        ok: boolean;
        content: string | null;
        missing: boolean;
        error?: string;
      }>;
      writeFile: (payload: { filePath: string; content: string }) => Promise<{ ok: boolean }>;
      watchFile: (filePath: string) => Promise<{ ok: boolean }>;
      unwatchFile: (filePath: string) => Promise<{ ok: boolean }>;
      unwatchAllFiles: () => Promise<{ ok: boolean }>;
      getRequirementsStatus: () => Promise<{
        ok: boolean;
        requirements?: RequirementStatus[];
        error?: string;
      }>;
      installRequirement: (payload: {
        id: RequirementId;
      }) => Promise<{ ok: boolean; result?: RequirementInstallResult; error?: string }>;
      listArduinoPorts: () => Promise<{ ok: boolean; ports?: ArduinoPortOption[]; error?: string }>;
      listArduinoBoards: () => Promise<{ ok: boolean; boards?: ArduinoBoardOption[]; error?: string }>;
      listArduinoInstalledCores: () => Promise<{ ok: boolean; cores?: ArduinoCorePackage[]; error?: string }>;
      listArduinoCatalogCores: () => Promise<{ ok: boolean; cores?: ArduinoCorePackage[]; error?: string }>;
      updateArduinoCoreIndex: () => Promise<{ ok: boolean; error?: string }>;
      installArduinoCore: (payload: { id: string }) => Promise<{ ok: boolean; message?: string; error?: string }>;
      uninstallArduinoCore: (payload: { id: string }) => Promise<{ ok: boolean; message?: string; error?: string }>;
      compileArduinoOpenSketch: (payload: {
        requestId: string;
        workspaceRoot: string;
        activeFilePath: string;
        fqbn: string;
      }) => Promise<{ ok: boolean; result?: ArduinoCompileResult; error?: string }>;
      uploadArduinoOpenSketch: (payload: {
        requestId: string;
        workspaceRoot: string;
        activeFilePath: string;
        fqbn: string;
        port: string;
      }) => Promise<{ ok: boolean; result?: ArduinoUploadResult; error?: string }>;
      cancelArduinoUpload: (requestId: string) => Promise<{ ok: boolean; cancelled: boolean; error?: string }>;
      serialConnect: (payload: { port: string; baudRate: number }) => Promise<{ ok: boolean; error?: string }>;
      serialDisconnect: (payload?: { reason?: string }) => Promise<{ ok: boolean; error?: string }>;
      serialSend: (payload: { text: string; appendNewline?: boolean }) => Promise<{ ok: boolean; error?: string }>;
      serialGetSnapshot: () => Promise<{ ok: boolean; snapshot?: SerialMonitorSnapshot; error?: string }>;
      serialClear: () => Promise<{ ok: boolean }>;
      serialExportCsv: () => Promise<{ ok: boolean; path?: string; error?: string }>;
      openExternalUrl: (payload: { url: string }) => Promise<{ ok: boolean; error?: string }>;
      openBrowserUrl: (payload: { url: string }) => Promise<{ ok: boolean; error?: string }>;
      getOpenAIProviderState: (payload?: { workspaceRoot?: string }) => Promise<{
        ok: boolean;
        state?: OpenAIProviderState;
        error?: string;
      }>;
      startOpenAIProviderOAuth: (payload?: { workspaceRoot?: string; methodIndex?: number }) => Promise<{
        ok: boolean;
        result?: OpenAIOAuthStartResult;
        error?: string;
      }>;
      completeOpenAIProviderOAuth: (payload: {
        workspaceRoot?: string;
        methodIndex: number;
        code?: string;
      }) => Promise<{
        ok: boolean;
        result?: OpenAIOAuthCompleteResult;
        state?: OpenAIProviderState;
        error?: string;
      }>;
      setOpenAIProviderApiKey: (payload: { workspaceRoot?: string; apiKey: string }) => Promise<{
        ok: boolean;
        state?: OpenAIProviderState;
        error?: string;
      }>;
      disconnectOpenAIProvider: (payload?: { workspaceRoot?: string }) => Promise<{
        ok: boolean;
        state?: OpenAIProviderState;
        error?: string;
      }>;
      onSerialMonitorEvent: (listener: (payload: SerialMonitorEvent) => void) => void;
      offSerialMonitorEvent: (listener: (payload: SerialMonitorEvent) => void) => void;
      onArduinoCommandOutput: (listener: (payload: ArduinoCommandOutputEnvelope) => void) => void;
      offArduinoCommandOutput: (listener: (payload: ArduinoCommandOutputEnvelope) => void) => void;
      startAgentTurn: (payload: {
        requestId: string;
        workspaceRoot: string;
        prompt: string;
        sessionId?: string;
        model?: {
          providerID: string;
          modelID: string;
        };
      }) => Promise<{ ok: boolean; error?: string }>;
      listAgentSessions: (payload: {
        workspaceRoot: string;
      }) => Promise<{ ok: boolean; sessions?: AgentSessionSummary[]; error?: string }>;
      getAgentHistory: (payload: {
        workspaceRoot: string;
        limit?: number;
        sessionId?: string;
      }) => Promise<{ ok: boolean; messages?: AgentHistoryMessage[]; error?: string }>;
      listAgentPendingInterrupts: (payload: {
        workspaceRoot: string;
        sessionId?: string;
      }) => Promise<{ ok: boolean; pending?: AgentPendingInterrupts; error?: string }>;
      replyAgentPermission: (payload: {
        workspaceRoot: string;
        requestId: string;
        reply: 'once' | 'always' | 'reject';
        message?: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      replyAgentQuestion: (payload: {
        workspaceRoot: string;
        requestId: string;
        answers: string[][];
      }) => Promise<{ ok: boolean; error?: string }>;
      rejectAgentQuestion: (payload: {
        workspaceRoot: string;
        requestId: string;
      }) => Promise<{ ok: boolean; error?: string }>;
      createAgentSession: (payload: {
        workspaceRoot: string;
      }) => Promise<{ ok: boolean; sessionId?: string; error?: string }>;
      cancelAgentTurn: (requestId: string) => Promise<{ ok: boolean }>;
      onAgentStream: (listener: (payload: AgentStreamEnvelope) => void) => void;
      offAgentStream: (listener: (payload: AgentStreamEnvelope) => void) => void;
      onAgentLog: (listener: (payload: AgentLogEnvelope) => void) => void;
      offAgentLog: (listener: (payload: AgentLogEnvelope) => void) => void;
      onFileChanged: (listener: (payload: FileChangedEnvelope) => void) => void;
      offFileChanged: (listener: (payload: FileChangedEnvelope) => void) => void;
      onWorkspaceTreeChanged: (listener: (payload: WorkspaceTreeChangedEnvelope) => void) => void;
      offWorkspaceTreeChanged: (listener: (payload: WorkspaceTreeChangedEnvelope) => void) => void;
    };
  }
}
