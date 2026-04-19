import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

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
type StateBootstrap = {
  appState: AppState;
  workspaceState: WorkspaceManagerState;
};

const streamListeners = new Map<(payload: AgentStreamEnvelope) => void, (event: IpcRendererEvent, payload: AgentStreamEnvelope) => void>();
const logListeners = new Map<(payload: AgentLogEnvelope) => void, (event: IpcRendererEvent, payload: AgentLogEnvelope) => void>();
const arduinoOutputListeners = new Map<
  (payload: ArduinoCommandOutputEnvelope) => void,
  (event: IpcRendererEvent, payload: ArduinoCommandOutputEnvelope) => void
>();
const fileChangeListeners = new Map<
  (payload: FileChangedEnvelope) => void,
  (event: IpcRendererEvent, payload: FileChangedEnvelope) => void
>();
const workspaceTreeListeners = new Map<
  (payload: WorkspaceTreeChangedEnvelope) => void,
  (event: IpcRendererEvent, payload: WorkspaceTreeChangedEnvelope) => void
>();
const serialMonitorListeners = new Map<
  (payload: SerialMonitorEvent) => void,
  (event: IpcRendererEvent, payload: SerialMonitorEvent) => void
>();
const electronAPI = {
  getStateBootstrap: () => ipcRenderer.invoke('state:get-bootstrap') as Promise<StateBootstrap>,
  setAppState: (appState: AppState) => ipcRenderer.invoke('state:set-app', appState) as Promise<{ ok: boolean }>,
  setWorkspaceManagerState: (workspaceState: WorkspaceManagerState) =>
    ipcRenderer.invoke('state:set-workspace-manager', workspaceState) as Promise<{ ok: boolean }>,
  openFolder: () =>
    ipcRenderer.invoke('workspace:open-folder') as Promise<{
      cancelled: boolean;
      workspace?: { id: string; name: string; rootPath: string };
      tree?: Array<{ path: string; isDirectory: boolean }>;
    }>,
  listSavedWorkspaces: () =>
    ipcRenderer.invoke('workspace:list-saved') as Promise<Array<{ id: string; name: string; rootPath: string }>>,
  removeSavedWorkspace: (payload: { rootPath: string }) =>
    ipcRenderer.invoke('workspace:remove-saved', payload) as Promise<{ ok: boolean; error?: string }>,
  getWorkspaceTree: (rootPath: string) =>
    ipcRenderer.invoke('workspace:tree', rootPath) as Promise<Array<{ path: string; isDirectory: boolean }>>,
  openWorkspaceInFinder: (payload: { rootPath: string }) =>
    ipcRenderer.invoke('workspace:open-in-finder', payload) as Promise<{ ok: boolean; error?: string }>,
  createWorkspaceEntry: (payload: {
    workspaceRoot: string;
    parentPath: string;
    kind: 'file' | 'folder';
    name: string;
  }) =>
    ipcRenderer.invoke('workspace:create-entry', payload) as Promise<{
      ok: boolean;
      path?: string;
      error?: string;
    }>,
  renameWorkspaceEntry: (payload: { workspaceRoot: string; path: string; nextName: string }) =>
    ipcRenderer.invoke('workspace:rename-entry', payload) as Promise<{
      ok: boolean;
      path?: string;
      error?: string;
    }>,
  watchWorkspaceTree: (rootPath: string) => ipcRenderer.invoke('workspace:watch-tree', rootPath) as Promise<{ ok: boolean }>,
  unwatchWorkspaceTree: (rootPath: string) =>
    ipcRenderer.invoke('workspace:unwatch-tree', rootPath) as Promise<{ ok: boolean }>,
  unwatchAllWorkspaceTrees: () => ipcRenderer.invoke('workspace:unwatch-all-trees') as Promise<{ ok: boolean }>,
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath) as Promise<{ content: string }>,
  readFileIfExists: (filePath: string) =>
    ipcRenderer.invoke('file:read-if-exists', filePath) as Promise<{
      ok: boolean;
      content: string | null;
      missing: boolean;
      error?: string;
    }>,
  writeFile: (payload: { filePath: string; content: string }) =>
    ipcRenderer.invoke('file:write', payload) as Promise<{ ok: boolean }>,
  watchFile: (filePath: string) => ipcRenderer.invoke('file:watch', filePath) as Promise<{ ok: boolean }>,
  unwatchFile: (filePath: string) => ipcRenderer.invoke('file:unwatch', filePath) as Promise<{ ok: boolean }>,
  unwatchAllFiles: () => ipcRenderer.invoke('file:unwatch-all') as Promise<{ ok: boolean }>,
  getRequirementsStatus: () =>
    ipcRenderer.invoke('requirements:get-status') as Promise<{
      ok: boolean;
      requirements?: RequirementStatus[];
      error?: string;
    }>,
  installRequirement: (payload: { id: RequirementId }) =>
    ipcRenderer.invoke('requirements:install', payload) as Promise<{
      ok: boolean;
      result?: RequirementInstallResult;
      error?: string;
    }>,
  listArduinoPorts: () =>
    ipcRenderer.invoke('arduino:list-ports') as Promise<{ ok: boolean; ports?: ArduinoPortOption[]; error?: string }>,
  listArduinoBoards: () =>
    ipcRenderer.invoke('arduino:list-boards') as Promise<{ ok: boolean; boards?: ArduinoBoardOption[]; error?: string }>,
  getArduinoBoardDetails: (payload: { fqbn: string }) =>
    ipcRenderer.invoke('arduino:get-board-details', payload) as Promise<{
      ok: boolean;
      details?: ArduinoBoardDetails;
      error?: string;
    }>,
  listArduinoInstalledCores: () =>
    ipcRenderer.invoke('arduino:list-installed-cores') as Promise<{ ok: boolean; cores?: ArduinoCorePackage[]; error?: string }>,
  listArduinoCatalogCores: () =>
    ipcRenderer.invoke('arduino:list-catalog-cores') as Promise<{ ok: boolean; cores?: ArduinoCorePackage[]; error?: string }>,
  updateArduinoCoreIndex: () =>
    ipcRenderer.invoke('arduino:update-core-index') as Promise<{ ok: boolean; error?: string }>,
  installArduinoCore: (payload: { id: string }) =>
    ipcRenderer.invoke('arduino:install-core', payload) as Promise<{ ok: boolean; message?: string; error?: string }>,
  uninstallArduinoCore: (payload: { id: string }) =>
    ipcRenderer.invoke('arduino:uninstall-core', payload) as Promise<{ ok: boolean; message?: string; error?: string }>,
  compileArduinoOpenSketch: (payload: { requestId: string; workspaceRoot: string; activeFilePath: string; fqbn: string }) =>
    ipcRenderer.invoke('arduino:compile-open-sketch', payload) as Promise<{
      ok: boolean;
      result?: ArduinoCompileResult;
      error?: string;
    }>,
  uploadArduinoOpenSketch: (payload: {
    requestId: string;
    workspaceRoot: string;
    activeFilePath: string;
    fqbn: string;
    port: string;
  }) =>
    ipcRenderer.invoke('arduino:upload-open-sketch', payload) as Promise<{
      ok: boolean;
      result?: ArduinoUploadResult;
      error?: string;
    }>,
  cancelArduinoUpload: (requestId: string) =>
    ipcRenderer.invoke('arduino:cancel-upload', requestId) as Promise<{
      ok: boolean;
      cancelled: boolean;
      error?: string;
    }>,
  serialConnect: (payload: { port: string; baudRate: number }) =>
    ipcRenderer.invoke('serial:connect', payload) as Promise<{ ok: boolean; error?: string }>,
  serialDisconnect: (payload?: { reason?: string }) =>
    ipcRenderer.invoke('serial:disconnect', payload) as Promise<{ ok: boolean; error?: string }>,
  serialSend: (payload: { text: string; appendNewline?: boolean }) =>
    ipcRenderer.invoke('serial:send', payload) as Promise<{ ok: boolean; error?: string }>,
  serialGetSnapshot: () =>
    ipcRenderer.invoke('serial:get-snapshot') as Promise<{
      ok: boolean;
      snapshot?: SerialMonitorSnapshot;
      error?: string;
    }>,
  serialClear: () => ipcRenderer.invoke('serial:clear') as Promise<{ ok: boolean }>,
  serialExportCsv: () =>
    ipcRenderer.invoke('serial:export-csv') as Promise<{ ok: boolean; path?: string; error?: string }>,
  openExternalUrl: (payload: { url: string }) =>
    ipcRenderer.invoke('app:open-external-url', payload) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  openBrowserUrl: (payload: { url: string }) =>
    ipcRenderer.invoke('app:open-browser-url', payload) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  getOpenAIProviderState: (payload?: { workspaceRoot?: string }) =>
    ipcRenderer.invoke('providers:openai:get-state', payload) as Promise<{
      ok: boolean;
      state?: OpenAIProviderState;
      error?: string;
    }>,
  startOpenAIProviderOAuth: (payload?: { workspaceRoot?: string; methodIndex?: number }) =>
    ipcRenderer.invoke('providers:openai:oauth-start', payload) as Promise<{
      ok: boolean;
      result?: OpenAIOAuthStartResult;
      error?: string;
    }>,
  completeOpenAIProviderOAuth: (payload: { workspaceRoot?: string; methodIndex: number; code?: string }) =>
    ipcRenderer.invoke('providers:openai:oauth-complete', payload) as Promise<{
      ok: boolean;
      result?: OpenAIOAuthCompleteResult;
      state?: OpenAIProviderState;
      error?: string;
    }>,
  setOpenAIProviderApiKey: (payload: { workspaceRoot?: string; apiKey: string }) =>
    ipcRenderer.invoke('providers:openai:set-api-key', payload) as Promise<{
      ok: boolean;
      state?: OpenAIProviderState;
      error?: string;
    }>,
  disconnectOpenAIProvider: (payload?: { workspaceRoot?: string }) =>
    ipcRenderer.invoke('providers:openai:disconnect', payload) as Promise<{
      ok: boolean;
      state?: OpenAIProviderState;
      error?: string;
    }>,
  onSerialMonitorEvent: (listener: (payload: SerialMonitorEvent) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: SerialMonitorEvent) => {
      listener(payload);
    };

    serialMonitorListeners.set(listener, wrapped);
    ipcRenderer.on('serial:monitor-event', wrapped);
  },
  offSerialMonitorEvent: (listener: (payload: SerialMonitorEvent) => void) => {
    const wrapped = serialMonitorListeners.get(listener);
    if (!wrapped) return;

    ipcRenderer.off('serial:monitor-event', wrapped);
    serialMonitorListeners.delete(listener);
  },
  onArduinoCommandOutput: (listener: (payload: ArduinoCommandOutputEnvelope) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: ArduinoCommandOutputEnvelope) => {
      listener(payload);
    };

    arduinoOutputListeners.set(listener, wrapped);
    ipcRenderer.on('arduino:command-output', wrapped);
  },
  offArduinoCommandOutput: (listener: (payload: ArduinoCommandOutputEnvelope) => void) => {
    const wrapped = arduinoOutputListeners.get(listener);
    if (!wrapped) return;

    ipcRenderer.off('arduino:command-output', wrapped);
    arduinoOutputListeners.delete(listener);
  },
  startAgentTurn: (payload: {
    requestId: string;
    workspaceRoot: string;
    prompt: string;
    sessionId?: string;
    model?: {
      providerID: string;
      modelID: string;
    };
  }) =>
    ipcRenderer.invoke('agent:run-turn', payload) as Promise<{ ok: boolean; error?: string }>,
  listAgentSessions: (payload: { workspaceRoot: string }) =>
    ipcRenderer.invoke('agent:list-sessions', payload) as Promise<{
      ok: boolean;
      sessions?: AgentSessionSummary[];
      error?: string;
    }>,
  getAgentHistory: (payload: { workspaceRoot: string; limit?: number; sessionId?: string }) =>
    ipcRenderer.invoke('agent:get-history', payload) as Promise<{ ok: boolean; messages?: AgentHistoryMessage[]; error?: string }>,
  listAgentPendingInterrupts: (payload: { workspaceRoot: string; sessionId?: string }) =>
    ipcRenderer.invoke('agent:list-pending-interrupts', payload) as Promise<{
      ok: boolean;
      pending?: AgentPendingInterrupts;
      error?: string;
    }>,
  replyAgentPermission: (payload: {
    workspaceRoot: string;
    requestId: string;
    reply: 'once' | 'always' | 'reject';
    message?: string;
  }) =>
    ipcRenderer.invoke('agent:permission-reply', payload) as Promise<{ ok: boolean; error?: string }>,
  replyAgentQuestion: (payload: {
    workspaceRoot: string;
    requestId: string;
    answers: string[][];
  }) => ipcRenderer.invoke('agent:question-reply', payload) as Promise<{ ok: boolean; error?: string }>,
  rejectAgentQuestion: (payload: {
    workspaceRoot: string;
    requestId: string;
  }) => ipcRenderer.invoke('agent:question-reject', payload) as Promise<{ ok: boolean; error?: string }>,
  createAgentSession: (payload: { workspaceRoot: string }) =>
    ipcRenderer.invoke('agent:new-session', payload) as Promise<{ ok: boolean; sessionId?: string; error?: string }>,
  cancelAgentTurn: (requestId: string) =>
    ipcRenderer.invoke('agent:cancel-turn', requestId) as Promise<{ ok: boolean }>,
  onAgentStream: (listener: (payload: AgentStreamEnvelope) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: AgentStreamEnvelope) => {
      listener(payload);
    };

    streamListeners.set(listener, wrapped);
    ipcRenderer.on('agent:stream', wrapped);
  },
  offAgentStream: (listener: (payload: AgentStreamEnvelope) => void) => {
    const wrapped = streamListeners.get(listener);
    if (!wrapped) return;

    ipcRenderer.off('agent:stream', wrapped);
    streamListeners.delete(listener);
  },
  onAgentLog: (listener: (payload: AgentLogEnvelope) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: AgentLogEnvelope) => {
      listener(payload);
    };

    logListeners.set(listener, wrapped);
    ipcRenderer.on('agent:log', wrapped);
  },
  offAgentLog: (listener: (payload: AgentLogEnvelope) => void) => {
    const wrapped = logListeners.get(listener);
    if (!wrapped) return;

    ipcRenderer.off('agent:log', wrapped);
    logListeners.delete(listener);
  },
  onFileChanged: (listener: (payload: FileChangedEnvelope) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: FileChangedEnvelope) => {
      listener(payload);
    };

    fileChangeListeners.set(listener, wrapped);
    ipcRenderer.on('file:changed', wrapped);
  },
  offFileChanged: (listener: (payload: FileChangedEnvelope) => void) => {
    const wrapped = fileChangeListeners.get(listener);
    if (!wrapped) return;

    ipcRenderer.off('file:changed', wrapped);
    fileChangeListeners.delete(listener);
  },
  onWorkspaceTreeChanged: (listener: (payload: WorkspaceTreeChangedEnvelope) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: WorkspaceTreeChangedEnvelope) => {
      listener(payload);
    };

    workspaceTreeListeners.set(listener, wrapped);
    ipcRenderer.on('workspace:tree-changed', wrapped);
  },
  offWorkspaceTreeChanged: (listener: (payload: WorkspaceTreeChangedEnvelope) => void) => {
    const wrapped = workspaceTreeListeners.get(listener);
    if (!wrapped) return;

    ipcRenderer.off('workspace:tree-changed', wrapped);
    workspaceTreeListeners.delete(listener);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
