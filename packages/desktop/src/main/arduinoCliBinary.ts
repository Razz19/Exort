import { existsSync } from 'node:fs';
import { chmod, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const EXORT_MANAGED_ARDUINO_CLI_VERSION = '1.5.0';
export const EXORT_MANAGED_ARDUINO_CLI_RELEASE_TAG = `v${EXORT_MANAGED_ARDUINO_CLI_VERSION}`;
export const EXORT_ARDUINO_CLI_BINARY_ENV = 'EXORT_ARDUINO_CLI_BINARY';

const EXORT_RUNTIME_APP_DIR = 'Exort';
const EXORT_RUNTIME_SEGMENTS = ['runtime', 'arduino-cli'] as const;
const VERSION_TIMEOUT_MS = 15_000;
let lastProvisionDiagnostics: string | null = null;

export type ArduinoCliBinarySource = 'managed' | 'system';

export type ManagedArduinoCliBinary = {
  source: ArduinoCliBinarySource;
  binaryPath: string;
  managedVersion: string;
  managedRoot: string;
  platformKey: string;
  installRoot: string;
};

export type ManagedArduinoCliStatus = {
  installed: boolean;
  version: string | null;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath: string;
  source: ArduinoCliBinarySource;
  managedVersion: string;
};

type RunCommandResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
};

type VersionResult = {
  ok: boolean;
  version: string | null;
  detail?: string;
};

type EnsureOptions = {
  log?: (line: string) => void;
  installIfMissing?: boolean;
};

function getBinaryName(): string {
  return process.platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
}

function getPlatformKey(): string {
  return `${process.platform}-${process.arch}`;
}

function getManagedRootFromEnv(): string | null {
  const configured = process.env.EXORT_ARDUINO_CLI_RUNTIME_DIR?.trim();
  if (!configured) return null;
  return path.resolve(configured);
}

async function getManagedRoot(): Promise<string> {
  const fromEnv = getManagedRootFromEnv();
  if (fromEnv) return fromEnv;

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    const dataRoot =
      localAppData && localAppData.length > 0
        ? path.resolve(localAppData)
        : path.join(os.homedir(), 'AppData', 'Local');
    return path.join(dataRoot, EXORT_RUNTIME_APP_DIR, ...EXORT_RUNTIME_SEGMENTS);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', EXORT_RUNTIME_APP_DIR, ...EXORT_RUNTIME_SEGMENTS);
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  const dataRoot =
    xdgDataHome && xdgDataHome.length > 0 ? path.resolve(xdgDataHome) : path.join(os.homedir(), '.local', 'share');
  return path.join(dataRoot, EXORT_RUNTIME_APP_DIR, ...EXORT_RUNTIME_SEGMENTS);
}

function getManagedBinaryPath(managedRoot: string, platformKey: string): string {
  return path.join(managedRoot, 'managed', EXORT_MANAGED_ARDUINO_CLI_VERSION, platformKey, getBinaryName());
}

