import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ToolContext } from './agent/toolTypes.js';

import arduinoCompileTool from '../../opencode-agent/tools/arduinoCompile.js';

type ArduinoPortOption = {
  address: string;
  label: string;
  protocol: string;
};

type ArduinoBoardOption = {
  name: string;
  fqbn: string;
  platform: string;
};

type ArduinoCoreTier = 'official' | 'certified' | 'partner' | 'community';

type ArduinoCorePackage = {
  id: string;
  name: string;
  maintainer: string;
  website: string | null;
  installedVersion: string | null;
  latestVersion: string | null;
  boardCount: number;
  types: string[];
  deprecated: boolean;
  tier: ArduinoCoreTier;
};

type ArduinoCompileResult = {
  ok: boolean;
  status?: string;
  message?: string;
  workspaceRoot?: string;
  sketchDirectory?: string;
  fqbn?: string;
  command?: string[];
  exitCode?: number | null;
  aborted?: boolean;
  errorSummary?: string[];
  stdout?: string | null;
  stderr?: string | null;
  inferred?: Record<string, unknown>;
};

type ArduinoUploadResult = {
  ok: boolean;
  status: 'uploaded' | 'upload_failed' | 'upload_cancelled';
  message: string;
  workspaceRoot: string;
  sketchDirectory: string;
  fqbn: string;
  port: string;
  command: string[];
  exitCode: number | null;
  aborted: boolean;
  stdout: string;
  stderr: string;
  error?: string;
};

type CommandRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  aborted: boolean;
};

type ListPortsResponse =
  | { ok: true; ports: ArduinoPortOption[] }
  | {
      ok: false;
      error: string;
    };

type ListBoardsResponse =
  | { ok: true; boards: ArduinoBoardOption[] }
  | {
      ok: false;
      error: string;
    };

type ListCorePackagesResponse =
  | { ok: true; cores: ArduinoCorePackage[] }
  | {
      ok: false;
      error: string;
    };

type UpdateCoreIndexResponse =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

type InstallCoreResponse =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

type UninstallCoreResponse =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

type CompileOpenSketchPayload = {
  requestId: string;
  workspaceRoot: string;
  activeFilePath: string;
  fqbn: string;
};

type CompileOpenSketchResponse =
  | { ok: true; result: ArduinoCompileResult }
  | {
      ok: false;
      error: string;
    };

type UploadOpenSketchPayload = {
  requestId: string;
  workspaceRoot: string;
  activeFilePath: string;
  fqbn: string;
  port: string;
};

type UploadOpenSketchResponse =
  | { ok: true; result: ArduinoUploadResult }
  | {
      ok: false;
      error: string;
    };

type RunArduinoCliOptions = {
  cwd?: string;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  onChunk?: OutputChunkCallback;
};

type OutputChunkPayload = {
  stream: 'stdout' | 'stderr';
  chunk: string;
};

type OutputChunkCallback = (payload: OutputChunkPayload) => void;

type ResolvedSketchTarget = {
  workspaceRoot: string;
  activeFilePath: string;
  relativeSketchPath: string;
  sketchDirectoryAbsolute: string;
  sketchDirectoryRelative: string;
};

