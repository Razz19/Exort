import os from 'node:os';
import path from 'node:path';

function getPathKey(env: NodeJS.ProcessEnv): string {
  if (process.platform !== 'win32') return 'PATH';

  const existing = Object.keys(env).find((key) => key.toLowerCase() === 'path');
  return existing ?? 'Path';
}

function getPathEntries(env: NodeJS.ProcessEnv): string[] {
  const pathKey = getPathKey(env);
  const raw = env[pathKey];
  return typeof raw === 'string' && raw.length > 0 ? raw.split(path.delimiter).filter(Boolean) : [];
}

function getCommonBinaryDirs(): string[] {
  const homeDir = os.homedir();

  if (process.platform === 'darwin') {
    return [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      '/opt/local/bin',
      '/opt/local/sbin',
      path.join(homeDir, '.local', 'bin'),
      path.join(homeDir, 'bin')
    ];
  }

  if (process.platform === 'linux') {
    return [
      '/usr/local/bin',
      '/usr/local/sbin',
      '/usr/bin',
      '/usr/sbin',
      path.join(homeDir, '.local', 'bin'),
      path.join(homeDir, 'bin')
    ];
  }

  return [];
}

export function withRuntimePathEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const pathKey = getPathKey(env);
  const nextEntries = Array.from(new Set([...getCommonBinaryDirs(), ...getPathEntries(env)]));

  return {
    ...env,
    [pathKey]: nextEntries.join(path.delimiter)
  };
}
