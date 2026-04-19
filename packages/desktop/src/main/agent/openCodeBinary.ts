import { existsSync } from 'node:fs';
import { copyFile, chmod, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const EXORTAI_MANAGED_OPENCODE_VERSION = '1.1.51';

const INSTALL_TIMEOUT_MS = 8 * 60 * 1000;
const EXORT_RUNTIME_APP_DIR = 'Exort';
const EXORT_RUNTIME_SEGMENTS = ['runtime', 'opencode'] as const;
const LEGACY_ELECTRON_APP_NAME_SEGMENTS = ['@exortai', 'desktop'] as const;
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

function getPlatformManagedDataRoot(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    return localAppData && localAppData.length > 0
      ? path.resolve(localAppData)
      : path.join(os.homedir(), 'AppData', 'Local');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  return xdgDataHome && xdgDataHome.length > 0 ? path.resolve(xdgDataHome) : path.join(os.homedir(), '.local', 'share');
}

function getLegacyElectronUserDataRoot(): string {
  if (process.platform === 'win32') {
    const roamingAppData = process.env.APPDATA?.trim();
    const appDataRoot =
      roamingAppData && roamingAppData.length > 0
        ? path.resolve(roamingAppData)
        : path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appDataRoot, ...LEGACY_ELECTRON_APP_NAME_SEGMENTS);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', ...LEGACY_ELECTRON_APP_NAME_SEGMENTS);
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
  const appDataRoot =
    xdgConfigHome && xdgConfigHome.length > 0 ? path.resolve(xdgConfigHome) : path.join(os.homedir(), '.config');
  return path.join(appDataRoot, ...LEGACY_ELECTRON_APP_NAME_SEGMENTS);
}

async function getManagedRoot(): Promise<string> {
  const fromEnv = getManagedRootFromEnv();
  if (fromEnv) return fromEnv;

  return path.join(getPlatformManagedDataRoot(), EXORT_RUNTIME_APP_DIR, ...EXORT_RUNTIME_SEGMENTS);
}

function getManagedBinaryPath(managedRoot: string, platformKey: string): string {
  return path.join(managedRoot, 'managed', EXORTAI_MANAGED_OPENCODE_VERSION, platformKey, getBinaryName());
}

function getLegacyManagedRoots(canonicalRoot: string): string[] {
  const candidates = new Set<string>();
  candidates.add(path.join(getLegacyElectronUserDataRoot(), ...EXORT_RUNTIME_SEGMENTS));
  candidates.add(path.join(os.homedir(), '.exortai', ...EXORT_RUNTIME_SEGMENTS));

  const canonical = path.resolve(canonicalRoot);
  return [...candidates].map((candidate) => path.resolve(candidate)).filter((candidate) => candidate !== canonical);
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

async function adoptLegacyManagedBinary(params: {
  canonicalRoot: string;
  platformKey: string;
  targetBinaryPath: string;
  log?: OpenCodeLog;
}): Promise<InstallResult> {
  const legacyRoots = getLegacyManagedRoots(params.canonicalRoot);

  for (const legacyRoot of legacyRoots) {
    const legacyBinaryPath = getManagedBinaryPath(legacyRoot, params.platformKey);
    if (!existsSync(legacyBinaryPath)) continue;

    try {
      const version = await runVersionCommand(legacyBinaryPath);
      if (!version.ok) continue;

      await mkdir(path.dirname(params.targetBinaryPath), { recursive: true });
      await copyFile(legacyBinaryPath, params.targetBinaryPath);
      await ensureExecutable(params.targetBinaryPath);

      const copiedVersion = await runVersionCommand(params.targetBinaryPath);
      if (!copiedVersion.ok) {
        continue;
      }

      params.log?.(`runtime:binary:migrate:legacy source=${legacyBinaryPath} target=${params.targetBinaryPath}`);
      return { ok: true };
    } catch {
      // Continue with the next legacy location.
    }
  }

  return {
    ok: false,
    detail: 'No usable legacy managed OpenCode binary was found to migrate into the canonical runtime directory.'
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
  const managedBinaryPath = getManagedBinaryPath(managedRoot, platformKey);

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
    throw new Error('OpenCode runtime is not installed. Open Settings > Requirements and install it!');
  }

  log?.(`runtime:binary:provision:start source=managed version=${resolved.managedVersion} target=${resolved.binaryPath}`);

  const migratedLegacy = await adoptLegacyManagedBinary({
    canonicalRoot: resolved.managedRoot,
    platformKey: resolved.platformKey,
    targetBinaryPath: resolved.binaryPath,
    log
  });
  if (migratedLegacy.ok) {
    lastProvisionDiagnostics = null;
    return resolved;
  }
  attemptErrors.push(`legacy-migrate: ${migratedLegacy.detail ?? 'failed'}`);

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

  if (resolved.source === 'managed' && !existsSync(resolved.binaryPath)) {
    await adoptLegacyManagedBinary({
      canonicalRoot: resolved.managedRoot,
      platformKey: resolved.platformKey,
      targetBinaryPath: resolved.binaryPath
    });
  }

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
