<script lang="ts">
  import { BringToFront, Dice6, MonitorCog, X } from "lucide-svelte";
  import BoardsSettingsTab from "./BoardsSettingsTab.svelte";
  import GeneralSettingsTab from "./GeneralSettingsTab.svelte";
  import ProvidersSettingsTab from "./ProvidersSettingsTab.svelte";

  type SettingsTab = "general" | "providers" | "boards";

  let {
    onClose,
    initialTab = "general",
    activeWorkspaceRoot = null,
    onRequirementsUpdated = () => {},
  } = $props<{
    onClose: () => void;
    initialTab?: SettingsTab;
    activeWorkspaceRoot?: string | null;
    onRequirementsUpdated?: (requirements: RequirementStatus[]) => void;
  }>();

  let activeTab = $state<SettingsTab>("general");

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon: typeof X;
  }> = [
    { id: "general", label: "General", icon: MonitorCog },
    { id: "providers", label: "Providers", icon: BringToFront },
    { id: "boards", label: "Boards", icon: Dice6 },
  ];
  const activeTabLabel = $derived.by(
    () => tabs.find((tab) => tab.id === activeTab)?.label ?? "Settings",
  );

  $effect(() => {
    activeTab = initialTab;
  });

  $effect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function onBackdropKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClose();
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/80 p-4"
  role="dialog"
  aria-modal="true"
  aria-label="App settings"
  tabindex="-1"
  onclick={onBackdropClick}
  onkeydown={onBackdropKeydown}
>
  <section
    class="flex h-[min(680px,calc(100vh-2rem))] w-[min(1120px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-dark-yellow/20 bg-dark-surface shadow-2xl"
  >
    <aside
      class="flex w-48 shrink-0 flex-col border-r border-dark-border bg-dark-bg px-3 py-3"
    >
      <div
        class="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-dark-fg3"
      ></div>
      <nav class="flex flex-col gap-2 pt-10" aria-label="Settings sections">
        {#each tabs as tab (tab.id)}
          <button
            class={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-primary-600/20 text-dark-fg"
                : "text-dark-fg2 hover:bg-dark-bgH hover:text-dark-fg"
            }`}
            onclick={() => {
              activeTab = tab.id;
            }}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <tab.icon class="h-4 w-4 shrink-0" />
            <span>{tab.label}</span>
          </button>
        {/each}
      </nav>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex items-center justify-between border-b border-dark-border px-5 py-3"
      >
        <h1 class="text-base font-semibold text-dark-fg">{activeTabLabel}</h1>
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dark-border
            bg-dark-bg text-dark-fg2 transition-colors hover:bg-dark-bgH hover:text-dark-fg"
          onclick={onClose}
          aria-label="Close settings"
        >
          <X class="h-4 w-4" />
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-5">
        {#if activeTab === "general"}
          <GeneralSettingsTab {onRequirementsUpdated} />
        {:else if activeTab === "providers"}
          <ProvidersSettingsTab {activeWorkspaceRoot} />
        {:else}
          <BoardsSettingsTab />
        {/if}
      </div>
    </div>
  </section>
</div>
