import { existsSync } from 'node:fs';
import { copyFile, chmod, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const EXORTAI_MANAGED_OPENCODE_VERSION = '1.1.51';

const INSTALL_TIMEOUT_MS = 8 * 60 * 1000;
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
  const configured = process.env.EXORTAI_OPENCODE_RUNTIME_DIR?.trim();
  if (!configured) return null;
  return path.resolve(configured);
}

function allowSystemBinaryOverride(): boolean {
  return process.env.EXORTAI_ALLOW_SYSTEM_OPENCODE?.trim() === '1';
}

async function getElectronUserDataDir(): Promise<string | null> {
  try {
    const electronModule = (await import('electron')) as {
      app?: {
        isReady?: () => boolean;
        getPath?: (name: string) => string;
      };
    };

    const app = electronModule.app;
    if (!app || typeof app.isReady !== 'function' || typeof app.getPath !== 'function') {
      return null;
    }

    if (!app.isReady()) {
      return null;
    }

    const userData = app.getPath('userData');
    if (!userData || !userData.trim()) return null;
    return userData;
  } catch {
    return null;
  }
}

async function getManagedRoot(): Promise<string> {
  const fromEnv = getManagedRootFromEnv();
  if (fromEnv) return fromEnv;

  const userData = await getElectronUserDataDir();
  if (userData) {
    return path.join(userData, 'runtime', 'opencode');
  }

  return path.join(os.homedir(), '.exortai', 'runtime', 'opencode');
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
  const envConfigured = process.env.EXORTAI_OPENCODE_LOCAL_BINARY?.trim();
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

async function installFromLocalCopy(targetBinaryPath: string): Promise<InstallResult> {
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
      if (!version.ok) continue;

      await mkdir(path.dirname(targetBinaryPath), { recursive: true });
      await copyFile(resolved, targetBinaryPath);
      await ensureExecutable(targetBinaryPath);

      const copiedVersion = await runVersionCommand(targetBinaryPath);
      if (!copiedVersion.ok) {
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
  return new Promise((resolve) => {
    const proc = spawn(binaryPath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const settle = (result: VersionResult) => {
      if (settled) return;
      settled = true;
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
        version: null,
        detail: error.message
      });
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = `${stderr}`.trim() || `${stdout}`.trim() || `Exit code ${code ?? 'unknown'}.`;
        settle({
          ok: false,
          version: null,
          detail
        });
        return;
      }

      const firstLine = `${stdout}`
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      settle({
        ok: true,
        version: firstLine ?? null
      });
    });
  });
}

export async function resolveManagedOpenCodeBinary(): Promise<ManagedOpenCodeBinary> {
  const sourceOverride = process.env.EXORTAI_OPENCODE_BINARY?.trim();
  const managedRoot = await getManagedRoot();
  const platformKey = getPlatformKey();
  const managedInstallRoot = path.join(managedRoot, 'managed', EXORTAI_MANAGED_OPENCODE_VERSION, platformKey);
  const managedBinaryPath = path.join(managedInstallRoot, getBinaryName());

  if (sourceOverride && allowSystemBinaryOverride()) {
    return {
      source: 'system',
      binaryPath: path.resolve(sourceOverride),
      managedVersion: EXORTAI_MANAGED_OPENCODE_VERSION,
      managedRoot,
      platformKey,
      installRoot: managedRoot
    };
  }

  if (existsSync(managedBinaryPath)) {
    return {
      source: 'managed',
      binaryPath: managedBinaryPath,
      managedVersion: EXORTAI_MANAGED_OPENCODE_VERSION,
      managedRoot,
      platformKey,
      installRoot: managedInstallRoot
    };
  }

  return {
    source: 'managed',
    binaryPath: managedBinaryPath,
    managedVersion: EXORTAI_MANAGED_OPENCODE_VERSION,
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
    if (!version.ok) {
      lastProvisionDiagnostics = `system: configured binary failed validation (${version.detail ?? 'version check failed'})`;
      throw new Error(`Configured OpenCode binary failed validation: ${version.detail ?? 'version check failed.'}`);
    }

    lastProvisionDiagnostics = null;
    return resolved;
  }

  if (existsSync(resolved.binaryPath)) {
    const version = await runVersionCommand(resolved.binaryPath);
    if (version.ok) {
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
    throw new Error('Managed Exort Agent runtime is not installed. Open Settings > Requirements and install Exort Agent.');
  }

  log?.(`runtime:binary:provision:start source=managed version=${resolved.managedVersion} target=${resolved.binaryPath}`);

  const localCopy = await installFromLocalCopy(resolved.binaryPath);
  if (localCopy.ok) {
    lastProvisionDiagnostics = null;
    log?.(`runtime:binary:provision:done source=managed method=copy target=${resolved.binaryPath}`);
    return resolved;
  }
  attemptErrors.push(`copy: ${localCopy.detail ?? 'failed'}`);

  lastProvisionDiagnostics = attemptErrors.join('; ');
  throw new Error(`Failed to provision managed OpenCode runtime (${attemptErrors.join('; ')})`);
}

export async function getManagedOpenCodeStatus(): Promise<ManagedOpenCodeStatus> {
  const resolved = await resolveManagedOpenCodeBinary();

  if (!existsSync(resolved.binaryPath)) {
    const details =
      resolved.source === 'system'
        ? `Configured OpenCode binary is missing: ${resolved.binaryPath}`
        : `Managed Exort Agent runtime is not installed. Install from Settings > Requirements and run one of the OpenCode manual install commands.`;

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
  if (!version.ok) {
    const diagnostics = `version-check: ${version.detail ?? 'failed to read version'}`;
    lastProvisionDiagnostics = diagnostics;
    return {
      installed: false,
      version: null,
      details: version.detail ?? 'Failed to read OpenCode version.',
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
