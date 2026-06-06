import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { tool } from '@opencode-ai/plugin/tool';

type PlatformioCompileArgs = {
  projectPath?: string;
  environment?: string;
  verbose?: boolean;
};

type CompileRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  aborted: boolean;
  commandName: string;
};

type OutputChunkPayload = {
  stream: 'stdout' | 'stderr';
  chunk: string;
};

type OutputChunkCallback = (payload: OutputChunkPayload) => void;

const MAX_OUTPUT_LENGTH = 12000;
const MAX_ERROR_SUMMARY_LINES = 8;

function getRuntimePathKey(env: NodeJS.ProcessEnv): string {
  if (process.platform !== 'win32') return 'PATH';
  return Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path';
}

function buildRuntimePathEntries(): string[] {
  const home = process.env.HOME;
  const entries =
    process.platform === 'darwin'
      ? ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin', '/opt/local/bin', '/opt/local/sbin']
      : process.platform === 'linux'
        ? ['/usr/local/bin', '/usr/local/sbin', '/usr/bin', '/usr/sbin']
        : [];

  if (home) {
    entries.push(path.join(home, '.local', 'bin'));
    entries.push(path.join(home, 'bin'));
  }

  return entries;
}

function withToolRuntimePathEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const nextEnv: NodeJS.ProcessEnv = { ...env };
  const pathKey = getRuntimePathKey(nextEnv);
  const existingRaw = typeof nextEnv[pathKey] === 'string' ? nextEnv[pathKey] : '';
  const existingEntries = existingRaw
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const merged = [...buildRuntimePathEntries(), ...existingEntries].filter((entry, index, array) => array.indexOf(entry) === index);
  nextEnv[pathKey] = merged.join(path.delimiter);
  return nextEnv;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getWorkspaceRoot(context: unknown): string {
  const record = asRecord(context);
  const directory = asNonBlankString(record.directory);
  return directory ? path.resolve(directory) : process.cwd();
}

function getOutputChunkCallback(context: unknown): OutputChunkCallback | undefined {
  const record = asRecord(context);
  const callback = record.outputChunkCallback;
  return typeof callback === 'function' ? (callback as OutputChunkCallback) : undefined;
}

function toWorkspaceRelative(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  return relative ? relative.replace(/\\/g, '/') : '.';
}

function isInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relative = path.relative(workspaceRoot, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function stripIniInlineComment(value: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && (index === 0 || value[index - 1] !== '\\')) {
      quote = quote === char ? null : quote ?? char;
      continue;
    }
    if (!quote && (char === ';' || char === '#')) return value.slice(0, index);
  }
  return value;
}

function parseListValue(value: string): string[] {
  return stripIniInlineComment(value)
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter((item) => item.length > 0);
}

function parsePlatformioIni(text: string): { envs: string[]; defaultEnvs: string[] } {
  const envs: string[] = [];
  const defaultEnvs: string[] = [];
  let section = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch?.[1]) {
      section = sectionMatch[1].trim();
      const envMatch = section.match(/^env:([^\]]+)$/);
      if (envMatch?.[1]) {
        const env = envMatch[1].trim();
        if (env && !envs.includes(env)) envs.push(env);
      }
      continue;
    }

    if (section !== 'platformio') continue;
    const optionMatch = line.match(/^default_envs\s*=\s*(.*)$/);
    if (!optionMatch?.[1]) continue;
    for (const env of parseListValue(optionMatch[1])) {
      if (!defaultEnvs.includes(env)) defaultEnvs.push(env);
    }
  }

  return { envs, defaultEnvs };
}

async function resolveProjectRoot(workspaceRoot: string, projectPath?: string): Promise<string> {
  const candidate = projectPath ? path.resolve(workspaceRoot, projectPath) : workspaceRoot;
  if (!isInsideWorkspace(workspaceRoot, candidate)) {
    throw new Error(`projectPath must stay inside workspace: ${projectPath}`);
  }

  const stat = await fs.stat(candidate);
  const projectRoot = stat.isFile() ? path.dirname(candidate) : candidate;
  const iniPath = path.join(projectRoot, 'platformio.ini');
  await fs.access(iniPath);
  return projectRoot;
}

function truncateOutput(value: string): string {
  if (value.length <= MAX_OUTPUT_LENGTH) return value;
  const marker = `...[truncated ${value.length - MAX_OUTPUT_LENGTH} chars; showing most recent output]...\n`;
  const tailLength = Math.max(0, MAX_OUTPUT_LENGTH - marker.length);
  return `${marker}${value.slice(-tailLength)}`;
}

function asOutputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return truncateOutput(trimmed);
}

function toJsonOutput(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
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

function runVersionCheck(commandName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(commandName, ['--version'], { env: withToolRuntimePathEnv() });
    proc.once('error', () => resolve(false));
    proc.once('close', (exitCode) => resolve(exitCode === 0));
  });
}

async function resolvePlatformioCommand(): Promise<string> {
  if (await runVersionCheck('pio')) return 'pio';
  if (await runVersionCheck('platformio')) return 'platformio';
  throw new Error('PlatformIO CLI not found. Install PlatformIO Core and make sure "pio" or "platformio" is available in PATH.');
}

