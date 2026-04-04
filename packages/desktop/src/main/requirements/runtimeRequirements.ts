import { spawn } from 'node:child_process';

import {
  ensureManagedOpenCodeBinary,
  getManagedOpenCodeStatus,
  type OpenCodeBinarySource
} from '../agent/openCodeBinary.js';
import { ensureOpenCodeIsolation, getOpenCodeIsolationStatus } from '../agent/openCodeIsolation.js';
import { installOpenCodeFromReleaseAssets } from './opencodeReleaseInstaller.js';

export type RequirementId = 'opencode' | 'arduino-cli';

export type RequirementStatus = {
  id: RequirementId;
  label: string;
  installed: boolean;
  version: string | null;
  checkedAt: string;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath?: string;
  source?: OpenCodeBinarySource;
  managedVersion?: string;
  runtimeDataRoot?: string;
  runtimeConfigRoot?: string;
  runtimeStateRoot?: string;
  isolated?: boolean;
};

export type RequirementInstallResult = {
  id: RequirementId;
  ok: boolean;
  installedAfter: boolean;
  versionAfter: string | null;
  strategyTried: string | null;
  message: string;
  manualCommands: string[];
  logs: string[];
};

type OSKind = 'macos' | 'linux' | 'windows';

type InstallStrategy = {
  id: string;
  command: string;
  args: string[];
  requires: string[];
  shell?: boolean;
};

type RunCommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut: boolean;
};

const REQUIREMENT_ORDER: RequirementId[] = ['opencode', 'arduino-cli'];
const INSTALL_TIMEOUT_MS = 8 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10_000;

function isWindows(): boolean {
  return process.platform === 'win32';
}

