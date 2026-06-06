import { spawn } from 'node:child_process';

import { withRuntimePathEnv } from './runtimeEnv.js';

export type PlatformioCliResolution = {
  command: string;
  version: string;
};

type VersionCheckResult = {
  ok: boolean;
  version: string;
  error?: string;
};

function runVersionCheck(command: string): Promise<VersionCheckResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, ['--version'], {
      env: withRuntimePathEnv()
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.once('error', (error) => {
      const message =
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? `${command} was not found in PATH.`
          : error instanceof Error
            ? error.message
            : String(error);
      resolve({ ok: false, version: '', error: message });
    });

    proc.once('close', (exitCode) => {
      if (exitCode !== 0) {
        const detail = stderr.trim() || stdout.trim() || `${command} --version exited with code ${exitCode}`;
        resolve({ ok: false, version: '', error: detail });
        return;
      }

      resolve({ ok: true, version: stdout.trim() || stderr.trim() || command });
    });
  });
}

export async function resolvePlatformioCliBinary(): Promise<PlatformioCliResolution> {
  const candidates = ['pio', 'platformio'];
  const errors: string[] = [];

  for (const command of candidates) {
    const result = await runVersionCheck(command);
    if (result.ok) {
      return {
        command,
        version: result.version
      };
    }
    if (result.error) errors.push(`${command}: ${result.error}`);
  }

  throw new Error(
    `PlatformIO CLI not found. Install PlatformIO Core and make sure "pio" or "platformio" is available in PATH. ${errors.join(' ')}`
  );
}

export function withPlatformioRuntimeEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return withRuntimePathEnv(env);
}
