import { app, BrowserWindow, ipcMain } from 'electron';
import updaterPkg from 'electron-updater';

import type { UpdaterEvent, UpdaterState } from '../../shared/updater.js';

const { autoUpdater } = updaterPkg;

type RegisterUpdaterBridgeParams = {
  owner: string;
  repo: string;
};

let initialized = false;
let quittingForInstall = false;
let state: UpdaterState = createInitialUpdaterState();

function createInitialUpdaterState(): UpdaterState {
  return {
    enabled: app.isPackaged,
    status: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    releaseDate: null,
    checkedAt: null,
    progressPercent: null,
    bytesPerSecond: null,
    transferred: null,
    total: null,
    message: app.isPackaged ? null : 'Updates are disabled for development builds.',
    error: null
  };
}

function broadcastUpdateState(): void {
  const payload: UpdaterEvent = {
    state: getUpdaterState()
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.webContents.send('updater:event', payload);
  }
}

function setUpdaterState(patch: Partial<UpdaterState>): void {
  state = {
    ...state,
    ...patch
  };
  broadcastUpdateState();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Unknown updater error.';
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function setupAutoUpdater(owner: string, repo: string): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.setFeedURL({
    provider: 'github',
    owner,
    repo
  });

  autoUpdater.on('checking-for-update', () => {
    setUpdaterState({
      status: 'checking',
      checkedAt: new Date().toISOString(),
      message: 'Checking for updates...',
      error: null,
      progressPercent: null,
      bytesPerSecond: null,
      transferred: null,
      total: null
    });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdaterState({
      status: 'available',
      availableVersion: info.version,
      releaseDate: asIsoString(info.releaseDate),
      checkedAt: new Date().toISOString(),
      message: `Version ${info.version} is available.`,
      error: null
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdaterState({
      status: 'up-to-date',
      availableVersion: null,
      releaseDate: null,
      checkedAt: new Date().toISOString(),
      message: 'You are on the latest version.',
      error: null,
      progressPercent: null,
      bytesPerSecond: null,
      transferred: null,
      total: null
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdaterState({
      status: 'downloading',
      progressPercent: Number.isFinite(progress.percent) ? progress.percent : null,
      bytesPerSecond: Number.isFinite(progress.bytesPerSecond) ? progress.bytesPerSecond : null,
      transferred: Number.isFinite(progress.transferred) ? progress.transferred : null,
      total: Number.isFinite(progress.total) ? progress.total : null,
      message: 'Downloading update...',
      error: null
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdaterState({
      status: 'downloaded',
      availableVersion: info.version ?? state.availableVersion,
      releaseDate: asIsoString(info.releaseDate) ?? state.releaseDate,
      progressPercent: 100,
      message: 'Update ready to install.',
      error: null
    });
  });

  autoUpdater.on('error', (error) => {
    const message = getErrorMessage(error);
    setUpdaterState({
      status: 'error',
      message,
      error: message
    });
  });
}

export function getUpdaterState(): UpdaterState {
  return { ...state };
}

export function registerUpdaterBridge(params: RegisterUpdaterBridgeParams): void {
  if (initialized) return;
  initialized = true;

  if (app.isPackaged) {
    setupAutoUpdater(params.owner, params.repo);
  } else {
    setUpdaterState({
      enabled: false,
      status: 'idle',
      message: 'Updates are disabled for development builds.',
      error: null
    });
  }

  ipcMain.handle('updater:get-state', async () => {
    return {
      ok: true,
      state: getUpdaterState()
    };
  });

  ipcMain.handle('updater:check', async () => {
    if (!state.enabled) {
      return { ok: false, error: state.message ?? 'Updater is disabled for this build.' };
    }

    try {
      await autoUpdater.checkForUpdates();
      return { ok: true, state: getUpdaterState() };
    } catch (error) {
      const message = getErrorMessage(error);
      setUpdaterState({
        status: 'error',
        message,
        error: message
      });
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!state.enabled) {
      return { ok: false, error: state.message ?? 'Updater is disabled for this build.' };
    }
    if (state.status === 'downloaded') {
      return { ok: true, state: getUpdaterState() };
    }

    try {
      await autoUpdater.downloadUpdate();
      return { ok: true, state: getUpdaterState() };
    } catch (error) {
      const message = getErrorMessage(error);
      setUpdaterState({
        status: 'error',
        message,
        error: message
      });
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('updater:install', async () => {
    if (!state.enabled) {
      return { ok: false, error: state.message ?? 'Updater is disabled for this build.' };
    }
    if (state.status !== 'downloaded') {
      return { ok: false, error: 'No downloaded update is ready to install.' };
    }

    quittingForInstall = true;
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });

    return { ok: true };
  });
}

export function isQuittingForInstall(): boolean {
  return quittingForInstall;
}

