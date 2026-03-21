import { get, writable } from 'svelte/store';

import {
  createDefaultAppState,
  createDefaultWorkspaceManagerState,
  createDefaultWorkspaceState,
  sanitizeAppState,
  sanitizeWorkspaceManagerState,
  sanitizeWorkspaceState,
  MAX_RECENT_WORKSPACES
} from './defaults';
import type { AppState, StateBootstrap, WorkspaceManagerState, WorkspaceState } from './types';

type AppStatePatch = {
  activeWorkspaceRoot?: string | null;
  layout?: {
    chatWidthPct?: number;
    chatCollapsed?: boolean;
    editorWidthPct?: number;
    fileManagerCollapsed?: boolean;
  };
  serial?: {
    bufferSize?: number;
  };
  appearance?: {
    monacoTheme?: AppState['appearance']['monacoTheme'];
    chatFontSize?: AppState['appearance']['chatFontSize'];
  };
  providers?: {
    openai?: {
      selectedModelId?: string | null;
    };
  };
};

type WorkspaceStatePatch = Partial<Omit<WorkspaceState, 'rootPath'>>;
type WorkspaceManagerStatePatch = Partial<WorkspaceManagerState>;

export const appStateStore = writable<AppState>(createDefaultAppState());
export const workspaceManagerStore = writable<WorkspaceManagerState>(createDefaultWorkspaceManagerState());

let hydrated = false;
let hydrating = false;
let appPersistTimer: ReturnType<typeof setTimeout> | null = null;
let workspacePersistTimer: ReturnType<typeof setTimeout> | null = null;

function canPersist(): boolean {
  return hydrated && !hydrating;
}

function persistAppStateSoon(): void {
  if (!canPersist()) return;

  if (appPersistTimer) {
    clearTimeout(appPersistTimer);
  }

  appPersistTimer = setTimeout(() => {
    appPersistTimer = null;
    void window.electronAPI.setAppState(get(appStateStore));
  }, 120);
}

function persistWorkspaceStateSoon(): void {
  if (!canPersist()) return;

  if (workspacePersistTimer) {
    clearTimeout(workspacePersistTimer);
  }

  workspacePersistTimer = setTimeout(() => {
    workspacePersistTimer = null;
    void window.electronAPI.setWorkspaceManagerState(get(workspaceManagerStore));
  }, 120);
}

appStateStore.subscribe(() => {
  persistAppStateSoon();
});

workspaceManagerStore.subscribe(() => {
  persistWorkspaceStateSoon();
});

export async function hydrateStateManager(): Promise<void> {
  hydrating = true;

  try {
    const bootstrap = (await window.electronAPI.getStateBootstrap()) as StateBootstrap;
    appStateStore.set(sanitizeAppState(bootstrap?.appState));
    workspaceManagerStore.set(sanitizeWorkspaceManagerState(bootstrap?.workspaceState));
    hydrated = true;
  } finally {
    hydrating = false;
  }
}

export function patchAppState(
  patchOrUpdater: AppStatePatch | ((current: AppState) => AppStatePatch)
): void {
  appStateStore.update((current) => {
    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(current) : patchOrUpdater;
    const merged: AppState = {
      ...current,
      ...patch,
      layout: {
        ...current.layout,
        ...(patch.layout ?? {})
      },
      serial: {
        ...current.serial,
        ...(patch.serial ?? {})
      },
      appearance: {
        ...current.appearance,
        ...(patch.appearance ?? {})
      },
      providers: {
        ...current.providers,
        ...(patch.providers ?? {}),
        openai: {
          ...current.providers.openai,
          ...(patch.providers?.openai ?? {})
        }
      }
    };

    return sanitizeAppState(merged);
  });
}

export function touchRecentWorkspace(rootPath: string): void {
  workspaceManagerStore.update((current) => {
    const sanitized = sanitizeWorkspaceManagerState(current);
    const nextRecents = [rootPath, ...sanitized.recentWorkspaceRoots.filter((item) => item !== rootPath)].slice(
      0,
      MAX_RECENT_WORKSPACES
    );

    const existing = sanitized.byRoot[rootPath] ?? createDefaultWorkspaceState(rootPath);

    return sanitizeWorkspaceManagerState({
      ...sanitized,
      recentWorkspaceRoots: nextRecents,
      byRoot: {
        ...sanitized.byRoot,
        [rootPath]: existing
      }
    });
  });
}

export function upsertWorkspaceState(rootPath: string, patch: WorkspaceStatePatch): void {
  workspaceManagerStore.update((current) => {
    const sanitized = sanitizeWorkspaceManagerState(current);
    const existing = sanitized.byRoot[rootPath] ?? createDefaultWorkspaceState(rootPath);
    const merged = sanitizeWorkspaceState(
      {
        ...existing,
        ...patch
      },
      rootPath
    );

    const nextRecents = [rootPath, ...sanitized.recentWorkspaceRoots.filter((item) => item !== rootPath)].slice(
      0,
      MAX_RECENT_WORKSPACES
    );

    return sanitizeWorkspaceManagerState({
      ...sanitized,
      recentWorkspaceRoots: nextRecents,
      byRoot: {
        ...sanitized.byRoot,
        [rootPath]: merged
      }
    });
  });
}

export function patchWorkspaceManagerState(
  patchOrUpdater: WorkspaceManagerStatePatch | ((current: WorkspaceManagerState) => WorkspaceManagerStatePatch)
): void {
  workspaceManagerStore.update((current) => {
    const sanitized = sanitizeWorkspaceManagerState(current);
    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(sanitized) : patchOrUpdater;

    return sanitizeWorkspaceManagerState({
      ...sanitized,
      ...patch,
      byRoot: {
        ...sanitized.byRoot,
        ...(patch.byRoot ?? {})
      }
    });
  });
}
