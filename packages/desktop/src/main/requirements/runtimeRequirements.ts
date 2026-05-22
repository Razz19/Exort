import {
  EXORT_MANAGED_OPENCODE_RELEASE_TAG,
  ensureManagedOpenCodeBinary,
  getManagedOpenCodeStatus,
  type OpenCodeBinarySource
} from '../agent/openCodeBinary.js';
import { ensureOpenCodeIsolation, getOpenCodeIsolationStatus } from '../agent/openCodeIsolation.js';
import {
  EXORT_MANAGED_ARDUINO_CLI_RELEASE_TAG,
  EXORT_MANAGED_ARDUINO_CLI_VERSION,
  ensureManagedArduinoCliBinary,
  getManagedArduinoCliStatus,
  type ArduinoCliBinarySource
} from '../arduinoCliBinary.js';
import { resolveArduinoCliReleaseAssetForCurrentTarget } from './arduinoCliReleaseInstaller.js';
import { installOpenCodeFromReleaseAssets, resolveOpenCodeReleaseAssetForCurrentTarget } from './opencodeReleaseInstaller.js';

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
  source?: OpenCodeBinarySource | ArduinoCliBinarySource;
  managedVersion?: string;
  runtimeDataRoot?: string;
  runtimeConfigRoot?: string;
  runtimeStateRoot?: string;
  isolated?: boolean;
  releaseTargetKey?: string;
  releaseArchiveName?: string;
  releaseArchiveSha256?: string;
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

const REQUIREMENT_ORDER: RequirementId[] = ['opencode', 'arduino-cli'];

function detectOs(): OSKind {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function isRequirementId(value: string): value is RequirementId {
  return value === 'opencode' || value === 'arduino-cli';
}

function getRequirementLabel(id: RequirementId): string {
  if (id === 'opencode') return 'OpenCode';
  return 'Arduino CLI';
}

function getManualCommands(id: RequirementId, os: OSKind): string[] {
  if (id === 'opencode') {
    return [
      `Download the pinned OpenCode release from https://github.com/anomalyco/opencode/releases/tag/${EXORT_MANAGED_OPENCODE_RELEASE_TAG}`,
      'Set EXORT_OPENCODE_BINARY to the downloaded binary and EXORT_ALLOW_SYSTEM_OPENCODE=1 before launching Exort'
    ];
  }

  if (os === 'windows') {
    return [
      `Download arduino-cli_${EXORT_MANAGED_ARDUINO_CLI_VERSION}_Windows_64bit.zip from https://github.com/arduino/arduino-cli/releases/tag/${EXORT_MANAGED_ARDUINO_CLI_RELEASE_TAG}`,
      'winget install --id ArduinoSA.CLI -e --accept-package-agreements --accept-source-agreements',
      'choco install arduino-cli',
      'scoop install arduino-cli'
    ];
  }

  return [
    `Download the Arduino CLI ${EXORT_MANAGED_ARDUINO_CLI_VERSION} archive for your platform from https://github.com/arduino/arduino-cli/releases/tag/${EXORT_MANAGED_ARDUINO_CLI_RELEASE_TAG}`,
    'brew install arduino-cli',
    'curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=$HOME/.local/bin sh'
  ];
}

async function getVersion(id: RequirementId): Promise<{
  ok: boolean;
  version: string | null;
  details?: string;
  provisionDiagnostics?: string;
  binaryPath?: string;
  source?: OpenCodeBinarySource | ArduinoCliBinarySource;
  managedVersion?: string;
  runtimeDataRoot?: string;
  runtimeConfigRoot?: string;
  runtimeStateRoot?: string;
  isolated?: boolean;
  releaseTargetKey?: string;
  releaseArchiveName?: string;
  releaseArchiveSha256?: string;
}> {
  if (id === 'opencode') {
    const [status, isolation, releaseAsset] = await Promise.all([
      getManagedOpenCodeStatus(),
      getOpenCodeIsolationStatus(),
      resolveOpenCodeReleaseAssetForCurrentTarget().catch(() => null)
    ]);
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
      isolated: isolation.isolated,
      releaseTargetKey: releaseAsset?.targetKey,
      releaseArchiveName: releaseAsset?.archiveName,
      releaseArchiveSha256: releaseAsset?.sha256
    };
  }

  if (id === 'arduino-cli') {
    const [status, releaseAsset] = await Promise.all([
      getManagedArduinoCliStatus(),
      Promise.resolve().then(() => resolveArduinoCliReleaseAssetForCurrentTarget()).catch(() => null)
    ]);
    return {
      ok: status.installed,
      version: status.version,
      details: status.details,
      provisionDiagnostics: status.provisionDiagnostics,
      binaryPath: status.binaryPath,
      source: status.source,
      managedVersion: status.managedVersion,
      releaseTargetKey: releaseAsset?.targetKey,
      releaseArchiveName: releaseAsset?.archiveName,
      releaseArchiveSha256: releaseAsset?.sha256
    };
  }

  throw new Error(`Unsupported requirement id: ${id}`);
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
      isolated: result.isolated,
      releaseTargetKey: result.releaseTargetKey,
      releaseArchiveName: result.releaseArchiveName,
      releaseArchiveSha256: result.releaseArchiveSha256
    });
  }

  return entries;
}

export async function installRequirement(id: RequirementId): Promise<RequirementInstallResult> {
  const os = detectOs();
  const logs: string[] = [];
  const manualCommands = getManualCommands(id, os);

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
      lastFailureMessage = `Release URL install failed: ${releaseMessage}`;
    }
  }

  if (id === 'arduino-cli') {
    attemptedStrategyId = 'release-url';
    try {
      await ensureManagedArduinoCliBinary({
        installIfMissing: true,
        log: (line) => {
          logs.push(`[runtime] ${line}`);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to provision Arduino CLI.';
      logs.push(`[runtime:error] ${message}`);
      return {
        id,
        ok: false,
        installedAfter: false,
        versionAfter: null,
        strategyTried: attemptedStrategyId,
        message,
        manualCommands,
        logs
      };
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

    return {
      id,
      ok: false,
      installedAfter: false,
      versionAfter: null,
      strategyTried: attemptedStrategyId,
      message: `Managed Arduino CLI install finished, but validation failed: ${validated.details ?? 'version check failed'}`,
      manualCommands,
      logs
    };
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
