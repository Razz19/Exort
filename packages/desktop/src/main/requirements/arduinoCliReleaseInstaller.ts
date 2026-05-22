import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  EXORT_MANAGED_ARDUINO_CLI_RELEASE_TAG,
  ensureArduinoCliExecutable,
  resolveManagedArduinoCliBinary,
  runArduinoCliVersionCommand
} from '../arduinoCliBinary.js';
import releaseAssets from './arduinoCliReleaseAssets.json';

type ArchiveType = 'zip' | 'tar.gz';

type ReleaseAssetEntry = {
  archiveName: string;
  archiveType: ArchiveType;
  binaryName: string;
  sha256: string;
};

type ReleaseAssetMap = Record<string, ReleaseAssetEntry>;

type RunCommandResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
};

export type ArduinoCliReleaseInstallResult = {
  ok: boolean;
  targetKey?: string;
  url?: string;
  archiveType?: ArchiveType;
  binaryPath?: string;
  message?: string;
};

export type ArduinoCliReleaseAssetDetails = ReleaseAssetEntry & {
  targetKey: string;
  url: string;
};

export type ArduinoCliPlatformInput = {
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
};

const RELEASE_ASSETS: ReleaseAssetMap = releaseAssets as ReleaseAssetMap;
const COMMAND_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 8 * 60 * 1000;
const ARDUINO_CLI_RELEASE_BASE_URL = 'https://github.com/arduino/arduino-cli/releases/download';

export function resolveArduinoCliReleaseTargetKey(input: ArduinoCliPlatformInput = process): string {
  if (input.platform === 'darwin') {
    if (input.arch === 'arm64') return 'darwin-arm64';
    if (input.arch === 'x64') return 'darwin-x64';
    throw new Error(`Unsupported macOS architecture for Arduino CLI: ${input.arch}`);
  }

  if (input.platform === 'win32') {
    if (input.arch === 'x64') return 'windows-x64';
    throw new Error(`Unsupported Windows architecture for Arduino CLI: ${input.arch}`);
  }

  if (input.platform === 'linux') {
    if (input.arch === 'arm64') return 'linux-arm64';
    if (input.arch === 'x64') return 'linux-x64';
    throw new Error(`Unsupported Linux architecture for Arduino CLI: ${input.arch}`);
  }

  throw new Error(`Unsupported platform for Arduino CLI: ${input.platform}`);
}

function buildReleaseUrl(asset: ReleaseAssetEntry): string {
  return `${ARDUINO_CLI_RELEASE_BASE_URL}/${EXORT_MANAGED_ARDUINO_CLI_RELEASE_TAG}/${asset.archiveName}`;
}

export function resolveArduinoCliReleaseAssetForCurrentTarget(
  input: ArduinoCliPlatformInput = process
): ArduinoCliReleaseAssetDetails {
  const targetKey = resolveArduinoCliReleaseTargetKey(input);
  const asset = RELEASE_ASSETS[targetKey];
  if (!asset) {
    throw new Error(`No Arduino CLI release asset is configured for target ${targetKey}.`);
  }

  return {
    ...asset,
    targetKey,
    url: buildReleaseUrl(asset)
  };
}

function trimOutput(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`Operation timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function runCommand(params: {
  command: string;
  args?: string[];
  timeoutMs?: number;
}): Promise<RunCommandResult> {
  const args = params.args ?? [];
  const timeoutMs = params.timeoutMs ?? COMMAND_TIMEOUT_MS;

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

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const controller = new AbortController();
  const response = await withTimeout(
    fetch(url, {
      signal: controller.signal,
      redirect: 'follow'
    }),
    DOWNLOAD_TIMEOUT_MS,
    () => controller.abort()
  );

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}.`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(destinationPath, data);
}

function normalizeSha256(value: string): string {
  return value.trim().toLowerCase().replace(/^sha256:/, '');
}

async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

function buildArchivePath(tempRoot: string, archiveType: ArchiveType): string {
  return path.join(tempRoot, archiveType === 'zip' ? 'arduino-cli-release.zip' : 'arduino-cli-release.tar.gz');
}

