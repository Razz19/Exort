import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPEN_CODE_MODEL, openCodeServerOptions } from './openCodeConfig.js';
import { ensureManagedOpenCodeBinary, resolveManagedOpenCodeBinary } from './openCodeBinary.js';
import { ensureOpenCodeIsolation } from './openCodeIsolation.js';
import { startOpenCodeSidecar } from './openCodeSidecar.js';

type OpenCodeV2ClientModule = {
  createOpencodeClient?: (config?: Record<string, unknown>) => unknown;
};

type OpenCodeServer = {
  url?: string;
  close?: () => void | Promise<void>;
};

type OpenCodeClientShape = {
  session?: {
    list?: (args?: unknown, options?: unknown) => Promise<unknown>;
    get?: (args?: unknown, options?: unknown) => Promise<unknown>;
    create?: (args?: unknown, options?: unknown) => Promise<unknown>;
    messages?: (args?: unknown, options?: unknown) => Promise<unknown>;
    prompt?: (args?: unknown, options?: unknown) => Promise<unknown>;
    promptAsync?: (args?: unknown, options?: unknown) => Promise<unknown>;
    abort?: (args?: unknown, options?: unknown) => Promise<unknown>;
  };
  event?: {
    subscribe?: (args?: unknown, options?: unknown) => Promise<unknown>;
  };
};

type OpenCodePermissionShape = {
  list?: (args?: unknown) => Promise<unknown>;
  reply?: (args?: unknown) => Promise<unknown>;
  respond?: (args?: unknown) => Promise<unknown>;
};

type OpenCodeQuestionShape = {
  list?: (args?: unknown) => Promise<unknown>;
  reply?: (args?: unknown) => Promise<unknown>;
  reject?: (args?: unknown) => Promise<unknown>;
};

type OpenCodeAuthShape = {
  set?: (args?: unknown) => Promise<unknown>;
  remove?: (args?: unknown) => Promise<unknown>;
};

type OpenCodeProviderOAuthShape = {
  authorize?: (args?: unknown) => Promise<unknown>;
  callback?: (args?: unknown) => Promise<unknown>;
};

type OpenCodeProviderShape = {
  list?: (args?: unknown) => Promise<unknown>;
  auth?: (args?: unknown) => Promise<unknown>;
  oauth?: OpenCodeProviderOAuthShape;
};

type OpenCodeV2ClientShape = {
  permission?: OpenCodePermissionShape;
  question?: OpenCodeQuestionShape;
  auth?: OpenCodeAuthShape;
  provider?: OpenCodeProviderShape;
};

type OpenCodeLog = (line: string) => void;

export type OpenCodeClient = {
  session: {
    list?: (args?: unknown, options?: unknown) => Promise<unknown>;
    get?: (args?: unknown, options?: unknown) => Promise<unknown>;
    create: (args?: unknown, options?: unknown) => Promise<unknown>;
    messages?: (args?: unknown, options?: unknown) => Promise<unknown>;
    prompt: (args?: unknown, options?: unknown) => Promise<unknown>;
    promptAsync?: (args?: unknown, options?: unknown) => Promise<unknown>;
    abort?: (args?: unknown, options?: unknown) => Promise<unknown>;
  };
  event: {
    subscribe: (args?: unknown, options?: unknown) => Promise<unknown>;
  };
  permission?: {
    list?: (args?: unknown) => Promise<unknown>;
    reply?: (args?: unknown) => Promise<unknown>;
    respond?: (args?: unknown) => Promise<unknown>;
  };
  question?: {
    list?: (args?: unknown) => Promise<unknown>;
    reply?: (args?: unknown) => Promise<unknown>;
    reject?: (args?: unknown) => Promise<unknown>;
  };
  auth?: {
    set?: (args?: unknown) => Promise<unknown>;
    remove?: (args?: unknown) => Promise<unknown>;
  };
  provider?: {
    list?: (args?: unknown) => Promise<unknown>;
    auth?: (args?: unknown) => Promise<unknown>;
    oauth?: {
      authorize?: (args?: unknown) => Promise<unknown>;
      callback?: (args?: unknown) => Promise<unknown>;
    };
  };
};

export type OpenCodeRuntime = {
  client: OpenCodeClient;
  server?: OpenCodeServer;
  binaryPath: string;
};

let runtimePromise: Promise<OpenCodeRuntime> | null = null;
const OPENCODE_CONFIG_DIR_NAME = 'opencode-config';
const OPENCODE_TOOLS_DIR_NAME = 'tools';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown OpenCode SDK error';
}

