import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseLatestOpenCodeRelease, compareOpenCodeVersions, selectOpenCodeTarget, verifyOpenCodeArchive, fetchLatestOpenCodeVersion } from '../../requirements/opencodeReleaseInstaller.js';
import { getActiveOpenCodeVersion, activateOpenCodeVersion, resolveManagedOpenCodeBinary, getManagedOpenCodeStatus } from '../openCodeBinary.js';
import { parseOpenCodeVersion } from '../openCodeProbe.js';
const feed = (version: string) => ({ version, active: true, channel: 'latest', metadata: { package: '@opencode/cli' } });
test('release selection accepts stable 2.x and rejects prereleases and other majors', () => {
  assert.equal(parseLatestOpenCodeRelease(feed('2.0.14')), '2.0.14');
  for (const version of ['1.99.0', '3.0.0', '2.0.15-beta', '2.01.0', '../2.0.14', '2.0.15+build']) assert.throws(() => parseLatestOpenCodeRelease(feed(version)));
  assert.throws(() => parseLatestOpenCodeRelease({ ...feed('2.0.15'), active: false }));
  assert.equal(compareOpenCodeVersions('2.0.100', '2.0.99'), 1);
  assert.equal(compareOpenCodeVersions('2.0.14', '2.1.0'), -1);
  assert.equal(compareOpenCodeVersions('2.0.14', '2.0.14'), 0);
});
test('platform selection preserves conservative CPU baseline and libc variants', () => {
  assert.equal(selectOpenCodeTarget('linux', 'x64', null, true), 'linux-x64-baseline-musl');
  assert.equal(selectOpenCodeTarget('linux', 'x64', true, true), 'linux-x64-musl');
  assert.equal(selectOpenCodeTarget('linux', 'arm64', null, true), 'linux-arm64-musl');
  assert.equal(selectOpenCodeTarget('win32', 'x64', false, false), 'windows-x64-baseline');
  assert.equal(selectOpenCodeTarget('darwin', 'arm64', null, false), 'darwin-arm64');
  assert.equal(selectOpenCodeTarget('darwin', 'x64', true, false), 'darwin-x64');
  assert.throws(() => selectOpenCodeTarget('linux', 'arm', null, false), /Unsupported/);
});
test('archive integrity and exact version reports reject corrupted or ambiguous data', () => {
  const data = Buffer.from('verified package');
  const integrity = 'sha512-' + createHash('sha512').update(data).digest('base64');
  assert.doesNotThrow(() => verifyOpenCodeArchive(data, integrity));
  assert.throws(() => verifyOpenCodeArchive(Buffer.from('corrupt'), integrity), /integrity/);
  assert.equal(parseOpenCodeVersion('2.0.14\n'), '2.0.14');
  assert.equal(parseOpenCodeVersion('2.0.14-beta'), null);
  assert.equal(parseOpenCodeVersion('untrusted output 2.0.14'), null);
});
test('offline checks fail predictably', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try { await assert.rejects(fetchLatestOpenCodeVersion(), /offline/); }
  finally { globalThis.fetch = original; }
});
test('newer managed versions persist and stored path traversal is rejected', async () => {
  const previous = process.env.EXORT_OPENCODE_RUNTIME_DIR;
  const root = await mkdtemp(path.join(os.tmpdir(), 'exort-v2-version-test-'));
  process.env.EXORT_OPENCODE_RUNTIME_DIR = root;
  try {
    assert.equal(await getActiveOpenCodeVersion(), '2.0.14');
    await activateOpenCodeVersion('2.1.3');
    assert.equal(await getActiveOpenCodeVersion(), '2.1.3');
    assert.ok((await resolveManagedOpenCodeBinary()).binaryPath.includes(path.join('managed', '2.1.3')));
    await writeFile(path.join(root, 'active-version.json'), JSON.stringify({ version: '../../escape' }));
    await assert.rejects(resolveManagedOpenCodeBinary(), /Invalid managed/);
    await rm(path.join(root, 'active-version.json'));
    const legacy = path.join(root, 'managed', '1.15.7', `${process.platform}-${process.arch}`);
    await mkdir(legacy, { recursive: true }); await writeFile(path.join(legacy, process.platform === 'win32' ? 'opencode.exe' : 'opencode'), 'never executed');
    assert.equal((await getManagedOpenCodeStatus()).version, '1.15.7');
    assert.equal((await getManagedOpenCodeStatus()).installed, false);
  } finally {
    if (previous === undefined) delete process.env.EXORT_OPENCODE_RUNTIME_DIR; else process.env.EXORT_OPENCODE_RUNTIME_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test('installer rejects wrong binary version after verifying archive integrity', { skip: process.platform === 'win32' }, async () => {
  const { execFile } = await import('node:child_process');
  const { readFile, chmod } = await import('node:fs/promises');
  const { installOpenCodeFromReleaseAssets, resolveOpenCodeReleaseAssetForCurrentTarget } = await import('../../requirements/opencodeReleaseInstaller.js');
  const previous = process.env.EXORT_OPENCODE_RUNTIME_DIR;
  const root = await mkdtemp(path.join(os.tmpdir(), 'exort-v2-archive-test-'));
  const original = globalThis.fetch;
  process.env.EXORT_OPENCODE_RUNTIME_DIR = root;
  try {
    const pinned = await resolveOpenCodeReleaseAssetForCurrentTarget();
    await mkdir(path.join(root, 'package/bin'), { recursive: true });
    await writeFile(path.join(root, 'package/bin/opencode'), '#!/bin/sh\necho 2.0.14\n');
    await chmod(path.join(root, 'package/bin/opencode'), 0o755);
    await new Promise<void>((resolve, reject) => execFile('tar', ['-czf', path.join(root, 'test.tgz'), '-C', root, 'package/bin/opencode'], e => e ? reject(e) : resolve()));
    const archive = await readFile(path.join(root, 'test.tgz'));
    const integrity = 'sha512-' + createHash('sha512').update(archive).digest('base64');
    globalThis.fetch = async input => String(input).includes('/2.0.15')
      ? Response.json({ name: pinned.package, version: '2.0.15', dist: { tarball: 'https://registry.npmjs.org/fixture.tgz', integrity } })
      : new Response(new Uint8Array(archive));
    const result = await installOpenCodeFromReleaseAssets({ version: '2.0.15' });
    assert.equal(result.ok, false);
    assert.match(result.message!, /expected version 2.0.15/);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.EXORT_OPENCODE_RUNTIME_DIR; else process.env.EXORT_OPENCODE_RUNTIME_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
