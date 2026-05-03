import { getOpenCodeRuntime, shutdownOpenCode, type OpenCodeClient } from './openCode.js';
import { OPEN_CODE_MODEL } from './openCodeConfig.js';

export type AgentStreamEvent =
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
      questions: OpenCodeQuestionInfo[];
    }
  | { type: 'question_replied'; requestId: string; sessionId: string; answers: string[][] }
  | { type: 'question_rejected'; requestId: string; sessionId: string }
  | { type: 'task'; message: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export type AgentHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type OpenCodeSessionSummary = {
  id: string;
  title: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpenCodeQuestionOption = {
  label: string;
  description: string;
};

export type OpenCodeQuestionInfo = {
  header: string;
  question: string;
  options: OpenCodeQuestionOption[];
  multiple: boolean;
  custom: boolean;
};

export type OpenCodeQuestionRequest = {
  id: string;
  sessionId: string;
  toolCallId?: string;
  messageId?: string;
  questions: OpenCodeQuestionInfo[];
};

export type OpenCodePermissionRequest = {
  id: string;
  sessionId: string;
  title: string;
  toolCallId?: string;
  messageId?: string;
};

export type OpenCodePendingInterrupts = {
  permissions: OpenCodePermissionRequest[];
  questions: OpenCodeQuestionRequest[];
};

export type OpenCodeProviderModel = {
  id: string;
  name: string;
  releaseDate: string | null;
  status: 'active' | 'beta' | 'alpha' | 'deprecated' | null;
  reasoning: boolean;
  toolCall: boolean;
};

export type OpenCodeProviderCatalog = {
  providerId: string;
  available: boolean;
  connected: boolean;
  defaultModelId: string | null;
  recommendedModelId: string | null;
  models: OpenCodeProviderModel[];
};

export type OpenCodeModelCatalogProvider = OpenCodeProviderCatalog & {
  providerName: string;
};

export type OpenCodeProviderAuthMethod = {
  index: number;
  type: 'oauth' | 'api' | 'unknown';
  label: string;
};

export type OpenCodeProviderAuthMethods = {
  providerId: string;
  methods: OpenCodeProviderAuthMethod[];
  oauthMethodIndices: number[];
  recommendedOAuthMethodIndex: number | null;
  apiKeyMethodIndex: number | null;
};

export type OpenCodeProviderOAuthStartResult = {
  providerId: string;
  methodIndex: number;
  url: string;
  method: 'auto' | 'code';
  instructions: string;
};

export type OpenCodeProviderOAuthCompleteResult = {
  providerId: string;
  methodIndex: number;
  ok: boolean;
};

type OpenCodeSubscription = {
  stream?: AsyncIterable<unknown>;
  controller?: {
    abort?: () => void;
  };
};

type RunOpenCodeTurnParams = {
  workspaceRoot: string;
  prompt: string;
  sessionId?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  signal: AbortSignal;
  onEvent: (event: AgentStreamEvent) => void;
  onLog?: (line: string) => void;
};

type LoadOpenCodeSessionHistoryParams = {
  workspaceRoot: string;
  limit?: number;
  sessionId?: string;
  onLog?: (line: string) => void;
};

const workspaceSessions = new Map<string, string>();
const loggedSessionIds = new Set<string>();
const ANSI_GREEN = '\u001b[32m';
const ANSI_RESET = '\u001b[0m';

function logSessionHighlight(log: ((line: string) => void) | undefined, sessionId: string, workspaceRoot: string): void {
  if (!log) return;
  if (loggedSessionIds.has(sessionId)) return;
  loggedSessionIds.add(sessionId);
  log(`\u001b[33msession:active id=${sessionId} workspace=${workspaceRoot}\u001b[0m`);
}

function isArduinoCompileToolName(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  return (
    normalized === 'arduinocompile' ||
    normalized.endsWith(':arduinocompile') ||
    normalized.endsWith('/arduinocompile')
  );
}

function logToolTrace(log: (line: string) => void, toolName: string, line: string): void {
  if (isArduinoCompileToolName(toolName)) {
    log(`${ANSI_GREEN}${line}${ANSI_RESET}`);
    return;
  }

  log(line);
}

function getToolResultStatusLabel(toolName: string, output: string, isError: boolean): string {
  if (isError) return 'error';
  if (!isArduinoCompileToolName(toolName)) return 'ok';

  try {
    const parsed = asRecord(JSON.parse(output));
    const status = getFirstNonBlankString(parsed.status);
    if (status) return status;
    if (parsed.ok === false) return 'failed';
  } catch {
    // Ignore parse errors for non-JSON tool output.
  }

  return 'ok';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getFirstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return null;
}

function getFirstNonBlankString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function getFirstNumber(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isGenericPermissionTitle(value: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'permission' || normalized === 'permission request';
}

function compactDisplayText(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return compact;
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

function stringifyCompactValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? compactDisplayText(trimmed) : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function extractPermissionPattern(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? compactDisplayText(trimmed) : null;
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim().length > 0);
    if (typeof first === 'string') {
      return compactDisplayText(first);
    }
  }

  return null;
}

function resolvePermissionTitle(value: Record<string, unknown>, tool: Record<string, unknown>): string {
  const title = getFirstNonBlankString(value.title);
  const metadata = asRecord(value.metadata);
  const type = getFirstNonBlankString(value.type, tool.name, metadata.tool, metadata.operation);
  const pattern =
    extractPermissionPattern(value.pattern) ??
    stringifyCompactValue(metadata.filePath) ??
    stringifyCompactValue(metadata.path) ??
    stringifyCompactValue(metadata.url) ??
    stringifyCompactValue(metadata.command) ??
    stringifyCompactValue(metadata.pattern);

  if (!isGenericPermissionTitle(title)) {
    return title ?? 'Permission';
  }

  if (type && pattern) {
    return compactDisplayText(`${type} ${pattern}`);
  }

  if (type) return compactDisplayText(type);
  if (pattern) return pattern;
  return title ?? 'Permission';
}

function summarizeToolInputForPermission(toolName: string, input?: string): string {
  if (!input?.trim()) {
    return toolName;
  }

  try {
    const parsed = JSON.parse(input);
    const record = asRecord(parsed);
    const target =
      stringifyCompactValue(record.filePath) ??
      stringifyCompactValue(record.path) ??
      stringifyCompactValue(record.url) ??
      stringifyCompactValue(record.command) ??
      stringifyCompactValue(record.pattern) ??
      stringifyCompactValue(record.description);

    if (target) {
      return compactDisplayText(`${toolName} ${target}`);
    }
  } catch {
    // Keep fallback below when input is not JSON.
  }

  const compactInput = compactDisplayText(input);
  return compactDisplayText(`${toolName} ${compactInput}`);
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'OpenCode operation failed';
}

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name.includes('abort') ||
    message.includes('abort') ||
    message.includes('canceled') ||
    message.includes('cancelled')
  );
}

function isIgnorableConsoleError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError.code === 'EIO') return true;
  return error.message.toUpperCase().includes('EIO');
}

function emitSafeLog(onLog: ((line: string) => void) | undefined, line: string): void {
  try {
    onLog?.(line);
  } catch (error) {
    if (!isIgnorableConsoleError(error)) {
      throw error;
    }
  }
}

function extractResponseData(response: unknown): unknown {
  const value = asRecord(response);
  if ('data' in value && value.data !== undefined) {
    return value.data;
  }
  return response;
}

