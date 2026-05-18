import { ipcMain, shell } from 'electron';

import {
  completeOpenCodeProviderOAuth,
  listOpenCodeModelCatalog,
  removeOpenCodeProviderAuth,
  setOpenCodeProviderApiKey,
  startOpenCodeProviderOAuth,
  type OpenCodeModelCatalogProvider,
  type OpenCodeProviderOAuthCompleteResult,
  type OpenCodeProviderOAuthStartResult
} from '../agent/opencodeRuntime.js';
import { loadProviderState, loadProviderStates, resolveProviderOAuthMethodIndex, type ProviderState } from './providerState.js';

type RegisterProvidersBridgeParams = {
  onOpenCodeLog: (line: string) => void;
};

const OPENAI_PROVIDER_ID = 'openai';

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateAllowedExternalUrl(url: string): { ok: true } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only HTTPS URLs are allowed.' };
  }

  return { ok: true };
}

async function loadOpenAIProviderState(
  workspaceRoot: string | undefined,
  onOpenCodeLog: (line: string) => void
): Promise<ProviderState> {
  return loadProviderState({
    providerId: OPENAI_PROVIDER_ID,
    workspaceRoot,
    onLog: onOpenCodeLog
  });
}

async function loadOpenCodeModelCatalog(
  workspaceRoot: string | undefined,
  onOpenCodeLog: (line: string) => void
): Promise<OpenCodeModelCatalogProvider[]> {
  return listOpenCodeModelCatalog({
    workspaceRoot,
    onLog: onOpenCodeLog
  });
}

