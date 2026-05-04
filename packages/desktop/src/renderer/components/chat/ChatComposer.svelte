<script lang="ts">
  import { onMount } from "svelte";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import LoaderCircle from "lucide-svelte/icons/loader-circle";
  import Square from "lucide-svelte/icons/square";
  import {
    findSelectedModel,
    resolveSelectedModel,
    sameSelectedModel,
  } from "../../lib/modelCatalog";
  import { appStateStore, patchAppState } from "../../lib/state/stateManager";
  import type {
    OpenCodeModelCatalogProvider,
    SelectedModelRef,
  } from "../../lib/types";
  import { OPEN_CODE_MODEL } from "../../../shared/openCodeModel.js";

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
  let catalogProviders = $state<OpenCodeModelCatalogProvider[]>([]);
  let providerLoading = $state(false);
  let providerError = $state<string | null>(null);
  let selectedModel = $state<SelectedModelRef | null>(null);
  let providerRequestId = 0;

  let canSend = $derived(!busy && prompt.trim().length > 0);
  let selectedModelLabel = $derived.by(() => {
    const selectedEntry = findSelectedModel(catalogProviders, selectedModel);
    return selectedEntry?.model.name ?? selectedModel?.modelId ?? OPEN_CODE_MODEL;
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

  async function refreshOpenCodeModelCatalog(): Promise<void> {
    const currentRequestId = ++providerRequestId;
    providerLoading = true;
    providerError = null;

    try {
      const response = await window.electronAPI.getOpenCodeModelCatalog({
        workspaceRoot: getWorkspaceRoot(),
      });

      if (currentRequestId !== providerRequestId) return;
      if (!response.ok || !response.providers) {
        catalogProviders = [];
        providerError =
          response.error?.trim() || "Failed to load available models.";
        return;
      }

      catalogProviders = response.providers;
      const resolvedModel = resolveSelectedModel(
        response.providers,
        selectedModel,
      );
      if (!sameSelectedModel(resolvedModel, selectedModel)) {
        patchAppState({
          providers: {
            selectedModel: resolvedModel,
          },
        });
      }
    } catch (error) {
      if (currentRequestId !== providerRequestId) return;
      catalogProviders = [];
      providerError =
        error instanceof Error ? error.message : "Failed to load available models.";
    } finally {
      if (currentRequestId === providerRequestId) {
        providerLoading = false;
      }
    }
  }

  function toggleModelPopover(): void {
    modelOpen = !modelOpen;
    if (modelOpen) {
      void refreshOpenCodeModelCatalog();
    }
  }

  function selectModel(providerId: string, modelId: string): void {
    const nextProviderId = providerId.trim();
    const nextModelId = modelId.trim();
    if (!nextProviderId || !nextModelId) return;

    patchAppState({
      providers: {
        selectedModel: {
          providerId: nextProviderId,
          modelId: nextModelId,
        },
      },
    });
    modelOpen = false;
  }

  function isSelectedModel(providerId: string, modelId: string): boolean {
    return (
      selectedModel?.providerId === providerId &&
      selectedModel?.modelId === modelId
    );
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
      selectedModel = state.providers.selectedModel;
    });

    return () => {
      unsubscribe();
    };
  });

  $effect(() => {
    activeWorkspaceRoot;
    void refreshOpenCodeModelCatalog();
  });
</script>

<div
  class="chat-composer-root p-3"
  onselectstart={(event) => {
    event.preventDefault();
  }}
>
  <div class="rounded-xl border border-dark-border bg-dark-bgS/80 px-3 py-2.5">
    <textarea
      class="w-full resize-none border-0 bg-transparent p-0 text-sm text-dark-fg focus:outline-none focus:ring-0"
      bind:this={textareaEl}
      bind:value={prompt}
      maxlength={MAX_PROMPT_CHARS}
      placeholder="Ask Exort..."
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
                  <span class="font-medium text-dark-fg1">Select Model</span>
                </div>

                {#if providerLoading}
                  <p class="text-xs text-dark-fg3">Loading models...</p>
                {:else if providerError}
                  <p class="text-xs text-dark-red">{providerError}</p>
                {:else}
                  <div class="space-y-2">
                    {#if catalogProviders.length === 0}
                      <p class="text-xs text-dark-fg3">
                        No connected models available.
                      </p>
                    {:else}
                      <div
                        class="chat-timeline-scroll max-h-52 space-y-2 overflow-y-auto pr-2"
                      >
                        {#each catalogProviders as provider (provider.providerId)}
                          <div class="space-y-1">
                            <div class="px-1 text-[11px] font-semibold text-dark-fg2">
                              {provider.providerName}
                            </div>
                            {#each provider.models as model (model.id)}
                              <button
                                class={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors duration-150 ${
                                  isSelectedModel(provider.providerId, model.id)
                                    ? "border-primary-500 bg-dark-bg1 text-dark-fg1"
                                    : "border-dark-border bg-dark-bg text-dark-fg3 hover:bg-dark-bg1 hover:text-dark-fg1"
                                }`}
                                onclick={() =>
                                  selectModel(provider.providerId, model.id)}
                                title={`${provider.providerId}/${model.id}`}
                              >
                                <div
                                  class="flex items-center justify-between gap-2"
                                >
                                  <span class="truncate">{model.name}</span>
                                  {#if model.id === provider.defaultModelId}
                                    <span
                                      class="shrink-0 text-[10px] text-dark-fg4"
                                      >default</span
                                    >
                                  {/if}
                                </div>
                              </button>
                            {/each}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
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