type ResolveSketchTargetResponse =
  | { ok: true; value: ResolvedSketchTarget }
  | {
      ok: false;
      error: string;
    };

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPathInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relative = path.relative(workspaceRoot, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function isValidCoreId(value: string): boolean {
  return /^[^:@\s]+:[^:@\s]+$/.test(value);
}

function resolveCoreTier(id: string, maintainer: string, types: string[]): ArduinoCoreTier {
  if (id.startsWith('arduino:') || maintainer === 'Arduino') {
    return 'official';
  }

  const normalizedTypes = types.map((item) => item.trim().toLowerCase());
  if (normalizedTypes.includes('arduino certified')) {
    return 'certified';
  }
  if (normalizedTypes.includes('partner') || normalizedTypes.includes('arduino@heart')) {
    return 'partner';
  }

  return 'community';
}

function pickCoreRelease(
  releaseRecord: Record<string, unknown>,
  latestVersion: string | null,
  installedVersion: string | null
): Record<string, unknown> | null {
  if (latestVersion) {
    const release = asRecord(releaseRecord[latestVersion]);
    if (Object.keys(release).length > 0) return release;
  }

  if (installedVersion) {
    const release = asRecord(releaseRecord[installedVersion]);
    if (Object.keys(release).length > 0) return release;
  }

  for (const key of Object.keys(releaseRecord)) {
    const release = asRecord(releaseRecord[key]);
    if (Object.keys(release).length > 0) return release;
  }

  return null;
}

function normalizeCorePlatforms(platformsInput: unknown): ArduinoCorePackage[] {
  if (!Array.isArray(platformsInput)) return [];

  const normalized: ArduinoCorePackage[] = [];

  for (const entry of platformsInput) {
    const platform = asRecord(entry);
    const id = asNonBlankString(platform.id);
    if (!id) continue;

    const maintainer = asNonBlankString(platform.maintainer) ?? 'Unknown maintainer';
    const website = asNonBlankString(platform.website);
    const installedVersion = asNonBlankString(platform.installed_version);
    const latestVersion = asNonBlankString(platform.latest_version);
    const releases = asRecord(platform.releases);
    const release = pickCoreRelease(releases, latestVersion, installedVersion);
    if (!release) continue;

    const name = asNonBlankString(release.name) ?? id;
    const types = asStringArray(release.types);
    const boards = Array.isArray(release.boards) ? release.boards : [];
    const boardCount = boards.length;
    const deprecated = asBoolean(release.deprecated) || asBoolean(platform.deprecated);
    const tier = resolveCoreTier(id, maintainer, types);

    normalized.push({
      id,
      name,
      maintainer,
      website,
      installedVersion,
      latestVersion,
      boardCount,
      types,
      deprecated,
      tier
    });
  }

  normalized.sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.id.localeCompare(right.id);
  });

  return normalized;
}

function summarizeInstallOutput(coreId: string, stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line) continue;
    if (line.toLowerCase().includes('platform') && line.toLowerCase().includes('installed')) {
      return line;
    }
  }

  return `Installed ${coreId}.`;
}

function summarizeUninstallOutput(coreId: string, stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line) continue;
    if (line.toLowerCase().includes('platform') && line.toLowerCase().includes('uninstalled')) {
      return line;
    }
  }

  return `Removed ${coreId}.`;
}