function normalizeOpenCodeClient(value: unknown, v2Client?: unknown): OpenCodeClient | null {
  const candidate = value as OpenCodeClientShape;
  const v2Candidate = v2Client as OpenCodeV2ClientShape | undefined;

  const session = candidate.session;
  const events = candidate.event;
  const list = session?.list;
  const get = session?.get;
  const create = session?.create;
  const messages = session?.messages;
  const prompt = session?.prompt;
  const promptAsync = session?.promptAsync;
  const abort = session?.abort;
  const subscribe = events?.subscribe;

  if (typeof create !== 'function' || typeof prompt !== 'function' || typeof subscribe !== 'function') {
    return null;
  }

  const permission = v2Candidate?.permission;
  const permissionList = permission?.list;
  const permissionReply = permission?.reply;
  const permissionRespond = permission?.respond;

  const question = v2Candidate?.question;
  const questionList = question?.list;
  const questionReply = question?.reply;
  const questionReject = question?.reject;

  const authApi = v2Candidate?.auth;
  const authSet = authApi?.set;
  const authRemove = authApi?.remove;

  const provider = v2Candidate?.provider;
  const providerList = provider?.list;
  const providerAuth = provider?.auth;
  const providerOauth = provider?.oauth;
  const providerOauthAuthorize = providerOauth?.authorize;
  const providerOauthCallback = providerOauth?.callback;

  return {
    // Bind SDK methods so extracted references still keep their internal `this` context.
    session: {
      list: typeof list === 'function' ? list.bind(session) : undefined,
      get: typeof get === 'function' ? get.bind(session) : undefined,
      create: create.bind(session),
      messages: typeof messages === 'function' ? messages.bind(session) : undefined,
      prompt: prompt.bind(session),
      promptAsync: typeof promptAsync === 'function' ? promptAsync.bind(session) : undefined,
      abort: typeof abort === 'function' ? abort.bind(session) : undefined
    },
    event: {
      subscribe: subscribe.bind(events)
    },
    permission:
      typeof permissionList === 'function' ||
      typeof permissionReply === 'function' ||
      typeof permissionRespond === 'function'
        ? {
            list: typeof permissionList === 'function' ? permissionList.bind(permission) : undefined,
            reply: typeof permissionReply === 'function' ? permissionReply.bind(permission) : undefined,
            respond: typeof permissionRespond === 'function' ? permissionRespond.bind(permission) : undefined
          }
        : undefined,
    question:
      typeof questionList === 'function' || typeof questionReply === 'function' || typeof questionReject === 'function'
        ? {
            list: typeof questionList === 'function' ? questionList.bind(question) : undefined,
            reply: typeof questionReply === 'function' ? questionReply.bind(question) : undefined,
            reject: typeof questionReject === 'function' ? questionReject.bind(question) : undefined
          }
        : undefined,
    auth:
      typeof authSet === 'function' || typeof authRemove === 'function'
        ? {
            set: typeof authSet === 'function' ? authSet.bind(authApi) : undefined,
            remove: typeof authRemove === 'function' ? authRemove.bind(authApi) : undefined
          }
        : undefined,
    provider:
      typeof providerList === 'function' ||
      typeof providerAuth === 'function' ||
      typeof providerOauthAuthorize === 'function' ||
      typeof providerOauthCallback === 'function'
        ? {
            list: typeof providerList === 'function' ? providerList.bind(provider) : undefined,
            auth: typeof providerAuth === 'function' ? providerAuth.bind(provider) : undefined,
            oauth:
              typeof providerOauthAuthorize === 'function' || typeof providerOauthCallback === 'function'
                ? {
                    authorize:
                      typeof providerOauthAuthorize === 'function'
                        ? providerOauthAuthorize.bind(providerOauth)
                        : undefined,
                    callback: typeof providerOauthCallback === 'function' ? providerOauthCallback.bind(providerOauth) : undefined
                  }
                : undefined
          }
        : undefined
  };
}

function isOpenCodeConfigDir(candidate: string): boolean {
  return existsSync(path.join(candidate, OPENCODE_TOOLS_DIR_NAME));
}

