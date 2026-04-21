import { spawn } from 'node:child_process';
import { type Dirent, promises as fs } from 'node:fs';
import path from 'node:path';

import { tool } from '@opencode-ai/plugin/tool';

type ArduinoCompileArgs = {
  sketchPath?: string;
  fqbn?: string;
  buildPath?: string;
  clean?: boolean;
  exportBinaries?: boolean;
  verbose?: boolean;
};

type CompileRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  aborted: boolean;
};

type OutputChunkPayload = {
  stream: 'stdout' | 'stderr';
  chunk: string;
};

type OutputChunkCallback = (payload: OutputChunkPayload) => void;

const MAX_OUTPUT_LENGTH = 12000;
const MAX_ERROR_SUMMARY_LINES = 8;
const MAX_DISCOVERED_SKETCHES = 20;
const MAX_REPORTED_CANDIDATES = 8;
const SKETCH_DISCOVERY_IGNORE = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'dist',
  'build',
  'out',
  '.idea',
  '.vscode'
]);

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

function toWorkspaceRelative(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(workspaceRoot, targetPath);
  if (!relative) return '.';
  return relative;
}

function isInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relative = path.relative(workspaceRoot, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
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
    line.includes('compilation error')
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

async function readTextFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function inferFqbnFromSketchYaml(workspaceRoot: string): Promise<{ fqbn: string; source: string } | null> {
  const candidates = ['sketch.yaml', 'sketch.yml'];
  for (const candidate of candidates) {
    const filePath = path.join(workspaceRoot, candidate);
    const text = await readTextFileIfExists(filePath);
    if (!text) continue;

    const defaultFqbnMatch = text.match(/^\s*default_fqbn\s*:\s*["']?([^"'#\s]+)["']?/m);
    const fqbnMatch = text.match(/^\s*fqbn\s*:\s*["']?([^"'#\s]+)["']?/m);
    const resolved = defaultFqbnMatch?.[1] ?? fqbnMatch?.[1];
    if (!resolved) continue;

    return {
      fqbn: resolved,
      source: candidate
    };
  }

  return null;
}

async function inferFqbnFromJsonFile(
  workspaceRoot: string,
  relativePath: string
): Promise<{ fqbn: string; source: string } | null> {
  const filePath = path.join(workspaceRoot, relativePath);
  const text = await readTextFileIfExists(filePath);
  if (!text) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = asRecord(JSON.parse(text));
  } catch {
    return null;
  }

  const fqbn = asNonBlankString(parsed.fqbn) ?? asNonBlankString(parsed.board);
  if (!fqbn) return null;

  return {
    fqbn,
    source: relativePath
  };
}

async function inferFqbn(workspaceRoot: string): Promise<{ fqbn: string; source: string } | null> {
  const fromSketchYaml = await inferFqbnFromSketchYaml(workspaceRoot);
  if (fromSketchYaml) return fromSketchYaml;

  const fromVsCode = await inferFqbnFromJsonFile(workspaceRoot, '.vscode/arduino.json');
  if (fromVsCode) return fromVsCode;

  const fromArduinoJson = await inferFqbnFromJsonFile(workspaceRoot, 'arduino.json');
  if (fromArduinoJson) return fromArduinoJson;

  const fromSketchJson = await inferFqbnFromJsonFile(workspaceRoot, 'sketch.json');
  if (fromSketchJson) return fromSketchJson;

  return null;
}

function shouldIgnoreDirectory(name: string): boolean {
  if (SKETCH_DISCOVERY_IGNORE.has(name)) return true;
  return name.startsWith('.');
}

async function discoverInoFiles(workspaceRoot: string): Promise<string[]> {
  const queue = [workspaceRoot];
  const discovered: string[] = [];

  while (queue.length > 0 && discovered.length < MAX_DISCOVERED_SKETCHES) {
    const current = queue.shift();
    if (!current) break;

    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!shouldIgnoreDirectory(entry.name)) {
          queue.push(path.join(current, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== '.ino') continue;
      discovered.push(path.join(current, entry.name));
      if (discovered.length >= MAX_DISCOVERED_SKETCHES) {
        break;
      }
    }
  }

  return discovered;
}

