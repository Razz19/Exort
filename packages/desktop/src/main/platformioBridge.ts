import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  detectEmbeddedProject,
  isPathInsideWorkspace,
  parsePlatformioIni,
  type PlatformioProjectInfo
} from './embeddedProjectResolver.js';
import { resolvePlatformioCliBinary, withPlatformioRuntimeEnv } from './platformioCliBinary.js';

type OutputChunkPayload = {
  stream: 'stdout' | 'stderr';
  chunk: string;
};

type OutputChunkCallback = (payload: OutputChunkPayload) => void;

type CommandRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  aborted: boolean;
};

export type PlatformioProjectEnvironment = {
  name: string;
  selected: boolean;
  default: boolean;
};

export type PlatformioProjectTarget = {
  projectRoot: string;
  platformioIniPath: string;
  relativeProjectRoot: string;
  envs: string[];
  defaultEnvs: string[];
  resolvedEnv: string | null;
  envRequired: boolean;
};

export type PlatformioListEnvsResponse =
  | {
      ok: true;
      target: PlatformioProjectTarget;
      environments: PlatformioProjectEnvironment[];
    }
  | {
      ok: false;
      error: string;
    };

export type PlatformioCompileResult = {
  ok: boolean;
  status: 'compiled' | 'compile_failed' | 'missing_input';
  message: string;
  workspaceRoot: string;
  projectRoot?: string;
  environment?: string | null;
  command?: string[];
  exitCode?: number | null;
  aborted?: boolean;
  errorSummary?: string[];
  stdout?: string | null;
  stderr?: string | null;
};

export type PlatformioUploadResult = {
  ok: boolean;
  status: 'uploaded' | 'upload_failed' | 'upload_cancelled' | 'missing_input';
  message: string;
  workspaceRoot: string;
  projectRoot?: string;
  environment?: string | null;
  port?: string | null;
  command?: string[];
  exitCode?: number | null;
  aborted?: boolean;
  stdout?: string | null;
  stderr?: string | null;
  error?: string;
};

export type PlatformioCleanResult = {
  ok: boolean;
  status: 'cleaned' | 'clean_failed' | 'missing_input';
  message: string;
  workspaceRoot: string;
  projectRoot?: string;
  environment?: string | null;
  command?: string[];
  exitCode?: number | null;
  aborted?: boolean;
  errorSummary?: string[];
  stdout?: string | null;
  stderr?: string | null;
};

export type PlatformioTestResult = {
  ok: boolean;
  status: 'tested' | 'test_failed' | 'test_cancelled' | 'missing_input';
  message: string;
  workspaceRoot: string;
  projectRoot?: string;
  environment?: string | null;
  command?: string[];
  exitCode?: number | null;
  aborted?: boolean;
  stdout?: string | null;
  stderr?: string | null;
  error?: string;
};

type PlatformioCompilePayload = {
  requestId: string;
  workspaceRoot: string;
  activeFilePath?: string | null;
  environment?: string;
};

type PlatformioUploadPayload = PlatformioCompilePayload & {
  port?: string;
};

type PlatformioCompileResponse =
  | { ok: true; result: PlatformioCompileResult }
  | {
      ok: false;
      error: string;
    };

type PlatformioUploadResponse =
  | { ok: true; result: PlatformioUploadResult }
  | {
      ok: false;
      error: string;
    };

type PlatformioCleanResponse =
  | { ok: true; result: PlatformioCleanResult }
  | { ok: false; error: string };

type PlatformioTestResponse =
  | { ok: true; result: PlatformioTestResult }
  | { ok: false; error: string };

const MAX_OUTPUT_LENGTH = 12000;
const MAX_ERROR_SUMMARY_LINES = 8;

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOutputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_OUTPUT_LENGTH) return trimmed;
  const marker = `...[truncated ${trimmed.length - MAX_OUTPUT_LENGTH} chars; showing most recent output]...\n`;
  return `${marker}${trimmed.slice(-(MAX_OUTPUT_LENGTH - marker.length))}`;
}

