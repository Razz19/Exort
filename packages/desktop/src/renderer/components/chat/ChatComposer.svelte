<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import FileText from "lucide-svelte/icons/file-text";
  import Plus from "lucide-svelte/icons/plus";
  import LoaderCircle from "lucide-svelte/icons/loader-circle";
  import Square from "lucide-svelte/icons/square";
  import X from "lucide-svelte/icons/x";
  import {
    findSelectedModel,
    resolveSelectedModel,
    sameSelectedModel,
  } from "../../lib/modelCatalog";
  import { appStateStore, patchAppState } from "../../lib/state/stateManager";
  import type {
    ChatAttachment,
    ChatSendPayload,
    OpenCodeModelCatalogProvider,
    SelectedModelRef,
  } from "../../lib/types";
  import { OPEN_CODE_MODEL } from "../../../shared/openCodeModel.js";

  type ComposerAttachment = ChatAttachment & {
    previewUrl?: string;
  };

  let {
    activeWorkspaceRoot,
    busy,
    stopping,
    agentMode,
    onAgentModeChange,
    onSend,
    onStop,
  } = $props<{
    activeWorkspaceRoot: string | null;
    busy: boolean;
    stopping: boolean;
    agentMode: "build" | "plan";
    onAgentModeChange: (mode: "build" | "plan") => void;
    onSend: (payload: ChatSendPayload) => Promise<void> | void;
    onStop: () => Promise<void> | void;
  }>();

  const MAX_PROMPT_CHARS = 12000;
  const ATTACHMENT_ONLY_PROMPT = "Please review the attached file.";

  let prompt = $state("");
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);
  let attachments = $state<ComposerAttachment[]>([]);
  let draggingFiles = $state(false);
  let modelOpen = $state(false);
  let modelButtonEl = $state<HTMLButtonElement | null>(null);
  let modelPopoverEl = $state<HTMLDivElement | null>(null);
  let catalogProviders = $state<OpenCodeModelCatalogProvider[]>([]);
  let providerLoading = $state(false);
  let providerError = $state<string | null>(null);
  let selectedModel = $state<SelectedModelRef | null>(null);
  let providerRequestId = 0;
  let dragDepth = 0;

  let canSend = $derived(
    !busy && (prompt.trim().length > 0 || attachments.length > 0),
  );
  let selectedModelLabel = $derived.by(() => {
    const selectedEntry = findSelectedModel(catalogProviders, selectedModel);
    return (
      selectedEntry?.model.name ?? selectedModel?.modelId ?? OPEN_CODE_MODEL
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

  function normalizeAttachmentMime(file: File): string {
    if (file.type.startsWith("image/") || file.type === "application/pdf") {
      return file.type;
    }
    return "text/plain";
  }

  function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }

  function revokeAttachmentPreview(attachment: ComposerAttachment): void {
    if (!attachment.previewUrl) return;
    URL.revokeObjectURL(attachment.previewUrl);
  }

  function removeAttachment(id: string): void {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed) revokeAttachmentPreview(removed);
    attachments = attachments.filter((attachment) => attachment.id !== id);
  }

  function clearAttachments(): void {
    for (const attachment of attachments) {
      revokeAttachmentPreview(attachment);
    }
    attachments = [];
  }

  function clearSentAttachments(): void {
    attachments = [];
  }

  function addFiles(files: FileList | File[]): void {
    const next = [...attachments];
    const seenPaths = new Set(next.map((attachment) => attachment.path));

    for (const file of Array.from(files)) {
      const path = window.electronAPI.getPathForFile(file).trim();
      if (!path || seenPaths.has(path)) continue;

      const mime = normalizeAttachmentMime(file);
      const attachment: ComposerAttachment = {
        id: crypto.randomUUID(),
        name: file.name || path.split(/[\\/]/).pop() || "attachment",
        path,
        mime,
        size: file.size,
        previewUrl: mime.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      };
      next.push(attachment);
      seenPaths.add(path);
    }

    attachments = next;
  }

  function openFilePicker(): void {
    fileInputEl?.click();
  }

  function handleFileInputChange(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !input.files) return;
    addFiles(input.files);
    input.value = "";
  }

  function hasDraggedFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  function handleDragEnter(event: DragEvent): void {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    draggingFiles = true;
  }

  function handleDragOver(event: DragEvent): void {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent): void {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      draggingFiles = false;
    }
  }

  function handleDrop(event: DragEvent): void {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    draggingFiles = false;
    const files = event.dataTransfer?.files;
    if (files) addFiles(files);
  }

  function extractClipboardFiles(event: ClipboardEvent): File[] {
    const clipboard = event.clipboardData;
    if (!clipboard) return [];

    const files: File[] = [];
    const seen = new Set<File>();

    for (const file of Array.from(clipboard.files)) {
      if (seen.has(file)) continue;
      seen.add(file);
      files.push(file);
    }

    for (const item of Array.from(clipboard.items)) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      files.push(file);
    }

    return files;
  }

  function handleComposerPaste(event: ClipboardEvent): void {
    const files = extractClipboardFiles(event);
    if (files.length === 0) return;
    // When clipboard includes files, attach them without pasting fallback text
    // such as the file name/path into the prompt.
    event.preventDefault();
    addFiles(files);
  }

  function toSendAttachments(): ChatAttachment[] {
    return attachments.map(({ previewUrl, ...attachment }) => ({
      ...attachment,
      url: previewUrl,
    }));
  }

  function submit(): void {
    const text = prompt.trim();
    if (busy || (!text && attachments.length === 0)) return;

    const previousPrompt = prompt;
    const previousAttachments = attachments;
    const payload: ChatSendPayload = {
      prompt: text || ATTACHMENT_ONLY_PROMPT,
      attachments: toSendAttachments(),
      mode: agentMode,
    };

    prompt = "";
    clearSentAttachments();
    queueMicrotask(() => resizeInput());

    void Promise.resolve(onSend(payload))
      .then(() => {
        // Cleared optimistically on submit.
      })
      .catch((error) => {
        console.error("[ChatComposer] send failed", error);
        if (!prompt.trim() && attachments.length === 0) {
          prompt = previousPrompt;
          attachments = previousAttachments;
          queueMicrotask(() => resizeInput());
        }
      });
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
        error instanceof Error
          ? error.message
          : "Failed to load available models.";
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

  onDestroy(() => {
    clearAttachments();
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
  <div
    class={`rounded-xl border px-3 py-2.5 transition-colors duration-150 ${
      draggingFiles
        ? "border-primary-500 bg-dark-bg1"
        : "border-dark-border bg-dark-bgS/80"
    } focus-within:border-dark-orange2/50`}
    ondragenter={handleDragEnter}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    role="group"
    aria-label="Chat composer"
  >
    <input
      class="hidden"
      bind:this={fileInputEl}
      type="file"
      multiple
      onchange={handleFileInputChange}
      aria-label="Attach files"
    />

    {#if attachments.length > 0}
      <div class="mb-2 flex flex-wrap gap-2">
        {#each attachments as attachment (attachment.id)}
          <div
            class="group inline-flex max-w-full items-center gap-2 rounded-md border border-dark-border bg-dark-bg px-2 py-1 text-xs text-dark-fg2"
            title={attachment.path}
          >
            {#if attachment.previewUrl}
              <img
                class="h-7 w-7 shrink-0 rounded object-cover"
                src={attachment.previewUrl}
                alt={attachment.name}
              />
            {:else}
              <span
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-dark-bg1 text-dark-fg3"
                aria-hidden="true"
              >
                <FileText class="h-4 w-4" />
              </span>
            {/if}
            <span class="min-w-0">
              <span class="block max-w-40 truncate text-dark-fg1">
                {attachment.name}
              </span>
              <span class="block text-[10px] text-dark-fg4">
                {formatFileSize(attachment.size)}
              </span>
            </span>
            <button
              type="button"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-dark-fg3 transition-colors hover:bg-dark-bg1 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              onclick={() => removeAttachment(attachment.id)}
              aria-label={`Remove ${attachment.name}`}
              title="Remove"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <textarea
      class="w-full resize-none border-0 bg-transparent p-0 text-sm text-dark-fg placeholder:text-dark-fg4 focus:outline-none focus:ring-0"
      bind:this={textareaEl}
      bind:value={prompt}
      maxlength={MAX_PROMPT_CHARS}
      placeholder="Ask Exort..."
      style="min-height: 44px; max-height: 120px;"
      onpaste={handleComposerPaste}
      onkeydown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submit();
        }
      }}
    ></textarea>

    <div class="mt-1.5 flex items-center justify-between">
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-dark-fg3 transition-colors duration-150 hover:bg-dark-bg1 hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          onclick={openFilePicker}
          disabled={busy}
          aria-label="Attach files"
          title="Attach files"
        >
          <Plus class="h-4 w-4" />
        </button>

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
                            <div
                              class="px-1 text-[11px] font-semibold text-dark-fg2"
                            >
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

      <div class="flex items-center gap-2">
        <div
          class="inline-flex items-center gap-2 rounded-md border border-dark-border px-2 py-1"
          role="group"
          aria-label="Agent mode"
        >
          <span class="text-xs font-medium text-dark-fg3">Mode</span>
          <button
            type="button"
            class={`inline-flex h-6 items-center rounded-md border px-2.5 text-[10px] font-medium transition-colors ${
              agentMode === "build"
                ? "border-dark-blue bg-dark-blue text-dark-bg"
                : "border-dark-green bg-dark-green text-dark-bg"
            }`}
            disabled={busy}
            onclick={() =>
              onAgentModeChange(agentMode === "build" ? "plan" : "build")}
            aria-pressed={true}
            title={`Switch to ${agentMode === "build" ? "Plan" : "Build"} mode`}
          >
            {agentMode === "build" ? "Build" : "Plan"}
          </button>
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
</div>
