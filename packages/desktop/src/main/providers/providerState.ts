import {
  getOpenCodeProviderAuthMethods,
  getOpenCodeProviderCatalog,
  listOpenCodeProviderAuthMethods,
  listOpenCodeProviderCatalog,
  type OpenCodeModelCatalogProvider,
  type OpenCodeProviderAuthMethod,
  type OpenCodeProviderAuthMethods,
  type OpenCodeProviderCatalog
} from '../agent/opencodeRuntime.js';

export type ProviderAuthMethod = OpenCodeProviderAuthMethod;

export type ProviderState = {
  providerId: string;
  providerName: string;
  available: boolean;
  connected: boolean;
  defaultModelId: string | null;
  recommendedModelId: string | null;
  models: OpenCodeProviderCatalog['models'];
  authMethods: ProviderAuthMethod[];
  oauthMethodIndices: number[];
  recommendedOAuthMethodIndex: number | null;
  apiKeyMethodIndex: number | null;
};

function toProviderState(
  catalog: OpenCodeModelCatalogProvider | (OpenCodeProviderCatalog & { providerName?: string }),
  auth: OpenCodeProviderAuthMethods
): ProviderState {
  return {
    providerId: catalog.providerId,
    providerName: catalog.providerName ?? catalog.providerId,
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

function emptyAuthMethods(providerId: string): OpenCodeProviderAuthMethods {
  return {
    providerId,
    methods: [],
    oauthMethodIndices: [],
    recommendedOAuthMethodIndex: null,
    apiKeyMethodIndex: null
  };
}

export async function loadProviderState(params: {
  providerId: string;
  workspaceRoot?: string;
  onLog: (line: string) => void;
}): Promise<ProviderState> {
  const [catalog, authMethods] = await Promise.all([
    getOpenCodeProviderCatalog({
      providerId: params.providerId,
      workspaceRoot: params.workspaceRoot,
      onLog: params.onLog
    }),
    getOpenCodeProviderAuthMethods({
      providerId: params.providerId,
      workspaceRoot: params.workspaceRoot,
      onLog: params.onLog
    }).catch(() => emptyAuthMethods(params.providerId))
  ]);

  return toProviderState(catalog, authMethods);
}

export async function loadProviderStates(params: {
  workspaceRoot?: string;
  onLog: (line: string) => void;
}): Promise<ProviderState[]> {
  const [catalog, authMethodsByProvider] = await Promise.all([
    listOpenCodeProviderCatalog({
      workspaceRoot: params.workspaceRoot,
      onLog: params.onLog
    }),
    listOpenCodeProviderAuthMethods({
      workspaceRoot: params.workspaceRoot,
      onLog: params.onLog
    }).catch(() => ({} as Record<string, OpenCodeProviderAuthMethods>))
  ]);

  return catalog.map((provider) => {
    const authMethods = authMethodsByProvider[provider.providerId] ?? emptyAuthMethods(provider.providerId);
    return toProviderState(provider, authMethods);
  });
}

export function resolveProviderOAuthMethodIndex(state: ProviderState, methodIndex?: number): number | null {
  if (typeof methodIndex === 'number' && Number.isInteger(methodIndex) && methodIndex >= 0) {
    return methodIndex;
  }

  return state.recommendedOAuthMethodIndex ?? state.oauthMethodIndices[0] ?? null;
}