function isErrorLikeLine(value: string): boolean {
  const line = value.toLowerCase();
  return (
    line.startsWith('error:') ||
    line.includes(' error:') ||
    line.includes('fatal error:') ||
    line.includes('undefined reference') ||
    line.includes('not declared in this scope') ||
    line.includes('no such file or directory') ||
    line.includes('compilation terminated') ||
    line.includes('*** [.pio/')
  );
}

function extractErrorSummary(stdout: string, stderr: string): string[] {
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const summary: string[] = [];
  const seen = new Set<string>();

  for (let index = lines.length - 1; index >= 0 && summary.length < MAX_ERROR_SUMMARY_LINES; index -= 1) {
    const line = lines[index];
    if (!line || !isErrorLikeLine(line) || seen.has(line)) continue;
    seen.add(line);
    summary.unshift(line);
  }

  return summary;
}

function toRelative(workspaceRoot: string, targetPath: string): string {
  return path.relative(workspaceRoot, targetPath).replace(/\\/g, '/') || '.';
}

function toProjectTarget(info: PlatformioProjectInfo): PlatformioProjectTarget {
  return {
    projectRoot: info.projectRoot,
    platformioIniPath: info.platformioIniPath,
    relativeProjectRoot: info.relativeProjectRoot,
    envs: info.envs,
    defaultEnvs: info.defaultEnvs,
    resolvedEnv: info.resolvedEnv,
    envRequired: info.envRequired
  };
}

function resolveEnvironment(info: PlatformioProjectInfo, requestedEnvironment: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const requested = asNonBlankString(requestedEnvironment);
  if (requested) {
    if (info.envs.length > 0 && !info.envs.includes(requested)) {
      return { ok: false, error: `PlatformIO environment not found in platformio.ini: ${requested}` };
    }
    return { ok: true, value: requested };
  }

  if (info.resolvedEnv) return { ok: true, value: info.resolvedEnv };
  if (!info.envRequired) return { ok: true, value: null };
  return { ok: false, error: 'PlatformIO environment is required. Select one of the project environments first.' };
}

export function buildPlatformioRunArgs(projectRoot: string, environment?: string | null, target?: 'upload' | 'clean', uploadPort?: string | null): string[] {
  const args = ['run', '-d', projectRoot];
  if (environment) args.push('-e', environment);
  if (target) args.push('-t', target);
  if (uploadPort) args.push('--upload-port', uploadPort);
  return args;
}

export function buildPlatformioTestArgs(projectRoot: string, environment?: string | null): string[] {
  const args = ['test', '-d', projectRoot];
  if (environment) args.push('-e', environment);
  return args;
}

async function createWorkspaceTempEnv(workspaceRoot: string): Promise<NodeJS.ProcessEnv> {
  const tempRoot = path.join(workspaceRoot, '.exort', 'tmp');
  await fs.mkdir(tempRoot, { recursive: true });

  return withPlatformioRuntimeEnv({
    ...process.env,
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    TEMPDIR: tempRoot
  });
}

