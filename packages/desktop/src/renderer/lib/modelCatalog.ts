import type { OpenCodeModelCatalogProvider, SelectedModelRef } from './types';

export function sameSelectedModel(left: SelectedModelRef | null, right: SelectedModelRef | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.providerId === right.providerId && left.modelId === right.modelId;
}

export function resolveSelectedModel(
  providers: OpenCodeModelCatalogProvider[],
  persisted: SelectedModelRef | null
): SelectedModelRef | null {
  if (!persisted) {
    return null;
  }

  const provider = providers.find((item) => item.providerId === persisted.providerId);
  if (!provider || provider.models.length === 0) {
    return null;
  }

  if (provider.models.some((item) => item.id === persisted.modelId)) {
    return persisted;
  }

  if (provider.defaultModelId && provider.models.some((item) => item.id === provider.defaultModelId)) {
    return {
      providerId: provider.providerId,
      modelId: provider.defaultModelId
    };
  }

  const firstModelId = provider.models[0]?.id;
  if (!firstModelId) {
    return null;
  }

  return {
    providerId: provider.providerId,
    modelId: firstModelId
  };
}

export function findSelectedModel(
  providers: OpenCodeModelCatalogProvider[],
  selected: SelectedModelRef | null
): { provider: OpenCodeModelCatalogProvider; model: OpenCodeModelCatalogProvider['models'][number] } | null {
  if (!selected) {
    return null;
  }

  const provider = providers.find((item) => item.providerId === selected.providerId);
  if (!provider) {
    return null;
  }

  const model = provider.models.find((item) => item.id === selected.modelId);
  if (!model) {
    return null;
  }

  return { provider, model };
}

export function isHiddenModel(
  hiddenModels: SelectedModelRef[],
  providerId: string,
  modelId: string
): boolean {
  return hiddenModels.some((item) => item.providerId === providerId && item.modelId === modelId);
}

export function filterVisibleModels(
  providers: OpenCodeModelCatalogProvider[],
  hiddenModels: SelectedModelRef[]
): OpenCodeModelCatalogProvider[] {
  return providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => !isHiddenModel(hiddenModels, provider.providerId, model.id))
    }))
    .filter((provider) => provider.models.length > 0);
}