function trimOutput(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function runCommand(params: {
  command: string;
  args?: string[];
  timeoutMs?: number;
}): Promise<RunCommandResult> {
  const args = params.args ?? [];
  const timeoutMs = params.timeoutMs ?? VERSION_TIMEOUT_MS;

  return new Promise((resolve) => {
    const proc = spawn(params.command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 2000).unref();
    }, timeoutMs);

    const settle = (result: RunCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (error) => {
      settle({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        error: error.message,
        timedOut
      });
    });

    proc.on('close', (code) => {
      settle({
        ok: code === 0 && !timedOut,
        exitCode: code,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}

function firstVersionLine(stdout: string, stderr: string): string | null {
  const merged = trimOutput(stdout) || trimOutput(stderr);
  return merged.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? null;
}

export async function ensureArduinoCliExecutable(binaryPath: string): Promise<void> {
  if (process.platform === 'win32') return;
  await chmod(binaryPath, 0o755).catch(() => {
    // Best effort; validation below reports an actionable error if chmod was required.
  });
}

export async function runArduinoCliVersionCommand(binaryPath: string): Promise<VersionResult> {
  const versionResult = await runCommand({ command: binaryPath, args: ['version'], timeoutMs: VERSION_TIMEOUT_MS });
  if (versionResult.ok) {
    return {
      ok: true,
      version: firstVersionLine(versionResult.stdout, versionResult.stderr)
    };
  }

  const fallbackResult = await runCommand({ command: binaryPath, args: ['--version'], timeoutMs: VERSION_TIMEOUT_MS });
  if (fallbackResult.ok) {
    return {
      ok: true,
      version: firstVersionLine(fallbackResult.stdout, fallbackResult.stderr)
    };
  }

  return {
    ok: false,
    version: null,
    detail:
      trimOutput(versionResult.stderr) ||
      trimOutput(versionResult.stdout) ||
      trimOutput(fallbackResult.stderr) ||
      trimOutput(fallbackResult.stdout) ||
      versionResult.error ||
      fallbackResult.error ||
      'Arduino CLI version check failed.'
  };
}

export async function resolveManagedArduinoCliBinary(): Promise<ManagedArduinoCliBinary> {
  const managedRoot = await getManagedRoot();
  const platformKey = getPlatformKey();
  const managedInstallRoot = path.join(managedRoot, 'managed', EXORT_MANAGED_ARDUINO_CLI_VERSION, platformKey);
  const managedBinaryPath = getManagedBinaryPath(managedRoot, platformKey);

  return {
    source: 'managed',
    binaryPath: managedBinaryPath,
    managedVersion: EXORT_MANAGED_ARDUINO_CLI_VERSION,
    managedRoot,
    platformKey,
    installRoot: managedInstallRoot
  };
}

export async function ensureManagedArduinoCliBinary(options: EnsureOptions = {}): Promise<ManagedArduinoCliBinary> {
  const log = options.log;
  const installIfMissing = options.installIfMissing === true;
  const resolved = await resolveManagedArduinoCliBinary();

  log?.(`arduino:binary:resolved path=${resolved.binaryPath} version=${resolved.managedVersion} source=${resolved.source}`);

  if (existsSync(resolved.binaryPath)) {
    await ensureArduinoCliExecutable(resolved.binaryPath);
    const version = await runArduinoCliVersionCommand(resolved.binaryPath);
    if (version.ok) {
      lastProvisionDiagnostics = null;
      return resolved;
    }

    if (!installIfMissing) {
      lastProvisionDiagnostics = `existing-binary: failed validation (${version.detail ?? 'version check failed'})`;
      throw new Error(`Managed Arduino CLI failed validation: ${version.detail ?? 'version check failed'}`);
    }
    log?.(`arduino:binary:existing:invalid detail=${version.detail ?? 'version check failed'}`);
  }

  if (!installIfMissing) {
    throw new Error('Arduino CLI is not installed. Open Settings > Requirements and install it.');
  }

  const { installArduinoCliFromReleaseAssets } = await import('./requirements/arduinoCliReleaseInstaller.js');
  const result = await installArduinoCliFromReleaseAssets({ log });
  if (!result.ok) {
    lastProvisionDiagnostics = result.message ?? 'release install failed';
    throw new Error(`Failed to provision managed Arduino CLI (${lastProvisionDiagnostics})`);
  }

  await mkdir(path.dirname(resolved.binaryPath), { recursive: true });
  await ensureArduinoCliExecutable(resolved.binaryPath);
  const version = await runArduinoCliVersionCommand(resolved.binaryPath);
  if (!version.ok) {
    lastProvisionDiagnostics = `version-check: ${version.detail ?? 'failed to read version'}`;
    throw new Error(`Managed Arduino CLI failed validation after install: ${version.detail ?? 'version check failed'}`);
  }

  lastProvisionDiagnostics = null;
  return resolved;
}

export async function getManagedArduinoCliStatus(): Promise<ManagedArduinoCliStatus> {
  const resolved = await resolveManagedArduinoCliBinary();

  if (!existsSync(resolved.binaryPath)) {
    return {
      installed: false,
      version: null,
      details: 'Managed Arduino CLI is not installed. Install it from Settings > Requirements.',
      provisionDiagnostics: lastProvisionDiagnostics ?? undefined,
      binaryPath: resolved.binaryPath,
      source: resolved.source,
      managedVersion: resolved.managedVersion
    };
  }

  await ensureArduinoCliExecutable(resolved.binaryPath);
  const version = await runArduinoCliVersionCommand(resolved.binaryPath);
  if (!version.ok) {
    const diagnostics = `version-check: ${version.detail ?? 'failed to read version'}`;
    lastProvisionDiagnostics = diagnostics;
    return {
      installed: false,
      version: null,
      details: version.detail ?? 'Failed to read Arduino CLI version.',
      provisionDiagnostics: diagnostics,
      binaryPath: resolved.binaryPath,
      source: resolved.source,
      managedVersion: resolved.managedVersion
    };
  }

  lastProvisionDiagnostics = null;
  return {
    installed: true,
    version: version.version,
    binaryPath: resolved.binaryPath,
    source: resolved.source,
    managedVersion: resolved.managedVersion
  };
}

export async function withArduinoCliRuntimeEnv(env: NodeJS.ProcessEnv = process.env): Promise<NodeJS.ProcessEnv> {
  const resolved = await resolveManagedArduinoCliBinary();
  return {
    ...env,
    [EXORT_ARDUINO_CLI_BINARY_ENV]: resolved.binaryPath
  };
}