async function runArduinoCli(args: string[], options: RunArduinoCliOptions = {}): Promise<CommandRunResult> {
  return new Promise((resolve) => {
    const proc = spawn('arduino-cli', args, {
      cwd: options.cwd,
      env: options.env,
      signal: options.signal
    });
    let stdout = '';
    let stderr = '';
    let done = false;

    const settle = (result: CommandRunResult) => {
      if (done) return;
      done = true;
      resolve(result);
    };

    proc.stdout.on('data', (chunk) => {
      const nextChunk = chunk.toString();
      stdout += nextChunk;
      options.onChunk?.({ stream: 'stdout', chunk: nextChunk });
    });

    proc.stderr.on('data', (chunk) => {
      const nextChunk = chunk.toString();
      stderr += nextChunk;
      options.onChunk?.({ stream: 'stderr', chunk: nextChunk });
    });

    proc.once('error', (error) => {
      const wasAborted =
        options.signal?.aborted === true ||
        (error as NodeJS.ErrnoException).name === 'AbortError' ||
        (error as NodeJS.ErrnoException).code === 'ABORT_ERR';
      const message = wasAborted
        ? 'Command was aborted.'
        : (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'arduino-cli not found in PATH.'
          : error instanceof Error
            ? error.message
            : String(error);
      settle({
        exitCode: null,
        stdout,
        stderr,
        error: message,
        aborted: wasAborted
      });
    });

    proc.once('close', (exitCode, closeSignal) => {
      settle({
        exitCode,
        stdout,
        stderr,
        aborted: options.signal?.aborted === true || closeSignal != null
      });
    });
  });
}

async function resolveSketchTarget(workspaceRootInput: unknown, activeFilePathInput: unknown): Promise<ResolveSketchTargetResponse> {
  const workspaceRootRaw = asNonBlankString(workspaceRootInput);
  const activeFilePathRaw = asNonBlankString(activeFilePathInput);

  if (!workspaceRootRaw) {
    return { ok: false, error: 'workspaceRoot is required.' };
  }

  if (!activeFilePathRaw) {
    return { ok: false, error: 'activeFilePath is required.' };
  }

  const workspaceRoot = path.resolve(workspaceRootRaw);
  const activeFilePath = path.resolve(activeFilePathRaw);

  let workspaceStat;
  try {
    workspaceStat = await fs.stat(workspaceRoot);
  } catch {
    return { ok: false, error: `Workspace root does not exist: ${workspaceRoot}` };
  }

  if (!workspaceStat.isDirectory()) {
    return { ok: false, error: `Workspace root is not a directory: ${workspaceRoot}` };
  }

  if (!isPathInsideWorkspace(workspaceRoot, activeFilePath)) {
    return { ok: false, error: 'Active file must be inside the current workspace.' };
  }

  if (path.extname(activeFilePath).toLowerCase() !== '.ino') {
    return { ok: false, error: 'Operation requires an active .ino file.' };
  }

  let fileStat;
  try {
    fileStat = await fs.stat(activeFilePath);
  } catch {
    return { ok: false, error: `Active sketch file does not exist: ${activeFilePath}` };
  }

  if (!fileStat.isFile()) {
    return { ok: false, error: `Active sketch path is not a file: ${activeFilePath}` };
  }

  const relativeSketchPath = path.relative(workspaceRoot, activeFilePath).replace(/\\/g, '/');
  const sketchDirectoryAbsolute = path.dirname(activeFilePath);
  const sketchDirectoryRelative = path.relative(workspaceRoot, sketchDirectoryAbsolute).replace(/\\/g, '/') || '.';

  return {
    ok: true,
    value: {
      workspaceRoot,
      activeFilePath,
      relativeSketchPath,
      sketchDirectoryAbsolute,
      sketchDirectoryRelative
    }
  };
}

async function createWorkspaceTempEnv(workspaceRoot: string): Promise<NodeJS.ProcessEnv> {
  const tempRoot = path.join(workspaceRoot, '.exortai', 'tmp');
  await fs.mkdir(tempRoot, { recursive: true });

  return {
    ...process.env,
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    TEMPDIR: tempRoot
  };
}

export async function listConnectedSerialPorts(): Promise<ListPortsResponse> {
  const runResult = await runArduinoCli(['board', 'list', '--format', 'json']);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }
  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  const parsed = parseJson<{ detected_ports?: unknown[] }>(runResult.stdout);
  if (!parsed) {
    return { ok: false, error: 'Failed to parse serial ports from arduino-cli output.' };
  }

  const ports = (parsed.detected_ports ?? [])
    .map((item) => asRecord(item).port)
    .map((value) => asRecord(value))
    .map((port): ArduinoPortOption | null => {
      const address = asNonBlankString(port.address);
      if (!address) return null;

      return {
        address,
        label: asNonBlankString(port.label) ?? address,
        protocol: asNonBlankString(port.protocol) ?? 'serial'
      };
    })
    .filter((item): item is ArduinoPortOption => item !== null);

  return { ok: true, ports };
}

