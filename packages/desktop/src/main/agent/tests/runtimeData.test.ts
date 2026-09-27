import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { OpenCodeClient } from '@opencode/client';
import { snapshotRuntimeData, restoreRuntimeData, prepareV2Migration, waitForV2Migration, recoverInterruptedActivation } from '../runtimeData.js';
import { withRuntimeCall, withRuntimeMaintenance, assertRuntimeAvailable } from '../runtimeAccess.js';

async function root() { const p = await mkdtemp(path.join(os.tmpdir(), 'exort-v2-data-test-')); await mkdir(path.join(p, 'isolation')); return p; }
test('pre-v2 backup is immutable and failed migration preserves it', async () => {
  const p = await root();
  try {
    await writeFile(path.join(p, 'isolation', 'history'), 'legacy history');
    await prepareV2Migration(p);
    await writeFile(path.join(p, 'isolation', 'history'), 'partly migrated');
    await prepareV2Migration(p);
    const client = { migration: { v1: { status: async () => ({ status: 'error', error: 'test failure' }) } } } as unknown as OpenCodeClient;
    await assert.rejects(waitForV2Migration(client, p), /backup has been preserved/);
    assert.equal(await readFile(path.join(p, 'backups/before-v2/isolation/history'), 'utf8'), 'legacy history');
    assert.equal(existsSync(path.join(p, 'v2-migration-completed.json')), false);
  } finally { await rm(p, { recursive: true, force: true }); }
});
test('rollback restores data, credentials, active version and migration marker together', async () => {
  const p = await root();
  try {
    await writeFile(path.join(p, 'isolation', 'credentials'), 'test-only-token');
    await writeFile(path.join(p, 'active-version.json'), JSON.stringify({ version: '2.0.14' }));
    const backup = await snapshotRuntimeData(p, 'before-test');
    await writeFile(path.join(p, 'isolation', 'credentials'), 'changed');
    await writeFile(path.join(p, 'v2-migration-completed.json'), '{}');
    await restoreRuntimeData(p, backup);
    assert.equal(await readFile(path.join(p, 'isolation/credentials'), 'utf8'), 'test-only-token');
    assert.equal(existsSync(path.join(p, 'v2-migration-completed.json')), false);
    assert.equal(JSON.parse(await readFile(path.join(p, 'active-version.json'), 'utf8')).version, '2.0.14');
  } finally { await rm(p, { recursive: true, force: true }); }
});
test('startup recovers an interrupted first activation without starting v1', async () => {
  const p = await root();
  try {
    await writeFile(path.join(p, 'isolation/history'), 'v1');
    await snapshotRuntimeData(p, 'before-test');
    await writeFile(path.join(p, 'isolation/history'), 'incomplete v2');
    const install = path.join(p, 'managed/2.0.14/darwin-arm64');
    await mkdir(install, { recursive: true }); await writeFile(path.join(install, 'opencode'), 'candidate');
    await writeFile(path.join(p, 'activation.json'), JSON.stringify({ id: 'test', target: '2.0.14', platform: 'darwin-arm64', backup: 'before-test' }));
    await recoverInterruptedActivation(p);
    assert.equal(await readFile(path.join(p, 'isolation/history'), 'utf8'), 'v1');
    assert.equal(existsSync(install), false);
    assert.equal(existsSync(path.join(p, 'backups/before-test')), true);
    await recoverInterruptedActivation(p); // idempotent
  } finally { await rm(p, { recursive: true, force: true }); }
});
test('a committed activation is retained after interruption during journal cleanup', async () => {
  const p = await root();
  try {
    await writeFile(path.join(p, 'activation.json'), JSON.stringify({ id: 'test', target: '2.0.15', platform: 'linux-x64', backup: 'before-test' }));
    await writeFile(path.join(p, 'active-version.json'), JSON.stringify({ version: '2.0.15', transactionID: 'test' }));
    await recoverInterruptedActivation(p);
    assert.equal(existsSync(path.join(p, 'activation.json')), false);
    assert.equal(JSON.parse(await readFile(path.join(p, 'active-version.json'), 'utf8')).version, '2.0.15');
  } finally { await rm(p, { recursive: true, force: true }); }
});
test('maintenance drains existing calls, blocks new calls and releases after failure', async () => {
  let release!: () => void;
  const call = withRuntimeCall(() => new Promise<void>(r => { release = r; }));
  let entered = false;
  const update = withRuntimeMaintenance(async () => { entered = true; assert.doesNotThrow(assertRuntimeAvailable); throw new Error('candidate failed'); });
  const rejected = assert.rejects(update, /candidate failed/);
  assert.throws(assertRuntimeAvailable, /being updated/);
  assert.equal(entered, false);
  release(); await call; await rejected;
  assert.equal(entered, true);
  assert.doesNotThrow(assertRuntimeAvailable);
});
