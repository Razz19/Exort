import { waitForExortPlugin } from './v2Readiness.js';
import { existsSync } from 'node:fs';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPEN_CODE_MODEL, openCodeServerOptions } from './openCodeConfig.js';
import { ensureManagedOpenCodeBinary, resolveManagedOpenCodeBinary } from './openCodeBinary.js';
import { ensureOpenCodeIsolation } from './openCodeIsolation.js';
import { startOpenCodeSidecar } from './openCodeSidecar.js';
import { EXORT_ARDUINO_CLI_BINARY_ENV, resolveManagedArduinoCliBinary } from '../arduinoCliBinary.js';

import { OpenCode, type OpenCodeClient as NativeClient } from '@opencode/client';
import { createV2Adapter } from './v2Adapter.js';
import { withRuntimeCall } from './runtimeAccess.js';
import { prepareV2Migration, waitForV2Migration } from './runtimeData.js';
type OpenCodeLog = (line: string) => void;
type OpenCodeServer = { url?: string; close?: () => void | Promise<void> };

export type OpenCodeClient = {
  hasPendingInteractions?: () => boolean;
  session: {
    list?: (args?: unknown, options?: unknown) => Promise<unknown>;
    get?: (args?: unknown, options?: unknown) => Promise<unknown>;
    create: (args?: unknown, options?: unknown) => Promise<unknown>;
    messages?: (args?: unknown, options?: unknown) => Promise<unknown>;
    diff?: (args?: unknown, options?: unknown) => Promise<unknown>;
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
  native: NativeClient;
  server?: OpenCodeServer;
  binaryPath: string;
  managedRoot: string;
};

let runtimePromise: Promise<OpenCodeRuntime> | null = null;
let activeRuntimeGeneration: number | null = null;
let runtimeGenerationSeed = 0;
const OPENCODE_CONFIG_DIR_NAME = 'opencode-config';
const OPENCODE_TOOLS_DIR_NAME = 'tools';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown OpenCode SDK error';
}

function isOpenCodeConfigDir(candidate: string): boolean { return existsSync(path.join(candidate, OPENCODE_TOOLS_DIR_NAME)); }

function toAsarUnpackedPath(candidate: string): string {
  const marker = `${path.sep}app.asar${path.sep}`;
  if (candidate.includes(marker)) {
    return candidate.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`);
  }

  const suffix = `${path.sep}app.asar`;
  if (candidate.endsWith(suffix)) {
    return `${candidate.slice(0, -suffix.length)}${path.sep}app.asar.unpacked`;
  }

  return candidate;
}

function resolveOpenCodeConfigSourceDir(): string {
  const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(toAsarUnpackedPath(runtimeDirectory), OPENCODE_CONFIG_DIR_NAME),
    path.resolve(runtimeDirectory, OPENCODE_CONFIG_DIR_NAME),
    toAsarUnpackedPath(runtimeDirectory),
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

async function ensureOpenCodeConfigDir(managedRoot: string, log?: OpenCodeLog): Promise<string> {
  const sourceDir = resolveOpenCodeConfigSourceDir();
  const resolved = path.join(managedRoot, 'config', OPENCODE_CONFIG_DIR_NAME);

  await mkdir(path.dirname(resolved), { recursive: true });
  await rm(resolved, { recursive: true, force: true });
  for (const directory of ['tools', 'plugins']) {
    await cp(path.join(sourceDir, directory), path.join(resolved, directory), { recursive: true });
  }
  log?.(`config:dir:set path=${resolved}`);
  return resolved;
}

async function createOpenCodeRuntime(log?: OpenCodeLog): Promise<OpenCodeRuntime> {
  log?.('runtime:create:start');
  const runtimeGeneration = ++runtimeGenerationSeed;
  const managedBinary = await ensureManagedOpenCodeBinary({ log, installIfMissing: false });
  await prepareV2Migration(managedBinary.managedRoot);
  const configAssets = await ensureOpenCodeConfigDir(managedBinary.managedRoot, log);
  const isolation = await ensureOpenCodeIsolation();
  const configDirectory = path.join(isolation.runtimeConfigRoot, 'opencode');
  await mkdir(configDirectory, { recursive: true });
  await writeFile(path.join(configDirectory, 'opencode.json'), JSON.stringify({
    ...openCodeServerOptions.config, plugins: [path.join(configAssets, 'plugins', 'exort')]
  }), { mode: 0o600 });
  const managedArduinoCli = await resolveManagedArduinoCliBinary();

  const sidecar = await startOpenCodeSidecar({
    binaryPath: managedBinary.binaryPath,
    hostname: openCodeServerOptions.hostname,
    port: openCodeServerOptions.port,
    timeoutMs: openCodeServerOptions.timeout,
    config: openCodeServerOptions.config,
    envOverrides: {
      ...isolation.envOverrides,
      [EXORT_ARDUINO_CLI_BINARY_ENV]: managedArduinoCli.binaryPath
    },
    isolationInfo: isolation,
    onUnexpectedExit: ({ code, signal }) => {
      if (activeRuntimeGeneration !== runtimeGeneration) return;
      activeRuntimeGeneration = null;
      runtimePromise = null;
      log?.(`runtime:invalidated reason=sidecar-exit code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    },
    log
  });

  log?.('sdk:v2-client:import:start');
  activeRuntimeGeneration = runtimeGeneration;

  try {
    const native = OpenCode.make({ baseUrl: sidecar.url, headers: sidecar.headers });
    await waitForV2Migration(native, managedBinary.managedRoot);
    await waitForExortPlugin(native, managedBinary.managedRoot);
    const client = createV2Adapter(native);

    log?.('runtime:create:ready');
    log?.(`\u001b[33msdk:init model=${OPEN_CODE_MODEL} session=none pid=${process.pid}\u001b[0m`);

    return {
      client,
      native,
      binaryPath: managedBinary.binaryPath,
      managedRoot: managedBinary.managedRoot,
      server: {
        url: sidecar.url,
        close: sidecar.close
      }
    };
  } catch (error) {
    activeRuntimeGeneration = null;
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
  return withRuntimeCall(async () => {
    if (await runtimeRequiresRecycle(log)) await shutdownOpenCode(log);
    if (!runtimePromise) {
      runtimePromise = createOpenCodeRuntime(log).catch((error) => {
        activeRuntimeGeneration = null;
        runtimePromise = null;
        log?.(`runtime:create:error ${getErrorMessage(error)}`);
        throw error;
      });
    } else {
      log?.('runtime:reuse');
    }
    return runtimePromise;
  });
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
  activeRuntimeGeneration = null;
}

export async function getExistingOpenCodeRuntime(): Promise<OpenCodeRuntime | null> { return runtimePromise ? runtimePromise.catch(() => null) : null; }
