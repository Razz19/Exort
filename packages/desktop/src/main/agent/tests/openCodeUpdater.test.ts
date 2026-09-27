import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createOpenCodeUpdater } from '../../updater/openCodeUpdater.js';
import type { OpenCodeRuntime } from '../openCode.js';
import type { OpenCodeUpdateState } from '../../../shared/openCodeUpdater.js';

async function fixture(version = '2.0.14', fail = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'exort-updater-test-'));
  await mkdir(path.join(root, 'isolation')); await writeFile(path.join(root, 'isolation/history'), 'original');
  let current = version, candidate: string | undefined, busy = false, networkFailure = false, downloads = 0, starts = 0;
  let staged: string | undefined;
  const states: OpenCodeUpdateState[] = [];
  const updater = createOpenCodeUpdater({
    getManagedRoot: async () => root,
    getManagedOpenCodeStatus: async () => ({ installed: current.startsWith('2.'), version: current, source: 'managed', binaryPath: 'fixture', managedVersion: '2.0.14' }),
    getActiveOpenCodeVersion: async () => current.startsWith('2.') ? current : '2.0.14',
    fetchLatestOpenCodeVersion: async () => { if (networkFailure) throw new Error('offline'); return '2.0.15'; },
    resolveOpenCodeReleaseAssetForCurrentTarget: async () => ({ targetKey: 'linux-x64', package: '@opencode/cli-linux-x64', version: '2.0.15', archiveName: 'test.tgz', archiveType: 'tar.gz', binaryName: 'opencode', url: 'https://registry.npmjs.org/test', integrity: 'test' }),
    installOpenCodeFromReleaseAssets: async () => {
      downloads++;
      staged = await mkdtemp(path.join(root, 'stage-')); await writeFile(path.join(staged, 'opencode'), 'verified fixture');
      return { ok: true, binaryPath: path.join(staged, 'opencode') };
    },
    resolveManagedOpenCodeBinary: async v => ({ source: 'managed', managedRoot: root, managedVersion: v!, binaryPath: path.join(root, 'managed', v!, 'linux-x64/opencode'), installRoot: path.join(root, 'managed', v!, 'linux-x64'), platformKey: 'linux-x64' }),
    getExistingOpenCodeRuntime: async () => null,
    shutdownOpenCodeRuntime: async () => {},
    setCandidateOpenCodeVersion: v => { candidate = v; },
    getOpenCodeRuntime: async () => {
      starts++;
      if (candidate) await writeFile(path.join(root, 'isolation/history'), 'migrated');
      if (candidate && fail) throw new Error('migration test failure');
      return { native: { server: { info: async () => ({ version: candidate || current }) }, provider: { list: async () => ({ data: [] }) } } } as unknown as OpenCodeRuntime;
    },
    activateOpenCodeVersion: async v => { current = v; }
  });
  updater.configureOpenCodeUpdater({ automaticChecks: true, isAgentBusy: () => busy, onState: s => { states.push(s); if (s.status === 'waiting-for-idle') busy = false; } });
  return { updater, root, states, setBusy: () => { busy = true; }, offline: () => { networkFailure = true; }, counters: () => ({ current, downloads, starts, candidate }), cleanup: () => rm(root, { recursive: true, force: true }) };
}
test('concurrent check/install requests install once, wait for idle and commit after smoke checks', async () => {
  const f = await fixture();
  try {
    f.setBusy();
    const checking = f.updater.checkOpenCodeUpdate();
    const installing = f.updater.installOpenCodeUpdate();
    assert.equal(f.updater.installOpenCodeUpdate(), installing);
    await checking;
    assert.equal((await installing).ok, true);
    assert.deepEqual(f.counters(), { current: '2.0.15', downloads: 1, starts: 1, candidate: undefined });
    assert.ok(f.states.some(s => s.status === 'waiting-for-idle'));
    assert.equal(f.states.at(-1)!.status, 'updated');
    assert.equal(existsSync(path.join(f.root, 'activation.json')), false);
  } finally { await f.cleanup(); }
});
test('failed later 2.x update restores the previous data and restarts previous runtime', async () => {
  const f = await fixture('2.0.14', true);
  try {
    await f.updater.checkOpenCodeUpdate();
    assert.equal((await f.updater.installOpenCodeUpdate()).ok, false);
    assert.equal(await readFile(path.join(f.root, 'isolation/history'), 'utf8'), 'original');
    assert.equal(f.counters().current, '2.0.14');
    assert.equal(f.counters().starts, 2);
    assert.equal(existsSync(path.join(f.root, 'managed/2.0.15/linux-x64')), false);
  } finally { await f.cleanup(); }
});
test('failed initial migration retains v1 data and backup without running v1', async () => {
  const f = await fixture('1.15.7', true);
  try {
    assert.equal((await f.updater.getOpenCodeUpdateState()).status, 'available');
    assert.equal((await f.updater.installOpenCodeUpdate()).ok, false);
    assert.equal(f.counters().starts, 1);
    assert.equal(await readFile(path.join(f.root, 'isolation/history'), 'utf8'), 'original');
    assert.ok(existsSync(path.join(f.root, 'backups')));
  } finally { await f.cleanup(); }
});
test('offline background errors are marked quiet and manual errors are actionable', async () => {
  const f = await fixture();
  try {
    f.offline();
    const background = await f.updater.checkOpenCodeUpdate(true);
    assert.equal(background.ok, false); assert.equal(background.state?.background, true);
    const manual = await f.updater.checkOpenCodeUpdate(false);
    assert.equal(manual.state?.background, false); assert.match(manual.error!, /offline/);
  } finally { await f.cleanup(); }
});

test('older feed versions never downgrade an active newer runtime', async () => {
  const f = await fixture('2.0.100');
  try {
    assert.equal((await f.updater.checkOpenCodeUpdate()).state?.status, 'up-to-date');
    assert.equal((await f.updater.installOpenCodeUpdate()).ok, true);
    assert.equal(f.counters().current, '2.0.100'); assert.equal(f.counters().downloads, 0);
  } finally { await f.cleanup(); }
});
test('explicit system overrides stay externally managed', async () => {
  const updater = createOpenCodeUpdater({ getManagedOpenCodeStatus: async () => ({ installed: true, version: '2.0.14', source: 'system', binaryPath: '/external/opencode', managedVersion: '2.0.14' }) });
  assert.equal((await updater.getOpenCodeUpdateState()).status, 'external');
  assert.equal((await updater.checkOpenCodeUpdate()).state?.status, 'external');
  assert.equal((await updater.installOpenCodeUpdate()).ok, false);
});