export function registerProvidersBridge(params: RegisterProvidersBridgeParams): void {
  const logOpenCodeLine = params.onOpenCodeLog;

  ipcMain.handle(
    'app:open-external-url',
    async (_event, payload: { url: string }): Promise<{ ok: boolean; error?: string }> => {
      const url = asNonBlankString(payload?.url);
      if (!url) {
        return { ok: false, error: 'A URL is required.' };
      }

      const validation = validateAllowedExternalUrl(url);
      if (!validation.ok) {
        return { ok: false, error: validation.error };
      }

      try {
        await shell.openExternal(url);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to open URL.'
        };
      }
    }
  );

  ipcMain.handle(
    'providers:model-catalog:get',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; providers?: OpenCodeModelCatalogProvider[]; error?: string }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const providers = await loadOpenCodeModelCatalog(workspaceRoot, logOpenCodeLine);
        return { ok: true, providers };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load available models';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:states:get',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; providers?: ProviderState[]; error?: string }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const providers = await loadProviderStates({
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, providers };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load provider states';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:state:get',
    async (
      _event,
      payload?: {
        providerId?: string;
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; state?: ProviderState; error?: string }> => {
      try {
        const providerId = asNonBlankString(payload?.providerId);
        if (!providerId) {
          return { ok: false, error: 'Provider ID is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const state = await loadProviderState({
          providerId,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load provider state';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:openai:get-state',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; state?: ProviderState; error?: string }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const state = await loadOpenAIProviderState(workspaceRoot, logOpenCodeLine);
        return { ok: true, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load OpenAI provider state';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:oauth-start',
    async (
      _event,
      payload?: {
        providerId?: string;
        workspaceRoot?: string;
        methodIndex?: number;
      }
    ): Promise<{
      ok: boolean;
      result?: OpenCodeProviderOAuthStartResult;
      error?: string;
    }> => {
      try {
        const providerId = asNonBlankString(payload?.providerId);
        if (!providerId) {
          return { ok: false, error: 'Provider ID is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const state = await loadProviderState({
          providerId,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        const methodIndex = resolveProviderOAuthMethodIndex(state, payload?.methodIndex);

        if (methodIndex == null) {
          return { ok: false, error: `No OAuth method is available for ${providerId}.` };
        }

        const result = await startOpenCodeProviderOAuth({
          providerId,
          methodIndex,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start provider OAuth';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:openai:oauth-start',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
        methodIndex?: number;
      }
    ): Promise<{
      ok: boolean;
      result?: OpenCodeProviderOAuthStartResult;
      error?: string;
    }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        let methodIndex =
          typeof payload?.methodIndex === 'number' && Number.isInteger(payload.methodIndex) && payload.methodIndex >= 0
            ? payload.methodIndex
            : null;

        if (methodIndex == null) {
          const state = await loadProviderState({
            providerId: OPENAI_PROVIDER_ID,
            workspaceRoot,
            onLog: logOpenCodeLine
          });
          methodIndex = resolveProviderOAuthMethodIndex(state, payload?.methodIndex);
        }

        if (methodIndex == null) {
          return { ok: false, error: 'No OpenAI OAuth method is available.' };
        }

        const result = await startOpenCodeProviderOAuth({
          providerId: OPENAI_PROVIDER_ID,
          methodIndex,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start OpenAI OAuth';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:oauth-complete',
    async (
      _event,
      payload: {
        providerId?: string;
        workspaceRoot?: string;
        methodIndex: number;
        code?: string;
      }
    ): Promise<{
      ok: boolean;
      result?: OpenCodeProviderOAuthCompleteResult;
      state?: ProviderState;
      error?: string;
    }> => {
      try {
        const providerId = asNonBlankString(payload?.providerId);
        if (!providerId) {
          return { ok: false, error: 'Provider ID is required.' };
        }
        if (!Number.isInteger(payload?.methodIndex) || payload.methodIndex < 0) {
          return { ok: false, error: 'A valid auth method index is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const result = await completeOpenCodeProviderOAuth({
          providerId,
          methodIndex: payload.methodIndex,
          code: payload.code,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        const state = await loadProviderState({
          providerId,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, result, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to complete provider OAuth';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:openai:oauth-complete',
    async (
      _event,
      payload: {
        workspaceRoot?: string;
        methodIndex: number;
        code?: string;
      }
    ): Promise<{
      ok: boolean;
      result?: OpenCodeProviderOAuthCompleteResult;
      state?: ProviderState;
      error?: string;
    }> => {
      try {
        if (!Number.isInteger(payload?.methodIndex) || payload.methodIndex < 0) {
          return { ok: false, error: 'A valid auth method index is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        const result = await completeOpenCodeProviderOAuth({
          providerId: OPENAI_PROVIDER_ID,
          methodIndex: payload.methodIndex,
          code: payload.code,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        const state = await loadOpenAIProviderState(workspaceRoot, logOpenCodeLine);
        return { ok: true, result, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to complete OpenAI OAuth';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:set-api-key',
    async (
      _event,
      payload: {
        providerId?: string;
        workspaceRoot?: string;
        apiKey: string;
      }
    ): Promise<{ ok: boolean; state?: ProviderState; error?: string }> => {
      try {
        const providerId = asNonBlankString(payload?.providerId);
        if (!providerId) {
          return { ok: false, error: 'Provider ID is required.' };
        }

        const apiKey = asNonBlankString(payload?.apiKey);
        if (!apiKey) {
          return { ok: false, error: 'API key is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        await setOpenCodeProviderApiKey({
          providerId,
          apiKey,
          onLog: logOpenCodeLine
        });
        const state = await loadProviderState({
          providerId,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to set provider API key';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:openai:set-api-key',
    async (
      _event,
      payload: {
        workspaceRoot?: string;
        apiKey: string;
      }
    ): Promise<{ ok: boolean; state?: ProviderState; error?: string }> => {
      try {
        const apiKey = asNonBlankString(payload?.apiKey);
        if (!apiKey) {
          return { ok: false, error: 'API key is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        await setOpenCodeProviderApiKey({
          providerId: OPENAI_PROVIDER_ID,
          apiKey,
          onLog: logOpenCodeLine
        });
        const state = await loadOpenAIProviderState(workspaceRoot, logOpenCodeLine);
        return { ok: true, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to set OpenAI API key';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:disconnect',
    async (
      _event,
      payload?: {
        providerId?: string;
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; state?: ProviderState; error?: string }> => {
      try {
        const providerId = asNonBlankString(payload?.providerId);
        if (!providerId) {
          return { ok: false, error: 'Provider ID is required.' };
        }

        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        await removeOpenCodeProviderAuth({
          providerId,
          onLog: logOpenCodeLine
        });
        const state = await loadProviderState({
          providerId,
          workspaceRoot,
          onLog: logOpenCodeLine
        });
        return { ok: true, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to disconnect provider';
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'providers:openai:disconnect',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; state?: ProviderState; error?: string }> => {
      try {
        const workspaceRoot = asNonBlankString(payload?.workspaceRoot) ?? undefined;
        await removeOpenCodeProviderAuth({
          providerId: OPENAI_PROVIDER_ID,
          onLog: logOpenCodeLine
        });
        const state = await loadOpenAIProviderState(workspaceRoot, logOpenCodeLine);
        return { ok: true, state };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to disconnect OpenAI provider';
        return { ok: false, error: message };
      }
    }
  );
}