function resolveOpenCodeConfigSourceDir(): string {
  const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(runtimeDirectory, OPENCODE_CONFIG_DIR_NAME),
    runtimeDirectory
  ];

  for (const candidate of candidates) {
    if (isOpenCodeConfigDir(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'OpenCode config directory not found. Expected sidecar tools under out/main/opencode-config or src/main/agent.'
  );
}

async function ensureOpenCodeConfigDir(managedRoot: string, log?: OpenCodeLog): Promise<void> {
  const sourceDir = resolveOpenCodeConfigSourceDir();
  const resolved = path.join(managedRoot, 'config', OPENCODE_CONFIG_DIR_NAME);
  const previous = process.env.OPENCODE_CONFIG_DIR?.trim();

  await mkdir(path.dirname(resolved), { recursive: true });
  await rm(resolved, { recursive: true, force: true });
  await cp(sourceDir, resolved, {
    recursive: true,
    force: true,
    filter: (source) => path.basename(source) !== 'node_modules'
  });

  process.env.OPENCODE_CONFIG_DIR = resolved;

  if (previous && previous !== resolved) {
    log?.(`config:dir:override from=${previous} to=${resolved}`);
    return;
  }

  log?.(`config:dir:set path=${resolved} source=${sourceDir}`);
}

async function createOpenCodeRuntime(log?: OpenCodeLog): Promise<OpenCodeRuntime> {
  log?.('runtime:create:start');
  const managedBinary = await ensureManagedOpenCodeBinary({ log, installIfMissing: false });
  await ensureOpenCodeConfigDir(managedBinary.managedRoot, log);
  const isolation = await ensureOpenCodeIsolation();

  const sidecar = await startOpenCodeSidecar({
    binaryPath: managedBinary.binaryPath,
    hostname: openCodeServerOptions.hostname,
    port: openCodeServerOptions.port,
    timeoutMs: openCodeServerOptions.timeout,
    config: openCodeServerOptions.config,
    envOverrides: isolation.envOverrides,
    isolationInfo: isolation,
    log
  });

  log?.('sdk:v2-client:import:start');

  try {
    const v2Module = (await import('@opencode-ai/sdk/v2/client')) as OpenCodeV2ClientModule;
    const createV2Client = v2Module.createOpencodeClient;

    if (typeof createV2Client !== 'function') {
      throw new Error('OpenCode SDK v2 client is installed but createOpencodeClient() is not available');
    }

    const clientCandidate = createV2Client({
      baseUrl: sidecar.url
    });

    const client = normalizeOpenCodeClient(clientCandidate, clientCandidate);
    if (!client) {
      throw new Error('OpenCode SDK client shape is not compatible with ExortAi integration');
    }

    log?.('runtime:create:ready');
    log?.(`\u001b[33msdk:init model=${OPEN_CODE_MODEL} session=none pid=${process.pid}\u001b[0m`);

    return {
      client,
      binaryPath: managedBinary.binaryPath,
      server: {
        url: sidecar.url,
        close: sidecar.close
      }
    };
  } catch (error) {
    await sidecar.close().catch(() => {
      // Swallow shutdown errors on startup failures.
    });
    throw error;
  }
}

async function runtimeRequiresRecycle(log?: OpenCodeLog): Promise<boolean> {
  if (!runtimePromise) return false;

  const runtime = await runtimePromise.catch((error) => {
    log?.(`runtime:resolve:error ${getErrorMessage(error)}`);
    runtimePromise = null;
    return null;
  });
  if (!runtime) return false;

  const currentBinaryPath = path.resolve(runtime.binaryPath);
  if (!existsSync(currentBinaryPath)) {
    log?.(`runtime:recycle reason=binary-missing path=${currentBinaryPath}`);
    return true;
  }

  const expectedBinary = await resolveManagedOpenCodeBinary();
  const expectedBinaryPath = path.resolve(expectedBinary.binaryPath);
  if (currentBinaryPath !== expectedBinaryPath) {
    log?.(`runtime:recycle reason=binary-path-changed from=${currentBinaryPath} to=${expectedBinaryPath}`);
    return true;
  }

  return false;
}

export async function getOpenCodeRuntime(log?: OpenCodeLog): Promise<OpenCodeRuntime> {
  if (await runtimeRequiresRecycle(log)) {
    await shutdownOpenCode(log);
  }

  if (!runtimePromise) {
    runtimePromise = createOpenCodeRuntime(log).catch((error) => {
      // Reset singleton on init failure so next turn can retry initialization.
      runtimePromise = null;
      log?.(`runtime:create:error ${getErrorMessage(error)}`);
      throw error;
    });
  } else {
    log?.('runtime:reuse');
  }

  return runtimePromise;
}

export async function shutdownOpenCode(log?: OpenCodeLog): Promise<void> {
  if (!runtimePromise) return;

  const runtime = await runtimePromise.catch((error) => {
    log?.(`runtime:resolve:error ${getErrorMessage(error)}`);
    return null;
  });

  try {
    log?.('runtime:close:start');
    await runtime?.server?.close?.();
    log?.('runtime:closed');
  } catch (error) {
    log?.(`runtime:close:error ${getErrorMessage(error)}`);
  }

  runtimePromise = null;
}