function getResponseErrorMessage(response: unknown): string | null {
  const value = asRecord(response);
  const errorValue = value.error;
  if (errorValue === undefined || errorValue === null) return null;

  if (typeof errorValue === 'string') {
    const trimmed = errorValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const errorRecord = asRecord(errorValue);
  const errorData = asRecord(errorRecord.data);
  return getFirstNonBlankString(errorData.message, errorRecord.message);
}

function resolveDirectoryFromWorkspaceRoot(workspaceRoot?: string): string | undefined {
  const directory = getFirstNonBlankString(workspaceRoot);
  return directory ?? undefined;
}

async function recycleOpenCodeRuntimeAfterProviderAuthMutation(log?: (line: string) => void): Promise<void> {
  // Provider auth/model metadata can remain stale on a long-lived SDK runtime instance.
  // Recycling runtime here ensures subsequent provider state reads reflect latest auth immediately.
  await shutdownOpenCode(log);
  workspaceSessions.clear();
  loggedSessionIds.clear();
}

const OPENAI_MODEL_RECOMMENDATION_ORDER = ['gpt-5.3-codex', 'gpt-5.2-codex'];
const OPENAI_CHATGPT_UNSUPPORTED_MODEL_IDS = new Set(['codex-mini-latest']);
const OPENAI_CHATGPT_MODEL_ALLOWLIST = new Set([
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.1-codex'
]);

function parseProviderModelStatus(value: unknown): OpenCodeProviderModel['status'] {
  if (value === 'active' || value === 'beta' || value === 'alpha' || value === 'deprecated') {
    return value;
  }
  return null;
}

function parseProviderModels(modelsValue: unknown): OpenCodeProviderModel[] {
  const modelsRecord = asRecord(modelsValue);
  const parsed: OpenCodeProviderModel[] = [];

  for (const [key, value] of Object.entries(modelsRecord)) {
    const model = asRecord(value);
    const capabilities = asRecord(model.capabilities);
    const id = getFirstNonBlankString(model.id, key);
    if (!id) continue;

    parsed.push({
      id,
      name: getFirstNonBlankString(model.name) ?? id,
      releaseDate: getFirstNonBlankString(model.release_date, model.releaseDate) ?? null,
      status: parseProviderModelStatus(getFirstNonBlankString(model.status)),
      reasoning: model.reasoning === true || capabilities.reasoning === true,
      toolCall: model.tool_call === true || model.toolCall === true || capabilities.tool_call === true
    });
  }

  parsed.sort((a, b) => a.name.localeCompare(b.name));
  return parsed;
}

function parseProviderModelInputCostById(modelsValue: unknown): Map<string, number> {
  const modelsRecord = asRecord(modelsValue);
  const costs = new Map<string, number>();

  for (const [key, value] of Object.entries(modelsRecord)) {
    const model = asRecord(value);
    const id = getFirstNonBlankString(model.id, key);
    if (!id) continue;

    const cost = asRecord(model.cost);
    const inputCost = getFirstNumber(cost.input);
    if (inputCost == null) continue;
    costs.set(id, inputCost);
  }

  return costs;
}

function isLikelyOpenAIChatGPTOAuthCatalog(models: OpenCodeProviderModel[], inputCostById: Map<string, number>): boolean {
  if (models.length === 0) return false;

  let observedCosts = 0;
  for (const model of models) {
    const inputCost = inputCostById.get(model.id);
    if (inputCost == null) continue;
    observedCosts += 1;
    if (inputCost !== 0) return false;
  }

  return observedCosts > 0;
}

function filterOpenAIModelsForDesktopCatalog(
  providerId: string,
  models: OpenCodeProviderModel[],
  isLikelyChatGPTOAuth: boolean
): OpenCodeProviderModel[] {
  if (providerId !== 'openai' || !isLikelyChatGPTOAuth) {
    return models;
  }

  const withoutKnownUnsupported = models.filter((model) => !OPENAI_CHATGPT_UNSUPPORTED_MODEL_IDS.has(model.id));
  const allowlisted = withoutKnownUnsupported.filter((model) => OPENAI_CHATGPT_MODEL_ALLOWLIST.has(model.id));

  // If the known ChatGPT Codex allowlist is present, only show those models.
  // Otherwise keep a permissive fallback (minus known unsupported IDs) to avoid empty lists.
  if (allowlisted.length > 0) {
    return allowlisted;
  }

  return withoutKnownUnsupported;
}

function pickRecommendedOpenAIModelId(models: OpenCodeProviderModel[], defaultModelId: string | null): string | null {
  const available = new Set(models.map((item) => item.id));
  for (const modelId of OPENAI_MODEL_RECOMMENDATION_ORDER) {
    if (available.has(modelId)) return modelId;
  }

  if (defaultModelId && available.has(defaultModelId)) {
    return defaultModelId;
  }

  return models[0]?.id ?? null;
}

function getDefaultOpenCodeProviderId(): string | null {
  const [providerId] = OPEN_CODE_MODEL.split('/');
  return getFirstNonBlankString(providerId) ?? null;
}

function buildProviderCatalogEntry(
  providerRecord: Record<string, unknown>,
  connected: Set<string>,
  defaults: Record<string, unknown>
): OpenCodeModelCatalogProvider | null {
  const providerId = getFirstNonBlankString(providerRecord.id);
  if (!providerId) return null;

  const defaultModelId = getFirstNonBlankString(defaults[providerId]) ?? null;
  const parsedModels = parseProviderModels(providerRecord.models);
  const inputCostById = parseProviderModelInputCostById(providerRecord.models);
  const isLikelyChatGPTOAuth = isLikelyOpenAIChatGPTOAuthCatalog(parsedModels, inputCostById);
  const models = filterOpenAIModelsForDesktopCatalog(providerId, parsedModels, isLikelyChatGPTOAuth);
  const normalizedDefaultModelId =
    defaultModelId && models.some((model) => model.id === defaultModelId) ? defaultModelId : null;

  return {
    providerId,
    providerName: getFirstNonBlankString(providerRecord.name, providerRecord.label) ?? providerId,
    available: true,
    connected: connected.has(providerId),
    defaultModelId: normalizedDefaultModelId,
    recommendedModelId:
      providerId === 'openai'
        ? pickRecommendedOpenAIModelId(models, normalizedDefaultModelId)
        : normalizedDefaultModelId ?? models[0]?.id ?? null,
    models
  };
}

function parseProviderAuthMethodsByProvider(response: unknown, providerId: string): OpenCodeProviderAuthMethod[] {
  const payload = asRecord(extractResponseData(response));
  const rawMethods = Array.isArray(payload[providerId]) ? payload[providerId] : [];
  const methods: OpenCodeProviderAuthMethod[] = [];

  for (const [index, value] of rawMethods.entries()) {
    const method = asRecord(value);
    const label = getFirstNonBlankString(method.label) ?? `Method ${index + 1}`;
    const typeValue = getFirstNonBlankString(method.type);
    const type: OpenCodeProviderAuthMethod['type'] = typeValue === 'oauth' || typeValue === 'api' ? typeValue : 'unknown';

    methods.push({
      index,
      type,
      label
    });
  }

  return methods;
}

function pickRecommendedOAuthMethodIndex(methods: OpenCodeProviderAuthMethod[]): number | null {
  const oauthMethods = methods.filter((item) => item.type === 'oauth');
  if (oauthMethods.length === 0) return null;

  const browserMethod = oauthMethods.find((item) => item.label.toLowerCase().includes('browser'));
  if (browserMethod) return browserMethod.index;

  const chatGptMethod = oauthMethods.find((item) => item.label.toLowerCase().includes('chatgpt'));
  if (chatGptMethod) return chatGptMethod.index;

  return oauthMethods[0]?.index ?? null;
}

function toIsoDateTime(value: unknown): string {
  const timestamp = getFirstNumber(value);
  if (timestamp == null) return new Date().toISOString();

  const milliseconds = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const parsed = new Date(milliseconds);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function isGenericWorkspaceSessionTitle(value: string | null): boolean {
  if (!value) return false;
  return /^workspace:\s+/i.test(value.trim());
}

function getSessionIdFromCreateResponse(response: unknown): string | null {
  const value = asRecord(response);
  const data = asRecord(value.data);
  const session = asRecord(data.session);

  return getFirstString(value.id, data.id, session.id);
}

async function createWorkspaceSessionWithClient(
  client: OpenCodeClient,
  workspaceRoot: string,
  log?: (line: string) => void
): Promise<string> {
  log?.('session:create:start');

  let response: unknown;
  try {
    response = await client.session.create({
      directory: workspaceRoot
    });
  } catch (error) {
    log?.(`session:create:error ${getErrorMessage(error)}`);
    throw error;
  }

  const sessionId = getSessionIdFromCreateResponse(response);
  if (!sessionId) {
    log?.('session:create:error missing-session-id');
    throw new Error('OpenCode did not return a session id');
  }

  log?.(`session:create:ok id=${sessionId}`);
  workspaceSessions.set(workspaceRoot, sessionId);
  return sessionId;
}

function extractSessionRecords(response: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(response)) {
    return response.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  const value = asRecord(response);
  if (Array.isArray(value.data)) {
    return value.data.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  return [];
}

async function findLatestWorkspaceSessionId(
  client: OpenCodeClient,
  workspaceRoot: string,
  log?: (line: string) => void
): Promise<string | null> {
  const listSessions = client.session.list;
  if (typeof listSessions !== 'function') {
    return null;
  }

  log?.('session:list:start');

  let response: unknown;
  try {
    response = await listSessions({
      directory: workspaceRoot
    });
  } catch (error) {
    log?.(`session:list:error ${getErrorMessage(error)}`);
    return null;
  }

  const sessions = extractSessionRecords(response);
  if (sessions.length === 0) {
    log?.('session:list:empty');
    return null;
  }

  let latestId: string | null = null;
  let latestUpdated = -1;

  for (const session of sessions) {
    const sessionDirectory = getFirstString(session.directory);
    if (sessionDirectory && sessionDirectory !== workspaceRoot) {
      continue;
    }

    const sessionId = getFirstString(session.id);
    if (!sessionId) {
      continue;
    }

    const time = asRecord(session.time);
    const updated = getFirstNumber(time.updated, time.created) ?? 0;
    if (updated >= latestUpdated) {
      latestId = sessionId;
      latestUpdated = updated;
    }
  }

  if (!latestId) {
    log?.('session:list:empty');
    return null;
  }

  log?.(`session:list:reuse id=${latestId}`);
  return latestId;
}

async function ensureWorkspaceSessionId(
  client: OpenCodeClient,
  workspaceRoot: string,
  log?: (line: string) => void
): Promise<string> {
  const cached = workspaceSessions.get(workspaceRoot);
  if (cached) {
    if (await isWorkspaceSessionUsable(client, workspaceRoot, cached, log)) {
      log?.(`session:cache-hit id=${cached}`);
      logSessionHighlight(log, cached, workspaceRoot);
      return cached;
    }
    log?.(`session:cache-drop id=${cached}`);
    workspaceSessions.delete(workspaceRoot);
  }

  const discovered = await findLatestWorkspaceSessionId(client, workspaceRoot, log);
  if (discovered) {
    workspaceSessions.set(workspaceRoot, discovered);
    logSessionHighlight(log, discovered, workspaceRoot);
    return discovered;
  }

  const created = await createWorkspaceSessionWithClient(client, workspaceRoot, log);
  logSessionHighlight(log, created, workspaceRoot);
  return created;
}

async function isWorkspaceSessionUsable(
  client: OpenCodeClient,
  workspaceRoot: string,
  sessionId: string,
  log?: (line: string) => void
): Promise<boolean> {
  const getSession = client.session.get;
  if (typeof getSession !== 'function') {
    return true;
  }

  try {
    const response = await getSession({
      sessionID: sessionId,
      directory: workspaceRoot
    });
    const responseError = getResponseErrorMessage(response);
    if (responseError) {
      log?.(`session:validate:error id=${sessionId} message=${compactLogValue(responseError, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    log?.(`session:validate:error id=${sessionId} message=${compactLogValue(getErrorMessage(error), 200)}`);
    return false;
  }
}

function extractDataArray(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) {
    return response.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  const value = asRecord(response);
  if (Array.isArray(value.data)) {
    return value.data.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  return [];
}

function parseQuestionInfo(input: unknown): OpenCodeQuestionInfo | null {
  const value = asRecord(input);
  const header = getFirstNonBlankString(value.header, value.title) ?? 'Question';
  const question = getFirstNonBlankString(value.question) ?? '';

  const optionsValue = Array.isArray(value.options) ? value.options : [];
  const options = optionsValue
    .map((item) => {
      const option = asRecord(item);
      const label = getFirstNonBlankString(option.label);
      if (!label) return null;
      return {
        label,
        description: getFirstNonBlankString(option.description) ?? ''
      };
    })
    .filter((item): item is OpenCodeQuestionOption => item !== null);

  return {
    header,
    question,
    options,
    multiple: value.multiple === true,
    custom: value.custom !== false
  };
}

function parseQuestionRequest(input: unknown): OpenCodeQuestionRequest | null {
  const value = asRecord(input);
  const id = getFirstNonBlankString(value.id, value.requestID, value.requestId);
  const sessionId = getFirstNonBlankString(value.sessionID, value.sessionId);
  if (!id || !sessionId) return null;

  const tool = asRecord(value.tool);
  const toolCallId = getFirstNonBlankString(tool.callID, tool.callId);
  const messageId = getFirstNonBlankString(tool.messageID, tool.messageId);

  const questionsValue = Array.isArray(value.questions) ? value.questions : [];
  const questions = questionsValue
    .map((item) => parseQuestionInfo(item))
    .filter((item): item is OpenCodeQuestionInfo => item !== null);

  return {
    id,
    sessionId,
    toolCallId: toolCallId ?? undefined,
    messageId: messageId ?? undefined,
    questions
  };
}

function parsePermissionRequest(input: unknown): OpenCodePermissionRequest | null {
  const value = asRecord(input);
  const id = getFirstNonBlankString(value.id, value.requestID, value.requestId);
  const sessionId = getFirstNonBlankString(value.sessionID, value.sessionId);
  if (!id || !sessionId) return null;

  const tool = asRecord(value.tool);
  const toolCallId = getFirstNonBlankString(tool.callID, tool.callId, value.callID, value.callId);
  const messageId = getFirstNonBlankString(tool.messageID, tool.messageId, value.messageID, value.messageId);
  const title = resolvePermissionTitle(value, tool);

  return {
    id,
    sessionId,
    title,
    toolCallId: toolCallId ?? undefined,
    messageId: messageId ?? undefined
  };
}

export async function getOpenCodeProviderCatalog(params: {
  providerId: string;
  workspaceRoot?: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodeProviderCatalog> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const listProviders = runtime.client.provider?.list;
  if (typeof listProviders !== 'function') {
    throw new Error('OpenCode provider list API is not available in this SDK runtime');
  }

  const directory = resolveDirectoryFromWorkspaceRoot(params.workspaceRoot);
  const response = await listProviders({
    directory
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  const payload = asRecord(extractResponseData(response));
  const providers = Array.isArray(payload.all) ? payload.all : [];
  const connected = new Set(
    (Array.isArray(payload.connected) ? payload.connected : []).filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    )
  );
  const defaults = asRecord(payload.default);

  const providerRecord =
    providers.find((item): item is Record<string, unknown> => {
      if (typeof item !== 'object' || item === null) return false;
      return getFirstNonBlankString((item as Record<string, unknown>).id) === params.providerId;
    }) ?? null;

  const defaultModelId = getFirstNonBlankString(defaults[params.providerId]) ?? null;
  if (!providerRecord) {
    return {
      providerId: params.providerId,
      available: false,
      connected: connected.has(params.providerId),
      defaultModelId,
      recommendedModelId: null,
      models: []
    };
  }

  const entry = buildProviderCatalogEntry(providerRecord, connected, defaults);
  if (!entry) {
    return {
      providerId: params.providerId,
      available: false,
      connected: connected.has(params.providerId),
      defaultModelId,
      recommendedModelId: null,
      models: []
    };
  }

  const { providerName: _providerName, ...catalog } = entry;
  return catalog;
}

export async function listOpenCodeModelCatalog(params: {
  workspaceRoot?: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodeModelCatalogProvider[]> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const listProviders = runtime.client.provider?.list;
  if (typeof listProviders !== 'function') {
    throw new Error('OpenCode provider list API is not available in this SDK runtime');
  }

  const directory = resolveDirectoryFromWorkspaceRoot(params.workspaceRoot);
  const response = await listProviders({
    directory
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  const payload = asRecord(extractResponseData(response));
  const providers = Array.isArray(payload.all) ? payload.all : [];
  const connected = new Set(
    (Array.isArray(payload.connected) ? payload.connected : []).filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    )
  );
  const defaults = asRecord(payload.default);
  const defaultProviderId = getDefaultOpenCodeProviderId();

  return providers
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((providerRecord) => buildProviderCatalogEntry(providerRecord, connected, defaults))
    .filter((entry): entry is OpenCodeModelCatalogProvider => entry !== null)
    .map((entry) =>
      entry.providerId === defaultProviderId
        ? {
            ...entry,
            connected: true
          }
        : entry
    )
    .filter((entry) => entry.connected && entry.models.length > 0)
    .sort((left, right) => {
      const leftScore = left.providerId === defaultProviderId ? 0 : 1;
      const rightScore = right.providerId === defaultProviderId ? 0 : 1;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.providerName.localeCompare(right.providerName);
    });
}

export async function getOpenCodeProviderAuthMethods(params: {
  providerId: string;
  workspaceRoot?: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodeProviderAuthMethods> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const getAuthMethods = runtime.client.provider?.auth;
  if (typeof getAuthMethods !== 'function') {
    throw new Error('OpenCode provider auth API is not available in this SDK runtime');
  }

  const directory = resolveDirectoryFromWorkspaceRoot(params.workspaceRoot);
  const response = await getAuthMethods({
    directory
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  const methods = parseProviderAuthMethodsByProvider(response, params.providerId);
  const oauthMethodIndices = methods.filter((item) => item.type === 'oauth').map((item) => item.index);
  const apiKeyMethodIndex = methods.find((item) => item.type === 'api')?.index ?? null;

  return {
    providerId: params.providerId,
    methods,
    oauthMethodIndices,
    recommendedOAuthMethodIndex: pickRecommendedOAuthMethodIndex(methods),
    apiKeyMethodIndex
  };
}

export async function startOpenCodeProviderOAuth(params: {
  providerId: string;
  methodIndex: number;
  workspaceRoot?: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodeProviderOAuthStartResult> {
  if (!Number.isInteger(params.methodIndex) || params.methodIndex < 0) {
    throw new Error('Invalid provider auth method index');
  }

  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const authorizeOAuth = runtime.client.provider?.oauth?.authorize;
  if (typeof authorizeOAuth !== 'function') {
    throw new Error('OpenCode provider OAuth authorize API is not available in this SDK runtime');
  }

  const directory = resolveDirectoryFromWorkspaceRoot(params.workspaceRoot);
  const response = await authorizeOAuth({
    providerID: params.providerId,
    directory,
    method: params.methodIndex
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  const payload = asRecord(extractResponseData(response));
  const url = getFirstNonBlankString(payload.url);
  const method = getFirstNonBlankString(payload.method);
  if (!url) {
    throw new Error('OpenCode OAuth authorize response did not include a URL');
  }
  if (method !== 'auto' && method !== 'code') {
    throw new Error('OpenCode OAuth authorize response did not include a valid method');
  }

  return {
    providerId: params.providerId,
    methodIndex: params.methodIndex,
    url,
    method,
    instructions: getFirstNonBlankString(payload.instructions) ?? ''
  };
}

export async function completeOpenCodeProviderOAuth(params: {
  providerId: string;
  methodIndex: number;
  code?: string;
  workspaceRoot?: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodeProviderOAuthCompleteResult> {
  if (!Number.isInteger(params.methodIndex) || params.methodIndex < 0) {
    throw new Error('Invalid provider auth method index');
  }

  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const completeOAuth = runtime.client.provider?.oauth?.callback;
  if (typeof completeOAuth !== 'function') {
    throw new Error('OpenCode provider OAuth callback API is not available in this SDK runtime');
  }

  const code = getFirstNonBlankString(params.code);
  const directory = resolveDirectoryFromWorkspaceRoot(params.workspaceRoot);
  const response = await completeOAuth({
    providerID: params.providerId,
    directory,
    method: params.methodIndex,
    code: code ?? undefined
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  const payload = extractResponseData(response);
  const payloadRecord = asRecord(payload);
  const responseRecord = asRecord(response);
  const ok =
    (typeof payload === 'boolean' ? payload : null) ??
    (typeof payloadRecord.ok === 'boolean' ? payloadRecord.ok : null) ??
    (typeof payloadRecord.success === 'boolean' ? payloadRecord.success : null) ??
    (typeof responseRecord.ok === 'boolean' ? responseRecord.ok : null) ??
    (typeof responseRecord.success === 'boolean' ? responseRecord.success : null) ??
    true;

  await recycleOpenCodeRuntimeAfterProviderAuthMutation(log);

  return {
    providerId: params.providerId,
    methodIndex: params.methodIndex,
    ok
  };
}

export async function setOpenCodeProviderApiKey(params: {
  providerId: string;
  apiKey: string;
  onLog?: (line: string) => void;
}): Promise<void> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const setAuth = runtime.client.auth?.set;
  if (typeof setAuth !== 'function') {
    throw new Error('OpenCode auth set API is not available in this SDK runtime');
  }

  const response = await setAuth({
    providerID: params.providerId,
    auth: {
      type: 'api',
      key: apiKey
    }
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  await recycleOpenCodeRuntimeAfterProviderAuthMutation(log);
}

export async function removeOpenCodeProviderAuth(params: {
  providerId: string;
  onLog?: (line: string) => void;
}): Promise<void> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const removeAuth = runtime.client.auth?.remove;
  if (typeof removeAuth !== 'function') {
    throw new Error('OpenCode auth remove API is not available in this SDK runtime');
  }

  const response = await removeAuth({
    providerID: params.providerId
  });
  const responseError = getResponseErrorMessage(response);
  if (responseError) {
    throw new Error(responseError);
  }

  await recycleOpenCodeRuntimeAfterProviderAuthMutation(log);
}

export async function listOpenCodePendingInterrupts(params: {
  workspaceRoot: string;
  sessionId?: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodePendingInterrupts> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const listPermissions = runtime.client.permission?.list;
  const listQuestions = runtime.client.question?.list;

  let permissions: OpenCodePermissionRequest[] = [];
  let questions: OpenCodeQuestionRequest[] = [];

  if (typeof listPermissions === 'function') {
    try {
      const response = await listPermissions({
        directory: params.workspaceRoot
      });
      permissions = extractDataArray(response)
        .map((item) => parsePermissionRequest(item))
        .filter((item): item is OpenCodePermissionRequest => item !== null);
    } catch (error) {
      log(`interrupts:permission:list:error ${getErrorMessage(error)}`);
    }
  }

  if (typeof listQuestions === 'function') {
    try {
      const response = await listQuestions({
        directory: params.workspaceRoot
      });
      questions = extractDataArray(response)
        .map((item) => parseQuestionRequest(item))
        .filter((item): item is OpenCodeQuestionRequest => item !== null);
    } catch (error) {
      log(`interrupts:question:list:error ${getErrorMessage(error)}`);
    }
  }

  const filterSessionId = getFirstNonBlankString(params.sessionId);
  if (!filterSessionId) {
    return { permissions, questions };
  }

  return {
    permissions: permissions.filter((item) => item.sessionId === filterSessionId),
    questions: questions.filter((item) => item.sessionId === filterSessionId)
  };
}

export async function replyOpenCodePermission(params: {
  workspaceRoot: string;
  requestId: string;
  reply: 'once' | 'always' | 'reject';
  message?: string;
  onLog?: (line: string) => void;
}): Promise<void> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const replyPermission = runtime.client.permission?.reply;
  if (typeof replyPermission !== 'function') {
    throw new Error('OpenCode permission reply is not available in this SDK runtime');
  }

  await replyPermission({
    requestID: params.requestId,
    directory: params.workspaceRoot,
    reply: params.reply,
    message: params.message
  });
}

export async function replyOpenCodeQuestion(params: {
  workspaceRoot: string;
  requestId: string;
  answers: string[][];
  onLog?: (line: string) => void;
}): Promise<void> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const replyQuestion = runtime.client.question?.reply;
  if (typeof replyQuestion !== 'function') {
    throw new Error('OpenCode question reply is not available in this SDK runtime');
  }

  await replyQuestion({
    requestID: params.requestId,
    directory: params.workspaceRoot,
    answers: params.answers
  });
}

export async function rejectOpenCodeQuestion(params: {
  workspaceRoot: string;
  requestId: string;
  onLog?: (line: string) => void;
}): Promise<void> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const rejectQuestion = runtime.client.question?.reject;
  if (typeof rejectQuestion !== 'function') {
    throw new Error('OpenCode question reject is not available in this SDK runtime');
  }

  await rejectQuestion({
    requestID: params.requestId,
    directory: params.workspaceRoot
  });
}

export async function createOpenCodeSession(params: {
  workspaceRoot: string;
  onLog?: (line: string) => void;
}): Promise<string> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  log(`session:new:start workspace=${params.workspaceRoot}`);
  const runtime = await getOpenCodeRuntime(log);
  const sessionId = await createWorkspaceSessionWithClient(runtime.client, params.workspaceRoot, log);
  log(`session:new:ok id=${sessionId}`);
  return sessionId;
}

export async function listOpenCodeSessions(params: {
  workspaceRoot: string;
  onLog?: (line: string) => void;
}): Promise<OpenCodeSessionSummary[]> {
  const log = (line: string) => {
    params.onLog?.(line);
  };

  const runtime = await getOpenCodeRuntime(log);
  const listSessions = runtime.client.session.list;
  if (typeof listSessions !== 'function') {
    log('session:list:unsupported');
    return [];
  }

  log(`session:list:query workspace=${params.workspaceRoot}`);
  let response: unknown;
  try {
    response = await listSessions({
      directory: params.workspaceRoot
    });
  } catch (error) {
    log(`session:list:error ${getErrorMessage(error)}`);
    throw error;
  }

  const sessions = extractSessionRecords(response)
    .map((session) => {
      const info = asRecord(session.info);
      const time = asRecord(session.time);
      const infoTime = asRecord(info.time);
      const sessionId = getFirstNonBlankString(session.id, info.id);
      if (!sessionId) return null;

      const sessionDirectory = getFirstNonBlankString(session.directory, info.directory);
      if (sessionDirectory && sessionDirectory !== params.workspaceRoot) {
        return null;
      }

      const directTitle = getFirstNonBlankString(session.title) ?? null;
      const infoTitle = getFirstNonBlankString(info.title) ?? null;
      const infoName = getFirstNonBlankString(info.name) ?? null;
      const title =
        (!isGenericWorkspaceSessionTitle(directTitle) ? directTitle : null) ??
        (!isGenericWorkspaceSessionTitle(infoTitle) ? infoTitle : null) ??
        (!isGenericWorkspaceSessionTitle(infoName) ? infoName : null) ??
        directTitle ??
        infoTitle ??
        infoName ??
        null;
      const slug = getFirstNonBlankString(
        session.slug,
        info.slug,
        session.name,
        info.name
      ) ?? null;
      const createdEpoch = getFirstNumber(time.created, infoTime.created, session.created, info.created);
      const updatedEpoch = getFirstNumber(time.updated, infoTime.updated, session.updated, info.updated);

      return {
        id: sessionId,
        title,
        slug,
        createdAt: toIsoDateTime(createdEpoch ?? updatedEpoch),
        updatedAt: toIsoDateTime(updatedEpoch ?? createdEpoch),
        createdEpoch: createdEpoch ?? 0,
        updatedEpoch: updatedEpoch ?? createdEpoch ?? 0
      };
    })
    .filter((item): item is OpenCodeSessionSummary & { createdEpoch: number; updatedEpoch: number } => item !== null)
    .sort((a, b) => {
      if (a.updatedEpoch !== b.updatedEpoch) {
        return b.updatedEpoch - a.updatedEpoch;
      }
      return b.createdEpoch - a.createdEpoch;
    })
    .map(({ createdEpoch: _createdEpoch, updatedEpoch: _updatedEpoch, ...item }) => item);

  log(`session:list:ok count=${sessions.length}`);
  return sessions;
}

function parseToolName(part: Record<string, unknown>): string {
  return getFirstNonBlankString(part.name, part.tool, part.toolName, part.tool_name, part.command) ?? 'tool';
}

function parseToolId(part: Record<string, unknown>): string {
  return getFirstNonBlankString(part.id, part.callID, part.callId, part.toolCallId) ?? 'tool-call';
}

function parseMessagePartId(properties: Record<string, unknown>): string | null {
  const part = asRecord(properties.part);
  return (
    getFirstNonBlankString(
      properties.partID,
      properties.partId,
      part.id,
      part.partID,
      part.partId
    ) ?? null
  );
}

function parseContentKindFromPartType(partType: string | null): 'reasoning' | 'text' | null {
  if (!partType) return null;
  if (partType === 'reasoning') return 'reasoning';
  if (partType === 'text' || partType === 'output_text' || partType === 'assistant_text') {
    return 'text';
  }
  return null;
}

function compactLogValue(value: string, maxLength = 120): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3))}...`;
}

function serializeForLog(value: unknown, maxLength = 4000): string {
  const raw = stringifyUnknown(value);
  if (!raw) return '';
  return compactLogValue(raw, maxLength);
}

function logRawEvent(rawEvent: unknown, log: (line: string) => void): void {
  const event = asRecord(rawEvent);
  const type = getFirstString(event.type) ?? 'unknown';
  if (type === 'message.part.updated') {
    return;
  }
  const properties = asRecord(event.properties);
  const part = asRecord(properties.part);
  const partType = getFirstNonBlankString(part.type);
  const data = serializeForLog(properties);

  if (data) {
    if (partType) {
      log(`event:raw type=${type} part=${partType} data=${data}`);
      return;
    }
    log(`event:raw type=${type} data=${data}`);
    return;
  }

  if (partType) {
    log(`event:raw type=${type} part=${partType}`);
    return;
  }

  log(`event:raw type=${type}`);
}

function buildTaskMessageFromPart(part: Record<string, unknown>): string | null {
  const partType = getFirstNonBlankString(part.type) ?? '';
  if (!partType || partType === 'text' || partType === 'tool') {
    return null;
  }

  if (partType === 'subtask') {
    const agent = getFirstNonBlankString(part.agent) ?? 'agent';
    const description = getFirstNonBlankString(part.description, part.prompt, part.name) ?? 'subtask';
    return `subtask agent=${agent} description=${compactLogValue(description)}`;
  }

  if (partType === 'step-start') {
    return 'step_start';
  }

  if (partType === 'step-finish') {
    const reason = getFirstNonBlankString(part.reason) ?? 'unknown';
    return `step_finish reason=${compactLogValue(reason)}`;
  }

  if (partType === 'agent') {
    const name = getFirstNonBlankString(part.name) ?? 'agent';
    return `agent name=${name}`;
  }

  if (partType === 'patch') {
    const files = Array.isArray(part.files) ? part.files.length : 0;
    return `patch files=${files}`;
  }

  if (partType === 'snapshot') {
    return 'snapshot';
  }

  if (partType === 'reasoning') {
    return null;
  }

  if (partType === 'file') {
    const filename = getFirstNonBlankString(part.filename, part.url) ?? 'file';
    return `file ${compactLogValue(filename)}`;
  }

  if (partType === 'retry') {
    const attempt = getFirstNumber(part.attempt) ?? 0;
    const message = getFirstNonBlankString(part.message) ?? '';
    return message ? `retry attempt=${attempt} message=${compactLogValue(message)}` : `retry attempt=${attempt}`;
  }

  if (partType === 'compaction') {
    const auto = typeof part.auto === 'boolean' ? part.auto : false;
    return `compaction auto=${auto}`;
  }

  return null;
}

function parseToolPart(part: Record<string, unknown>): AgentStreamEvent | null {
  const state = asRecord(part.state);
  const status = getFirstNonBlankString(state.status) ?? '';

  if (status === 'pending' || status === 'running') {
    const input = stringifyUnknown(state.input);
    return {
      type: 'tool_call',
      toolCallId: parseToolId(part),
      name: parseToolName(part),
      input: input || undefined
    };
  }

  if (status === 'completed' || status === 'error') {
    const output = status === 'error' ? stringifyUnknown(state.error) : stringifyUnknown(state.output);
    return {
      type: 'tool_result',
      toolCallId: parseToolId(part),
      output,
      isError: status === 'error'
    };
  }

  return null;
}

function parseMessagePartUpdated(properties: Record<string, unknown>): AgentStreamEvent | null {
  const part = asRecord(properties.part);
  const partType = getFirstNonBlankString(part.type) ?? '';
  const partId = parseMessagePartId(properties) ?? undefined;
  const role = getFirstNonBlankString(part.role, properties.role, properties.sender, part.sender) ?? '';

  if (role && role !== 'assistant') {
    return null;
  }

  if (partType === 'text' || partType === 'output_text' || partType === 'assistant_text' || !partType) {
    const delta = getFirstString(properties.delta, part.delta) ?? '';
    if (!delta) return null;

    return {
      type: 'content',
      content: delta,
      partId,
      contentKind: parseContentKindFromPartType(partType) ?? undefined
    };
  }

  if (partType === 'tool') {
    return parseToolPart(part);
  }

  return null;
}

function parseMessagePartDelta(properties: Record<string, unknown>): AgentStreamEvent | null {
  const role = getFirstNonBlankString(properties.role, properties.sender) ?? '';
  if (role && role !== 'assistant') {
    return null;
  }

  const field = getFirstNonBlankString(properties.field) ?? '';
  if (field && field !== 'text' && field !== 'content') {
    return null;
  }

  const delta = getFirstString(properties.delta) ?? '';
  if (!delta) return null;
  const partId = parseMessagePartId(properties) ?? undefined;

  return {
    type: 'content',
    content: delta,
    partId
  };
}

function captureContentPartKindFromRawEvent(
  rawEvent: unknown,
  expectedSessionId: string,
  partKindById: Map<string, 'reasoning' | 'text'>
): void {
  const event = asRecord(rawEvent);
  const type = getFirstString(event.type);
  if (type !== 'message.part.updated') return;

  const properties = asRecord(event.properties);
  const sessionRecord = asRecord(properties.session);
  const messageRecord = asRecord(properties.message);
  const partRecord = asRecord(properties.part);
  const possibleSessionId = getFirstString(
    properties.sessionID,
    properties.sessionId,
    properties.session_id,
    sessionRecord.id,
    sessionRecord.sessionID,
    sessionRecord.sessionId,
    messageRecord.sessionID,
    messageRecord.sessionId,
    partRecord.sessionID,
    partRecord.sessionId
  );
  if (possibleSessionId && possibleSessionId !== expectedSessionId) return;

  const partId = parseMessagePartId(properties);
  if (!partId) return;
  const partType = getFirstNonBlankString(partRecord.type);
  const kind = parseContentKindFromPartType(partType);
  if (!kind) return;
  partKindById.set(partId, kind);
}

function parseEvent(rawEvent: unknown, expectedSessionId: string): AgentStreamEvent | null {
  const event = asRecord(rawEvent);
  const type = getFirstString(event.type);
  if (!type) return null;

  const properties = asRecord(event.properties);
  const sessionRecord = asRecord(properties.session);
  const messageRecord = asRecord(properties.message);
  const partRecord = asRecord(properties.part);
  const possibleSessionId = getFirstString(
    properties.sessionID,
    properties.sessionId,
    properties.session_id,
    sessionRecord.id,
    sessionRecord.sessionID,
    sessionRecord.sessionId,
    messageRecord.sessionID,
    messageRecord.sessionId,
    partRecord.sessionID,
    partRecord.sessionId
  );

  if (possibleSessionId && possibleSessionId !== expectedSessionId) {
    return null;
  }

  if (type === 'session.error') {
    const errorRecord = asRecord(properties.error);
    const message = getFirstString(errorRecord.message, properties.message) ?? 'OpenCode session error';

    return { type: 'error', error: message };
  }

  if (type === 'session.status') {
    const status = asRecord(properties.status);
    const statusType = getFirstNonBlankString(status.type) ?? 'unknown';
    const message = getFirstNonBlankString(status.message, properties.message) ?? undefined;
    const attempt = getFirstNumber(status.attempt) ?? undefined;
    const next = getFirstNumber(status.next) ?? undefined;
    return {
      type: 'session_status',
      statusType,
      message,
      attempt,
      next
    };
  }

  if (type === 'session.idle') {
    return { type: 'done' };
  }

  if (type === 'message.updated') {
    const info = asRecord(properties.info);
    const messageId = getFirstNonBlankString(
      properties.messageID,
      properties.messageId,
      properties.id,
      info.id
    );
    if (!messageId) return null;
    const role = getFirstNonBlankString(
      properties.role,
      properties.sender,
      info.role
    ) ?? undefined;
    const sessionId = getFirstNonBlankString(
      properties.sessionID,
      properties.sessionId,
      info.sessionID,
      info.sessionId
    ) ?? undefined;
    return {
      type: 'message_updated',
      messageId,
      role,
      sessionId
    };
  }

  if (type === 'message.part.removed') {
    const messageId = getFirstNonBlankString(
      properties.messageID,
      properties.messageId
    );
    const partId = getFirstNonBlankString(
      properties.partID,
      properties.partId
    );
    if (!messageId || !partId) return null;
    const sessionId = getFirstNonBlankString(properties.sessionID, properties.sessionId) ?? undefined;
    return {
      type: 'message_part_removed',
      messageId,
      partId,
      sessionId
    };
  }

  if (type === 'permission.asked' || type === 'permission.updated') {
    const permission = parsePermissionRequest(properties);
    if (!permission) return null;
    return {
      type: 'permission_asked',
      requestId: permission.id,
      sessionId: permission.sessionId,
      toolCallId: permission.toolCallId,
      title: permission.title
    };
  }

  if (type === 'permission.replied') {
    const requestId = getFirstNonBlankString(properties.requestID, properties.requestId, properties.permissionID);
    const sessionId = getFirstNonBlankString(properties.sessionID, properties.sessionId);
    if (!requestId || !sessionId) return null;
    const reply = getFirstNonBlankString(properties.reply, properties.response) ?? 'unknown';
    return {
      type: 'permission_replied',
      requestId,
      sessionId,
      reply
    };
  }

  if (type === 'question.asked') {
    const question = parseQuestionRequest(properties);
    if (!question) return null;
    return {
      type: 'question_asked',
      requestId: question.id,
      sessionId: question.sessionId,
      toolCallId: question.toolCallId,
      questions: question.questions
    };
  }

  if (type === 'question.replied') {
    const requestId = getFirstNonBlankString(properties.requestID, properties.requestId);
    const sessionId = getFirstNonBlankString(properties.sessionID, properties.sessionId);
    if (!requestId || !sessionId) return null;
    const answers = Array.isArray(properties.answers)
      ? properties.answers
          .map((entry) => (Array.isArray(entry) ? entry.filter((value): value is string => typeof value === 'string') : []))
          .filter((entry) => entry.length > 0)
      : [];
    return {
      type: 'question_replied',
      requestId,
      sessionId,
      answers
    };
  }

  if (type === 'question.rejected') {
    const requestId = getFirstNonBlankString(properties.requestID, properties.requestId);
    const sessionId = getFirstNonBlankString(properties.sessionID, properties.sessionId);
    if (!requestId || !sessionId) return null;
    return {
      type: 'question_rejected',
      requestId,
      sessionId
    };
  }

  if (type === 'message.part.delta') {
    return parseMessagePartDelta(properties);
  }

  if (type !== 'message.part.updated') {
    return null;
  }

  return parseMessagePartUpdated(properties);
}

function buildTaskMessageFromRawEvent(rawEvent: unknown, expectedSessionId: string): string | null {
  const event = asRecord(rawEvent);
  const type = getFirstString(event.type);
  if (!type) return null;

  const properties = asRecord(event.properties);
  const sessionRecord = asRecord(properties.session);
  const messageRecord = asRecord(properties.message);
  const partRecord = asRecord(properties.part);
  const possibleSessionId = getFirstString(
    properties.sessionID,
    properties.sessionId,
    properties.session_id,
    sessionRecord.id,
    sessionRecord.sessionID,
    sessionRecord.sessionId,
    messageRecord.sessionID,
    messageRecord.sessionId,
    partRecord.sessionID,
    partRecord.sessionId
  );

  if (possibleSessionId && possibleSessionId !== expectedSessionId) {
    return null;
  }

  if (type === 'message.part.updated') {
    const part = asRecord(properties.part);
    return buildTaskMessageFromPart(part);
  }

  if (type === 'command.executed') {
    const name = getFirstNonBlankString(properties.name) ?? 'command';
    const args = getFirstNonBlankString(properties.arguments) ?? '';
    return args ? `command ${name} ${compactLogValue(args)}` : `command ${name}`;
  }

  if (type === 'file.edited') {
    const file = getFirstNonBlankString(properties.file) ?? 'file';
    return `file edited ${compactLogValue(file)}`;
  }

  if (type === 'session.diff') {
    const diffs = Array.isArray(properties.diff) ? properties.diff : [];
    if (diffs.length === 0) return 'diff updated';
    const summary = diffs
      .slice(0, 5)
      .map((item) => {
        const record = asRecord(item);
        const file = getFirstNonBlankString(record.file) ?? 'file';
        const additions = getFirstNumber(record.additions) ?? 0;
        const deletions = getFirstNumber(record.deletions) ?? 0;
        return `${file} (+${additions}/-${deletions})`;
      })
      .join(', ');
    return diffs.length > 5 ? `diff ${summary} ...` : `diff ${summary}`;
  }

  if (type === 'todo.updated') {
    const todos = Array.isArray(properties.todos) ? properties.todos : [];
    if (todos.length === 0) return 'todo updated';
    const summary = todos
      .slice(0, 5)
      .map((item) => {
        const record = asRecord(item);
        const status = getFirstNonBlankString(record.status) ?? 'pending';
        const content = getFirstNonBlankString(record.content) ?? 'task';
        return `[${status}] ${compactLogValue(content, 80)}`;
      })
      .join(' | ');
    return todos.length > 5 ? `todo ${summary} ...` : `todo ${summary}`;
  }

  if (type === 'permission.updated') {
    const title = getFirstNonBlankString(properties.title, properties.type) ?? 'permission';
    return `permission ${compactLogValue(title)}`;
  }

  if (type === 'permission.replied') {
    const response = getFirstNonBlankString(properties.response) ?? 'unknown';
    return `permission replied ${compactLogValue(response)}`;
  }

  if (type === 'question.asked') {
    const question = parseQuestionRequest(properties);
    if (!question) return 'question asked';
    const preview = question.questions[0]?.question ?? question.questions[0]?.header ?? 'question';
    return `question ${compactLogValue(preview, 120)}`;
  }

  if (type === 'question.replied') {
    return 'question replied';
  }

  if (type === 'question.rejected') {
    return 'question rejected';
  }

  if (type === 'session.status') {
    const status = asRecord(properties.status);
    const statusType = getFirstNonBlankString(status.type) ?? 'unknown';
    if (statusType === 'retry') {
      const attempt = getFirstNumber(status.attempt) ?? 0;
      const message = getFirstNonBlankString(status.message) ?? '';
      return message
        ? `status retry attempt=${attempt} message=${compactLogValue(message)}`
        : `status retry attempt=${attempt}`;
    }
    return `status ${statusType}`;
  }

  if (type === 'session.error') {
    const errorRecord = asRecord(properties.error);
    const message = getFirstNonBlankString(errorRecord.message, properties.message) ?? 'session error';
    return `error ${compactLogValue(message)}`;
  }

  if (type === 'file.watcher.updated') {
    const file = getFirstNonBlankString(properties.file) ?? 'file';
    const eventName = getFirstNonBlankString(properties.event) ?? 'event';
    return `file watcher ${eventName} ${compactLogValue(file)}`;
  }

  if (type === 'vcs.branch.updated') {
    const branch = getFirstNonBlankString(properties.branch) ?? 'unknown';
    return `vcs branch ${branch}`;
  }

  return null;
}

function asPartArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
}

function extractFinalResponseParts(response: unknown): Array<Record<string, unknown>> {
  const value = asRecord(response);
  if (Array.isArray(value.parts)) {
    return asPartArray(value.parts);
  }

  const message = asRecord(value.message);
  if (Array.isArray(message.parts)) {
    return asPartArray(message.parts);
  }

  const data = asRecord(value.data);
  if (Array.isArray(data.parts)) {
    return asPartArray(data.parts);
  }

  const dataMessage = asRecord(data.message);
  if (Array.isArray(dataMessage.parts)) {
    return asPartArray(dataMessage.parts);
  }

  return [];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

function emitTaskFromFinalResponse(response: unknown, emitTask: (message: string) => void): void {
  const parts = extractFinalResponseParts(response);
  if (parts.length === 0) return;

  for (const part of parts) {
    const message = buildTaskMessageFromPart(part);
    if (message) {
      emitTask(message);
    }
  }
}

function extractSessionMessageRows(response: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(response)) {
    return response.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  const value = asRecord(response);
  if (Array.isArray(value.data)) {
    return value.data.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  return [];
}

function extractHistoryRowParts(row: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(row.parts)) {
    return asPartArray(row.parts);
  }

  const message = asRecord(row.message);
  if (Array.isArray(message.parts)) {
    return asPartArray(message.parts);
  }

  const data = asRecord(row.data);
  if (Array.isArray(data.parts)) {
    return asPartArray(data.parts);
  }

  const dataMessage = asRecord(data.message);
  if (Array.isArray(dataMessage.parts)) {
    return asPartArray(dataMessage.parts);
  }

  return [];
}

function renderDirectHistoryContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        const record = asRecord(entry);
        return getFirstString(record.text, record.content, record.delta) ?? '';
      })
      .join('');
  }

  const record = asRecord(value);
  return (
    getFirstString(
      record.text,
      record.content,
      record.delta,
      record.output,
      record.response
    ) ?? ''
  );
}

function extractDirectHistoryMessageContent(row: Record<string, unknown>): string {
  const info = asRecord(row.info);
  const message = asRecord(row.message);
  const data = asRecord(row.data);
  const dataMessage = asRecord(data.message);

  const candidates = [
    row.content,
    row.text,
    row.delta,
    row.output,
    row.response,
    message.content,
    message.text,
    message.delta,
    message.output,
    message.response,
    data.content,
    data.text,
    data.delta,
    data.output,
    data.response,
    dataMessage.content,
    dataMessage.text,
    dataMessage.delta,
    dataMessage.output,
    dataMessage.response,
    info.content,
    info.text
  ];

  for (const candidate of candidates) {
    const content = renderDirectHistoryContent(candidate);
    if (content.trim().length > 0) {
      return content;
    }
  }

  return '';
}

function renderHistoryMessageContent(role: 'user' | 'assistant', parts: Array<Record<string, unknown>>): string {
  let content = '';

  for (const part of parts) {
    const partType = getFirstString(part.type) ?? '';

    if (partType === 'text' || partType === 'output_text' || partType === 'assistant_text') {
      content += getFirstString(part.text, part.content, part.delta) ?? '';
      continue;
    }

    if (role !== 'assistant' || partType !== 'tool') {
      continue;
    }
  }

  return content.trim();
}

export async function loadOpenCodeSessionHistory(params: LoadOpenCodeSessionHistoryParams): Promise<AgentHistoryMessage[]> {
  const log = (line: string) => {
    emitSafeLog(params.onLog, line);
  };

  log(`history:load:start workspace=${params.workspaceRoot}`);
  const runtime = await getOpenCodeRuntime(log);

  const loadMessages = runtime.client.session.messages;
  if (typeof loadMessages !== 'function') {
    log('history:load:unsupported session.messages');
    return [];
  }

  const explicitSessionId = getFirstNonBlankString(params.sessionId);
  if (explicitSessionId) {
    const usable = await isWorkspaceSessionUsable(runtime.client, params.workspaceRoot, explicitSessionId, log);
    if (usable) {
      workspaceSessions.set(params.workspaceRoot, explicitSessionId);
      logSessionHighlight(log, explicitSessionId, params.workspaceRoot);
    } else {
      log(`history:load:session:invalid id=${explicitSessionId}`);
    }
  }
  const sessionId =
    explicitSessionId && workspaceSessions.get(params.workspaceRoot) === explicitSessionId
      ? explicitSessionId
      : await ensureWorkspaceSessionId(runtime.client, params.workspaceRoot, log);
  log(`history:load:session id=${sessionId}`);

  let response: unknown;
  try {
    response = await loadMessages({
      sessionID: sessionId,
      directory: params.workspaceRoot,
      limit: params.limit
    });
  } catch (error) {
    log(`history:load:error ${getErrorMessage(error)}`);
    throw error;
  }

  const rows = extractSessionMessageRows(response);
  const parsed = rows
    .map((row, index) => {
      const info = asRecord(row.info);
      const message = asRecord(row.message);
      const data = asRecord(row.data);
      const dataMessage = asRecord(data.message);
      const role = getFirstString(
        info.role,
        row.role,
        message.role,
        data.role,
        dataMessage.role
      );
      if (role !== 'user' && role !== 'assistant') {
        const id = getFirstString(info.id, row.id, message.id, dataMessage.id) ?? `${sessionId}-${index}`;
        log(`history:row:skip id=${id} reason=role role=${getFirstString(info.role, row.role, message.role, data.role, dataMessage.role) ?? 'unknown'}`);
        return null;
      }

      const parts = extractHistoryRowParts(row);
      const content =
        renderHistoryMessageContent(role, parts) || extractDirectHistoryMessageContent(row);
      const id = getFirstString(info.id, row.id, message.id, dataMessage.id) ?? `${sessionId}-${index}`;
      const partTypes = parts
        .map((part) => getFirstString(part.type) ?? 'unknown')
        .filter((value) => value.length > 0)
        .join(',');
      if (!content) {
        return null;
      }

      const time = asRecord(info.time);
      const createdAt = toIsoDateTime(time.created);
      const createdEpoch = getFirstNumber(time.created) ?? 0;

      return {
        id,
        role,
        content,
        createdAt,
        createdEpoch
      };
    })
    .filter((item): item is AgentHistoryMessage & { createdEpoch: number } => item !== null)
    .sort((a, b) => a.createdEpoch - b.createdEpoch)
    .map(({ createdEpoch: _createdEpoch, ...item }) => item);

  log(`history:load:ok count=${parsed.length}`);
  return parsed;
}

function emitFallbackFromFinalResponse(
  response: unknown,
  onEvent: (event: AgentStreamEvent) => void,
  streamedContent: boolean
): void {
  const parts = extractFinalResponseParts(response);
  if (parts.length === 0) return;

  let aggregatedText = '';

  for (const part of parts) {
    const type = getFirstString(part.type) ?? '';

    if (type === 'text') {
      const text = getFirstString(part.text) ?? '';
      aggregatedText += text;
      continue;
    }

    if (type !== 'tool') {
      continue;
    }

    const state = asRecord(part.state);
    const status = getFirstNonBlankString(state.status) ?? '';

    onEvent({
      type: 'tool_call',
      toolCallId: parseToolId(part),
      name: parseToolName(part),
      input: stringifyUnknown(state.input) || undefined
    });

    if (status === 'completed' || status === 'error') {
      onEvent({
        type: 'tool_result',
        toolCallId: parseToolId(part),
        output: status === 'error' ? stringifyUnknown(state.error) : stringifyUnknown(state.output),
        isError: status === 'error'
      });
    }
  }

  if (!streamedContent && aggregatedText.trim().length > 0) {
    onEvent({ type: 'content', content: aggregatedText });
  }
}

export async function runOpenCodeTurn(params: RunOpenCodeTurnParams): Promise<void> {
  const log = (line: string) => {
    emitSafeLog(params.onLog, line);
  };
  const usingExplicitProviderModel = Boolean(params.model?.providerID && params.model?.modelID);

  const toolNames = new Map<string, string>();
  const toolPermissionContext = new Map<string, string>();
  const handleEvent = (event: AgentStreamEvent) => {
    let nextEvent = event;

    if (event.type === 'tool_call') {
      toolPermissionContext.set(
        event.toolCallId,
        summarizeToolInputForPermission(event.name, event.input)
      );
    }

    if (
      event.type === 'permission_asked' &&
      isGenericPermissionTitle(event.title) &&
      event.toolCallId
    ) {
      const context = toolPermissionContext.get(event.toolCallId) ?? toolNames.get(event.toolCallId);
      if (context) {
        nextEvent = {
          ...event,
          title: context
        };
      }
    }

    if (nextEvent.type === 'task') {
      params.onEvent(nextEvent);
      return;
    }

    if (nextEvent.type === 'tool_call') {
      toolNames.set(nextEvent.toolCallId, nextEvent.name);
      const input = nextEvent.input ? serializeForLog(nextEvent.input, 2000) : '';
      const line = input
        ? `task:tool_call name=${nextEvent.name} id=${nextEvent.toolCallId} input=${input}`
        : `task:tool_call name=${nextEvent.name} id=${nextEvent.toolCallId}`;
      logToolTrace(log, nextEvent.name, line);
    } else if (nextEvent.type === 'tool_result') {
      const name = toolNames.get(nextEvent.toolCallId) ?? nextEvent.toolCallId;
      const status = getToolResultStatusLabel(name, nextEvent.output, nextEvent.isError === true);
      const output = serializeForLog(nextEvent.output, 2000);
      const line = output
        ? `task:tool_result name=${name} id=${nextEvent.toolCallId} status=${status} output=${output}`
        : `task:tool_result name=${name} id=${nextEvent.toolCallId} status=${status}`;
      logToolTrace(log, name, line);
    } else if (nextEvent.type === 'content') {
      // Skip per-token content logging to avoid noisy logs.
    } else if (nextEvent.type === 'error') {
      log(`event:error message=${serializeForLog(nextEvent.error, 4000)}`);
    } else if (nextEvent.type === 'done') {
      log('task:done');
    }

    params.onEvent(nextEvent);
  };

  log(`turn:start workspace=${params.workspaceRoot}`);
  const runtime = await getOpenCodeRuntime(log);
  log('runtime:ready');

  const explicitSessionId = getFirstNonBlankString(params.sessionId);
  let preferredSessionId: string | null = null;
  if (explicitSessionId) {
    const usable = await isWorkspaceSessionUsable(runtime.client, params.workspaceRoot, explicitSessionId, log);
    if (usable) {
      workspaceSessions.set(params.workspaceRoot, explicitSessionId);
      logSessionHighlight(log, explicitSessionId, params.workspaceRoot);
      preferredSessionId = explicitSessionId;
    } else {
      log(`session:explicit-invalid id=${explicitSessionId}`);
    }
  }
  const sessionId = preferredSessionId ?? (await ensureWorkspaceSessionId(runtime.client, params.workspaceRoot, log));
  log(`session:active id=${sessionId}`);

  if (params.signal.aborted) {
    log('turn:aborted-before-prompt');
    throw new Error('Turn cancelled');
  }

  let subscription: OpenCodeSubscription | undefined;
  let cancelStarted = false;

  const requestSessionAbort = (): void => {
    if (cancelStarted) return;
    cancelStarted = true;
    log('turn:cancel:requested');

    try {
      subscription?.controller?.abort?.();
    } catch {
      // Best effort; session abort below is the primary stop mechanism.
    }

    const abortSession = runtime.client.session.abort;
    if (typeof abortSession !== 'function') {
      log('turn:cancel:session-abort:unsupported');
      return;
    }

    void abortSession({
      sessionID: sessionId,
      directory: params.workspaceRoot
    })
      .then(() => {
        log('turn:cancel:session-abort:sent');
      })
      .catch((error) => {
        log(`turn:cancel:session-abort:error ${getErrorMessage(error)}`);
      });
  };

  const handleAbortSignal = () => {
    log('turn:cancel:signal-observed');
    requestSessionAbort();
  };

  params.signal.addEventListener('abort', handleAbortSignal, { once: true });

  try {
    subscription = (await runtime.client.event.subscribe({
      directory: params.workspaceRoot
    }, {
      signal: params.signal
    })) as OpenCodeSubscription;
  } catch (error) {
    params.signal.removeEventListener('abort', handleAbortSignal);
    if (params.signal.aborted || isAbortLikeError(error)) {
      log('events:subscribe:aborted');
      throw new Error('Turn cancelled');
    }
    log(`events:subscribe:error ${getErrorMessage(error)}`);
    throw error;
  }
  log('events:subscribed');

  let streamedAnyContent = false;
  let streamFinished = false;
  let parsedEventCount = 0;
  const contentPartKindById = new Map<string, 'reasoning' | 'text'>();
  let resolveStreamSettled: () => void = () => {};
  const streamSettled = new Promise<void>((resolve) => {
    resolveStreamSettled = resolve;
  });

  const emitTask = (message: string) => {
    log(`task:${message}`);
    params.onEvent({ type: 'task', message });
  };

  const streamPump = (async () => {
    const stream = subscription.stream;
    if (!stream) {
      log('events:stream:missing');
      return;
    }
    log('events:stream:ready');

    for await (const raw of stream) {
      if (params.signal.aborted) {
        break;
      }

      logRawEvent(raw, log);
      captureContentPartKindFromRawEvent(raw, sessionId, contentPartKindById);
      const taskMessage = buildTaskMessageFromRawEvent(raw, sessionId);
      if (taskMessage) {
        emitTask(taskMessage);
      }

      const parsed = parseEvent(raw, sessionId);
      if (!parsed) continue;
      if (parsed.type === 'content' && parsed.partId && !parsed.contentKind) {
        parsed.contentKind = contentPartKindById.get(parsed.partId);
      }
      parsedEventCount += 1;

      if (parsed.type !== 'content') {
        log(`event:${parsed.type}`);
      }

      if (parsed.type === 'content') {
        streamedAnyContent = true;
      }

      handleEvent(parsed);

      if (parsed.type === 'done' || parsed.type === 'error') {
        streamFinished = true;
        break;
      }
    }
  })().finally(() => {
    resolveStreamSettled();
  });

  try {
    log('prompt:send');
    if (params.model?.providerID && params.model?.modelID) {
      log(`prompt:model provider=${params.model.providerID} model=${params.model.modelID}`);
    } else {
      log(`prompt:model provider=default model=${OPEN_CODE_MODEL}`);
    }
    let response: unknown;
    let usedPromptAsync = false;
    try {
      const promptBody: Record<string, unknown> = {
        parts: [
          {
            type: 'text',
            text: params.prompt
          }
        ]
      };
      if (params.model?.providerID && params.model?.modelID) {
        promptBody.model = {
          providerID: params.model.providerID,
          modelID: params.model.modelID
        };
      }

      const promptPayload = {
        sessionID: sessionId,
        directory: params.workspaceRoot,
        messageID: typeof promptBody.messageID === 'string' ? promptBody.messageID : undefined,
        model: (promptBody.model as { providerID: string; modelID: string } | undefined) ?? undefined,
        agent: typeof promptBody.agent === 'string' ? promptBody.agent : undefined,
        noReply: promptBody.noReply === true ? true : undefined,
        tools:
          promptBody.tools && typeof promptBody.tools === 'object'
            ? (promptBody.tools as Record<string, boolean>)
            : undefined,
        system: typeof promptBody.system === 'string' ? promptBody.system : undefined,
        parts: promptBody.parts as Array<{ type: 'text'; text: string }>
      };

      const promptAsync = runtime.client.session.promptAsync;
      if (typeof promptAsync === 'function') {
        usedPromptAsync = true;
        log('prompt:mode async');
        response = await promptAsync(promptPayload, {
          signal: params.signal
        });
      } else {
        log('prompt:mode sync');
        response = await runtime.client.session.prompt({
          ...promptPayload,
          variant: typeof promptBody.variant === 'string' ? promptBody.variant : undefined
        }, {
          signal: params.signal
        });
      }
    } catch (error) {
      if (params.signal.aborted || isAbortLikeError(error)) {
        log('prompt:aborted');
        throw new Error('Turn cancelled');
      }
      log(`prompt:error ${getErrorMessage(error)}`);
      throw error;
    }

    const responseError = getResponseErrorMessage(response);
    if (responseError) {
      log(`prompt:response:error ${serializeForLog(responseError, 2000)}`);
      throw new Error(responseError);
    }

    emitTaskFromFinalResponse(response, emitTask);
    emitFallbackFromFinalResponse(response, handleEvent, streamedAnyContent);
    const fallbackParts = extractFinalResponseParts(response);
    log(
      `prompt:response:summary parts=${fallbackParts.length} streamed=${streamedAnyContent ? 'yes' : 'no'} events=${parsedEventCount}`
    );
    log('prompt:response-received');

    if (usedPromptAsync) {
      log('prompt:awaiting-stream');
      await streamSettled;
    } else if (!streamFinished && !streamedAnyContent && fallbackParts.length === 0) {
      log('prompt:response:empty-await-stream');
      await Promise.race([streamSettled, wait(1500)]);
    }

    if (!usedPromptAsync && !streamFinished && !streamedAnyContent && fallbackParts.length === 0) {
      const emptyMessage = usingExplicitProviderModel
        ? 'Agent returned no response. Check Settings > Providers and reconnect your selected provider.'
        : 'Agent returned no response from ExortAI default model (big-pickle). Retry once, then restart the app if it persists.';
      handleEvent({ type: 'error', error: emptyMessage });
      log(`prompt:response:empty ${serializeForLog(emptyMessage, 1000)}`);
      streamFinished = true;
    }

    if (!streamFinished) {
      handleEvent({ type: 'done' });
      streamFinished = true;
      log('turn:done-from-fallback');
    }
  } catch (error) {
    if (params.signal.aborted || isAbortLikeError(error)) {
      if (!streamFinished) {
        handleEvent({ type: 'done' });
        streamFinished = true;
      }
      log('turn:cancelled');
      throw new Error('Turn cancelled');
    }

    const message = error instanceof Error ? error.message : 'OpenCode prompt execution failed';
    handleEvent({ type: 'error', error: message });
    log(`turn:error ${message}`);
    throw error;
  } finally {
    subscription?.controller?.abort?.();
    params.signal.removeEventListener('abort', handleAbortSignal);
    // Do not block turn completion on stream teardown; some SDK streams can linger.
    void streamPump.catch((error) => {
      log(`events:stream:error ${getErrorMessage(error)}`);
    });
    log('events:unsubscribed');
  }
}

export async function shutdownOpenCodeRuntime(): Promise<void> {
  await shutdownOpenCode();
  workspaceSessions.clear();
}
