import path from 'node:path';
import { existsSync } from 'node:fs';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getManagedOpenCodeStatus, getManagedRoot, activateOpenCodeVersion, setCandidateOpenCodeVersion, getActiveOpenCodeVersion, EXORT_MANAGED_OPENCODE_VERSION, resolveManagedOpenCodeBinary } from '../agent/openCodeBinary.js';
import { getExistingOpenCodeRuntime, getOpenCodeRuntime } from '../agent/openCode.js';
import { shutdownOpenCodeRuntime } from '../agent/opencodeRuntime.js';
import { withRuntimeMaintenance, runtimeCallsInFlight } from '../agent/runtimeAccess.js';
import { snapshotRuntimeData, beginRuntimeActivation, finishRuntimeActivation, rollbackRuntimeActivation } from '../agent/runtimeData.js';
import { compareOpenCodeVersions, fetchLatestOpenCodeVersion, installOpenCodeFromReleaseAssets, resolveOpenCodeReleaseAssetForCurrentTarget } from '../requirements/opencodeReleaseInstaller.js';
import type { OpenCodeUpdateState, OpenCodeUpdateResponse } from '../../shared/openCodeUpdater.js';

const defaultDependencies = { getManagedOpenCodeStatus, getManagedRoot, activateOpenCodeVersion, setCandidateOpenCodeVersion, getActiveOpenCodeVersion, resolveManagedOpenCodeBinary, getExistingOpenCodeRuntime, getOpenCodeRuntime, shutdownOpenCodeRuntime, withRuntimeMaintenance, snapshotRuntimeData, beginRuntimeActivation, finishRuntimeActivation, rollbackRuntimeActivation, compareOpenCodeVersions, fetchLatestOpenCodeVersion, installOpenCodeFromReleaseAssets, resolveOpenCodeReleaseAssetForCurrentTarget };

