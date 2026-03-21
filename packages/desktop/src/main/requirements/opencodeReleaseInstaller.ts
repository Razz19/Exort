import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { resolveManagedOpenCodeBinary } from '../agent/openCodeBinary.js';
import releaseAssets from './opencodeReleaseAssets.json';

type ArchiveType = 'zip' | 'tar.gz';

type ReleaseAssetEntry = {
  url: string;
  archiveType: ArchiveType;
  binaryName: string;
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

export type OpenCodeReleaseInstallResult = {
  ok: boolean;
  targetKey?: string;
  url?: string;
  archiveType?: ArchiveType;
  binaryPath?: string;
  message?: string;
};

const RELEASE_ASSETS: ReleaseAssetMap = releaseAssets as ReleaseAssetMap;
const COMMAND_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 8 * 60 * 1000;

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
  shell?: boolean;
  timeoutMs?: number;
}): Promise<RunCommandResult> {
  const args = params.args ?? [];
  const shell = params.shell === true;
  const timeoutMs = params.timeoutMs ?? COMMAND_TIMEOUT_MS;

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

async function detectLinuxMusl(): Promise<boolean> {
  if (process.platform !== 'linux') return false;
  if (existsSync('/etc/alpine-release')) return true;

  const result = await runCommand({
    command: 'sh',
    args: ['-lc', 'ldd --version 2>&1 || true'],
    timeoutMs: 10_000
  });
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return output.includes('musl');
}

async function detectHasAvx2(): Promise<boolean | null> {
  if (process.arch !== 'x64') return null;

  if (process.platform === 'linux') {
    try {
      const cpuInfo = (await readFile('/proc/cpuinfo', 'utf8')).toLowerCase();
      return cpuInfo.includes('avx2');
    } catch {
      return null;
    }
  }

  if (process.platform === 'darwin') {
    const result = await runCommand({
      command: 'sysctl',
      args: ['-n', 'hw.optional.avx2_0'],
      timeoutMs: 10_000
    });
    if (!result.ok) return null;
    const output = trimOutput(result.stdout);
    if (output === '1') return true;
    if (output === '0') return false;
    return null;
  }

  if (process.platform === 'win32') {
    const psCommand =
      "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class Cpu { [DllImport(\"kernel32.dll\")] public static extern bool IsProcessorFeaturePresent(uint pf); }'; if ([Cpu]::IsProcessorFeaturePresent(40)) { Write-Output 1 } else { Write-Output 0 }";
    const result = await runCommand({
      command: 'powershell.exe',
      args: ['-NoProfile', '-Command', psCommand],
      timeoutMs: 10_000
    });
    if (!result.ok) return null;
    const output = trimOutput(result.stdout);
    if (output === '1') return true;
    if (output === '0') return false;
    return null;
  }

  return null;
}

async function resolveTargetKey(): Promise<string> {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') return 'darwin-arm64';
    if (process.arch !== 'x64') {
      throw new Error(`Unsupported macOS architecture: ${process.arch}`);
    }

    const avx2 = await detectHasAvx2();
    return avx2 ? 'darwin-x64' : 'darwin-x64-baseline';
  }

  if (process.platform === 'win32') {
    if (process.arch !== 'x64') {
      throw new Error(`Unsupported Windows architecture: ${process.arch}`);
    }

    const avx2 = await detectHasAvx2();
    return avx2 ? 'windows-x64' : 'windows-x64-baseline';
  }

  if (process.platform === 'linux') {
    const musl = await detectLinuxMusl();

    if (process.arch === 'arm64') {
      return musl ? 'linux-arm64-musl' : 'linux-arm64';
    }

    if (process.arch !== 'x64') {
      throw new Error(`Unsupported Linux architecture: ${process.arch}`);
    }

    const avx2 = await detectHasAvx2();
    const useBaseline = avx2 !== true;

    if (musl) {
      return useBaseline ? 'linux-x64-baseline-musl' : 'linux-x64-musl';
    }

    return useBaseline ? 'linux-x64-baseline' : 'linux-x64';
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

function buildArchivePath(tempRoot: string, archiveType: ArchiveType): string {
  if (archiveType === 'zip') {
    return path.join(tempRoot, 'opencode-release.zip');
  }

  return path.join(tempRoot, 'opencode-release.tar.gz');
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

async function ensureExecutable(binaryPath: string): Promise<void> {
  if (process.platform === 'win32') return;
  await chmod(binaryPath, 0o755).catch(() => {
    // Best effort.
  });
}

async function validateBinary(binaryPath: string): Promise<void> {
  const result = await runCommand({
    command: binaryPath,
    args: ['--version'],
    timeoutMs: 15_000
  });
  if (!result.ok) {
    const detail = trimOutput(result.stderr) || trimOutput(result.stdout) || result.error || 'Version check failed.';
    throw new Error(detail);
  }
}

export async function installOpenCodeFromReleaseAssets(params?: {
  log?: (line: string) => void;
}): Promise<OpenCodeReleaseInstallResult> {
  const log = params?.log;
  const managed = await resolveManagedOpenCodeBinary();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'exort-opencode-release-'));

  try {
    const targetKey = await resolveTargetKey();
    const asset = RELEASE_ASSETS[targetKey];
    if (!asset) {
      return {
        ok: false,
        message: `No release asset is configured for target ${targetKey}.`
      };
    }

    log?.(`runtime:binary:provision:release:target key=${targetKey}`);
    log?.(`runtime:binary:provision:start source=managed method=release-url target=${managed.binaryPath}`);
    log?.(`runtime:binary:provision:release:download url=${asset.url}`);

    const archivePath = buildArchivePath(tempRoot, asset.archiveType);
    await downloadFile(asset.url, archivePath);

    const extractDir = path.join(tempRoot, 'extract');
    log?.(`runtime:binary:provision:release:extract archive=${archivePath}`);
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
        url: asset.url,
        archiveType: asset.archiveType,
        message: `Unable to locate extracted OpenCode binary (${asset.binaryName}) in archive.`
      };
    }

    await mkdir(path.dirname(managed.binaryPath), { recursive: true });
    await copyFile(extractedBinary, managed.binaryPath);
    await ensureExecutable(managed.binaryPath);
    await validateBinary(managed.binaryPath);

    log?.(`runtime:binary:provision:done source=managed method=release-url target=${managed.binaryPath}`);

    return {
      ok: true,
      targetKey,
      url: asset.url,
      archiveType: asset.archiveType,
      binaryPath: managed.binaryPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown release install error.';
    return {
      ok: false,
      message
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {
      // Best effort cleanup.
    });
  }
}
