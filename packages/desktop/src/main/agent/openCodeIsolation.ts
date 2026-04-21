import { access, constants, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { resolveManagedOpenCodeBinary } from './openCodeBinary.js';

type IsolationPaths = {
  root: string;
  runtimeConfigRoot: string;
  runtimeDataRoot: string;
  runtimeStateRoot: string;
};

export type OpenCodeIsolationInfo = IsolationPaths & {
  envOverrides: NodeJS.ProcessEnv;
};

export type OpenCodeIsolationStatus = Partial<IsolationPaths> & {
  isolated: boolean;
  details?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown isolation error';
}

function buildIsolationPaths(managedRoot: string): IsolationPaths {
  const root = path.join(managedRoot, 'isolation');

  if (process.platform === 'win32') {
    const appData = path.join(root, 'appdata');
    const localAppData = path.join(root, 'localappdata');
    return {
      root,
      runtimeConfigRoot: appData,
      runtimeDataRoot: localAppData,
      runtimeStateRoot: localAppData
    };
  }

  return {
    root,
    runtimeConfigRoot: path.join(root, 'xdg-config'),
    runtimeDataRoot: path.join(root, 'xdg-data'),
    runtimeStateRoot: path.join(root, 'xdg-state')
  };
}

function buildEnvOverrides(paths: IsolationPaths): NodeJS.ProcessEnv {
  if (process.platform === 'win32') {
    return {
      EXORT_OPENCODE_ISOLATED: '1',
      APPDATA: paths.runtimeConfigRoot,
      LOCALAPPDATA: paths.runtimeDataRoot
    };
  }

  return {
    EXORT_OPENCODE_ISOLATED: '1',
    XDG_CONFIG_HOME: paths.runtimeConfigRoot,
    XDG_DATA_HOME: paths.runtimeDataRoot,
    XDG_STATE_HOME: paths.runtimeStateRoot
  };
}

async function ensureWritableDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await access(directory, constants.R_OK | constants.W_OK);
}

async function resolveIsolationPaths(): Promise<IsolationPaths> {
  const managed = await resolveManagedOpenCodeBinary();
  return buildIsolationPaths(managed.managedRoot);
}

export async function ensureOpenCodeIsolation(): Promise<OpenCodeIsolationInfo> {
  const paths = await resolveIsolationPaths();
  const directories = Array.from(
    new Set([paths.root, paths.runtimeConfigRoot, paths.runtimeDataRoot, paths.runtimeStateRoot])
  );

  for (const directory of directories) {
    await ensureWritableDirectory(directory);
  }

  return {
    ...paths,
    envOverrides: buildEnvOverrides(paths)
  };
}

export async function getOpenCodeIsolationStatus(): Promise<OpenCodeIsolationStatus> {
  let paths: IsolationPaths | null = null;

  try {
    paths = await resolveIsolationPaths();
    const directories = Array.from(new Set([paths.root, paths.runtimeConfigRoot, paths.runtimeDataRoot, paths.runtimeStateRoot]));
    for (const directory of directories) {
      await ensureWritableDirectory(directory);
    }

    return {
      isolated: true,
      ...paths
    };
  } catch (error) {
    return {
      isolated: false,
      root: paths?.root,
      runtimeConfigRoot: paths?.runtimeConfigRoot,
      runtimeDataRoot: paths?.runtimeDataRoot,
      runtimeStateRoot: paths?.runtimeStateRoot,
      details: getErrorMessage(error)
    };
  }
}
