import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EXORT_MANAGED_ARDUINO_CLI_VERSION,
  getManagedArduinoCliStatus,
  resolveManagedArduinoCliBinary
} from '../arduinoCliBinary.js';
import { resolveArduinoCliReleaseTargetKey } from './arduinoCliReleaseInstaller.js';
import arduinoCliReleaseAssets from './arduinoCliReleaseAssets.json';
import opencodeReleaseAssets from './opencodeReleaseAssets.json';

test('Arduino CLI release target selection covers supported desktop platforms', () => {
  assert.equal(resolveArduinoCliReleaseTargetKey({ platform: 'darwin', arch: 'arm64' }), 'darwin-arm64');
  assert.equal(resolveArduinoCliReleaseTargetKey({ platform: 'darwin', arch: 'x64' }), 'darwin-x64');
  assert.equal(resolveArduinoCliReleaseTargetKey({ platform: 'linux', arch: 'x64' }), 'linux-x64');
  assert.equal(resolveArduinoCliReleaseTargetKey({ platform: 'linux', arch: 'arm64' }), 'linux-arm64');
  assert.equal(resolveArduinoCliReleaseTargetKey({ platform: 'win32', arch: 'x64' }), 'windows-x64');
});

test('Arduino CLI release target selection rejects unsupported platforms clearly', () => {
  assert.throws(
    () => resolveArduinoCliReleaseTargetKey({ platform: 'darwin', arch: 'arm' }),
    /Unsupported macOS architecture/
  );
  assert.throws(
    () => resolveArduinoCliReleaseTargetKey({ platform: 'freebsd', arch: 'x64' }),
    /Unsupported platform/
  );
});

test('Arduino CLI release assets exist for all supported targets', () => {
  const assets = arduinoCliReleaseAssets as Record<
    string,
    { archiveName?: string; archiveType?: string; binaryName?: string; sha256?: string }
  >;

  for (const key of ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'windows-x64']) {
    assert.equal(typeof assets[key]?.archiveName, 'string');
    assert.match(assets[key]?.archiveName ?? '', new RegExp(`arduino-cli_${EXORT_MANAGED_ARDUINO_CLI_VERSION}`));
    assert.equal(assets[key]?.binaryName, 'arduino-cli');
    assert.match(assets[key]?.sha256 ?? '', /^[a-f0-9]{64}$/);
  }
});

test('OpenCode release assets include sha256 for all supported targets', () => {
  const assets = opencodeReleaseAssets as Record<
    string,
    { archiveName?: string; archiveType?: string; binaryName?: string; sha256?: string }
  >;

  for (const key of [
    'darwin-arm64',
    'darwin-x64',
    'darwin-x64-baseline',
    'windows-x64',
    'windows-x64-baseline',
    'linux-x64',
    'linux-x64-baseline',
    'linux-x64-musl',
    'linux-x64-baseline-musl',
    'linux-arm64',
    'linux-arm64-musl'
  ]) {
    assert.equal(typeof assets[key]?.archiveName, 'string');
    assert.equal(assets[key]?.binaryName, 'opencode');
    assert.match(assets[key]?.sha256 ?? '', /^[a-f0-9]{64}$/);
  }
});

test('managed Arduino CLI status validates the managed binary without PATH', async () => {
  if (process.platform === 'win32') {
    return;
  }

  const previousRoot = process.env.EXORT_ARDUINO_CLI_RUNTIME_DIR;
  const previousPath = process.env.PATH;
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'exort-arduino-cli-test-'));

  try {
    process.env.EXORT_ARDUINO_CLI_RUNTIME_DIR = tempRoot;
    process.env.PATH = '';

    const resolved = await resolveManagedArduinoCliBinary();
    await mkdir(path.dirname(resolved.binaryPath), { recursive: true });
    await writeFile(
      resolved.binaryPath,
      '#!/bin/sh\nif [ "$1" = "version" ] || [ "$1" = "--version" ]; then echo "arduino-cli Version: test"; exit 0; fi\nexit 1\n'
    );
    await chmod(resolved.binaryPath, 0o755);

    const status = await getManagedArduinoCliStatus();
    assert.equal(status.installed, true);
    assert.equal(status.version, 'arduino-cli Version: test');
    assert.equal(status.binaryPath, resolved.binaryPath);
    assert.equal(status.source, 'managed');
  } finally {
    if (previousRoot === undefined) {
      delete process.env.EXORT_ARDUINO_CLI_RUNTIME_DIR;
    } else {
      process.env.EXORT_ARDUINO_CLI_RUNTIME_DIR = previousRoot;
    }
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
