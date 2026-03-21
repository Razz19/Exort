import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

import type { Config } from '@opencode-ai/sdk';
import type { OpenCodeIsolationInfo } from './openCodeIsolation.js';

type OpenCodeLog = (line: string) => void;
const ANSI_GREEN = '\u001b[32m';
const ANSI_RESET = '\u001b[0m';

type StartOpenCodeSidecarOptions = {
  binaryPath: string;
  hostname?: string;
  port?: number;
  timeoutMs?: number;
  config?: Config;
  envOverrides?: NodeJS.ProcessEnv;
  isolationInfo?: OpenCodeIsolationInfo;
  log?: OpenCodeLog;
};

export type OpenCodeSidecar = {
  url: string;
  pid: number | undefined;
  close: () => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown sidecar error';
}

function parseSidecarUrl(output: string): string | null {
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('opencode server listening')) continue;
    const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
    if (!match) continue;
    return match[1] ?? null;
  }

  return null;
}

function parsePortFromUrl(url: string): number | null {
  try {
    const parsed = new URL(url);
    const port = Number(parsed.port);
    if (Number.isFinite(port) && port > 0) return port;
    if (parsed.protocol === 'https:') return 443;
    return 80;
  } catch {
    return null;
  }
}

async function pickAvailablePort(hostname: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, hostname, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate sidecar port.')));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function waitForExit(proc: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve) => {
    proc.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function closeSidecarProcess(proc: ChildProcess): Promise<void> {
  if (proc.killed || proc.exitCode != null) {
    return;
  }

  const exitPromise = waitForExit(proc);

  try {
    proc.kill();
  } catch {
    // Ignore synchronous kill errors; fallback will handle unresolved exits.
  }

  const forceTimeoutMs = 4000;
  const forceKillPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      if (proc.exitCode == null && process.platform !== 'win32') {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore kill escalation failures.
        }
      }
      resolve();
    }, forceTimeoutMs).unref();
  });

  await Promise.race([exitPromise.then(() => undefined), forceKillPromise]);
  await exitPromise;
}

export async function startOpenCodeSidecar(options: StartOpenCodeSidecarOptions): Promise<OpenCodeSidecar> {
  const hostname = options.hostname ?? '127.0.0.1';
  const timeoutMs = options.timeoutMs ?? 5000;
  const port = typeof options.port === 'number' && options.port > 0 ? options.port : await pickAvailablePort(hostname);

  if (options.isolationInfo) {
    options.log?.(`runtime:isolation:enabled root=${options.isolationInfo.root}`);
    options.log?.(
      `runtime:isolation:paths config=${options.isolationInfo.runtimeConfigRoot} data=${options.isolationInfo.runtimeDataRoot} state=${options.isolationInfo.runtimeStateRoot}`
    );
  }

  const args = [`serve`, `--hostname=${hostname}`, `--port=${port}`];
  if (options.config?.logLevel) {
    args.push(`--log-level=${options.config.logLevel}`);
  }

  options.log?.(`runtime:sidecar:spawn path=${options.binaryPath} args=${args.join(' ')}`);

  const proc = spawn(options.binaryPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...(options.envOverrides ?? {}),
      OPENCODE_CONFIG_CONTENT: JSON.stringify(options.config ?? {})
    }
  });

  let output = '';
  let ready = false;

  proc.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });

  proc.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const readyUrl = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for OpenCode sidecar startup after ${timeoutMs}ms.`));
    }, timeoutMs);

    const onData = () => {
      const url = parseSidecarUrl(output);
      if (!url) return;
      ready = true;
      clearTimeout(timeout);
      resolve(url);
    };

    const onError = (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timeout);
      const detail = output.trim();
      const suffix = detail ? `\nSidecar output: ${detail}` : '';
      reject(new Error(`OpenCode sidecar exited before ready (code=${code ?? 'null'} signal=${signal ?? 'null'}).${suffix}`));
    };

    proc.once('error', onError);
    proc.once('exit', onExit);
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    onData();
  }).catch(async (error) => {
    options.log?.(`runtime:sidecar:error ${getErrorMessage(error)}`);
    if (proc.exitCode == null) {
      await closeSidecarProcess(proc);
    }
    throw error;
  });

  options.log?.(`runtime:sidecar:ready url=${readyUrl} pid=${proc.pid ?? 'unknown'}`);
  options.log?.(
    `${ANSI_GREEN}runtime:sidecar:info url=${readyUrl} port=${parsePortFromUrl(readyUrl) ?? port} pid=${
      proc.pid ?? 'unknown'
    } host=${hostname} binary=${options.binaryPath}${ANSI_RESET}`
  );

  proc.on('error', (error) => {
    options.log?.(`runtime:sidecar:error ${getErrorMessage(error)}`);
  });

  proc.on('exit', (code, signal) => {
    if (ready) {
      options.log?.(`runtime:sidecar:exit code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    }
  });

  return {
    url: readyUrl,
    pid: proc.pid,
    close: async () => {
      await closeSidecarProcess(proc);
    }
  };
}