async function resolveSketchDirectory(workspaceRoot: string, sketchPath: string): Promise<string> {
  const resolved = path.resolve(workspaceRoot, sketchPath);
  if (!isInsideWorkspace(workspaceRoot, resolved)) {
    throw new Error(`sketchPath must stay inside workspace: ${sketchPath}`);
  }

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new Error(`sketchPath does not exist: ${sketchPath}`);
  }

  if (stat.isDirectory()) {
    return resolved;
  }

  if (!stat.isFile()) {
    throw new Error(`sketchPath must be a directory or .ino file: ${sketchPath}`);
  }

  if (path.extname(resolved).toLowerCase() !== '.ino') {
    throw new Error(`sketchPath file must end with .ino: ${sketchPath}`);
  }

  return path.dirname(resolved);
}

async function runArduinoCompile(
  workspaceRoot: string,
  args: string[],
  signal: AbortSignal | undefined,
  outputChunkCallback?: OutputChunkCallback
): Promise<CompileRunResult> {
  const tempRoot = path.join(workspaceRoot, '.exort', 'tmp');
  await fs.mkdir(tempRoot, { recursive: true });

  const runtimeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: tempRoot,
    TMP: tempRoot,
    TEMP: tempRoot,
    TEMPDIR: tempRoot
  };

  return new Promise((resolve) => {
    const spawnOptions = signal
      ? { cwd: workspaceRoot, env: runtimeEnv, signal }
      : { cwd: workspaceRoot, env: runtimeEnv };
    const proc = spawn('arduino-cli', args, spawnOptions);

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
      const message =
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'arduino-cli not found in PATH.'
          : error instanceof Error
            ? error.message
            : String(error);
      settle({
        exitCode: null,
        stdout,
        stderr,
        error: message,
        aborted: message.includes('aborted')
      });
    });

    proc.once('close', (code, closeSignal) => {
      settle({
        exitCode: code,
        stdout,
        stderr,
        aborted: closeSignal != null
      });
    });
  });
}

