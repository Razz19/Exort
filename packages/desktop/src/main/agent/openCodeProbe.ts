import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function isolatedOpenCodeEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env, XDG_CONFIG_HOME: path.join(root, 'xdg-config'),
    XDG_DATA_HOME: path.join(root, 'xdg-data'), XDG_STATE_HOME: path.join(root, 'xdg-state'),
    XDG_CACHE_HOME: path.join(root, 'cache'), APPDATA: path.join(root, 'appdata'),
    LOCALAPPDATA: path.join(root, 'localappdata'),
    OPENCODE_CONFIG: undefined, OPENCODE_CONFIG_DIR: undefined, OPENCODE_CONFIG_CONTENT: undefined
  };
}

export function parseOpenCodeVersion(output: string): string | null {
  return /^(?:opencode\s+)?v?(\d+\.\d+\.\d+)\s*$/i.exec(output.trim())?.[1] ?? null;
}

/** Even --version may initialize logging. Never probe using the user's global paths. */
export async function readOpenCodeBinaryVersion(binary: string): Promise<string> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'exort-opencode-probe-'));
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile(binary, ['--version'], { timeout: 15000, killSignal: 'SIGKILL', maxBuffer: 65536,
        env: isolatedOpenCodeEnv(temporary), windowsHide: true }, (error, stdout) => {
        if (error) reject(new Error('OpenCode version check failed or timed out.'));
        else resolve(stdout);
      });
    });
    const version = parseOpenCodeVersion(output);
    if (!version) throw new Error('OpenCode reported an invalid version.');
    return version;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
