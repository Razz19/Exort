export type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  tree: Array<{ path: string; isDirectory: boolean }>;
};

export type OpenFile = {
  path: string;
  content: string;
  dirty: boolean;
};

export type AgentQuestionOption = {
  label: string;
  description: string;
};

export type AgentQuestionInfo = {
  header: string;
  question: string;
  options: AgentQuestionOption[];
  multiple: boolean;
  custom: boolean;
};

export type AgentQuestionRequest = {
  id: string;
  sessionId: string;
  toolCallId?: string;
  messageId?: string;
  questions: AgentQuestionInfo[];
};

export type AgentPermissionReply = 'once' | 'always' | 'reject';

export type AgentPermissionRequest = {
  id: string;
  sessionId: string;
  title: string;
  toolCallId?: string;
  messageId?: string;
};

export type AgentPendingInterrupts = {
  permissions: AgentPermissionRequest[];
  questions: AgentQuestionRequest[];
};

export type AgentStep = {
  id: string;
  title: string;
  toolName?: string;
  detail?: string;
  toolInput?: string;
  toolOutput?: string;
  status: 'running' | 'ok' | 'error';
  kind: 'tool' | 'task' | 'status' | 'error' | 'permission' | 'question';
  requestId?: string;
  sessionId?: string;
  permission?: {
    title: string;
    reply?: AgentPermissionReply;
  };
  question?: {
    questions: AgentQuestionInfo[];
    answers?: string[][];
    rejected?: boolean;
  };
  contentStart?: number;
  createdAt: string;
};

export type ChatItem = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  assistantContentParts?: Array<{
    id: string;
    kind: 'reasoning' | 'text';
    text: string;
  }>;
  steps?: AgentStep[];
};

export type AgentSessionSummary = {
  id: string;
  title: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpenAIProviderModel = {
  id: string;
  name: string;
  releaseDate: string | null;
  status: 'active' | 'beta' | 'alpha' | 'deprecated' | null;
  reasoning: boolean;
  toolCall: boolean;
};

export type OpenAIProviderAuthMethod = {
  index: number;
  type: 'oauth' | 'api' | 'unknown';
  label: string;
};

export type OpenAIProviderState = {
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

export type OpenAIOAuthStartResult = {
  providerId: 'openai';
  methodIndex: number;
  url: string;
  method: 'auto' | 'code';
  instructions: string;
};

export type TurnResult = {
  text: string;
};

export type ArduinoOperation = 'compile' | 'upload';

export type ArduinoOutputStream = 'stdout' | 'stderr';

export type ArduinoOutputRunStatus = 'running' | 'ok' | 'error' | 'cancelled';

export type ArduinoCommandOutputEnvelope = {
  requestId: string;
  operation: ArduinoOperation;
  stream: ArduinoOutputStream;
  chunk: string;
};

export type ArduinoOutputRunEntry = {
  id: string;
  stream: ArduinoOutputStream;
  chunk: string;
};

export type ArduinoOutputRun = {
  requestId: string;
  operation: ArduinoOperation;
  status: ArduinoOutputRunStatus;
  startedAt: string;
  finishedAt?: string;
  message?: string;
  command?: string[];
  exitCode?: number | null;
  logs: ArduinoOutputRunEntry[];
};

export type ArduinoOutputEvent =
  | {
      type: 'start';
      requestId: string;
      operation: ArduinoOperation;
      startedAt: string;
      command?: string[];
    }
  | {
      type: 'chunk';
      requestId: string;
      operation: ArduinoOperation;
      stream: ArduinoOutputStream;
      chunk: string;
    }
  | {
      type: 'finish';
      requestId: string;
      operation: ArduinoOperation;
      status: Exclude<ArduinoOutputRunStatus, 'running'>;
      message: string;
      exitCode: number | null;
      finishedAt: string;
      command?: string[];
    };

export type SerialMonitorStatus = 'disconnected' | 'connected' | 'streaming';

export type SerialLogDirection = 'rx' | 'tx' | 'system';

export type SerialLogEntry = {
  id: string;
  timestamp: string;
  direction: SerialLogDirection;
  text: string;
};

export type SerialMonitorSnapshot = {
  status: SerialMonitorStatus;
  port: string | null;
  baudRate: number | null;
  entries: SerialLogEntry[];
};

export type SerialMonitorEvent =
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

export type SerialPlotSeriesSource = 'labeled' | 'unlabeled';

export type SerialParsedPoint = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  source: SerialPlotSeriesSource;
};

export type SerialParsedLine = {
  rawLine: string;
  points: SerialParsedPoint[];
};

export type SerialPlotSeries = {
  key: string;
  label: string;
  unit: string | null;
  source: SerialPlotSeriesSource;
};

export type SerialPlotState = {
  maxSamples: number;
  parsedCount: number;
  ignoredCount: number;
  samplesX: number[];
  seriesOrder: string[];
  seriesByKey: Record<string, SerialPlotSeries>;
  seriesValues: Record<string, Array<number | null>>;
};

export type {
  AppState,
  PaneTab,
  PersistedTreeItem,
  StateBootstrap,
  WorkspaceManagerState,
  WorkspaceState
} from './state/types';