export async function listInstalledBoards(): Promise<ListBoardsResponse> {
  const runResult = await runArduinoCli(['board', 'listall', '--format', 'json']);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }
  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  const parsed = parseJson<{ boards?: unknown[] }>(runResult.stdout);
  if (!parsed) {
    return { ok: false, error: 'Failed to parse board list from arduino-cli output.' };
  }

  const byFqbn = new Map<string, ArduinoBoardOption>();
  for (const entry of parsed.boards ?? []) {
    const boardRecord = asRecord(entry);
    const fqbn = asNonBlankString(boardRecord.fqbn);
    const name = asNonBlankString(boardRecord.name);
    if (!fqbn || !name) continue;

    const platformRecord = asRecord(boardRecord.platform);
    const releaseRecord = asRecord(platformRecord.release);
    if (releaseRecord.installed !== true) continue;

    const metadataRecord = asRecord(platformRecord.metadata);
    const platformName =
      asNonBlankString(releaseRecord.name) ?? asNonBlankString(metadataRecord.id) ?? asNonBlankString(metadataRecord.maintainer) ?? 'Unknown platform';

    if (!byFqbn.has(fqbn)) {
      byFqbn.set(fqbn, {
        name,
        fqbn,
        platform: platformName
      });
    }
  }

  const boards = [...byFqbn.values()].sort((left, right) => left.name.localeCompare(right.name));
  return { ok: true, boards };
}

export async function listInstalledCores(): Promise<ListCorePackagesResponse> {
  const runResult = await runArduinoCli(['core', 'list', '--json']);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }
  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  const parsed = parseJson<{ platforms?: unknown[] }>(runResult.stdout);
  if (!parsed) {
    return { ok: false, error: 'Failed to parse installed cores from arduino-cli output.' };
  }

  return {
    ok: true,
    cores: normalizeCorePlatforms(parsed.platforms)
  };
}

export async function listCatalogCores(): Promise<ListCorePackagesResponse> {
  const runResult = await runArduinoCli(['core', 'list', '--all', '--json']);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }
  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  const parsed = parseJson<{ platforms?: unknown[] }>(runResult.stdout);
  if (!parsed) {
    return { ok: false, error: 'Failed to parse core catalog from arduino-cli output.' };
  }

  return {
    ok: true,
    cores: normalizeCorePlatforms(parsed.platforms)
  };
}

export async function updateCoreIndex(): Promise<UpdateCoreIndexResponse> {
  const runResult = await runArduinoCli(['core', 'update-index']);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }

  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  return { ok: true };
}

export async function installCore(idInput: string): Promise<InstallCoreResponse> {
  const id = asNonBlankString(idInput);
  if (!id) {
    return { ok: false, error: 'Core id is required.' };
  }
  if (!isValidCoreId(id)) {
    return { ok: false, error: 'Invalid core id. Expected format "packager:arch".' };
  }

  const runResult = await runArduinoCli(['core', 'install', id]);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }
  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  const output = runResult.stdout.trim();
  return {
    ok: true,
    message: output.length > 0 ? summarizeInstallOutput(id, output) : `Installed ${id}.`
  };
}

export async function uninstallCore(idInput: string): Promise<UninstallCoreResponse> {
  const id = asNonBlankString(idInput);
  if (!id) {
    return { ok: false, error: 'Core id is required.' };
  }
  if (!isValidCoreId(id)) {
    return { ok: false, error: 'Invalid core id. Expected format "packager:arch".' };
  }

  const runResult = await runArduinoCli(['core', 'uninstall', id]);
  if (runResult.error) {
    return { ok: false, error: runResult.error };
  }
  if (runResult.exitCode !== 0) {
    const detail = runResult.stderr.trim() || runResult.stdout.trim() || `arduino-cli exited with code ${runResult.exitCode}`;
    return { ok: false, error: detail };
  }

  const output = runResult.stdout.trim();
  return {
    ok: true,
    message: output.length > 0 ? summarizeUninstallOutput(id, output) : `Removed ${id}.`
  };
}

