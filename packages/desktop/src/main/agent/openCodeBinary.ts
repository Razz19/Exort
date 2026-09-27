import { recoverInterruptedActivation } from './runtimeData.js';
import { readOpenCodeBinaryVersion } from './openCodeProbe.js';
import { existsSync } from 'node:fs';
import { copyFile, chmod, mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const EXORT_MANAGED_OPENCODE_VERSION = '2.0.14';
export const EXORT_MANAGED_OPENCODE_RELEASE_TAG = `v${EXORT_MANAGED_OPENCODE_VERSION}`;

const INSTALL_TIMEOUT_MS = 8 * 60 * 1000;
const EXORT_RUNTIME_APP_DIR = 'Exort';
const EXORT_RUNTIME_SEGMENTS = ['runtime', 'opencode'] as const;
let lastProvisionDiagnostics: string | null = null;

export type OpenCodeBinarySource = 'managed' | 'system';

export type ManagedOpenCodeBinary = {
  source: OpenCodeBinarySource;
  binaryPath: string;
  managedVersion: string;
  managedRoot: string;
  platformKey: string;
  installRoot: string;
};

export type ManagedOpenCodeStatus = {
  installed: boolean;
  version: string | null;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath: string;
  source: OpenCodeBinarySource;
  managedVersion: string;
};

type OpenCodeLog = (line: string) => void;

type VersionResult = {
  ok: boolean;
  version: string | null;
  detail?: string;
};

type InstallResult = {
  ok: boolean;
  detail?: string;
};

type RunCommandResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
};

type EnsureOptions = {
  log?: OpenCodeLog;
  installIfMissing?: boolean;
};

function getBinaryName(): string {
  if (process.platform === 'win32') return 'opencode.exe';
  return 'opencode';
}

function getPlatformKey(): string {
  return `${process.platform}-${process.arch}`;
}

function getManagedRootFromEnv(): string | null {
  const configured = process.env.EXORT_OPENCODE_RUNTIME_DIR?.trim();
  if (!configured) return null;
  return path.resolve(configured);
}

function allowSystemBinaryOverride(): boolean {
  return process.env.EXORT_ALLOW_SYSTEM_OPENCODE?.trim() === '1';
}

function allowLocalBinaryCopyFallback(): boolean {
  return process.env.EXORT_ALLOW_LOCAL_OPENCODE_COPY?.trim() === '1';
}

