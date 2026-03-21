<script lang="ts">
  import {
    AlertTriangle,
    CheckCircle2,
    KeyRound,
    Link2,
    Loader,
    Unplug,
  } from "lucide-svelte";
  import type {
    OpenAIOAuthStartResult,
    OpenAIProviderState,
  } from "../../lib/types";

  let { activeWorkspaceRoot = null } = $props<{
    activeWorkspaceRoot?: string | null;
  }>();

  let providerState = $state<OpenAIProviderState | null>(null);
  let loading = $state(false);
  let oauthBusy = $state(false);
  let oauthWaiting = $state(false);
  let apiKeyBusy = $state(false);
  let disconnectBusy = $state(false);
  let pendingOAuthMethodIndex = $state<number | null>(null);
  let oauthCode = $state("");
  let oauthInstructions = $state("");
  let apiKeyInput = $state("");
  let errorMessage = $state<string | null>(null);
  let statusMessage = $state<string | null>(null);
  let requestId = 0;

  let connected = $derived(providerState?.connected === true);

  function normalizeMessage(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  function isOAuthLocalCallbackPortConflict(message: string): boolean {
    const normalized = normalizeMessage(message).toLowerCase();
    return (
      normalized.includes("port 1455") ||
      normalized.includes("failed to start server")
    );
  }

  function getOAuthStartMethodIndices(
    state: OpenAIProviderState | null,
  ): number[] {
    if (!state) return [];

    const oauthMethods = state.authMethods.filter(
      (item) => item.type === "oauth",
    );
    if (oauthMethods.length === 0) return [];

    const availableIndices = new Set(state.oauthMethodIndices);
    const ranked = oauthMethods
      .filter((item) => availableIndices.has(item.index))
      .slice()
      .sort((a, b) => {
        const labelA = a.label.toLowerCase();
        const labelB = b.label.toLowerCase();
        const scoreA = labelA.includes("headless")
          ? 0
          : labelA.includes("browser")
            ? 2
            : 1;
        const scoreB = labelB.includes("headless")
          ? 0
          : labelB.includes("browser")
            ? 2
            : 1;
        return scoreA - scoreB;
      });

    const ordered: number[] = [];
    const preferred = state.recommendedOAuthMethodIndex;
    if (preferred != null && ranked.some((item) => item.index === preferred)) {
      ordered.push(preferred);
    }

    for (const method of ranked) {
      if (!ordered.includes(method.index)) {
        ordered.push(method.index);
      }
    }

    return ordered;
  }

  function getWorkspaceRoot(): string | undefined {
    return activeWorkspaceRoot ?? undefined;
  }

  async function refreshProviderState(): Promise<void> {
    const currentRequestId = ++requestId;
    loading = true;
    errorMessage = null;

    try {
      const response = await window.electronAPI.getOpenAIProviderState({
        workspaceRoot: getWorkspaceRoot(),
      });

      if (currentRequestId !== requestId) return;

      if (!response.ok || !response.state) {
        errorMessage = normalizeMessage(
          response.error ?? "Failed to load OpenAI provider state.",
        );
        providerState = null;
        return;
      }

      providerState = response.state;
    } catch (error) {
      if (currentRequestId !== requestId) return;
      errorMessage = normalizeMessage(
        error instanceof Error
          ? error.message
          : "Failed to load OpenAI provider state.",
      );
      providerState = null;
    } finally {
      if (currentRequestId === requestId) {
        loading = false;
      }
    }
  }

  $effect(() => {
    activeWorkspaceRoot;
    void refreshProviderState();
  });

  async function connectChatGPT(): Promise<void> {
    if (oauthBusy) return;

    const methodIndices = getOAuthStartMethodIndices(providerState);
    if (methodIndices.length === 0) {
      errorMessage = "No OpenAI OAuth method is available.";
      return;
    }

    oauthBusy = true;
    oauthWaiting = false;
    errorMessage = null;
    statusMessage = null;
    oauthCode = "";
    oauthInstructions = "";

    try {
      let startResult: OpenAIOAuthStartResult | null = null;
      let startError = "Failed to start OpenAI OAuth.";
      let usedFallbackMethod = false;

      for (const [attemptIndex, methodIndex] of methodIndices.entries()) {
        const start = await window.electronAPI.startOpenAIProviderOAuth({
          workspaceRoot: getWorkspaceRoot(),
          methodIndex,
        });
        if (start.ok && start.result) {
          startResult = start.result;
          usedFallbackMethod = attemptIndex > 0;
          break;
        }

        const normalizedError = normalizeMessage(
          start.error ?? "Failed to start OpenAI OAuth.",
        );
        startError = normalizedError;
        const hasFallback = attemptIndex < methodIndices.length - 1;
        if (hasFallback && isOAuthLocalCallbackPortConflict(normalizedError)) {
          continue;
        }

        break;
      }

      if (!startResult) {
        errorMessage = startError;
        return;
      }

      pendingOAuthMethodIndex = startResult.methodIndex;
      oauthInstructions = startResult.instructions;

      const open = await window.electronAPI.openExternalUrl({
        url: startResult.url,
      });
      if (!open.ok) {
        errorMessage = normalizeMessage(
          open.error ?? "Failed to open OAuth URL.",
        );
        return;
      }

      if (startResult.method === "code") {
        statusMessage =
          "OAuth started. Paste the authorization code to complete connection.";
        return;
      }

      oauthWaiting = true;
      statusMessage = usedFallbackMethod
        ? "Browser callback unavailable. Waiting for alternate ChatGPT authorization..."
        : "Waiting for ChatGPT authorization...";
      const complete = await window.electronAPI.completeOpenAIProviderOAuth({
        workspaceRoot: getWorkspaceRoot(),
        methodIndex: startResult.methodIndex,
      });
      oauthWaiting = false;

      if (!complete.ok || !complete.result?.ok) {
        errorMessage = normalizeMessage(
          complete.error ?? "Failed to complete OpenAI OAuth.",
        );
        return;
      }

      statusMessage = "ChatGPT connected.";
      pendingOAuthMethodIndex = null;
      providerState = complete.state ?? providerState;
      await refreshProviderState();
    } catch (error) {
      oauthWaiting = false;
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to connect ChatGPT.",
      );
    } finally {
      oauthBusy = false;
    }
  }

  async function completeOAuthCode(): Promise<void> {
    if (oauthBusy || pendingOAuthMethodIndex == null) return;

    const code = oauthCode.trim();
    if (!code) {
      errorMessage = "Authorization code is required.";
      return;
    }

    oauthBusy = true;
    errorMessage = null;

    try {
      const complete = await window.electronAPI.completeOpenAIProviderOAuth({
        workspaceRoot: getWorkspaceRoot(),
        methodIndex: pendingOAuthMethodIndex,
        code,
      });

      if (!complete.ok || !complete.result?.ok) {
        errorMessage = normalizeMessage(
          complete.error ?? "Failed to complete OpenAI OAuth.",
        );
        return;
      }

      statusMessage = "ChatGPT connected.";
      oauthCode = "";
      oauthInstructions = "";
      pendingOAuthMethodIndex = null;
      providerState = complete.state ?? providerState;
      await refreshProviderState();
    } catch (error) {
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to complete OAuth.",
      );
    } finally {
      oauthBusy = false;
    }
  }

  async function saveApiKey(): Promise<void> {
    if (apiKeyBusy) return;

    const apiKey = apiKeyInput.trim();
    if (!apiKey) {
      errorMessage = "OpenAI API key is required.";
      return;
    }

    apiKeyBusy = true;
    errorMessage = null;

    try {
      const response = await window.electronAPI.setOpenAIProviderApiKey({
        workspaceRoot: getWorkspaceRoot(),
        apiKey,
      });
      if (!response.ok) {
        errorMessage = normalizeMessage(
          response.error ?? "Failed to save OpenAI API key.",
        );
        return;
      }

      apiKeyInput = "";
      statusMessage = "OpenAI API key saved.";
      providerState = response.state ?? providerState;
      await refreshProviderState();
    } catch (error) {
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to save API key.",
      );
    } finally {
      apiKeyBusy = false;
    }
  }

  async function disconnectOpenAI(): Promise<void> {
    if (disconnectBusy) return;

    disconnectBusy = true;
    errorMessage = null;
    statusMessage = null;
    oauthCode = "";
    oauthInstructions = "";
    pendingOAuthMethodIndex = null;

    try {
      const response = await window.electronAPI.disconnectOpenAIProvider({
        workspaceRoot: getWorkspaceRoot(),
      });
      if (!response.ok) {
        errorMessage = normalizeMessage(
          response.error ?? "Failed to disconnect OpenAI.",
        );
        return;
      }

      statusMessage = "OpenAI disconnected.";
      providerState = response.state ?? providerState;
      await refreshProviderState();
    } catch (error) {
      errorMessage = normalizeMessage(
        error instanceof Error ? error.message : "Failed to disconnect OpenAI.",
      );
    } finally {
      disconnectBusy = false;
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-4">
  <div class="flex items-center gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-dark-fg3">
      OpenAI Provider
    </h2>
    <div class="h-px flex-1 bg-dark-border"></div>
  </div>

  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-dark-fg">ChatGPT Status</h3>
      </div>

      <div class="inline-flex items-center gap-2 text-xs">
        {#if loading}
          <Loader class="h-4 w-4 animate-spin text-dark-fg3" />
          <span class="text-dark-fg3">Loading</span>
        {:else if connected}
          <CheckCircle2 class="h-4 w-4 text-dark-green" />
          <span class="text-dark-green">Connected</span>
        {:else}
          <AlertTriangle class="h-4 w-4 text-dark-yellow" />
          <span class="text-dark-yellow">Not connected</span>
        {/if}
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      {#if connected}
        <button
          class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
          onclick={() => void disconnectOpenAI()}
          disabled={disconnectBusy || loading}
        >
          {#if disconnectBusy}
            <Loader class="h-3.5 w-3.5 animate-spin" />
          {:else}
            <Unplug class="h-3.5 w-3.5" />
          {/if}
          Disconnect
        </button>
      {:else}
        <button
          class="btn-primary inline-flex h-8 items-center justify-center gap-2 px-3 py-0 text-xs"
          onclick={() => void connectChatGPT()}
          disabled={oauthBusy || loading}
        >
          {#if oauthBusy}
            <Loader class="h-3.5 w-3.5 animate-spin" />
          {:else}
            <Link2 class="h-3.5 w-3.5" />
          {/if}
          Connect ChatGPT
        </button>
      {/if}
    </div>

    {#if oauthWaiting}
      <div
        class="mt-3 inline-flex items-center gap-2 rounded-md border border-dark-blue/40 bg-dark-blue/10 px-2.5 py-1.5 text-xs text-dark-blue"
      >
        <Loader class="h-3.5 w-3.5 animate-spin" />
        Waiting for authorization to complete...
      </div>
    {/if}

    {#if pendingOAuthMethodIndex !== null && !oauthWaiting}
      <div
        class="mt-3 rounded-md border border-dark-border bg-dark-surface px-3 py-3"
      >
        <p class="text-xs text-dark-fg4">
          OAuth code is required for this connection method.
        </p>
        {#if oauthInstructions}
          <p class="mt-1 text-xs text-dark-fg3">{oauthInstructions}</p>
        {/if}
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input
            class="input-field h-8 w-full max-w-md rounded-md py-1 text-xs"
            type="text"
            placeholder="Paste authorization code"
            bind:value={oauthCode}
            spellcheck={false}
            autocomplete="off"
          />
          <button
            class="btn-secondary inline-flex h-8 items-center justify-center px-3 py-0 text-xs"
            onclick={() => void completeOAuthCode()}
            disabled={oauthBusy}
          >
            Complete OAuth
          </button>
        </div>
      </div>
    {/if}
  </div>

  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <h3 class="text-sm font-semibold text-dark-fg">OpenAI API Key</h3>
    <p class="mt-1 text-xs text-dark-fg4">
      Store API key in OpenCode auth storage.
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <div class="relative w-full max-w-md">
        <KeyRound
          class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dark-fg4"
        />
        <input
          class="input-field h-8 w-full rounded-md py-1 !pl-11 text-xs"
          type="password"
          placeholder="API Key"
          bind:value={apiKeyInput}
          autocomplete="off"
          spellcheck={false}
        />
      </div>
      <button
        class="btn-secondary inline-flex h-8 items-center justify-center px-3 py-0 text-xs"
        onclick={() => void saveApiKey()}
        disabled={apiKeyBusy}
      >
        {#if apiKeyBusy}
          <Loader class="h-3.5 w-3.5 animate-spin" />
        {/if}
        Save API Key
      </button>
    </div>
  </div>

  {#if errorMessage}
    <div
      class="rounded-md border border-dark-red/40 bg-dark-red/10 px-3 py-2 text-xs text-dark-red"
    >
      {errorMessage}
    </div>
  {/if}
  {#if statusMessage}
    <div
      class="rounded-md border border-dark-green/40 bg-dark-green/10 px-3 py-2 text-xs text-dark-green"
    >
      {statusMessage}
    </div>
  {/if}
</div>
