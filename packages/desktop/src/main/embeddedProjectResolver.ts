import { type Dirent, promises as fs } from 'node:fs';
import path from 'node:path';

export type EmbeddedProjectKind = 'arduino' | 'platformio' | 'unknown';

export type PlatformioProjectInfo = {
  kind: 'platformio';
  workspaceRoot: string;
  activeFilePath: string;
  projectRoot: string;
  platformioIniPath: string;
  relativeProjectRoot: string;
  envs: string[];
  defaultEnvs: string[];
  resolvedEnv: string | null;
  envRequired: boolean;
};

export type ArduinoProjectInfo = {
  kind: 'arduino';
  workspaceRoot: string;
  activeFilePath: string;
  sketchPath: string;
  sketchDirectory: string;
  relativeSketchPath: string;
  relativeSketchDirectory: string;
};

export type UnknownProjectInfo = {
  kind: 'unknown';
  workspaceRoot: string;
  activeFilePath: string | null;
  reason: string;
};

export type EmbeddedProjectInfo = PlatformioProjectInfo | ArduinoProjectInfo | UnknownProjectInfo;

const DISCOVERY_IGNORE_DIRS = new Set(['.git', 'node_modules', '.turbo', 'dist', 'build', 'out', '.idea', '.vscode', '.pio']);
const MAX_DISCOVERED_SKETCHES = 20;

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/') || '.';
}

export function isPathInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relative = path.relative(workspaceRoot, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findNearestPlatformioIni(workspaceRoot: string, startPath: string): Promise<string | null> {
  let current = startPath;

  try {
    const stat = await fs.stat(current);
    if (stat.isFile()) current = path.dirname(current);
  } catch {
    current = path.dirname(current);
  }

  while (isPathInsideWorkspace(workspaceRoot, current)) {
    const candidate = path.join(current, 'platformio.ini');
    if (await pathExists(candidate)) return candidate;

    if (current === workspaceRoot) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

function stripIniInlineComment(value: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && (index === 0 || value[index - 1] !== '\\')) {
      quote = quote === char ? null : quote ?? char;
      continue;
    }
    if (!quote && (char === ';' || char === '#')) {
      return value.slice(0, index);
    }
  }
  return value;
}

function parseListValue(value: string): string[] {
  return stripIniInlineComment(value)
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter((item) => item.length > 0);
}

export function parsePlatformioIni(text: string): { envs: string[]; defaultEnvs: string[] } {
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

async function readPlatformioProject(
  workspaceRoot: string,
  activeFilePath: string,
  platformioIniPath: string
): Promise<PlatformioProjectInfo> {
  const text = await fs.readFile(platformioIniPath, 'utf8');
  const parsed = parsePlatformioIni(text);
  const projectRoot = path.dirname(platformioIniPath);
  const resolvedEnv = parsed.defaultEnvs.length === 0 && parsed.envs.length === 1 ? parsed.envs[0] ?? null : null;

  return {
    kind: 'platformio',
    workspaceRoot,
    activeFilePath,
    projectRoot,
    platformioIniPath,
    relativeProjectRoot: normalizeRelativePath(path.relative(workspaceRoot, projectRoot)),
    envs: parsed.envs,
    defaultEnvs: parsed.defaultEnvs,
    resolvedEnv,
    envRequired: parsed.defaultEnvs.length === 0 && parsed.envs.length > 1
  };
}

function shouldIgnoreDirectory(entry: Dirent): boolean {
  return DISCOVERY_IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.');
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
        if (!shouldIgnoreDirectory(entry)) queue.push(path.join(current, entry.name));
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.ino') continue;
      discovered.push(path.join(current, entry.name));
      if (discovered.length >= MAX_DISCOVERED_SKETCHES) break;
    }
  }

  return discovered;
}

function toArduinoInfo(workspaceRoot: string, activeFilePath: string, sketchPath: string): ArduinoProjectInfo {
  const sketchDirectory = path.dirname(sketchPath);
  return {
    kind: 'arduino',
    workspaceRoot,
    activeFilePath,
    sketchPath,
    sketchDirectory,
    relativeSketchPath: normalizeRelativePath(path.relative(workspaceRoot, sketchPath)),
    relativeSketchDirectory: normalizeRelativePath(path.relative(workspaceRoot, sketchDirectory))
  };
}

export async function detectEmbeddedProject(workspaceRootInput: unknown, activeFilePathInput: unknown): Promise<EmbeddedProjectInfo> {
  const workspaceRootRaw = asNonBlankString(workspaceRootInput);
  const activeFilePathRaw = asNonBlankString(activeFilePathInput);

  if (!workspaceRootRaw) {
    return { kind: 'unknown', workspaceRoot: '', activeFilePath: null, reason: 'workspaceRoot is required.' };
  }

  const workspaceRoot = path.resolve(workspaceRootRaw);
  if (!activeFilePathRaw) {
    return { kind: 'unknown', workspaceRoot, activeFilePath: null, reason: 'Open a file first.' };
  }

  const activeFilePath = path.resolve(activeFilePathRaw);
  if (!isPathInsideWorkspace(workspaceRoot, activeFilePath)) {
    return { kind: 'unknown', workspaceRoot, activeFilePath, reason: 'Active file must be inside the current workspace.' };
  }

  const platformioIniPath = await findNearestPlatformioIni(workspaceRoot, activeFilePath);
  if (platformioIniPath) {
    return readPlatformioProject(workspaceRoot, activeFilePath, platformioIniPath);
  }

  if (path.extname(activeFilePath).toLowerCase() === '.ino') {
    return toArduinoInfo(workspaceRoot, activeFilePath, activeFilePath);
  }

  const discoveredInoFiles = await discoverInoFiles(workspaceRoot);
  if (discoveredInoFiles.length === 1 && discoveredInoFiles[0]) {
    return toArduinoInfo(workspaceRoot, activeFilePath, discoveredInoFiles[0]);
  }

  return {
    kind: 'unknown',
    workspaceRoot,
    activeFilePath,
    reason:
      discoveredInoFiles.length > 1
        ? 'Multiple Arduino sketches found. Open the target .ino file.'
        : 'No Arduino sketch or PlatformIO project detected for the active file.'
  };
}
