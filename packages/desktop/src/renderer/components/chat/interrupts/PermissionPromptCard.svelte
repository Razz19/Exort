<script lang="ts">
  import type { AgentPermissionReply } from "../../../lib/types";

  let { requestId, title, reply, busy = false, onReply } = $props<{
    requestId: string;
    title: string;
    reply?: AgentPermissionReply;
    busy?: boolean;
    onReply: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
  }>();

  let submitting = $state<AgentPermissionReply | null>(null);

  let isResolved = $derived(Boolean(reply));
  let isBusy = $derived(busy || submitting !== null);
  let permissionTarget = $derived.by(() => {
    const normalized = title.trim();
    if (!normalized) return "this action";
    if (/^permission(?:\s+request)?$/i.test(normalized)) {
      return "this action";
    }
    return normalized;
  });
  let statusText = $derived.by(() => {
    if (!reply) return null;
    if (reply === "once") return "Allowed once";
    if (reply === "always") return "Always allowed";
    return "Rejected";
  });

  async function submit(nextReply: AgentPermissionReply): Promise<void> {
    if (isBusy || isResolved) return;
    submitting = nextReply;

    try {
      await Promise.resolve(onReply(requestId, nextReply));
    } finally {
      submitting = null;
    }
  }
</script>

<div class="mt-2 rounded-md border border-dark-yellow/40 bg-dark-yellow/10 p-2.5">
  <p class="text-xs text-dark-fg2">Command requiring permission</p>
  <p class="mt-1 text-sm font-medium text-dark-fg1">{permissionTarget}</p>

  {#if statusText}
    <div class="mt-2 inline-flex rounded border border-dark-border bg-dark-bg px-2 py-1 text-[11px] text-dark-fg2">
      {statusText}
    </div>
  {:else}
    <div class="mt-2 flex flex-wrap gap-1.5">
      <button
        class="rounded border border-dark-red/50 px-2 py-1 text-xs text-dark-red2 hover:border-dark-red2 disabled:opacity-60"
        disabled={isBusy}
        onclick={() => submit("reject")}
      >
        {submitting === "reject" ? "Rejecting..." : "Reject"}
      </button>
      <button
        class="rounded border border-dark-border px-2 py-1 text-xs text-dark-fg2 hover:border-primary-500 hover:text-primary-300 disabled:opacity-60"
        disabled={isBusy}
        onclick={() => submit("always")}
      >
        {submitting === "always" ? "Saving..." : "Always allow"}
      </button>
      <button
        class="rounded border border-dark-aqua/50 bg-dark-aqua/10 px-2 py-1 text-xs text-dark-aqua hover:border-dark-aqua disabled:opacity-60"
        disabled={isBusy}
        onclick={() => submit("once")}
      >
        {submitting === "once" ? "Allowing..." : "Allow once"}
      </button>
    </div>
  {/if}
</div>