async function runPlatformio(
  args: string[],
  workspaceRoot: string,
  signal?: AbortSignal,
  outputChunkCallback?: OutputChunkCallback
): Promise<CommandRunResult & { command: string }> {
  let resolved;
  try {
    resolved = await resolvePlatformioCliBinary();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve PlatformIO CLI.';
    outputChunkCallback?.({ stream: 'stderr', chunk: `[PlatformIO] ${message}\n` });
    return {
      command: 'pio',
      exitCode: null,
      stdout: '',
      stderr: '',
      error: message,
      aborted: false
    };
  }
  const env = await createWorkspaceTempEnv(workspaceRoot);
  outputChunkCallback?.({ stream: 'stdout', chunk: `[PlatformIO] Command: ${[resolved.command, ...args].join(' ')}\n` });

  return new Promise((resolve) => {
    const proc = spawn(resolved.command, args, {
      cwd: workspaceRoot,
      env,
      signal
    });

    let stdout = '';
    let stderr = '';
    let done = false;

    const settle = (result: CommandRunResult & { command: string }) => {
      if (done) return;
      done = true;
      resolve(result);
    };

    proc.stdout.on('data', (chunk) => {
      const nextChunk = chunk.toString();
      stdout += nextChunk;
      outputChunkCallback?.({ stream: 'stdout', chunk: nextChunk });
    });

    proc.stderr.on('data', (chunk) => {
      const nextChunk = chunk.toString();
      stderr += nextChunk;
      outputChunkCallback?.({ stream: 'stderr', chunk: nextChunk });
    });

    proc.once('error', (error) => {
      const wasAborted =
        signal?.aborted === true ||
        (error as NodeJS.ErrnoException).name === 'AbortError' ||
        (error as NodeJS.ErrnoException).code === 'ABORT_ERR';
      const message = wasAborted
        ? 'Command was aborted.'
        : error instanceof Error
          ? error.message
          : String(error);
      outputChunkCallback?.({ stream: 'stderr', chunk: `[PlatformIO] Failed to start command: ${message}\n` });
      settle({
        command: resolved.command,
        exitCode: null,
        stdout,
        stderr,
        error: message,
        aborted: wasAborted
      });
    });

    proc.once('close', (exitCode, closeSignal) => {
      settle({
        command: resolved.command,
        exitCode,
        stdout,
        stderr,
        aborted: signal?.aborted === true || closeSignal != null
      });
    });
  });
}

async function resolvePlatformioTarget(workspaceRootInput: unknown, activeFilePathInput: unknown): Promise<
  | {
      ok: true;
      workspaceRoot: string;
      info: PlatformioProjectInfo;
    }
  | {
      ok: false;
      error: string;
      workspaceRoot: string;
    }
> {
  const workspaceRootRaw = asNonBlankString(workspaceRootInput);
  const activeFilePathRaw = asNonBlankString(activeFilePathInput);
  const workspaceRoot = workspaceRootRaw ? path.resolve(workspaceRootRaw) : '';
  if (!workspaceRootRaw) return { ok: false, error: 'workspaceRoot is required.', workspaceRoot };

  let activeFilePath: string | null = null;
  if (activeFilePathRaw) {
    activeFilePath = path.resolve(activeFilePathRaw);
    if (!isPathInsideWorkspace(workspaceRoot, activeFilePath)) {
      return { ok: false, error: 'Active file must be inside the current workspace.', workspaceRoot };
    }
  }

  const detected = await detectEmbeddedProject(workspaceRoot, activeFilePath);
  if (detected.kind !== 'platformio') {
    return {
      ok: false,
      error: detected.kind === 'unknown' ? detected.reason : 'Detected project is not a PlatformIO project.',
      workspaceRoot
    };
  }

  return { ok: true, workspaceRoot, info: detected };
}

export async function listPlatformioEnvironments(
  workspaceRootInput: unknown,
  activeFilePathInput: unknown
): Promise<PlatformioListEnvsResponse> {
  const target = await resolvePlatformioTarget(workspaceRootInput, activeFilePathInput);
  if (!target.ok) return { ok: false, error: target.error };

  const environments = target.info.envs.map((name) => ({
    name,
    selected: target.info.resolvedEnv === name,
    default: target.info.defaultEnvs.includes(name)
  }));

  return {
    ok: true,
    target: toProjectTarget(target.info),
    environments
  };
}

