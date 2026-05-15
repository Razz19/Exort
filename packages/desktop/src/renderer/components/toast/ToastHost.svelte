<script lang="ts">
  import {
    AlertTriangle,
    CheckCircle2,
    Info,
    X,
    XCircle,
  } from "lucide-svelte";
  import type { ToastMessage } from "./types";

  let { toasts, onDismiss, onAction } = $props<{
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
    onAction: (id: string) => void;
  }>();

  function getToastClasses(toast: ToastMessage): string {
    if (toast.variant === "success") {
      return "border-dark-green/40 bg-dark-green/15 text-dark-green2";
    }
    if (toast.variant === "warning") {
      return "border-dark-yellow/40 bg-dark-yellow/15 text-dark-yellow2";
    }
    if (toast.variant === "error") {
      return "border-dark-red/40 bg-dark-red/15 text-dark-red2";
    }
    return "border-dark-blue/40 bg-dark-blue/15 text-dark-blue2";
  }

  function getIcon(toast: ToastMessage): typeof Info {
    if (toast.variant === "success") return CheckCircle2;
    if (toast.variant === "warning") return AlertTriangle;
    if (toast.variant === "error") return XCircle;
    return Info;
  }
</script>

{#if toasts.length > 0}
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    aria-live="polite"
    aria-relevant="additions removals"
  >
    {#each toasts as toast (toast.id)}
      {@const Icon = getIcon(toast)}
      <section
        class={`pointer-events-auto rounded-lg border px-3 py-3 shadow-xl backdrop-blur ${getToastClasses(toast)}`}
        role={toast.variant === "error" || toast.variant === "warning"
          ? "alert"
          : "status"}
      >
        <div class="flex items-start gap-3">
          <Icon class="mt-0.5 h-4 w-4 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-semibold text-dark-fg">{toast.title}</p>
              <button
                class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-dark-fg3 transition-colors hover:bg-dark-bg/40 hover:text-dark-fg"
                onclick={() => onDismiss(toast.id)}
                aria-label={`Dismiss ${toast.title}`}
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
            <p class="mt-1 text-xs leading-5 text-dark-fg2">{toast.message}</p>
            {#if toast.actionLabel}
              <button
                class="btn-secondary mt-3 inline-flex h-8 items-center justify-center px-2.5 py-0 text-xs"
                onclick={() => onAction(toast.id)}
              >
                {toast.actionLabel}
              </button>
            {/if}
          </div>
        </div>
      </section>
    {/each}
  </div>
{/if}
