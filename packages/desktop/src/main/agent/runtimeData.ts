import { existsSync } from 'node:fs';
import { cp, mkdir, rename, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { OpenCodeClient } from '@opencode/client';

export async function snapshotRuntimeData(root: string, name: string): Promise<string> {
  const destination = path.join(root, 'backups', name);
  if (existsSync(destination)) return destination;
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const staging = destination + '.tmp';
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { mode: 0o700 });
  if (existsSync(path.join(root, 'isolation'))) {
    await cp(path.join(root, 'isolation'), path.join(staging, 'isolation'), { recursive: true });
  }
  for (const file of ['v2-migration-completed.json', 'active-version.json']) {
    if (existsSync(path.join(root, file))) await copyFile(path.join(root, file), path.join(staging, file));
  }
  await rename(staging, destination);
  return destination;
}
export async function restoreRuntimeData(root: string, snapshot: string): Promise<void> {
  const isolation = path.join(root, 'isolation');
  await rm(isolation, { recursive: true, force: true });
  if (existsSync(path.join(snapshot, 'isolation'))) await cp(path.join(snapshot, 'isolation'), isolation, { recursive: true });
  for (const file of ['v2-migration-completed.json', 'active-version.json']) {
    await rm(path.join(root, file), { force: true });
    if (existsSync(path.join(snapshot, file))) await copyFile(path.join(snapshot, file), path.join(root, file));
  }
}
export async function prepareV2Migration(root: string): Promise<void> {
  if (!existsSync(path.join(root, 'v2-migration-completed.json'))) await snapshotRuntimeData(root, 'before-v2');
}
export async function waitForV2Migration(client: OpenCodeClient, root: string): Promise<void> {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    const status = await client.migration.v1.status({ signal: AbortSignal.timeout(10000) });
    if (status.status === 'completed') {
      await writeFile(path.join(root, 'v2-migration-completed.json'), JSON.stringify({ completedAt: new Date().toISOString() }), { mode: 0o600 });
      return;
    }
    if (status.status === 'error') throw new Error(`OpenCode history migration failed: ${status.error}. Your pre-v2 backup has been preserved.`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('OpenCode history migration has not finished. Retry from Settings > Requirements. Your backup has been preserved.');
}

// A durable transaction journal makes process termination during activation recoverable.
let activationInProgress = false;
let recovering: Promise<void> | undefined;
type Activation = { id: string; target: string; platform: string; backup: string };
async function readActivation(root: string): Promise<Activation | null> {
  try {
    const value = JSON.parse(await readFile(path.join(root, 'activation.json'), 'utf8')) as Activation;
    if (!/^2\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.target) ||
      !/^(darwin|linux|win32)-(arm64|x64)$/.test(value.platform) ||
      !/^before-[a-zA-Z0-9.-]+$/.test(value.backup) || !/^[a-zA-Z0-9-]+$/.test(value.id)) {
      throw new Error('Invalid OpenCode activation journal. The runtime backup has been preserved.');
    }
    return value;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function beginRuntimeActivation(root: string, transaction: Activation): Promise<void> {
  await writeFile(path.join(root, 'activation.json.tmp'), JSON.stringify(transaction), { mode: 0o600 });
  await rename(path.join(root, 'activation.json.tmp'), path.join(root, 'activation.json'));
  activationInProgress = true;
}
export async function finishRuntimeActivation(root: string): Promise<void> {
  await rm(path.join(root, 'activation.json'), { force: true });
  activationInProgress = false;
}
export async function rollbackRuntimeActivation(root: string): Promise<void> {
  try {
    const transaction = await readActivation(root);
    if (!transaction) return;
    const backup = path.join(root, 'backups', transaction.backup);
    if (!existsSync(backup)) throw new Error('OpenCode rollback backup is missing. Activation remains blocked.');
    const installRoot = path.join(root, 'managed', transaction.target, transaction.platform);
    // Keep binary backup intact so recovery is idempotent even if interrupted again.
    await rm(installRoot, { recursive: true, force: true });
    if (existsSync(path.join(backup, 'binary'))) await cp(path.join(backup, 'binary'), installRoot, { recursive: true });
    await restoreRuntimeData(root, backup);
    await finishRuntimeActivation(root);
  } finally { activationInProgress = false; }
}
export async function recoverInterruptedActivation(root: string): Promise<void> {
  if (activationInProgress) return;
  if (recovering) return recovering;
  recovering = (async () => {
    const transaction = await readActivation(root);
    if (!transaction) return;
    const active = await readFile(path.join(root, 'active-version.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (active?.version === transaction.target && active?.transactionID === transaction.id) await finishRuntimeActivation(root);
    else await rollbackRuntimeActivation(root);
  })().finally(() => { recovering = undefined; });
  return recovering;
}
