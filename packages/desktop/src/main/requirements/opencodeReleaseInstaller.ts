import { readOpenCodeBinaryVersion } from '../agent/openCodeProbe.js';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdtemp, mkdir, readFile, rm, writeFile, lstat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EXORT_MANAGED_OPENCODE_VERSION, isSupportedOpenCodeVersion, resolveManagedOpenCodeBinary } from '../agent/openCodeBinary.js';
import releaseAssets from './opencodeReleaseAssets.json';

export type OpenCodeReleaseAssetDetails = {
  targetKey: string; package: string; version: string; archiveName: string;
  archiveType: 'tar.gz'; binaryName: string; url: string; integrity: string;
};
export type OpenCodeReleaseInstallResult = {
  ok: boolean; targetKey?: string; url?: string; archiveType?: string; binaryPath?: string; message?: string;
};
const COMMAND_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 8 * 60_000;
function trimOutput(value: string): string { return value.trim(); }
function runCommand(params: { command: string; args?: string[]; timeoutMs?: number }) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }>((resolve) => {
    const proc = spawn(params.command, params.args ?? [], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; proc.kill('SIGKILL'); }, params.timeoutMs ?? COMMAND_TIMEOUT_MS);
    proc.stdout.on('data', c => { stdout = (stdout + c).slice(-100000); });
    proc.stderr.on('data', c => { stderr = (stderr + c).slice(-100000); });
    proc.once('error', e => { clearTimeout(timer); resolve({ ok: false, stdout, stderr, error: e.message }); });
    proc.once('close', code => { clearTimeout(timer); resolve({ ok: code === 0 && !timedOut, stdout, stderr }); });
  });
}
export function compareOpenCodeVersions(a: string, b: string): number {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { const diff = (left[i] ?? 0) - (right[i] ?? 0); if (diff) return Math.sign(diff); }
  return 0;
}
export function parseLatestOpenCodeRelease(data: unknown): string {
  const d = data as { version?: unknown; active?: unknown; channel?: unknown; metadata?: { package?: unknown } };
  if (!d || !isSupportedOpenCodeVersion(d.version) || d.active !== true || d.channel !== 'latest' || d.metadata?.package !== '@opencode/cli') {
    throw new Error('No compatible stable OpenCode 2.x update is available.');
  }
  return d.version;
}
export async function fetchLatestOpenCodeVersion(): Promise<string> {
  const response = await fetch('https://opencode.ai/update/api/latest/cli/npm', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`OpenCode update check failed (${response.status}).`);
  return parseLatestOpenCodeRelease(await response.json());
}
export async function resolveOpenCodeReleaseAssetForCurrentTarget(version = EXORT_MANAGED_OPENCODE_VERSION): Promise<OpenCodeReleaseAssetDetails> {
  if (!isSupportedOpenCodeVersion(version)) throw new Error('Unsupported OpenCode version.');
  const targetKey = await resolveTargetKey();
  const pinned = (releaseAssets as Record<string, Omit<OpenCodeReleaseAssetDetails, 'targetKey'>>)[targetKey];
  if (!pinned) throw new Error(`No OpenCode package for ${targetKey}.`);
  if (version === EXORT_MANAGED_OPENCODE_VERSION) return { ...pinned, targetKey };
  const response = await fetch(`https://registry.npmjs.org/@opencode%2fcli-${targetKey}/${version}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`OpenCode ${version} is unavailable for ${targetKey}.`);
  const data = await response.json() as { name: string; version: string; dist: { tarball: string; integrity: string } };
  const url = new URL(data.dist.tarball);
  if (data.name !== pinned.package || data.version !== version || url.origin !== 'https://registry.npmjs.org' || !data.dist.integrity?.startsWith('sha512-')) {
    throw new Error('Invalid OpenCode package metadata.');
  }
  return { ...pinned, targetKey, version, url: url.href, archiveName: path.basename(url.pathname), integrity: data.dist.integrity };
}
export function verifyOpenCodeArchive(data: Buffer, integrity: string): void {
  const actual = 'sha512-' + createHash('sha512').update(data).digest('base64');
  if (actual !== integrity) throw new Error('OpenCode archive integrity check failed.');
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

export function selectOpenCodeTarget(platform: string, arch: string, avx2: boolean | null, musl: boolean): string {
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'linux' && arch === 'arm64') return musl ? 'linux-arm64-musl' : 'linux-arm64';
  if (arch === 'x64' && ['darwin', 'win32', 'linux'].includes(platform)) {
    return `${platform === 'win32' ? 'windows' : platform}-x64${avx2 === true ? '' : '-baseline'}${platform === 'linux' && musl ? '-musl' : ''}`;
  }
  throw new Error(`Unsupported OpenCode platform: ${platform}-${arch}`);
}
async function resolveTargetKey(): Promise<string> {
  return selectOpenCodeTarget(process.platform, process.arch, await detectHasAvx2(), await detectLinuxMusl());
}


export async function installOpenCodeFromReleaseAssets(params: {
  version?: string; log?: (line: string) => void; onProgress?: (percent: number) => void;
} = {}): Promise<OpenCodeReleaseInstallResult> {
  let temporary: string | undefined;
  let staged: string | undefined;
  try {
    const asset = await resolveOpenCodeReleaseAssetForCurrentTarget(params.version);
    const target = await resolveManagedOpenCodeBinary(asset.version);
    if (target.source !== 'managed') throw new Error('The configured system OpenCode binary is managed externally.');
    temporary = await mkdtemp(path.join(os.tmpdir(), 'exort-opencode-'));
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok || !response.body) throw new Error(`OpenCode download failed (${response.status}).`);
    const total = Number(response.headers.get('content-length'));
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let received = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value); chunks.push(chunk); received += chunk.length;
      if (received > 512 * 1024 * 1024) { await reader.cancel(); throw new Error('OpenCode archive exceeds maximum size.'); }
      if (total > 0) params.onProgress?.(Math.min(99, received / total * 100));
    }
    const data = Buffer.concat(chunks);
    verifyOpenCodeArchive(data, asset.integrity);
    const archive = path.join(temporary, 'runtime.tgz');
    await writeFile(archive, data);
    const member = `package/bin/${asset.binaryName}`;
    const extract = await runCommand({ command: 'tar', args: ['-xzf', archive, '-C', temporary, member] });
    if (!extract.ok) throw new Error(extract.error || extract.stderr || 'Could not extract OpenCode.');
    const binary = path.join(temporary, member);
    if (!(await lstat(binary)).isFile()) throw new Error('OpenCode package does not contain a regular binary.');
    if (process.platform !== 'win32') await chmod(binary, 0o755);
    if (await readOpenCodeBinaryVersion(binary) !== asset.version) {
      throw new Error(`Downloaded OpenCode did not report expected version ${asset.version}.`);
    }
    // Only stage here. The updater publishes this directory while holding the runtime lock.
    const stagingRoot = path.join(target.managedRoot, 'staging');
    await mkdir(stagingRoot, { recursive: true });
    staged = await mkdtemp(path.join(stagingRoot, `${asset.version}-`));
    const stagedBinary = path.join(staged, asset.binaryName);
    await copyFile(binary, stagedBinary);
    if (process.platform !== 'win32') await chmod(stagedBinary, 0o755);
    await writeFile(path.join(staged, 'release.json'), JSON.stringify(asset), { mode: 0o600 });
    params.onProgress?.(100);
    params.log?.(`Installed verified OpenCode ${asset.version} for ${asset.targetKey}.`);
    staged = undefined; // Ownership passes to the updater.
    return { ok: true, binaryPath: stagedBinary, targetKey: asset.targetKey, url: asset.url, archiveType: asset.archiveType };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'OpenCode install failed.' };
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    if (staged) await rm(staged, { recursive: true, force: true });
  }
}
