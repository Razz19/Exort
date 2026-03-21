<script lang="ts">
  import { onMount } from "svelte";
  import type { AgentSessionSummary } from "../lib/types";

  type WorkspaceEntry = {
    id: string;
    name: string;
    rootPath: string;
  };

  const panelWidthPx = 288;
  const panelGapPx = 8;
  const viewportPaddingPx = 8;
  const panelEstimatedHeightPx = 420;

  let {
    workspace,
    sessions,
    activeSessionId,
    anchorRect,
    loading,
    onSelectSession,
    onHover,
    onLeave,
  } = $props<{
    workspace: WorkspaceEntry | null;
    sessions: AgentSessionSummary[];
    activeSessionId: string | null;
    anchorRect: DOMRect | null;
    loading: boolean;
    onSelectSession?: (sessionId: string) => Promise<void> | void;
    onHover?: () => void;
    onLeave?: () => void;
  }>();

  let viewport = $state({ width: 0, height: 0 });

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function getSessionLabel(session: AgentSessionSummary): string {
    const title = session.title?.trim();
    const isGenericWorkspaceTitle =
      typeof title === "string" && /^workspace:\s+/i.test(title);
    if (title && !isGenericWorkspaceTitle) return title;
    const slug = session.slug?.trim();
    if (slug) return slug;
    if (title) return title;
    return `Session ${session.id.slice(0, 8)}`;
  }

  function formatSessionUpdatedAt(session: AgentSessionSummary): string {
    const parsed = new Date(session.updatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
    return session.updatedAt;
  }

  function formatSessionShortId(session: AgentSessionSummary): string {
    return session.id.slice(0, 8);
  }

  let panelLeftPx = $derived.by(() => {
    if (!anchorRect) return viewportPaddingPx;

    const minLeft = viewportPaddingPx;
    const maxLeft = Math.max(
      minLeft,
      viewport.width - panelWidthPx - viewportPaddingPx,
    );
    const preferredLeft = Math.round(
      anchorRect.left - panelWidthPx - panelGapPx,
    );
    if (preferredLeft >= minLeft) {
      return clamp(preferredLeft, minLeft, maxLeft);
    }

    const fallbackRight = Math.round(anchorRect.right + panelGapPx);
    return clamp(fallbackRight, minLeft, maxLeft);
  });
  let panelTopPx = $derived.by(() => {
    if (!anchorRect) return viewportPaddingPx;
    const maxTop = Math.max(
      viewportPaddingPx,
      viewport.height - panelEstimatedHeightPx - viewportPaddingPx,
    );
    return clamp(Math.round(anchorRect.top), viewportPaddingPx, maxTop);
  });

  onMount(() => {
    const syncViewport = () => {
      viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  });
</script>

{#if workspace && anchorRect}
  <div
    class="fixed z-50 w-72 rounded-lg border border-dark-border bg-dark-surface p-3 shadow-lg"
    style={`left: ${panelLeftPx}px; top: ${panelTopPx}px;`}
    role="tooltip"
    aria-label={`Workspace preview for ${workspace.name || workspace.rootPath}`}
    onmouseenter={onHover}
    onmouseleave={onLeave}
  >
    <div class="mb-3">
      <div class="truncate text-sm font-semibold text-dark-yellow">
        {workspace.name || workspace.rootPath}
      </div>
      <div class="truncate text-xs text-gray-400" title={workspace.rootPath}>
        {workspace.rootPath}
      </div>
    </div>

    {#if loading}
      <div
        class="rounded-md border border-dark-border bg-dark-bg p-2 text-xs text-gray-400"
      >
        Loading sessions...
      </div>
    {:else if sessions.length === 0}
      <div
        class="rounded-md border border-dark-border bg-dark-bg p-2 text-xs text-gray-400"
      >
        No sessions yet.
      </div>
    {:else}
      <div
        class="max-h-[min(28rem,calc(100vh-1rem))] overflow-y-auto rounded-md border border-dark-border bg-dark-bg p-2"
      >
        <div class="flex flex-col gap-1">
          {#each sessions as session (session.id)}
            <button
              type="button"
              class={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                session.id === activeSessionId
                  ? "border-primary-500 bg-primary-600/20"
                  : "border-dark-border bg-dark-bg hover:bg-dark-blue/20"
              }`}
              title={session.id}
              onclick={() => void onSelectSession?.(session.id)}
            >
              <div class="truncate text-xs font-medium text-dark-fg0">
                {getSessionLabel(session)}
              </div>
              <div
                class="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-dark-fg3"
              >
                <span class="truncate">{formatSessionUpdatedAt(session)}</span>
                <span class="shrink-0 font-mono"
                  >{formatSessionShortId(session)}</span
                >
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