function detectOs(): OSKind {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function quoteForShell(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isRequirementId(value: string): value is RequirementId {
  return value === 'opencode' || value === 'arduino-cli';
}

function getRequirementLabel(id: RequirementId): string {
  if (id === 'opencode') return 'OpenCode';
  return 'Arduino CLI';
}

function getRequirementBinary(id: RequirementId): string {
  if (id === 'opencode') return 'exort-managed-opencode';
  return 'arduino-cli';
}

function trimOutput(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function firstOutputLine(stdout: string, stderr: string): string | null {
  const merged = trimOutput(stdout) || trimOutput(stderr);
  const first = merged.split(/\r?\n/).find((line) => line.trim().length > 0);
  return first?.trim() ?? null;
}

function formatCommand(command: string, args: string[], shell = false): string {
  if (shell) {
    return [command, ...args].join(' ').trim();
  }

  if (isWindows()) {
    return [command, ...args.map((value) => (value.includes(' ') ? `"${value}"` : value))].join(' ');
  }

  return [command, ...args.map(quoteForShell)].join(' ');
}

async function runCommand(params: {
  command: string;
  args?: string[];
  shell?: boolean;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}): Promise<RunCommandResult> {
  const args = params.args ?? [];
  const shell = params.shell === true;
  const timeoutMs = params.timeoutMs ?? CHECK_TIMEOUT_MS;
  const rendered = formatCommand(params.command, args, shell);

  return new Promise((resolve) => {
    const proc = spawn(params.command, args, {
      shell,
      env: params.env,
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
        command: rendered,
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
        command: rendered,
        exitCode: code,
        stdout,
        stderr,
        timedOut
      });
    });
  });
}

async function commandExists(command: string): Promise<boolean> {
  if (isWindows()) {
    const result = await runCommand({ command: 'where', args: [command], timeoutMs: CHECK_TIMEOUT_MS });
    return result.ok;
  }

  const result = await runCommand({
    command: 'sh',
    args: ['-lc', `command -v ${quoteForShell(command)}`],
    timeoutMs: CHECK_TIMEOUT_MS
  });

  return result.ok;
}

function classifyFailure(output: string): 'permission' | 'other' {
  const normalized = output.toLowerCase();
  const permissionSignals = [
    'permission denied',
    'access denied',
    'requires administrator',
    'admin privileges',
    'not permitted',
    'operation not permitted',
    'requires elevated',
    'sudo',
    'administrator privileges',
    'uac'
  ];

  if (permissionSignals.some((signal) => normalized.includes(signal))) {
    return 'permission';
  }

  return 'other';
}

const OPENCODE_AUTO_STRATEGIES: Record<OSKind, InstallStrategy[]> = {
  macos: [
    {
      id: 'npm-global',
      command: 'npm',
      args: ['i', '-g', 'opencode-ai@latest'],
      requires: ['npm']
    },
    {
      id: 'brew-tap',
      command: 'brew',
      args: ['install', 'anomalyco/tap/opencode'],
      requires: ['brew']
    },
    {
      id: 'brew-formula',
      command: 'brew',
      args: ['install', 'opencode'],
      requires: ['brew']
    }
  ],
  linux: [
    {
      id: 'npm-global',
      command: 'npm',
      args: ['i', '-g', 'opencode-ai@latest'],
      requires: ['npm']
    },
    {
      id: 'brew-tap',
      command: 'brew',
      args: ['install', 'anomalyco/tap/opencode'],
      requires: ['brew']
    },
    {
      id: 'brew-formula',
      command: 'brew',
      args: ['install', 'opencode'],
      requires: ['brew']
    }
  ],
  windows: [
    {
      id: 'npm-global',
      command: 'npm.cmd',
      args: ['i', '-g', 'opencode-ai@latest'],
      requires: ['npm']
    },
    {
      id: 'scoop',
      command: 'scoop',
      args: ['install', 'opencode'],
      requires: ['scoop']
    },
    {
      id: 'choco',
      command: 'choco',
      args: ['install', 'opencode', '-y'],
      requires: ['choco']
    }
  ]
};

function getManualCommands(id: RequirementId, os: OSKind): string[] {
  if (id === 'opencode') {
    return [];
  }

  if (os === 'windows') {
    return [
      'winget install --id ArduinoSA.CLI -e --accept-package-agreements --accept-source-agreements',
      'choco install arduino-cli',
      'scoop install arduino-cli'
    ];
  }

  return [
    'brew install arduino-cli',
    'curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=$HOME/.local/bin sh'
  ];
}

function getInstallStrategies(id: RequirementId, os: OSKind): InstallStrategy[] {
  if (id === 'opencode') {
    return OPENCODE_AUTO_STRATEGIES[os].map((strategy) => ({
      ...strategy,
      args: [...strategy.args],
      requires: [...strategy.requires]
    }));
  }

  if (os === 'windows') {
    return [
      {
        id: 'winget',
        command: 'winget',
        args: ['install', '--id', 'ArduinoSA.CLI', '-e', '--accept-package-agreements', '--accept-source-agreements'],
        requires: ['winget']
      },
      {
        id: 'choco',
        command: 'choco',
        args: ['install', 'arduino-cli', '-y'],
        requires: ['choco']
      },
      {
        id: 'scoop',
        command: 'scoop',
        args: ['install', 'arduino-cli'],
        requires: ['scoop']
      }
    ];
  }

  return [
    {
      id: 'brew',
      command: 'brew',
      args: ['install', 'arduino-cli'],
      requires: ['brew']
    },
    {
      id: 'official-installer',
      command: 'sh',
      args: ['-lc', 'curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=$HOME/.local/bin sh'],
      requires: ['sh', 'curl']
    }
  ];
}

async function getVersion(id: RequirementId): Promise<{
  ok: boolean;
  version: string | null;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath?: string;
  source?: OpenCodeBinarySource;
  managedVersion?: string;
  runtimeDataRoot?: string;
  runtimeConfigRoot?: string;
  runtimeStateRoot?: string;
  isolated?: boolean;
}> {
  if (id === 'opencode') {
    const [status, isolation] = await Promise.all([getManagedOpenCodeStatus(), getOpenCodeIsolationStatus()]);
    const details = [status.details, isolation.isolated ? undefined : `Runtime isolation unavailable: ${isolation.details ?? 'Unknown error'}`]
      .filter((item): item is string => Boolean(item && item.trim().length > 0))
      .join(' ');

    return {
      ok: status.installed && isolation.isolated,
      version: status.version,
      details: details || undefined,
      provisionDiagnostics: status.provisionDiagnostics,
      binaryPath: status.binaryPath,
      source: status.source,
      managedVersion: status.managedVersion,
      runtimeDataRoot: isolation.runtimeDataRoot,
      runtimeConfigRoot: isolation.runtimeConfigRoot,
      runtimeStateRoot: isolation.runtimeStateRoot,
      isolated: isolation.isolated
    };
  }

  const binary = getRequirementBinary(id);

  if (!(await commandExists(binary))) {
    return {
      ok: false,
      version: null,
      details: `${binary} not found in PATH.`
    };
  }

  const versionResult = await runCommand({ command: binary, args: ['version'], timeoutMs: CHECK_TIMEOUT_MS });
  if (versionResult.ok) {
    return {
      ok: true,
      version: firstOutputLine(versionResult.stdout, versionResult.stderr)
    };
  }

  const fallbackResult = await runCommand({ command: binary, args: ['--version'], timeoutMs: CHECK_TIMEOUT_MS });
  if (fallbackResult.ok) {
    return {
      ok: true,
      version: firstOutputLine(fallbackResult.stdout, fallbackResult.stderr)
    };
  }

  return {
    ok: false,
    version: null,
    details:
      trimOutput(versionResult.stderr) ||
      trimOutput(versionResult.stdout) ||
      trimOutput(fallbackResult.stderr) ||
      trimOutput(fallbackResult.stdout) ||
      `Failed to run ${binary} version commands.`
  };
}

export async function getRequirementsStatus(): Promise<RequirementStatus[]> {
  const checkedAt = new Date().toISOString();
  const entries: RequirementStatus[] = [];

  for (const id of REQUIREMENT_ORDER) {
    const result = await getVersion(id);
    entries.push({
      id,
      label: getRequirementLabel(id),
      installed: result.ok,
      version: result.version,
      checkedAt,
      details: result.details,
      provisionDiagnostics: result.provisionDiagnostics,
      binaryPath: result.binaryPath,
      source: result.source,
      managedVersion: result.managedVersion,
      runtimeDataRoot: result.runtimeDataRoot,
      runtimeConfigRoot: result.runtimeConfigRoot,
      runtimeStateRoot: result.runtimeStateRoot,
      isolated: result.isolated
    });
  }

  return entries;
}

export async function installRequirement(id: RequirementId): Promise<RequirementInstallResult> {
  const os = detectOs();
  const logs: string[] = [];
  const manualCommands = getManualCommands(id, os);
  const strategies = getInstallStrategies(id, os);

  let attemptedStrategyId: string | null = null;
  let lastFailureMessage = 'No install strategy was executed.';

  if (id === 'opencode') {
    const releaseResult = await installOpenCodeFromReleaseAssets({
      log: (line) => {
        logs.push(`[runtime] ${line}`);
      }
    });

    if (releaseResult.ok) {
      attemptedStrategyId = 'release-url';
      try {
        await ensureManagedOpenCodeBinary({
          installIfMissing: true,
          log: (line) => {
            logs.push(`[runtime] ${line}`);
          }
        });
        const isolation = await ensureOpenCodeIsolation();
        logs.push(`[runtime] runtime:isolation:enabled root=${isolation.root}`);
        logs.push(
          `[runtime] runtime:isolation:paths config=${isolation.runtimeConfigRoot} data=${isolation.runtimeDataRoot} state=${isolation.runtimeStateRoot}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to provision OpenCode runtime.';
        logs.push(`[runtime:error] ${message}`);
        lastFailureMessage = `Release URL install succeeded, but managed provisioning failed: ${message}`;
      }

      const validated = await getVersion(id);
      if (validated.ok) {
        return {
          id,
          ok: true,
          installedAfter: true,
          versionAfter: validated.version,
          strategyTried: attemptedStrategyId,
          message: `${getRequirementLabel(id)} installed successfully.`,
          manualCommands,
          logs
        };
      }

      lastFailureMessage = `Release URL install finished, but validation failed: ${validated.details ?? 'version check failed'}`;
    } else {
      const releaseMessage = releaseResult.message ?? 'Unknown release installer error.';
      logs.push(`[runtime] runtime:binary:provision:release:error message=${releaseMessage}`);
      logs.push('[runtime] runtime:binary:provision:release:fallback-next');
      lastFailureMessage = `Release URL install failed: ${releaseMessage}`;
    }
  }

  for (const strategy of strategies) {
    const missingDependencies: string[] = [];

    for (const dependency of strategy.requires) {
      if (!(await commandExists(dependency))) {
        missingDependencies.push(dependency);
      }
    }

    if (missingDependencies.length > 0) {
      logs.push(
        `[skip] strategy=${strategy.id} missing=${missingDependencies.join(', ')} command=${formatCommand(
          strategy.command,
          strategy.args,
          strategy.shell
        )}`
      );
      continue;
    }

    attemptedStrategyId = strategy.id;
    const result = await runCommand({
      command: strategy.command,
      args: strategy.args,
      shell: strategy.shell,
      timeoutMs: INSTALL_TIMEOUT_MS
    });

    logs.push(`[run] strategy=${strategy.id} command=${result.command}`);
    if (result.stdout.trim().length > 0) {
      logs.push(`[stdout:${strategy.id}] ${trimOutput(result.stdout)}`);
    }
    if (result.stderr.trim().length > 0) {
      logs.push(`[stderr:${strategy.id}] ${trimOutput(result.stderr)}`);
    }

    if (result.timedOut) {
      return {
        id,
        ok: false,
        installedAfter: false,
        versionAfter: null,
        strategyTried: attemptedStrategyId,
        message: `Install timed out while running strategy "${strategy.id}".`,
        manualCommands,
        logs
      };
    }

    if (!result.ok) {
      const output = `${result.stdout}\n${result.stderr}\n${result.error ?? ''}`;
      const failureType = classifyFailure(output);
      const detail = trimOutput(result.stderr) || trimOutput(result.stdout) || result.error || `Exit code ${result.exitCode ?? 'unknown'}.`;
      lastFailureMessage = `Strategy "${strategy.id}" failed: ${detail}`;

      if (failureType === 'permission') {
        const permissionMessage =
          manualCommands.length > 0
            ? `Install requires elevated permissions. Run one of the manual commands in a privileged terminal.`
            : `Install requires elevated permissions. Retry from an elevated terminal.`;
        return {
          id,
          ok: false,
          installedAfter: false,
          versionAfter: null,
          strategyTried: attemptedStrategyId,
          message: permissionMessage,
          manualCommands,
          logs
        };
      }

      continue;
    }

    if (id === 'opencode') {
      try {
        await ensureManagedOpenCodeBinary({
          installIfMissing: true,
          log: (line) => {
            logs.push(`[runtime] ${line}`);
          }
        });
        const isolation = await ensureOpenCodeIsolation();
        logs.push(`[runtime] runtime:isolation:enabled root=${isolation.root}`);
        logs.push(
          `[runtime] runtime:isolation:paths config=${isolation.runtimeConfigRoot} data=${isolation.runtimeDataRoot} state=${isolation.runtimeStateRoot}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to provision OpenCode runtime.';
        logs.push(`[runtime:error] ${message}`);
        lastFailureMessage = `Strategy "${strategy.id}" finished, but managed provisioning failed: ${message}`;
        continue;
      }
    }

    const validated = await getVersion(id);
    if (validated.ok) {
      return {
        id,
        ok: true,
        installedAfter: true,
        versionAfter: validated.version,
        strategyTried: attemptedStrategyId,
        message: `${getRequirementLabel(id)} installed successfully.`,
        manualCommands,
        logs
      };
    }

    lastFailureMessage = `Strategy "${strategy.id}" finished, but validation failed: ${validated.details ?? 'version check failed'}`;
  }

  const finalStatus = await getVersion(id);
  if (finalStatus.ok) {
    return {
      id,
      ok: true,
      installedAfter: true,
      versionAfter: finalStatus.version,
      strategyTried: attemptedStrategyId,
      message: `${getRequirementLabel(id)} is installed.`,
      manualCommands,
      logs
    };
  }

  return {
    id,
    ok: false,
    installedAfter: false,
    versionAfter: null,
    strategyTried: attemptedStrategyId,
    message: lastFailureMessage,
    manualCommands,
    logs
  };
}

export async function installRequirements(ids: RequirementId[]): Promise<RequirementInstallResult[]> {
  const unique = Array.from(new Set(ids)).filter((id): id is RequirementId => isRequirementId(id));
  const results: RequirementInstallResult[] = [];

  for (const id of unique) {
    results.push(await installRequirement(id));
  }

  return results;
}

export { isRequirementId };