export async function getManagedRoot(): Promise<string> {
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

function getManagedBinaryPath(managedRoot: string, platformKey: string, version: string): string {
  return path.join(managedRoot, 'managed', version, platformKey, getBinaryName());
}

function quoteForShell(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function runCommand(params: {
  command: string;
  args?: string[];
  timeoutMs?: number;
  shell?: boolean;
}): Promise<RunCommandResult> {
  const args = params.args ?? [];
  const timeoutMs = params.timeoutMs ?? INSTALL_TIMEOUT_MS;
  const shell = params.shell === true;

  return new Promise((resolve) => {
    const proc = spawn(params.command, args, {
      shell,
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
      }, 5000).unref();
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

async function ensureExecutable(binaryPath: string): Promise<void> {
  if (process.platform === 'win32') return;
  await chmod(binaryPath, 0o755).catch(() => {
    // Best effort.
  });
}

async function resolveBinaryInPath(command: string): Promise<string | null> {
  if (process.platform === 'win32') {
    const result = await runCommand({ command: 'where', args: [command], timeoutMs: 5000 });
    if (!result.ok) return null;
    const first = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    return first ?? null;
  }

  const result = await runCommand({
    command: 'sh',
    args: ['-lc', `command -v ${quoteForShell(command)}`],
    timeoutMs: 5000
  });

  if (!result.ok) return null;
  return (
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null
  );
}

function getLocalBinaryCandidates(): string[] {
  const home = os.homedir();
  const candidates = new Set<string>();
  const envConfigured = process.env.EXORT_OPENCODE_LOCAL_BINARY?.trim();
  if (envConfigured) {
    candidates.add(path.resolve(envConfigured));
  }

  if (process.platform === 'win32') {
    candidates.add(path.join(home, '.opencode', 'bin', 'opencode.exe'));
    candidates.add(path.join(home, '.opencode', 'bin', 'opencode.cmd'));
    candidates.add(path.join(home, 'scoop', 'shims', 'opencode.exe'));
    candidates.add(path.join(home, 'scoop', 'shims', 'opencode.cmd'));
    const programData = process.env.ProgramData?.trim();
    if (programData) {
      candidates.add(path.join(programData, 'chocolatey', 'bin', 'opencode.exe'));
      candidates.add(path.join(programData, 'chocolatey', 'bin', 'opencode.cmd'));
    }
  } else {
    candidates.add(path.join(home, '.opencode', 'bin', 'opencode'));
    candidates.add(path.join(home, 'bin', 'opencode'));
    candidates.add(path.join(home, '.local', 'bin', 'opencode'));
    candidates.add('/opt/homebrew/bin/opencode');
    candidates.add('/usr/local/bin/opencode');
  }

  return [...candidates];
}

function isCopyCandidate(candidatePath: string): boolean {
  if (process.platform !== 'win32') return true;
  return !candidatePath.toLowerCase().endsWith('.cmd');
}

async function installFromLocalCopy(targetBinaryPath: string, expectedVersion: string): Promise<InstallResult> {
  const pathCandidate = await resolveBinaryInPath('opencode');
  const candidates = getLocalBinaryCandidates();
  if (pathCandidate) {
    candidates.unshift(pathCandidate);
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    if (!existsSync(resolved)) continue;
    if (!isCopyCandidate(resolved)) continue;

    try {
      const version = await runVersionCommand(resolved);
      if (!version.ok || version.version !== expectedVersion) continue;

      await mkdir(path.dirname(targetBinaryPath), { recursive: true });
      await copyFile(resolved, targetBinaryPath);
      await ensureExecutable(targetBinaryPath);

      const copiedVersion = await runVersionCommand(targetBinaryPath);
      if (!copiedVersion.ok || copiedVersion.version !== expectedVersion) {
        continue;
      }
      return { ok: true };
    } catch {
      // Continue with the next candidate.
    }
  }

  return {
    ok: false,
    detail: 'No usable local OpenCode binary was found to copy into the managed runtime.'
  };
}

async function runVersionCommand(binaryPath: string): Promise<VersionResult> {
  try { return { ok: true, version: await readOpenCodeBinaryVersion(binaryPath) }; }
  catch (error) { return { ok: false, version: null, detail: error instanceof Error ? error.message : 'Version check failed.' }; }
}

export function isSupportedOpenCodeVersion(value: unknown): value is string {
  return typeof value === 'string' && /^2\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) && value.split('.').every(part => Number.isSafeInteger(Number(part)));
}

let candidateVersion: string | undefined;
export function setCandidateOpenCodeVersion(version?: string): void {
  if (version !== undefined && !isSupportedOpenCodeVersion(version)) throw new Error('Unsupported OpenCode version.');
  candidateVersion = version;
}
export async function getActiveOpenCodeVersion(): Promise<string> {
  await recoverInterruptedActivation(await getManagedRoot());
  try {
    const stored = JSON.parse(await readFile(path.join(await getManagedRoot(), 'active-version.json'), 'utf8'));
    if (isSupportedOpenCodeVersion(stored.version)) return stored.version;
    throw new Error('Invalid managed OpenCode version.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EXORT_MANAGED_OPENCODE_VERSION;
    throw error;
  }
}
export async function activateOpenCodeVersion(version: string, transactionID?: string): Promise<void> {
  if (!isSupportedOpenCodeVersion(version)) throw new Error('Unsupported OpenCode version.');
  const root = await getManagedRoot();
  await mkdir(root, { recursive: true });
  const file = path.join(root, 'active-version.json');
  await writeFile(file + '.tmp', JSON.stringify({ version, transactionID }), { mode: 0o600 });
  await rename(file + '.tmp', file);
}

export async function resolveManagedOpenCodeBinary(versionOverride?: string): Promise<ManagedOpenCodeBinary> {
  const sourceOverride = process.env.EXORT_OPENCODE_BINARY?.trim();
  const managedRoot = await getManagedRoot();
  const platformKey = getPlatformKey();
  const version = versionOverride ?? candidateVersion ?? await getActiveOpenCodeVersion();
  if (!isSupportedOpenCodeVersion(version)) throw new Error('Unsupported OpenCode version.');
  const managedInstallRoot = path.join(managedRoot, 'managed', version, platformKey);
  const managedBinaryPath = getManagedBinaryPath(managedRoot, platformKey, version);

  if (sourceOverride && allowSystemBinaryOverride()) {
    return {
      source: 'system',
      binaryPath: path.resolve(sourceOverride),
      managedVersion: version,
      managedRoot,
      platformKey,
      installRoot: managedRoot
    };
  }

  if (existsSync(managedBinaryPath)) {
    return {
      source: 'managed',
      binaryPath: managedBinaryPath,
      managedVersion: version,
      managedRoot,
      platformKey,
      installRoot: managedInstallRoot
    };
  }

  return {
    source: 'managed',
    binaryPath: managedBinaryPath,
    managedVersion: version,
    managedRoot,
    platformKey,
    installRoot: managedInstallRoot
  };
}

export async function ensureManagedOpenCodeBinary(options: EnsureOptions = {}): Promise<ManagedOpenCodeBinary> {
  const log = options.log;
  const installIfMissing = options.installIfMissing === true;
  const resolved = await resolveManagedOpenCodeBinary();
  const attemptErrors: string[] = [];

  log?.(
    `runtime:binary:resolved path=${resolved.binaryPath} version=${resolved.managedVersion} source=${resolved.source}`
  );

  if (resolved.source === 'system') {
    if (!existsSync(resolved.binaryPath)) {
      lastProvisionDiagnostics = `system: missing configured binary at ${resolved.binaryPath}`;
      throw new Error(`Configured OpenCode binary is missing: ${resolved.binaryPath}`);
    }

    const version = await runVersionCommand(resolved.binaryPath);
    if (!version.ok || !isSupportedOpenCodeVersion(version.version)) {
      lastProvisionDiagnostics = `system: configured binary failed validation (${version.detail ?? 'version check failed'})`;
      throw new Error(`Configured OpenCode binary failed validation: ${version.detail ?? 'version check failed.'}`);
    }

    lastProvisionDiagnostics = null;
    return resolved;
  }

  if (existsSync(resolved.binaryPath)) {
    const version = await runVersionCommand(resolved.binaryPath);
    if (version.ok && version.version === resolved.managedVersion) {
      lastProvisionDiagnostics = null;
      return resolved;
    }

    if (!installIfMissing) {
      lastProvisionDiagnostics = `existing-binary: failed validation (${version.detail ?? 'version check failed'})`;
      throw new Error(
        `Managed Exort Agent runtime failed validation (${version.detail ?? 'version check failed'}). Open Settings > Requirements and install Exort Agent.`
      );
    }
    attemptErrors.push(`existing-binary: ${version.detail ?? 'version check failed'}`);
  }

  if (!installIfMissing) {
    throw new Error('OpenCode runtime is not installed. Open Settings > Requirements and install it!');
  }

  log?.(`runtime:binary:provision:start source=managed version=${resolved.managedVersion} target=${resolved.binaryPath}`);

  if (allowLocalBinaryCopyFallback()) {
    const localCopy = await installFromLocalCopy(resolved.binaryPath, resolved.managedVersion);
    if (localCopy.ok) {
      lastProvisionDiagnostics = null;
      log?.(`runtime:binary:provision:done source=managed method=copy target=${resolved.binaryPath}`);
      return resolved;
    }
    attemptErrors.push(`copy: ${localCopy.detail ?? 'failed'}`);
  } else {
    attemptErrors.push('copy: disabled (set EXORT_ALLOW_LOCAL_OPENCODE_COPY=1 to opt in)');
  }

  lastProvisionDiagnostics = attemptErrors.join('; ');
  throw new Error(`Failed to provision managed OpenCode runtime (${attemptErrors.join('; ')})`);
}

export async function getManagedOpenCodeStatus(): Promise<ManagedOpenCodeStatus> {
  const resolved = await resolveManagedOpenCodeBinary();

  if (!existsSync(resolved.binaryPath)) {
    if (resolved.source === 'managed') {
      const versions = await readdir(path.join(resolved.managedRoot, 'managed')).catch(() => []);
      const legacy = versions.filter(v => /^1\.\d+\.\d+$/.test(v)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of legacy) {
        const binaryPath = getManagedBinaryPath(resolved.managedRoot, resolved.platformKey, version);
        if (!existsSync(binaryPath)) continue;
        return { installed: false, version, binaryPath, source: 'managed', managedVersion: resolved.managedVersion,
          details: `OpenCode ${version} needs an upgrade to v2. Update from the notification or Settings > Requirements.` };
      }
    }
    const details =
      resolved.source === 'system'
        ? `Configured OpenCode binary is missing: ${resolved.binaryPath}`
        : `OpenCode v2 is required. Install or upgrade from Settings > Requirements.`;

    return {
      installed: false,
      version: null,
      details,
      provisionDiagnostics: lastProvisionDiagnostics ?? undefined,
      binaryPath: resolved.binaryPath,
      source: resolved.source,
      managedVersion: resolved.managedVersion
    };
  }

  const version = await runVersionCommand(resolved.binaryPath);
  if (!version.ok || (resolved.source === 'managed' ? version.version !== resolved.managedVersion : !isSupportedOpenCodeVersion(version.version))) {
    const detail = version.detail ?? `Expected OpenCode ${resolved.source === 'managed' ? resolved.managedVersion : 'stable 2.x'}; the binary reported ${version.version ?? 'no version'}.`;
    const diagnostics = `version-check: ${detail}`;
    lastProvisionDiagnostics = diagnostics;
    return {
      installed: false,
      version: null,
      details: detail,
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