export async function compilePlatformioProject(
  payload: PlatformioCompilePayload,
  outputChunkCallback?: OutputChunkCallback
): Promise<PlatformioCompileResponse> {
  const requestId = asNonBlankString(payload.requestId);
  if (!requestId) return { ok: false, error: 'requestId is required.' };

  const target = await resolvePlatformioTarget(payload.workspaceRoot, payload.activeFilePath);
  if (!target.ok) return { ok: false, error: target.error };

  const environment = resolveEnvironment(target.info, payload.environment);
  if (!environment.ok) {
    return {
      ok: true,
      result: {
        ok: false,
        status: 'missing_input',
        message: environment.error,
        workspaceRoot: target.workspaceRoot,
        projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
        environment: null,
        aborted: false
      }
    };
  }

  const args = buildPlatformioRunArgs(target.info.projectRoot, environment.value);
  const runResult = await runPlatformio(args, target.workspaceRoot, undefined, outputChunkCallback);
  const command = [runResult.command, ...args];
  const errorSummary = extractErrorSummary(runResult.stdout, runResult.stderr);
  const success = runResult.exitCode === 0 && !runResult.error;
  const failureMessage =
    errorSummary.length > 0
      ? `PlatformIO compile failed with exit code ${runResult.exitCode ?? 'unknown'}. First error: ${errorSummary[0]}`
      : `PlatformIO compile failed with exit code ${runResult.exitCode ?? 'unknown'}.`;

  return {
    ok: true,
    result: {
      ok: success,
      status: success ? 'compiled' : 'compile_failed',
      message: success ? 'PlatformIO compile completed successfully.' : runResult.error ?? failureMessage,
      workspaceRoot: target.workspaceRoot,
      projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
      environment: environment.value,
      command,
      exitCode: runResult.exitCode,
      aborted: runResult.aborted,
      errorSummary: errorSummary.length > 0 ? errorSummary : undefined,
      stdout: asOutputValue(runResult.stdout),
      stderr: asOutputValue(runResult.stderr)
    }
  };
}

export async function uploadPlatformioProject(
  payload: PlatformioUploadPayload,
  signal: AbortSignal,
  outputChunkCallback?: OutputChunkCallback
): Promise<PlatformioUploadResponse> {
  const requestId = asNonBlankString(payload.requestId);
  if (!requestId) return { ok: false, error: 'requestId is required.' };

  const target = await resolvePlatformioTarget(payload.workspaceRoot, payload.activeFilePath);
  if (!target.ok) return { ok: false, error: target.error };

  const environment = resolveEnvironment(target.info, payload.environment);
  if (!environment.ok) {
    return {
      ok: true,
      result: {
        ok: false,
        status: 'missing_input',
        message: environment.error,
        workspaceRoot: target.workspaceRoot,
        projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
        environment: null,
        aborted: false
      }
    };
  }

  const port = asNonBlankString(payload.port);
  const args = buildPlatformioRunArgs(target.info.projectRoot, environment.value, 'upload', port);
  const runResult = await runPlatformio(args, target.workspaceRoot, signal, outputChunkCallback);
  const command = [runResult.command, ...args];

  let status: PlatformioUploadResult['status'] = 'upload_failed';
  let message = `PlatformIO upload failed with exit code ${runResult.exitCode ?? 'unknown'}.`;
  if (runResult.aborted) {
    status = 'upload_cancelled';
    message = 'Upload cancelled.';
  } else if (runResult.exitCode === 0 && !runResult.error) {
    status = 'uploaded';
    message = 'PlatformIO upload completed successfully.';
  } else if (runResult.error) {
    message = runResult.error;
  } else if (runResult.stderr.trim()) {
    message = runResult.stderr.trim().split('\n').pop() ?? message;
  }

  return {
    ok: true,
    result: {
      ok: status === 'uploaded',
      status,
      message,
      workspaceRoot: target.workspaceRoot,
      projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
      environment: environment.value,
      port,
      command,
      exitCode: runResult.exitCode,
      aborted: runResult.aborted,
      stdout: asOutputValue(runResult.stdout),
      stderr: asOutputValue(runResult.stderr),
      error: runResult.error
    }
  };
}

