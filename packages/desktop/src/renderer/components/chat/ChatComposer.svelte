<script lang="ts">
  import { onMount } from "svelte";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import LoaderCircle from "lucide-svelte/icons/loader-circle";
  import Square from "lucide-svelte/icons/square";
  import { appStateStore, patchAppState } from "../../lib/state/stateManager";
  import type { OpenAIProviderState } from "../../lib/types";

  let { activeWorkspaceRoot, busy, stopping, onSend, onStop } = $props<{
    activeWorkspaceRoot: string | null;
    busy: boolean;
    stopping: boolean;
    onSend: (prompt: string) => Promise<void> | void;
    onStop: () => Promise<void> | void;
  }>();

  const MAX_PROMPT_CHARS = 12000;

  let prompt = $state("");
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let modelOpen = $state(false);
  let modelButtonEl = $state<HTMLButtonElement | null>(null);
  let modelPopoverEl = $state<HTMLDivElement | null>(null);
  let providerState = $state<OpenAIProviderState | null>(null);
  let providerLoading = $state(false);
  let providerError = $state<string | null>(null);
  let selectedModelId = $state<string | null>(null);
  let providerRequestId = 0;

  let canSend = $derived(!busy && prompt.trim().length > 0);
  let modelOptions = $derived(providerState?.models ?? []);
  let selectedModelLabel = $derived.by(() => {
    if (!providerState?.connected || !selectedModelId) return "Exort default";
    return (
      modelOptions.find((item) => item.id === selectedModelId)?.name ??
      "Exort default"
    );
  });

  function resizeInput(): void {
    if (!textareaEl) return;
    textareaEl.style.height = "0px";
    const nextHeight = Math.min(120, Math.max(44, textareaEl.scrollHeight));
    textareaEl.style.height = `${nextHeight}px`;
  }

  $effect(() => {
    prompt;
    resizeInput();
  });

  function submit(): void {
    const text = prompt.trim();
    if (!text || busy) return;
    prompt = "";
    void Promise.resolve(onSend(text)).catch((error) => {
      console.error("[ChatComposer] send failed", error);
    });
    queueMicrotask(() => resizeInput());
  }

  function getWorkspaceRoot(): string | undefined {
    return activeWorkspaceRoot ?? undefined;
  }

  function hasOpenAIModel(
    state: OpenAIProviderState,
    modelId: string | null,
  ): boolean {
    if (!modelId) return false;
    return state.models.some((item) => item.id === modelId);
  }

  function resolveOpenAISelectedModel(
    state: OpenAIProviderState,
    persistedModelId: string | null,
  ): string | null {
    if (!persistedModelId) {
      return null;
    }

    if (hasOpenAIModel(state, persistedModelId)) {
      return persistedModelId;
    }

    if (hasOpenAIModel(state, state.recommendedModelId)) {
      return state.recommendedModelId;
    }

    if (hasOpenAIModel(state, state.defaultModelId)) {
      return state.defaultModelId;
    }

    return state.models[0]?.id ?? null;
  }

  async function refreshOpenAIProviderState(): Promise<void> {
    const currentRequestId = ++providerRequestId;
    providerLoading = true;
    providerError = null;

    try {
      const response = await window.electronAPI.getOpenAIProviderState({
        workspaceRoot: getWorkspaceRoot(),
      });

      if (currentRequestId !== providerRequestId) return;
      if (!response.ok || !response.state) {
        providerState = null;
        providerError =
          response.error?.trim() || "Failed to load OpenAI models.";
        return;
      }

      providerState = response.state;
      const resolvedModelId = resolveOpenAISelectedModel(
        response.state,
        selectedModelId,
      );
      if (resolvedModelId !== selectedModelId) {
        patchAppState({
          providers: {
            openai: {
              selectedModelId: resolvedModelId,
            },
          },
        });
      }
    } catch (error) {
      if (currentRequestId !== providerRequestId) return;
      providerState = null;
      providerError =
        error instanceof Error
          ? error.message
          : "Failed to load OpenAI models.";
    } finally {
      if (currentRequestId === providerRequestId) {
        providerLoading = false;
      }
    }
  }

  function toggleModelPopover(): void {
    modelOpen = !modelOpen;
    if (modelOpen) {
      void refreshOpenAIProviderState();
    }
  }

  function selectOpenAIModel(modelId: string): void {
    const value = modelId.trim();
    if (!value) return;
    patchAppState({
      providers: {
        openai: {
          selectedModelId: value.length > 0 ? value : null,
        },
      },
    });
    modelOpen = false;
  }

  function isSelectedOpenAIModel(modelId: string): boolean {
    return selectedModelId === modelId;
  }

  function useExortDefault(): void {
    patchAppState({
      providers: {
        openai: {
          selectedModelId: null,
        },
      },
    });
    modelOpen = false;
  }

  $effect(() => {
    if (!modelOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (modelButtonEl?.contains(target)) return;
      if (modelPopoverEl?.contains(target)) return;
      modelOpen = false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        modelOpen = false;
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  onMount(() => {
    const unsubscribe = appStateStore.subscribe((state) => {
      selectedModelId = state.providers.openai.selectedModelId;
    });

    return () => {
      unsubscribe();
    };
  });

  $effect(() => {
    activeWorkspaceRoot;
    void refreshOpenAIProviderState();
  });
</script>

<div class="p-3">
  <div class="rounded-xl border border-dark-border bg-dark-bgS/80 px-3 py-2.5">
    <textarea
      class="w-full resize-none border-0 bg-transparent p-0 text-sm text-dark-fg focus:outline-none focus:ring-0"
      bind:this={textareaEl}
      bind:value={prompt}
      maxlength={MAX_PROMPT_CHARS}
      placeholder="Ask ExortAi..."
      style="min-height: 44px; max-height: 120px;"
      onkeydown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submit();
        }
      }}
    ></textarea>

    <div class="mt-1.5 flex items-center justify-between">
      <div class="flex items-center gap-1">
        <div class="relative">
          <button
            class="inline-flex h-8 max-w-[180px] items-center gap-1.5 px-2 text-dark-fg3 transition-colors duration-150 hover:text-dark-fg1"
            bind:this={modelButtonEl}
            aria-haspopup="dialog"
            aria-expanded={modelOpen}
            aria-label="Show model selector"
            title={`Model: ${selectedModelLabel}`}
            onclick={toggleModelPopover}
          >
            <span
              class="shrink-0 text-[10px] font-semibold uppercase tracking-wide"
            >
              AI
            </span>
            <span class="truncate text-xs">{selectedModelLabel}</span>
          </button>

          {#if modelOpen}
            <div
              class="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg border border-dark-border bg-dark-surface p-3 shadow-lg shadow-dark-bg/40"
              bind:this={modelPopoverEl}
              role="dialog"
              aria-label="Model selector"
            >
              <div class="space-y-2.5">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-medium text-dark-fg1">Model</span>
                  <span class="text-dark-fg4">Exort default available</span>
                </div>

                {#if providerLoading}
                  <p class="text-xs text-dark-fg3">Loading models...</p>
                {:else if providerError}
                  <p class="text-xs text-dark-red">{providerError}</p>
                {:else if providerState}
                  <div class="space-y-2">
                    <!-- <div class="text-[11px] text-dark-fg4">
                      {providerState.connected
                        ? "Connection: Connected"
                        : "Connection: Not connected"}
                    </div> -->
                    <button
                      class={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors duration-150 ${
                        selectedModelId == null
                          ? "border-primary-500 bg-dark-bg1 text-dark-fg1"
                          : "border-dark-border bg-dark-bg text-dark-fg3 hover:bg-dark-bg1 hover:text-dark-fg1"
                      }`}
                      onclick={useExortDefault}
                    >
                      <span class="block truncate">Use Exort default</span>
                    </button>
                    {#if providerState.connected}
                      <div class="text-[11px] text-dark-fg4">
                        Choose an OpenAI model.
                      </div>
                      {#if modelOptions.length === 0}
                        <p class="text-xs text-dark-fg3">
                          No OpenAI models available.
                        </p>
                      {:else}
                        <div class="max-h-44 space-y-1 overflow-y-auto pr-1">
                          {#each modelOptions as model (model.id)}
                            <button
                              class={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors duration-150 ${
                                isSelectedOpenAIModel(model.id)
                                  ? "border-primary-500 bg-dark-bg1 text-dark-fg1"
                                  : "border-dark-border bg-dark-bg text-dark-fg3 hover:bg-dark-bg1 hover:text-dark-fg1"
                              }`}
                              onclick={() => selectOpenAIModel(model.id)}
                              title={model.id}
                            >
                              <div
                                class="flex items-center justify-between gap-2"
                              >
                                <span class="truncate">{model.name}</span>
                                {#if model.id === providerState.defaultModelId}
                                  <span
                                    class="shrink-0 text-[10px] text-dark-fg4"
                                    >default</span
                                  >
                                {/if}
                              </div>
                            </button>
                          {/each}
                        </div>
                      {/if}
                    {:else}
                      <p class="text-xs text-dark-fg3">
                        No Provider connected.
                      </p>
                    {/if}
                  </div>
                {:else}
                  <p class="text-xs text-dark-fg3">
                    Provider state unavailable.
                  </p>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>

      {#if busy}
        <button
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-dark-fg2 bg-dark-fg2 text-dark-border transition-colors duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={stopping}
          onclick={() => void onStop()}
          aria-label={stopping ? "Stopping agent turn" : "Stop agent turn"}
          title={stopping ? "Stopping" : "Stop"}
        >
          {#if stopping}
            <LoaderCircle
              class="block h-4 w-4 animate-spin"
              size={16}
              color="currentColor"
              strokeWidth={2.2}
            />
          {:else}
            <Square
              class="block h-4 w-4"
              size={16}
              color="currentColor"
              strokeWidth={2.2}
            />
          {/if}
        </button>
      {:else}
        <button
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-dark-fg2 bg-dark-fg2 text-dark-border transition-colors duration-150 hover:opacity-90"
          class:cursor-not-allowed={!canSend}
          class:opacity-60={!canSend}
          class:pointer-events-none={!canSend}
          aria-disabled={!canSend}
          onclick={submit}
          aria-label="Send prompt"
          title="Send"
        >
          <ArrowUp
            class="block h-5 w-5"
            size={16}
            color="currentColor"
            strokeWidth={2.2}
          />
        </button>
      {/if}
    </div>
  </div>
</div>