async function runPlatformioCompile(
  workspaceRoot: string,
  args: string[],
  signal: AbortSignal | undefined,
  outputChunkCallback?: OutputChunkCallback
): Promise<CompileRunResult> {
  const tempRoot = path.join(workspaceRoot, '.exort', 'tmp');
  await fs.mkdir(tempRoot, { recursive: true });
  let commandName: string;
  try {
    commandName = await resolvePlatformioCommand();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve PlatformIO CLI.';
    outputChunkCallback?.({ stream: 'stderr', chunk: `[PlatformIO] ${message}\n` });
    return {
      commandName: 'pio',
      exitCode: null,
      stdout: '',
      stderr: '',
      error: message,
      aborted: false
    };
  }
  const runtimeEnv = {
    ...withToolRuntimePathEnv(),
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    TEMPDIR: tempRoot
  };
  outputChunkCallback?.({ stream: 'stdout', chunk: `[PlatformIO] Command: ${[commandName, ...args].join(' ')}\n` });

  return new Promise((resolve) => {
    const proc = spawn(commandName, args, signal ? { cwd: workspaceRoot, env: runtimeEnv, signal } : { cwd: workspaceRoot, env: runtimeEnv });
    let stdout = '';
    let stderr = '';
    let done = false;

    const settle = (result: CompileRunResult) => {
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
      const message = wasAborted ? 'Command was aborted.' : error instanceof Error ? error.message : String(error);
      outputChunkCallback?.({ stream: 'stderr', chunk: `[PlatformIO] Failed to start command: ${message}\n` });
      settle({
        commandName,
        exitCode: null,
        stdout,
        stderr,
        error: message,
        aborted: wasAborted
      });
    });

    proc.once('close', (exitCode, closeSignal) => {
      settle({
        commandName,
        exitCode,
        stdout,
        stderr,
        aborted: signal?.aborted === true || closeSignal != null
      });
    });
  });
}

export default tool({
  description: 'Compile PlatformIO projects using pio run.',
  args: {
    projectPath: tool.schema
      .string()
      .optional()
      .describe('PlatformIO project directory containing platformio.ini, relative to the current workspace root. Defaults to workspace root.'),
    environment: tool.schema.string().optional().describe('Optional PlatformIO environment name from [env:name].'),
    verbose: tool.schema.boolean().optional().describe('When true, run pio with verbose output.')
  },
  async execute(args: PlatformioCompileArgs, context: unknown): Promise<string> {
    const workspaceRoot = getWorkspaceRoot(context);
    let projectRoot: string;

    try {
      projectRoot = await resolveProjectRoot(workspaceRoot, args.projectPath);
    } catch (error) {
      return toJsonOutput({
        ok: false,
        status: 'missing_input',
        missing: ['projectPath'],
        message: error instanceof Error ? error.message : String(error),
        workspaceRoot
      });
    }

    const iniPath = path.join(projectRoot, 'platformio.ini');
    const parsed = parsePlatformioIni(await fs.readFile(iniPath, 'utf8'));
    const requestedEnvironment = asNonBlankString(args.environment);
    let environment: string | null = null;
    const missing: string[] = [];

    if (requestedEnvironment) {
      if (parsed.envs.length > 0 && !parsed.envs.includes(requestedEnvironment)) {
        return toJsonOutput({
          ok: false,
          status: 'missing_input',
          missing: ['environment'],
          message: `PlatformIO environment not found in platformio.ini: ${requestedEnvironment}`,
          workspaceRoot,
          projectRoot: toWorkspaceRelative(workspaceRoot, projectRoot),
          envs: parsed.envs,
          defaultEnvs: parsed.defaultEnvs
        });
      }
      environment = requestedEnvironment;
    } else if (parsed.defaultEnvs.length === 0 && parsed.envs.length === 1) {
      environment = parsed.envs[0] ?? null;
    } else if (parsed.defaultEnvs.length === 0 && parsed.envs.length > 1) {
      missing.push('environment');
    }

    if (missing.length > 0) {
      return toJsonOutput({
        ok: false,
        status: 'missing_input',
        missing,
        message: 'Multiple PlatformIO environments were found. Ask the user which environment to use, then call platformioCompile again.',
        workspaceRoot,
        projectRoot: toWorkspaceRelative(workspaceRoot, projectRoot),
        envs: parsed.envs,
        defaultEnvs: parsed.defaultEnvs
      });
    }

    const compileArgs = ['run', '-d', projectRoot];
    if (environment) compileArgs.push('-e', environment);
    if (args.verbose === true) compileArgs.push('-v');

    const abortSignal = asRecord(context).abort;
    const outputChunkCallback = getOutputChunkCallback(context);
    const runResult = await runPlatformioCompile(
      workspaceRoot,
      compileArgs,
      abortSignal instanceof AbortSignal ? abortSignal : undefined,
      outputChunkCallback
    );

    const command = [runResult.commandName, ...compileArgs];
    const errorSummary = extractErrorSummary(runResult.stdout, runResult.stderr);
    const success = runResult.exitCode === 0 && !runResult.error;
    const defaultFailureMessage = `PlatformIO compile failed with exit code ${runResult.exitCode ?? 'unknown'}.`;
    const failureMessage =
      errorSummary.length > 0 ? `${defaultFailureMessage} First error: ${errorSummary[0]}` : defaultFailureMessage;

    return toJsonOutput({
      ok: success,
      status: success ? 'compiled' : 'compile_failed',
      message: success ? 'PlatformIO compile completed successfully.' : runResult.error ?? failureMessage,
      workspaceRoot,
      projectRoot: toWorkspaceRelative(workspaceRoot, projectRoot),
      environment,
      command,
      exitCode: runResult.exitCode,
      aborted: runResult.aborted,
      errorSummary: errorSummary.length > 0 ? errorSummary : undefined,
      stdout: asOutputValue(runResult.stdout),
      stderr: asOutputValue(runResult.stderr),
      envs: parsed.envs,
      defaultEnvs: parsed.defaultEnvs
    });
  }
});