export default tool({
  description: 'Compile Arduino sketches using arduino-cli compile.',
  args: {
    sketchPath: tool.schema
      .string()
      .optional()
      .describe('Sketch directory or .ino file path, relative to the current workspace root.'),
    fqbn: tool.schema.string().optional().describe('Board FQBN, for example: arduino:avr:uno.'),
    buildPath: tool.schema
      .string()
      .optional()
      .describe('Optional output build path, relative to the workspace root.'),
    clean: tool.schema.boolean().optional().describe('When true, run compile with --clean.'),
    exportBinaries: tool.schema.boolean().optional().describe('When true, run compile with --export-binaries.'),
    verbose: tool.schema.boolean().optional().describe('When true, run compile with --verbose.')
  },
  async execute(args: ArduinoCompileArgs, context: unknown): Promise<string> {
    const workspaceRoot = getWorkspaceRoot(context);
    const missing: string[] = [];
    const hints: string[] = [];
    const inferred: Record<string, unknown> = {};

    let sketchDirectory: string | null = null;
    const providedSketchPath = asNonBlankString(args.sketchPath);

    if (providedSketchPath) {
      try {
        sketchDirectory = await resolveSketchDirectory(workspaceRoot, providedSketchPath);
      } catch (error) {
        return toJsonOutput({
          ok: false,
          status: 'compile_failed',
          message: error instanceof Error ? error.message : String(error),
          workspaceRoot
        });
      }
    } else {
      const discoveredInoFiles = await discoverInoFiles(workspaceRoot);
      if (discoveredInoFiles.length === 1) {
        const discoveredSketch = discoveredInoFiles[0];
        if (!discoveredSketch) {
          missing.push('sketchPath');
        } else {
          sketchDirectory = path.dirname(discoveredSketch);
          inferred.sketchPath = toWorkspaceRelative(workspaceRoot, sketchDirectory);
        }
      } else {
        missing.push('sketchPath');
        if (discoveredInoFiles.length === 0) {
          hints.push('No .ino files were found in the current workspace.');
        } else {
          const sketchCandidates = discoveredInoFiles
            .slice(0, MAX_REPORTED_CANDIDATES)
            .map((filePath) => toWorkspaceRelative(workspaceRoot, filePath));
          inferred.sketchCandidates = sketchCandidates;
          hints.push('Multiple sketches were found. Provide sketchPath to choose one.');
        }
      }
    }

    let fqbn = asNonBlankString(args.fqbn);
    if (!fqbn) {
      const inferredFqbn = await inferFqbn(workspaceRoot);
      if (inferredFqbn) {
        fqbn = inferredFqbn.fqbn;
        inferred.fqbn = inferredFqbn.fqbn;
        inferred.fqbnSource = inferredFqbn.source;
      } else {
        missing.push('fqbn');
        hints.push('Provide fqbn, for example: arduino:avr:uno');
      }
    }

    if (missing.length > 0) {
      return toJsonOutput({
        ok: false,
        status: 'missing_input',
        missing,
        message: `Missing required compile inputs (${missing.join(', ')}). Ask the user for these values and call arduinoCompile again.`,
        hints,
        inferred,
        workspaceRoot
      });
    }

    if (!sketchDirectory || !fqbn) {
      return toJsonOutput({
        ok: false,
        status: 'compile_failed',
        message: 'Internal validation failed before running compile.',
        workspaceRoot
      });
    }

    const compileArgs = ['compile', sketchDirectory, '--fqbn', fqbn];
    const providedBuildPath = asNonBlankString(args.buildPath);
    if (providedBuildPath) {
      const resolvedBuildPath = path.resolve(workspaceRoot, providedBuildPath);
      if (!isInsideWorkspace(workspaceRoot, resolvedBuildPath)) {
        return toJsonOutput({
          ok: false,
          status: 'compile_failed',
          message: `buildPath must stay inside workspace: ${providedBuildPath}`,
          workspaceRoot
        });
      }

      await fs.mkdir(resolvedBuildPath, { recursive: true });
      compileArgs.push('--build-path', resolvedBuildPath);
      inferred.buildPath = toWorkspaceRelative(workspaceRoot, resolvedBuildPath);
    }

    if (args.clean === true) compileArgs.push('--clean');
    if (args.exportBinaries === true) compileArgs.push('--export-binaries');
    if (args.verbose === true) compileArgs.push('--verbose');

    const abortSignal = asRecord(context).abort;
    const outputChunkCallback = getOutputChunkCallback(context);
    const runResult = await runArduinoCompile(
      workspaceRoot,
      compileArgs,
      abortSignal instanceof AbortSignal ? abortSignal : undefined,
      outputChunkCallback
    );

    const command = ['arduino-cli', ...compileArgs];
    const errorSummary = extractErrorSummary(runResult.stdout, runResult.stderr);
    const defaultFailureMessage = `arduino-cli compile failed with exit code ${runResult.exitCode ?? 'unknown'}.`;
    const failureMessage =
      errorSummary.length > 0 ? `${defaultFailureMessage} First error: ${errorSummary[0]}` : defaultFailureMessage;
    const response = {
      ok: runResult.exitCode === 0 && !runResult.error,
      status: runResult.exitCode === 0 && !runResult.error ? 'compiled' : 'compile_failed',
      message:
        runResult.exitCode === 0 && !runResult.error
          ? 'Arduino compile completed successfully.'
          : runResult.error ?? failureMessage,
      workspaceRoot,
      sketchDirectory: toWorkspaceRelative(workspaceRoot, sketchDirectory),
      fqbn,
      command,
      exitCode: runResult.exitCode,
      aborted: runResult.aborted,
      errorSummary: errorSummary.length > 0 ? errorSummary : undefined,
      stdout: asOutputValue(runResult.stdout),
      stderr: asOutputValue(runResult.stderr),
      inferred
    };

    return toJsonOutput(response);
  }
});