async function extractArchive(params: {
  archivePath: string;
  archiveType: ArchiveType;
  extractDir: string;
}): Promise<void> {
  const { archivePath, archiveType, extractDir } = params;
  await mkdir(extractDir, { recursive: true });

  if (archiveType === 'zip') {
    if (process.platform === 'win32') {
      const psCommand = `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`;
      const result = await runCommand({
        command: 'powershell.exe',
        args: ['-NoProfile', '-Command', psCommand],
        timeoutMs: COMMAND_TIMEOUT_MS
      });
      if (!result.ok) {
        const detail = trimOutput(result.stderr) || trimOutput(result.stdout) || result.error || 'Expand-Archive failed.';
        throw new Error(detail);
      }
      return;
    }

    const result = await runCommand({
      command: 'unzip',
      args: ['-o', archivePath, '-d', extractDir],
      timeoutMs: COMMAND_TIMEOUT_MS
    });
    if (!result.ok) {
      const detail = trimOutput(result.stderr) || trimOutput(result.stdout) || result.error || 'unzip failed.';
      throw new Error(detail);
    }
    return;
  }

  const result = await runCommand({
    command: 'tar',
    args: ['-xzf', archivePath, '-C', extractDir],
    timeoutMs: COMMAND_TIMEOUT_MS
  });
  if (!result.ok) {
    const detail = trimOutput(result.stderr) || trimOutput(result.stdout) || result.error || 'tar extract failed.';
    throw new Error(detail);
  }
}

async function findExtractedBinary(params: {
  rootDir: string;
  configuredName: string;
  targetBinaryPath: string;
}): Promise<string | null> {
  const { rootDir, configuredName, targetBinaryPath } = params;
  const requiredBaseName = path.basename(targetBinaryPath);
  const candidateNames = new Set<string>([configuredName, requiredBaseName]);
  if (process.platform === 'win32') {
    candidateNames.add(`${configuredName}.exe`);
  }

  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (candidateNames.has(entry.name)) {
        return fullPath;
      }
    }
  }

  return null;
}

async function validateBinary(binaryPath: string): Promise<void> {
  await chmod(binaryPath, 0o755).catch(() => {
    // Best effort; runArduinoCliVersionCommand will fail if executable permissions are still wrong.
  });
  const result = await runArduinoCliVersionCommand(binaryPath);
  if (!result.ok) {
    throw new Error(result.detail ?? 'Version check failed.');
  }
}

export async function installArduinoCliFromReleaseAssets(params?: {
  log?: (line: string) => void;
}): Promise<ArduinoCliReleaseInstallResult> {
  const log = params?.log;
  const managed = await resolveManagedArduinoCliBinary();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'exort-arduino-cli-release-'));

  try {
    const assetDetails = resolveArduinoCliReleaseAssetForCurrentTarget();
    const { targetKey, url: assetUrl } = assetDetails;
    const asset: ReleaseAssetEntry = assetDetails;
    log?.(`arduino:binary:provision:release:target key=${targetKey}`);
    log?.(`arduino:binary:provision:start source=managed method=release-url target=${managed.binaryPath}`);
    log?.(`arduino:binary:provision:release:download url=${assetUrl}`);

    const archivePath = buildArchivePath(tempRoot, asset.archiveType);
    await downloadFile(assetUrl, archivePath);
    log?.(`arduino:binary:provision:release:verify archive=${archivePath}`);
    const expectedSha256 = normalizeSha256(asset.sha256);
    const actualSha256 = normalizeSha256(await computeFileSha256(archivePath));
    if (expectedSha256 !== actualSha256) {
      throw new Error(
        `Checksum verification failed for ${asset.archiveName}. Expected sha256 ${expectedSha256} but got ${actualSha256}.`
      );
    }
    log?.(`arduino:binary:provision:release:verify:ok archive=${archivePath}`);

    const extractDir = path.join(tempRoot, 'extract');
    log?.(`arduino:binary:provision:release:extract archive=${archivePath}`);
    await extractArchive({
      archivePath,
      archiveType: asset.archiveType,
      extractDir
    });

    const extractedBinary = await findExtractedBinary({
      rootDir: extractDir,
      configuredName: asset.binaryName,
      targetBinaryPath: managed.binaryPath
    });

    if (!extractedBinary) {
      return {
        ok: false,
        targetKey,
        url: assetUrl,
        archiveType: asset.archiveType,
        message: `Unable to locate extracted Arduino CLI binary (${asset.binaryName}) in archive.`
      };
    }

    await mkdir(path.dirname(managed.binaryPath), { recursive: true });
    await copyFile(extractedBinary, managed.binaryPath);
    await ensureArduinoCliExecutable(managed.binaryPath);
    await validateBinary(managed.binaryPath);

    log?.(`arduino:binary:provision:done source=managed method=release-url target=${managed.binaryPath}`);

    return {
      ok: true,
      targetKey,
      url: assetUrl,
      archiveType: asset.archiveType,
      binaryPath: managed.binaryPath
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown Arduino CLI release install error.'
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {
      // Best effort cleanup.
    });
  }
}
