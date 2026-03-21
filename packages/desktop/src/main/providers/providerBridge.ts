import { ipcMain, shell } from 'electron';

import {
  completeOpenCodeProviderOAuth,
  getOpenCodeProviderAuthMethods,
  getOpenCodeProviderCatalog,
  removeOpenCodeProviderAuth,
  setOpenCodeProviderApiKey,
  startOpenCodeProviderOAuth,
  type OpenCodeProviderCatalog,
  type OpenCodeProviderAuthMethods,
  type OpenCodeProviderOAuthCompleteResult,
  type OpenCodeProviderOAuthStartResult
} from '../agent/opencodeRuntime.js';

type OpenAIProviderAuthMethod = {
  index: number;
  type: 'oauth' | 'api' | 'unknown';
  label: string;
};

type OpenAIProviderState = {
  providerId: 'openai';
  available: boolean;
  connected: boolean;
  defaultModelId: string | null;
  recommendedModelId: string | null;
  models: OpenCodeProviderCatalog['models'];
  authMethods: OpenAIProviderAuthMethod[];
  oauthMethodIndices: number[];
  recommendedOAuthMethodIndex: number | null;
  apiKeyMethodIndex: number | null;
};

type RegisterProvidersBridgeParams = {
  onOpenCodeLog: (line: string) => void;
};

const OPENAI_PROVIDER_ID = 'openai';
const OPENAI_EXTERNAL_AUTH_HOSTS = new Set(['auth.openai.com', 'chatgpt.com']);

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

  if (!OPENAI_EXTERNAL_AUTH_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, error: 'Host is not allowed for external open.' };
  }

  return { ok: true };
}

function toOpenAIProviderState(catalog: OpenCodeProviderCatalog, auth: OpenCodeProviderAuthMethods): OpenAIProviderState {
  return {
    providerId: OPENAI_PROVIDER_ID,
    available: catalog.available,
    connected: catalog.connected,
    defaultModelId: catalog.defaultModelId,
    recommendedModelId: catalog.recommendedModelId,
    models: catalog.models,
    authMethods: auth.methods,
    oauthMethodIndices: auth.oauthMethodIndices,
    recommendedOAuthMethodIndex: auth.recommendedOAuthMethodIndex,
    apiKeyMethodIndex: auth.apiKeyMethodIndex
  };
}

async function loadOpenAIProviderState(
  workspaceRoot: string | undefined,
  onOpenCodeLog: (line: string) => void
): Promise<OpenAIProviderState> {
  const [catalog, authMethods] = await Promise.all([
    getOpenCodeProviderCatalog({
      providerId: OPENAI_PROVIDER_ID,
      workspaceRoot,
      onLog: onOpenCodeLog
    }),
    getOpenCodeProviderAuthMethods({
      providerId: OPENAI_PROVIDER_ID,
      workspaceRoot,
      onLog: onOpenCodeLog
    })
  ]);

  return toOpenAIProviderState(catalog, authMethods);
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
    'providers:openai:get-state',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; state?: OpenAIProviderState; error?: string }> => {
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
          const authMethods = await getOpenCodeProviderAuthMethods({
            providerId: OPENAI_PROVIDER_ID,
            workspaceRoot,
            onLog: logOpenCodeLine
          });
          methodIndex = authMethods.recommendedOAuthMethodIndex ?? authMethods.oauthMethodIndices[0] ?? null;
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
      state?: OpenAIProviderState;
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
    'providers:openai:set-api-key',
    async (
      _event,
      payload: {
        workspaceRoot?: string;
        apiKey: string;
      }
    ): Promise<{ ok: boolean; state?: OpenAIProviderState; error?: string }> => {
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
    'providers:openai:disconnect',
    async (
      _event,
      payload?: {
        workspaceRoot?: string;
      }
    ): Promise<{ ok: boolean; state?: OpenAIProviderState; error?: string }> => {
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
