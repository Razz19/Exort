<script lang="ts">
  import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    KeyRound,
    Link2,
    Loader,
    RefreshCw,
    Search,
    Unplug,
  } from "lucide-svelte";
  import type {
    ProviderOAuthStartResult,
    ProviderState,
  } from "../../lib/types";

  let { activeWorkspaceRoot = null } = $props<{
    activeWorkspaceRoot?: string | null;
  }>();

  let providers = $state<ProviderState[]>([]);
  let selectedProviderId = $state<string | null>(null);
  let loading = $state(false);
  let authBusyKey = $state<string | null>(null);
  let oauthWaitingKey = $state<string | null>(null);
  let pendingOAuth = $state<{ providerId: string; methodIndex: number } | null>(
    null,
  );
  let oauthCodes = $state<Record<string, string>>({});
  let oauthDetails = $state<Record<string, ProviderOAuthStartResult>>({});
  let apiKeyInputs = $state<Record<string, string>>({});
  let providerQuery = $state("");
  let errorMessage = $state<string | null>(null);
  let requestId = 0;

  let selectedProvider = $derived.by(() =>
    providers.find((provider) => provider.providerId === selectedProviderId) ??
    null,
  );
  let filteredProviders = $derived.by(() => {
    const query = providerQuery.trim().toLowerCase();
    if (!query) return providers;

    return providers.filter((provider) => {
      const name = provider.providerName.toLowerCase();
      const id = provider.providerId.toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  });

  function normalizeMessage(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  function getWorkspaceRoot(): string | undefined {
    return activeWorkspaceRoot ?? undefined;
  }

  function oauthKey(providerId: string, methodIndex: number): string {
    return `${providerId}:${methodIndex}`;
  }

  function getProviderLabel(provider: ProviderState): string {
    return provider.providerName || provider.providerId;
  }

  function getOAuthMethods(provider: ProviderState): ProviderState["authMethods"] {
    return provider.authMethods
      .filter((method) => method.type === "oauth")
      .slice()
      .sort((left, right) => left.index - right.index);
  }

  function hasApiKeyAuth(provider: ProviderState): boolean {
    return (
      provider.apiKeyMethodIndex !== null ||
      provider.authMethods.some((method) => method.type === "api") ||
      provider.authMethods.length === 0
    );
  }

  function upsertProviderState(state: ProviderState): void {
    const nextProviders = providers.slice();
    const index = nextProviders.findIndex(
      (provider) => provider.providerId === state.providerId,
    );

    if (index >= 0) {
      nextProviders[index] = state;
    } else {
      nextProviders.push(state);
    }

    providers = nextProviders.sort((left, right) => {
      const leftScore = left.connected ? 0 : 1;
      const rightScore = right.connected ? 0 : 1;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return getProviderLabel(left).localeCompare(getProviderLabel(right));
    });
  }

  async function refreshProviders(): Promise<void> {
    const currentRequestId = ++requestId;
    loading = true;
    errorMessage = null;

    try {
      const response = await window.electronAPI.getProviderStates({
        workspaceRoot: getWorkspaceRoot(),
      });

      if (currentRequestId !== requestId) return;

      if (!response.ok || !response.providers) {
        errorMessage = normalizeMessage(
          response.error ?? "Failed to load providers.",
        );
        providers = [];
        selectedProviderId = null;
        return;
      }

      providers = response.providers;
      const selectedStillExists = providers.some(
        (provider) => provider.providerId === selectedProviderId,
      );
      if (!selectedStillExists) {
        selectedProviderId =
          providers.find((provider) => provider.connected)?.providerId ??
          providers[0]?.providerId ??
          null;
      }
    } catch (error) {
      if (currentRequestId !== requestId) return;
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to load providers.",
      );
      providers = [];
      selectedProviderId = null;
    } finally {
      if (currentRequestId === requestId) {
        loading = false;
      }
    }
  }

  $effect(() => {
    activeWorkspaceRoot;
    void refreshProviders();
  });

  async function saveApiKey(provider: ProviderState): Promise<void> {
    const providerId = provider.providerId;
    const apiKey = apiKeyInputs[providerId]?.trim() ?? "";
    if (!apiKey) {
      errorMessage = "API key is required.";
      return;
    }

    const busyKey = `api:${providerId}`;
    authBusyKey = busyKey;
    errorMessage = null;

    try {
      const response = await window.electronAPI.setProviderApiKey({
        providerId,
        workspaceRoot: getWorkspaceRoot(),
        apiKey,
      });

      if (!response.ok || !response.state) {
        errorMessage = normalizeMessage(
          response.error ?? "Failed to save API key.",
        );
        return;
      }

      apiKeyInputs = { ...apiKeyInputs, [providerId]: "" };
      upsertProviderState(response.state);
      selectedProviderId = providerId;
    } catch (error) {
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to save API key.",
      );
    } finally {
      if (authBusyKey === busyKey) {
        authBusyKey = null;
      }
    }
  }

  async function startOAuth(
    provider: ProviderState,
    methodIndex: number,
  ): Promise<void> {
    const providerId = provider.providerId;
    const busyKey = `oauth:${providerId}:${methodIndex}`;
    authBusyKey = busyKey;
    errorMessage = null;

    try {
      const start = await window.electronAPI.startProviderOAuth({
        providerId,
        workspaceRoot: getWorkspaceRoot(),
        methodIndex,
      });

      if (!start.ok || !start.result) {
        errorMessage = normalizeMessage(
          start.error ?? "Failed to start OAuth.",
        );
        return;
      }

      const detailKey = oauthKey(providerId, methodIndex);
      oauthDetails = {
        ...oauthDetails,
        [detailKey]: start.result,
      };
      pendingOAuth = { providerId, methodIndex };

      if (start.result.url) {
        const open = await window.electronAPI.openExternalUrl({
          url: start.result.url,
        });
        if (!open.ok) {
          errorMessage = normalizeMessage(
            open.error ?? "Failed to open OAuth URL.",
          );
        }
      }

      if (start.result.method === "auto" && !start.result.userCode) {
        oauthWaitingKey = detailKey;
        const complete = await window.electronAPI.completeProviderOAuth({
          providerId,
          workspaceRoot: getWorkspaceRoot(),
          methodIndex,
        });
        oauthWaitingKey = null;

        if (!complete.ok || !complete.result?.ok || !complete.state) {
          errorMessage = normalizeMessage(
            complete.error ?? "Failed to complete OAuth.",
          );
          return;
        }

        pendingOAuth = null;
        upsertProviderState(complete.state);
        selectedProviderId = providerId;
      } else {
        // keep silent on successful OAuth start per settings UX
      }
    } catch (error) {
      oauthWaitingKey = null;
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to start OAuth.",
      );
    } finally {
      if (authBusyKey === busyKey) {
        authBusyKey = null;
      }
    }
  }

  async function completeOAuth(
    provider: ProviderState,
    methodIndex: number,
  ): Promise<void> {
    const providerId = provider.providerId;
    const detailKey = oauthKey(providerId, methodIndex);
    const code = oauthCodes[detailKey]?.trim();
    const busyKey = `oauth-complete:${providerId}:${methodIndex}`;
    authBusyKey = busyKey;
    errorMessage = null;

    try {
      const complete = await window.electronAPI.completeProviderOAuth({
        providerId,
        workspaceRoot: getWorkspaceRoot(),
        methodIndex,
        code: code || undefined,
      });

      if (!complete.ok || !complete.result?.ok || !complete.state) {
        errorMessage = normalizeMessage(
          complete.error ?? "Failed to complete OAuth.",
        );
        return;
      }

      oauthCodes = { ...oauthCodes, [detailKey]: "" };
      pendingOAuth = null;
      upsertProviderState(complete.state);
      selectedProviderId = providerId;
    } catch (error) {
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to complete OAuth.",
      );
    } finally {
      if (authBusyKey === busyKey) {
        authBusyKey = null;
      }
    }
  }

  async function disconnectProvider(provider: ProviderState): Promise<void> {
    const providerId = provider.providerId;
    const busyKey = `disconnect:${providerId}`;
    authBusyKey = busyKey;
    errorMessage = null;

    try {
      const response = await window.electronAPI.disconnectProvider({
        providerId,
        workspaceRoot: getWorkspaceRoot(),
      });

      if (!response.ok || !response.state) {
        errorMessage = normalizeMessage(
          response.error ?? "Failed to disconnect provider.",
        );
        return;
      }

      upsertProviderState(response.state);
      selectedProviderId = providerId;
    } catch (error) {
      errorMessage = normalizeMessage(
        error instanceof Error
          ? error.message
          : "Failed to disconnect provider.",
      );
    } finally {
      if (authBusyKey === busyKey) {
        authBusyKey = null;
      }
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-4">
  <div class="flex flex-wrap items-center gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-dark-fg3">
      Providers
    </h2>
    <div class="h-px min-w-12 flex-1 bg-dark-border"></div>
    <button
      class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
      onclick={() => void refreshProviders()}
      disabled={loading}
    >
      {#if loading}
        <Loader class="h-3.5 w-3.5 animate-spin" />
      {:else}
        <RefreshCw class="h-3.5 w-3.5" />
      {/if}
      Refresh
    </button>
  </div>

  <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
    <aside class="flex min-h-0 flex-col rounded-lg border border-dark-border bg-dark-bg">
      <div class="border-b border-dark-border p-3">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-fg4"
          />
          <input
            class="input-field h-8 w-full rounded-md py-1 !pl-10 text-xs"
            type="search"
            placeholder="Search providers"
            bind:value={providerQuery}
            spellcheck={false}
          />
        </div>
      </div>

      <div class="chat-timeline-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {#if loading && providers.length === 0}
          <div class="flex items-center gap-2 px-2 py-2 text-xs text-dark-fg3">
            <Loader class="h-3.5 w-3.5 animate-spin" />
            Loading providers
          </div>
        {:else if filteredProviders.length === 0}
          <div class="px-2 py-2 text-xs text-dark-fg4">No providers found.</div>
        {:else}
          <div class="flex flex-col gap-1">
            {#each filteredProviders as provider (provider.providerId)}
              <button
                class={[
                  "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                  selectedProviderId === provider.providerId
                    ? "border-primary-500 bg-dark-bg2 text-dark-fg"
                    : "border-transparent text-dark-fg3 hover:bg-dark-bg1 hover:text-dark-fg",
                ]}
                onclick={() => {
                  selectedProviderId = provider.providerId;
                }}
              >
                <span class="min-w-0">
                  <span class="block truncate font-medium">
                    {getProviderLabel(provider)}
                  </span>
                  <span class="block truncate font-mono text-[11px] text-dark-fg4">
                    {provider.providerId}
                  </span>
                </span>
                {#if provider.connected}
                  <CheckCircle2 class="h-3.5 w-3.5 shrink-0 text-dark-green" />
                {:else}
                  <AlertTriangle class="h-3.5 w-3.5 shrink-0 text-dark-yellow" />
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </aside>

    <section class="min-h-0 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg">
      {#if selectedProvider}
        <div class="flex flex-col gap-4 p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <h3 class="truncate text-sm font-semibold text-dark-fg">
                  {getProviderLabel(selectedProvider)}
                </h3>
                {#if selectedProvider.connected}
                  <span class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-dark-green/40 bg-dark-green/10 px-2 text-xs font-medium text-dark-green">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    Connected
                  </span>
                {:else}
                  <span class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-dark-yellow/40 bg-dark-yellow/10 px-2 text-xs font-medium text-dark-yellow">
                    <AlertTriangle class="h-3.5 w-3.5" />
                    Not connected
                  </span>
                {/if}
              </div>
              <p class="mt-1 truncate font-mono text-xs text-dark-fg4">
                {selectedProvider.providerId}
              </p>
            </div>

            {#if selectedProvider.connected}
              <button
                class="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-dark-red/50 bg-transparent px-3 py-0 text-xs font-medium text-dark-red transition-colors hover:bg-dark-red/10 disabled:cursor-not-allowed disabled:opacity-60"
                onclick={() => void disconnectProvider(selectedProvider)}
                disabled={authBusyKey === `disconnect:${selectedProvider.providerId}`}
              >
                {#if authBusyKey === `disconnect:${selectedProvider.providerId}`}
                  <Loader class="h-3.5 w-3.5 animate-spin" />
                {:else}
                  <Unplug class="h-3.5 w-3.5" />
                {/if}
                Disconnect
              </button>
            {/if}
          </div>

          <div class="rounded-lg border border-dark-border bg-dark-surface px-3 py-3">
            <h4 class="text-sm font-semibold text-dark-fg">Authentication</h4>

            {#if hasApiKeyAuth(selectedProvider)}
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <div class="relative min-w-0 flex-1">
                  <KeyRound
                    class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-fg4"
                  />
                  <input
                    class="input-field h-8 w-full rounded-md py-1 !pl-11 text-xs"
                    type="password"
                    placeholder="API Key"
                    value={apiKeyInputs[selectedProvider.providerId] ?? ""}
                    oninput={(event) => {
                      const target = event.currentTarget as HTMLInputElement;
                      apiKeyInputs = {
                        ...apiKeyInputs,
                        [selectedProvider.providerId]: target.value,
                      };
                    }}
                    autocomplete="off"
                    spellcheck={false}
                  />
                </div>
                <button
                  class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
                  onclick={() => void saveApiKey(selectedProvider)}
                  disabled={authBusyKey === `api:${selectedProvider.providerId}`}
                >
                  {#if authBusyKey === `api:${selectedProvider.providerId}`}
                    <Loader class="h-3.5 w-3.5 animate-spin" />
                  {/if}
                  Save Key
                </button>
              </div>
            {/if}

            {#if getOAuthMethods(selectedProvider).length > 0}
              <div class="mt-3 flex flex-col gap-3 border-t border-dark-border pt-3">
                {#each getOAuthMethods(selectedProvider) as method (method.index)}
                  {@const detailKey = oauthKey(selectedProvider.providerId, method.index)}
                  {@const detail = oauthDetails[detailKey]}
                  {@const isPending =
                    pendingOAuth?.providerId === selectedProvider.providerId &&
                    pendingOAuth?.methodIndex === method.index}
                  <div class="rounded-md border border-dark-border bg-dark-bg px-3 py-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="truncate text-xs font-medium text-dark-fg">
                          {method.label}
                        </div>
                        <div class="font-mono text-[11px] text-dark-fg4">
                          OAuth method {method.index}
                        </div>
                      </div>
                      <button
                        class="btn-primary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
                        onclick={() => void startOAuth(selectedProvider, method.index)}
                        disabled={authBusyKey === `oauth:${selectedProvider.providerId}:${method.index}`}
                      >
                        {#if authBusyKey === `oauth:${selectedProvider.providerId}:${method.index}`}
                          <Loader class="h-3.5 w-3.5 animate-spin" />
                        {:else}
                          <Link2 class="h-3.5 w-3.5" />
                        {/if}
                        Connect
                      </button>
                    </div>

                    {#if oauthWaitingKey === detailKey}
                      <div
                        class="mt-3 inline-flex items-center gap-2 rounded-md border border-dark-blue/40 bg-dark-blue/10 px-2.5 py-1.5 text-xs text-dark-blue"
                      >
                        <Loader class="h-3.5 w-3.5 animate-spin" />
                        Waiting for authorization
                      </div>
                    {/if}

                    {#if detail}
                      <div class="mt-3 flex flex-col gap-2">
                        {#if detail.instructions}
                          <p class="text-xs text-dark-fg3">{detail.instructions}</p>
                        {/if}
                        {#if detail.userCode}
                          <input
                            class="input-field h-8 w-full max-w-sm rounded-md py-1 text-center font-mono text-xs"
                            value={detail.userCode}
                            readonly
                          />
                        {/if}
                        {#if detail.url}
                          <div class="flex flex-wrap items-center gap-2">
                            <input
                              class="input-field h-8 min-w-0 flex-1 rounded-md py-1 font-mono text-xs"
                              value={detail.url}
                              readonly
                            />
                            <button
                              class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
                              onclick={() =>
                                void window.electronAPI.openExternalUrl({
                                  url: detail.url,
                                })}
                            >
                              <ExternalLink class="h-3.5 w-3.5" />
                              Open
                            </button>
                          </div>
                        {/if}
                      </div>
                    {/if}

                    {#if isPending && oauthWaitingKey !== detailKey}
                      <div class="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          class="input-field h-8 min-w-0 flex-1 rounded-md py-1 text-xs"
                          type="text"
                          placeholder="Paste authorization code"
                          value={oauthCodes[detailKey] ?? ""}
                          oninput={(event) => {
                            const target = event.currentTarget as HTMLInputElement;
                            oauthCodes = {
                              ...oauthCodes,
                              [detailKey]: target.value,
                            };
                          }}
                          spellcheck={false}
                          autocomplete="off"
                        />
                        <button
                          class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
                          onclick={() => void completeOAuth(selectedProvider, method.index)}
                          disabled={authBusyKey === `oauth-complete:${selectedProvider.providerId}:${method.index}`}
                        >
                          {#if authBusyKey === `oauth-complete:${selectedProvider.providerId}:${method.index}`}
                            <Loader class="h-3.5 w-3.5 animate-spin" />
                          {/if}
                          Complete
                        </button>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="rounded-lg border border-dark-border bg-dark-surface px-3 py-3">
            <h4 class="text-sm font-semibold text-dark-fg">Models</h4>
            <div class="mt-3 grid gap-2 sm:grid-cols-3">
              <div class="rounded-md border border-dark-border bg-dark-bg px-2.5 py-2">
                <div class="text-[11px] uppercase tracking-wide text-dark-fg4">
                  Recommended
                </div>
                <div class="mt-1 truncate font-mono text-xs text-dark-fg">
                  {selectedProvider.recommendedModelId ?? "None"}
                </div>
              </div>
              <div class="rounded-md border border-dark-border bg-dark-bg px-2.5 py-2">
                <div class="text-[11px] uppercase tracking-wide text-dark-fg4">
                  Default
                </div>
                <div class="mt-1 truncate font-mono text-xs text-dark-fg">
                  {selectedProvider.defaultModelId ?? "None"}
                </div>
              </div>
              <div class="rounded-md border border-dark-border bg-dark-bg px-2.5 py-2">
                <div class="text-[11px] uppercase tracking-wide text-dark-fg4">
                  Available
                </div>
                <div class="mt-1 text-xs text-dark-fg">
                  {selectedProvider.models.length}
                </div>
              </div>
            </div>

            {#if selectedProvider.models.length > 0}
              <div class="mt-3 flex flex-wrap gap-2">
                {#each selectedProvider.models.slice(0, 10) as model (model.id)}
                  <span
                    class="max-w-full truncate rounded-md border border-dark-border bg-dark-bg px-2 py-1 font-mono text-[11px] text-dark-fg3"
                  >
                    {model.id}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="flex min-h-48 items-center justify-center px-4 text-xs text-dark-fg4">
          Select a provider.
        </div>
      {/if}
    </section>
  </div>

  {#if errorMessage}
    <div
      class="rounded-md border border-dark-red/40 bg-dark-red/10 px-3 py-2 text-xs text-dark-red"
    >
      {errorMessage}
    </div>
  {/if}
</div>