function createToolContext(
  workspaceRoot: string,
  outputChunkCallback?: OutputChunkCallback
): ToolContext & { outputChunkCallback?: OutputChunkCallback } {
  return {
    sessionID: 'desktop-navbar',
    messageID: crypto.randomUUID(),
    agent: 'desktop-ui',
    directory: workspaceRoot,
    worktree: workspaceRoot,
    abort: new AbortController().signal,
    outputChunkCallback,
    metadata: () => undefined,
    ask: async () => undefined
  };
}

export async function compileOpenSketchWithArduinoTool(
  payload: CompileOpenSketchPayload,
  outputChunkCallback?: OutputChunkCallback
): Promise<CompileOpenSketchResponse> {
  const requestId = asNonBlankString(payload.requestId);
  if (!requestId) {
    return { ok: false, error: 'requestId is required.' };
  }
  const target = await resolveSketchTarget(payload.workspaceRoot, payload.activeFilePath);
  if (!target.ok) return target;

  const fqbn = asNonBlankString(payload.fqbn);
  if (!fqbn) {
    return { ok: false, error: 'Board FQBN is required.' };
  }

  const context = createToolContext(target.value.workspaceRoot, outputChunkCallback);

  try {
    const rawOutput = await arduinoCompileTool.execute(
      {
        sketchPath: target.value.relativeSketchPath,
        fqbn
      },
      context
    );

    const parsed = parseJson<ArduinoCompileResult>(rawOutput);
    if (!parsed) {
      return { ok: false, error: 'arduinoCompile returned a non-JSON response.' };
    }

    return { ok: true, result: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Compile failed before arduinoCompile returned.'
    };
  }
}

export async function uploadOpenSketch(
  payload: UploadOpenSketchPayload,
  signal: AbortSignal,
  outputChunkCallback?: OutputChunkCallback
): Promise<UploadOpenSketchResponse> {
  const requestId = asNonBlankString(payload.requestId) ?? 'unknown';
  const target = await resolveSketchTarget(payload.workspaceRoot, payload.activeFilePath);
  if (!target.ok) return target;

  const fqbn = asNonBlankString(payload.fqbn);
  if (!fqbn) {
    return { ok: false, error: 'Board FQBN is required.' };
  }

  const port = asNonBlankString(payload.port);
  if (!port) {
    return { ok: false, error: 'Serial port is required.' };
  }

  const commandArgs = ['compile', target.value.sketchDirectoryAbsolute, '--fqbn', fqbn, '--upload', '--port', port];
  const command = ['arduino-cli', ...commandArgs];
  console.log(
    `[ArduinoUpload] bridge:start requestId=${requestId} fqbn=${fqbn} port=${port} sketch=${target.value.relativeSketchPath}`
  );

  const env = await createWorkspaceTempEnv(target.value.workspaceRoot);
  const runResult = await runArduinoCli(commandArgs, {
    cwd: target.value.workspaceRoot,
    env,
    signal,
    onChunk: outputChunkCallback
  });

  let status: ArduinoUploadResult['status'] = 'upload_failed';
  let message = `arduino-cli compile --upload failed with exit code ${runResult.exitCode ?? 'unknown'}.`;
  if (runResult.aborted) {
    status = 'upload_cancelled';
    message = 'Upload cancelled.';
  } else if (runResult.exitCode === 0 && !runResult.error) {
    status = 'uploaded';
    message = 'Sketch uploaded successfully.';
  } else if (runResult.error) {
    message = runResult.error;
  } else if (runResult.stderr.trim()) {
    message = runResult.stderr.trim().split('\n').pop() ?? message;
  }

  const result: ArduinoUploadResult = {
    ok: status === 'uploaded',
    status,
    message,
    workspaceRoot: target.value.workspaceRoot,
    sketchDirectory: target.value.sketchDirectoryRelative,
    fqbn,
    port,
    command,
    exitCode: runResult.exitCode,
    aborted: runResult.aborted,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    error: runResult.error
  };

  console.log(
    `[ArduinoUpload] bridge:done requestId=${requestId} status=${result.status} exitCode=${result.exitCode ?? 'null'}`
  );
  return { ok: true, result };
}