export function createOpenCodeUpdater(dependencies: Partial<typeof defaultDependencies> = {}) {
  const { getManagedOpenCodeStatus, getManagedRoot, activateOpenCodeVersion, setCandidateOpenCodeVersion, getActiveOpenCodeVersion, resolveManagedOpenCodeBinary, getExistingOpenCodeRuntime, getOpenCodeRuntime, shutdownOpenCodeRuntime, withRuntimeMaintenance, snapshotRuntimeData, beginRuntimeActivation, finishRuntimeActivation, rollbackRuntimeActivation, compareOpenCodeVersions, fetchLatestOpenCodeVersion, installOpenCodeFromReleaseAssets, resolveOpenCodeReleaseAssetForCurrentTarget } = { ...defaultDependencies, ...dependencies };
  let state: OpenCodeUpdateState = { status: 'idle', currentVersion: null, latestVersion: null, automaticChecks: false };
  let broadcast = (_state: OpenCodeUpdateState) => {};
  let agentBusy = () => false;
  let inFlight: Promise<OpenCodeUpdateResponse> | undefined;
  let stopped = false;
  let installing: Promise<OpenCodeUpdateResponse> | undefined;
  function configureOpenCodeUpdater(options: { automaticChecks: boolean; onState: (state: OpenCodeUpdateState) => void; isAgentBusy: () => boolean }): void {
    state.automaticChecks = options.automaticChecks; broadcast = options.onState; agentBusy = options.isAgentBusy;
  }
  function stopOpenCodeUpdater(): void { stopped = true; }
  function publish(change: Partial<OpenCodeUpdateState>): OpenCodeUpdateState {
    state = { ...state, ...change }; broadcast({ ...state }); return state;
  }
  async function getOpenCodeUpdateState(): Promise<OpenCodeUpdateState> {
    if (!inFlight) {
      const status = await getManagedOpenCodeStatus();
      state.currentVersion = status.version;
      if (status.source === 'system') state = { ...state, status: 'external', message: 'Your configured OpenCode binary is managed externally.' };
      else if (!status.installed && status.version?.startsWith('1.')) state = { ...state, status: 'available', latestVersion: EXORT_MANAGED_OPENCODE_VERSION, message: 'OpenCode v2 is required.' };
    }
    return { ...state };
  }
  function checkOpenCodeUpdate(background = false): Promise<OpenCodeUpdateResponse> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        await getOpenCodeUpdateState();
        if (state.status === 'external' || (background && !state.automaticChecks)) return { ok: true, state };
        publish({ status: 'checking', background, error: undefined, progressPercent: undefined });
        const status = await getManagedOpenCodeStatus();
        if (status.source === 'system') return { ok: true, state: publish({ status: 'external', currentVersion: status.version, message: 'Your configured OpenCode binary is managed externally.' }) };
        const latest = await fetchLatestOpenCodeVersion();
        const target = compareOpenCodeVersions(latest, EXORT_MANAGED_OPENCODE_VERSION) >= 0 ? latest : EXORT_MANAGED_OPENCODE_VERSION;
        await resolveOpenCodeReleaseAssetForCurrentTarget(target);
        const available = status.version !== null && compareOpenCodeVersions(target, status.version) > 0;
        return { ok: true, state: publish({ status: available ? 'available' : 'up-to-date', currentVersion: status.version, latestVersion: target, checkedAt: new Date().toISOString(), message: status.installed ? undefined : 'Install OpenCode from Requirements to get started.' }) };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not check OpenCode updates.';
        return { ok: false, error: message, state: publish({ status: 'error', background, error: message }) };
      }
    })().finally(() => { inFlight = undefined; });
    return inFlight;
  }
  async function isBusy(): Promise<boolean> {
    if (agentBusy() || runtimeCallsInFlight() > 0) return true;
    const runtime = await getExistingOpenCodeRuntime();
    if (!runtime) return false;
    if (runtime.client.hasPendingInteractions?.()) return true;
    const opts = { signal: AbortSignal.timeout(10000) };
    if (Object.keys(await runtime.native.session.active(opts)).length) return true;
    const locations = await runtime.native.debug.location.list(opts);
    for (const location of locations) {
      const [permissions, forms] = await Promise.all([
        runtime.native.permission.request.list({ location: { directory: location.directory } }, opts),
        runtime.native.form.list({ location: { directory: location.directory } }, opts)
      ]);
      if (permissions.data.length || forms.data.length) return true;
    }
    return false;
  }
  function installOpenCodeUpdate(): Promise<OpenCodeUpdateResponse> {
    if (installing) return installing;
    const checking = inFlight;
    installing = (async () => {
      if (checking) await checking;
      inFlight = performInstall();
      return await inFlight;
    })().finally(() => { installing = undefined; inFlight = undefined; });
    return installing;
  }
  async function performInstall(): Promise<OpenCodeUpdateResponse> {
    let staged: string | undefined;
    try {
      const status = await getManagedOpenCodeStatus();
      if (status.source === 'system') throw new Error('Your configured OpenCode binary is managed externally.');
      const current = await getActiveOpenCodeVersion();
      const target = state.latestVersion && compareOpenCodeVersions(state.latestVersion, current) > 0 ? state.latestVersion : current;
      if (status.installed && target === status.version) return { ok: true, state: publish({ status: 'up-to-date', currentVersion: status.version }) };
      publish({ status: 'downloading', background: false, latestVersion: target, error: undefined, message: undefined, progressPercent: 0 });
      const installed = await installOpenCodeFromReleaseAssets({ version: target, onProgress: progressPercent => publish({ progressPercent }) });
      if (!installed.ok || !installed.binaryPath) throw new Error(installed.message);
      staged = path.dirname(installed.binaryPath);
      const deadline = Date.now() + 24 * 60 * 60_000;
      while (true) {
        if (stopped) throw new Error('OpenCode update was cancelled because Exort is closing.');
        if (Date.now() > deadline) throw new Error('OpenCode is still busy. Retry the update when your conversations finish.');
        if (await isBusy()) {
          publish({ status: 'waiting-for-idle', message: 'Update downloaded. Waiting for active conversations and questions to finish.' });
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        const applied = await withRuntimeMaintenance(async () => {
          // New turns cannot enter after the maintenance lock is acquired.
          if (await isBusy()) return false;
          publish({ status: 'installing', message: 'Starting OpenCode and checking migrated history…' });
          const root = await getManagedRoot();
          await shutdownOpenCodeRuntime();
          const backup = await snapshotRuntimeData(root, `before-${target}-${Date.now()}`);
          const binary = await resolveManagedOpenCodeBinary(target);
          if (existsSync(binary.installRoot)) await cp(binary.installRoot, path.join(backup, 'binary'), { recursive: true });
          const transactionID = randomUUID();
          await beginRuntimeActivation(root, { id: transactionID, target, platform: binary.platformKey, backup: path.basename(backup) });
          setCandidateOpenCodeVersion(target);
          try {
            await rm(binary.installRoot, { recursive: true, force: true });
            await mkdir(path.dirname(binary.installRoot), { recursive: true });
            await rename(staged!, binary.installRoot);
            staged = undefined;
            const runtime = await getOpenCodeRuntime();
            const info = await runtime.native.server.info({ signal: AbortSignal.timeout(10000) });
            if (info.version !== target) throw new Error('OpenCode server reported an unexpected version.');
            await runtime.native.provider.list(undefined, { signal: AbortSignal.timeout(10000) });
            await activateOpenCodeVersion(target, transactionID);
            await finishRuntimeActivation(root);
          } catch (error) {
            await shutdownOpenCodeRuntime();
            setCandidateOpenCodeVersion(undefined);
            await rollbackRuntimeActivation(root);
            if (status.installed && status.version?.startsWith('2.')) await getOpenCodeRuntime().catch(() => {});
            throw error;
          } finally { setCandidateOpenCodeVersion(undefined); }
          publish({ status: 'updated', currentVersion: target, progressPercent: undefined, error: undefined, message: `OpenCode ${target} is ready.` });
          return true;
        });
        if (applied) break;
      }
      return { ok: true, state };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenCode update failed.';
      return { ok: false, error: message, state: publish({ status: 'error', background: false, error: message, progressPercent: undefined }) };
    } finally { if (staged) await rm(staged, { recursive: true, force: true }); }
  }
  async function restartManagedOpenCode(): Promise<void> {
    if (inFlight || await isBusy()) throw new Error('OpenCode is busy. Finish active conversations or updates before restarting.');
    await withRuntimeMaintenance(async () => {
      if (await isBusy()) throw new Error('OpenCode is busy. Finish active conversations before restarting.');
      await shutdownOpenCodeRuntime(); await getOpenCodeRuntime();
    });
  }

  return { configureOpenCodeUpdater, stopOpenCodeUpdater, getOpenCodeUpdateState, checkOpenCodeUpdate, installOpenCodeUpdate, restartManagedOpenCode };
}

export const { configureOpenCodeUpdater, stopOpenCodeUpdater, getOpenCodeUpdateState, checkOpenCodeUpdate, installOpenCodeUpdate, restartManagedOpenCode } = createOpenCodeUpdater();