export async function cleanPlatformioProject(
  payload: PlatformioCompilePayload,
  outputChunkCallback?: OutputChunkCallback
): Promise<PlatformioCleanResponse> {
  const requestId = asNonBlankString(payload.requestId);
  if (!requestId) return { ok: false, error: 'requestId is required.' };

  const target = await resolvePlatformioTarget(payload.workspaceRoot, payload.activeFilePath);
  if (!target.ok) return { ok: false, error: target.error };

  const environment = resolveEnvironment(target.info, payload.environment);
  if (!environment.ok) {
    return {
      ok: true,
      result: {
        ok: false,
        status: 'missing_input',
        message: environment.error,
        workspaceRoot: target.workspaceRoot,
        projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
        environment: null,
        aborted: false
      }
    };
  }

  const args = buildPlatformioRunArgs(target.info.projectRoot, environment.value, 'clean');
  const runResult = await runPlatformio(args, target.workspaceRoot, undefined, outputChunkCallback);
  const command = [runResult.command, ...args];
  const errorSummary = extractErrorSummary(runResult.stdout, runResult.stderr);
  const success = runResult.exitCode === 0 && !runResult.error;
  const failureMessage =
    errorSummary.length > 0
      ? `PlatformIO clean failed with exit code ${runResult.exitCode ?? 'unknown'}. First error: ${errorSummary[0]}`
      : `PlatformIO clean failed with exit code ${runResult.exitCode ?? 'unknown'}.`;

  return {
    ok: true,
    result: {
      ok: success,
      status: success ? 'cleaned' : 'clean_failed',
      message: success ? 'PlatformIO clean completed successfully.' : runResult.error ?? failureMessage,
      workspaceRoot: target.workspaceRoot,
      projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
      environment: environment.value,
      command,
      exitCode: runResult.exitCode,
      aborted: runResult.aborted,
      errorSummary: errorSummary.length > 0 ? errorSummary : undefined,
      stdout: asOutputValue(runResult.stdout),
      stderr: asOutputValue(runResult.stderr)
    }
  };
}

export async function testPlatformioProject(
  payload: PlatformioCompilePayload,
  signal: AbortSignal,
  outputChunkCallback?: OutputChunkCallback
): Promise<PlatformioTestResponse> {
  const requestId = asNonBlankString(payload.requestId);
  if (!requestId) return { ok: false, error: 'requestId is required.' };

  const target = await resolvePlatformioTarget(payload.workspaceRoot, payload.activeFilePath);
  if (!target.ok) return { ok: false, error: target.error };

  const environment = resolveEnvironment(target.info, payload.environment);
  if (!environment.ok) {
    return {
      ok: true,
      result: {
        ok: false,
        status: 'missing_input',
        message: environment.error,
        workspaceRoot: target.workspaceRoot,
        projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
        environment: null,
        aborted: false
      }
    };
  }

  const args = buildPlatformioTestArgs(target.info.projectRoot, environment.value);
  const runResult = await runPlatformio(args, target.workspaceRoot, signal, outputChunkCallback);
  const command = [runResult.command, ...args];

  let status: PlatformioTestResult['status'] = 'test_failed';
  let message = `PlatformIO test failed with exit code ${runResult.exitCode ?? 'unknown'}.`;
  if (runResult.aborted) {
    status = 'test_cancelled';
    message = 'Test cancelled.';
  } else if (runResult.exitCode === 0 && !runResult.error) {
    status = 'tested';
    message = 'PlatformIO test completed successfully.';
  } else if (runResult.error) {
    message = runResult.error;
  } else if (runResult.stderr.trim()) {
    message = runResult.stderr.trim().split('\n').pop() ?? message;
  }

  return {
    ok: true,
    result: {
      ok: status === 'tested',
      status,
      message,
      workspaceRoot: target.workspaceRoot,
      projectRoot: toRelative(target.workspaceRoot, target.info.projectRoot),
      environment: environment.value,
      command,
      exitCode: runResult.exitCode,
      aborted: runResult.aborted,
      stdout: asOutputValue(runResult.stdout),
      stderr: asOutputValue(runResult.stderr),
      error: runResult.error
    }
  };
}

export async function parsePlatformioIniFile(filePath: string): Promise<{ envs: string[]; defaultEnvs: string[] }> {
  return parsePlatformioIni(await fs.readFile(filePath, 'utf8'));
}
