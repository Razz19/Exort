<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";
  import { FileText, X } from "lucide-svelte";

  import type { ChatAttachment } from "../../lib/types";
  import {
    attachmentPreviewUrl,
    formatAttachmentSize,
    isImageAttachment,
  } from "./attachmentPreview";

  let { attachment, onClose } = $props<{
    attachment: ChatAttachment;
    onClose: () => void;
  }>();

  let closeButtonEl = $state<HTMLButtonElement | null>(null);
  let imageLoadFailed = $state(false);

  let previewUrl = $derived(attachmentPreviewUrl(attachment));
  let canRenderImage = $derived(
    isImageAttachment(attachment) && !imageLoadFailed,
  );

  $effect(() => {
    attachment.id;
    imageLoadFailed = false;
  });

  $effect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonEl?.focus();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  onMount(() => {
    closeButtonEl?.focus();
  });
</script>

<div
  class="absolute inset-0 z-50 flex items-center justify-center overflow-hidden p-4"
  role="dialog"
  aria-modal="true"
  aria-label={`Attachment preview: ${attachment.name}`}
>
  <button
    type="button"
    class="absolute inset-0 bg-dark-bg/80"
    tabindex="-1"
    aria-label="Close attachment preview"
    onclick={onClose}
    transition:fade={{ duration: 120 }}
  ></button>

  <section
    class="flex h-[calc(100%-2rem)] max-h-[48rem] w-[calc(100%-2rem)] max-w-3xl origin-center items-center justify-center"
    transition:scale={{ duration: 160, easing: cubicOut, opacity: 0, start: 0.96 }}
  >
    <div
      class="group relative inline-flex max-h-full max-w-full items-center justify-center"
    >
      {#if canRenderImage}
        <img
          class="block max-h-[calc(100vh-7rem)] max-w-full rounded object-contain"
          src={previewUrl}
          alt={attachment.name}
          onerror={() => {
            imageLoadFailed = true;
          }}
        />
      {:else}
        <div
          class="flex max-w-full flex-col items-center justify-center gap-3 rounded-lg border border-dark-border bg-dark-bgS px-6 py-8 text-center"
        >
          <span
            class="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-dark-bg1 text-dark-fg3"
            aria-hidden="true"
          >
            <FileText class="h-7 w-7" />
          </span>
          <div class="max-w-full">
            <p class="max-w-full truncate text-sm font-medium text-dark-fg1">
              {attachment.name}
            </p>
            <p class="mt-1 text-xs text-dark-fg4">
              Preview unavailable
            </p>
          </div>
        </div>
      {/if}

      <button
        type="button"
        bind:this={closeButtonEl}
        class="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md bg-dark-bg/70 text-dark-fg2 shadow-lg backdrop-blur-sm transition-colors hover:bg-dark-bg hover:text-dark-fg1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label="Close attachment preview"
        title="Close"
        onclick={onClose}
      >
        <X class="h-4 w-4" />
      </button>

      <div
        class="pointer-events-none absolute bottom-2 left-2 right-2 flex items-end gap-3 rounded-md bg-dark-bg/80 px-3 py-2 opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100"
        aria-hidden="true"
      >
        <span
          class="min-w-0 flex-1 break-all text-[11px] leading-4 text-dark-fg2"
        >
          {attachment.path}
        </span>
        <span class="shrink-0 text-[10px] text-dark-fg4">
          {formatAttachmentSize(attachment.size)}
        </span>
      </div>
    </div>
  </section>
</div>
