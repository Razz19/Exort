<script lang="ts">
  import { onMount } from "svelte";
  import { Download, Loader, RefreshCw, Search, Trash2 } from "lucide-svelte";

  let searchQuery = $state("");
  let installedCores = $state<ArduinoCorePackage[]>([]);
  let catalogCores = $state<ArduinoCorePackage[]>([]);
  let loadingInstalled = $state(false);
  let loadingCatalog = $state(false);
  let refreshBusy = $state(false);
  let installingCoreIds = $state<Record<string, true>>({});
  let uninstallingCoreIds = $state<Record<string, true>>({});
  let errorMessage = $state<string | null>(null);
  let statusMessage = $state<string | null>(null);

  let normalizedQuery = $derived(searchQuery.trim().toLowerCase());
  let installedCoreIds = $derived.by(
    () => new Set(installedCores.map((core) => core.id)),
  );
  let filteredInstalled = $derived.by(() => {
    if (!normalizedQuery) return installedCores;
    return installedCores.filter((core) => matchesQuery(core, normalizedQuery));
  });
  let filteredCatalog = $derived.by(() => {
    if (!normalizedQuery) return catalogCores;
    return catalogCores.filter((core) => matchesQuery(core, normalizedQuery));
  });

  onMount(() => {
    void loadAll();
  });

  function matchesQuery(core: ArduinoCorePackage, query: string): boolean {
    if (!query) return true;
    return (
      core.name.toLowerCase().includes(query) ||
      core.id.toLowerCase().includes(query) ||
      core.maintainer.toLowerCase().includes(query)
    );
  }

  function getTierClasses(tier: ArduinoCoreTier): string {
    if (tier === "official") {
      return "border-dark-blue/40 bg-dark-blue/15 text-dark-blue2";
    }
    if (tier === "certified") {
      return "border-dark-green/40 bg-dark-green/15 text-dark-green2";
    }
    if (tier === "community") {
      return "border-dark-aqua2/40 bg-dark-aqua2/10 text-dark-aqua2";
    }
    return "border-dark-yellow/40 bg-dark-yellow/15 text-dark-yellow2";
  }

  function getTierLabel(tier: ArduinoCoreTier): string {
    if (tier === "official") return "Official";
    if (tier === "certified") return "Certified";
    if (tier === "community") return "Community";
    return "Partner";
  }

  function normalizeStatusMessage(input: string): string {
    const compact = input.replace(/\s+/g, " ").trim();
    const MAX_LEN = 180;
    if (compact.length <= MAX_LEN) return compact;
    return `${compact.slice(0, MAX_LEN - 1)}...`;
  }

  async function loadInstalled(errors: string[]): Promise<void> {
    loadingInstalled = true;
    try {
      const response = await window.electronAPI.listArduinoInstalledCores();
      if (!response.ok) {
        errors.push(response.error ?? "Failed to load installed cores.");
        return;
      }
      installedCores = response.cores ?? [];
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : "Failed to load installed cores.",
      );
    } finally {
      loadingInstalled = false;
    }
  }

  async function loadCatalog(errors: string[]): Promise<void> {
    loadingCatalog = true;
    try {
      const response = await window.electronAPI.listArduinoCatalogCores();
      if (!response.ok) {
        errors.push(response.error ?? "Failed to load core catalog.");
        return;
      }
      catalogCores = response.cores ?? [];
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Failed to load core catalog.",
      );
    } finally {
      loadingCatalog = false;
    }
  }

  async function loadAll(): Promise<void> {
    const errors: string[] = [];
    await Promise.all([loadInstalled(errors), loadCatalog(errors)]);
    errorMessage = errors[0] ? normalizeStatusMessage(errors[0]) : null;
  }

  async function refreshIndex(): Promise<void> {
    if (refreshBusy) return;

    refreshBusy = true;
    errorMessage = null;
    statusMessage = null;

    try {
      const response = await window.electronAPI.updateArduinoCoreIndex();
      if (!response.ok) {
        errorMessage = normalizeStatusMessage(
          response.error ?? "Failed to refresh core index.",
        );
        return;
      }

      statusMessage = normalizeStatusMessage("Board index refreshed.");
      await loadAll();
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to refresh core index.",
      );
    } finally {
      refreshBusy = false;
    }
  }

  async function installCore(coreId: string): Promise<void> {
    if (
      installedCoreIds.has(coreId) ||
      installingCoreIds[coreId] ||
      uninstallingCoreIds[coreId]
    )
      return;

    installingCoreIds = {
      ...installingCoreIds,
      [coreId]: true,
    };
    errorMessage = null;
    statusMessage = null;

    try {
      const response = await window.electronAPI.installArduinoCore({
        id: coreId,
      });

      if (!response.ok) {
        errorMessage = normalizeStatusMessage(
          response.error ?? `Failed to install ${coreId}.`,
        );
        return;
      }

      statusMessage = normalizeStatusMessage(
        response.message ?? `Installed ${coreId}.`,
      );
      await loadAll();
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error ? error.message : `Failed to install ${coreId}.`,
      );
    } finally {
      const next = { ...installingCoreIds };
      delete next[coreId];
      installingCoreIds = next;
    }
  }

  async function uninstallCore(coreId: string): Promise<void> {
    if (uninstallingCoreIds[coreId] || installingCoreIds[coreId]) return;

    uninstallingCoreIds = {
      ...uninstallingCoreIds,
      [coreId]: true,
    };
    errorMessage = null;
    statusMessage = null;

    try {
      const response = await window.electronAPI.uninstallArduinoCore({
        id: coreId,
      });

      if (!response.ok) {
        errorMessage = normalizeStatusMessage(
          response.error ?? `Failed to remove ${coreId}.`,
        );
        return;
      }

      statusMessage = normalizeStatusMessage(
        response.message ?? `Removed ${coreId}.`,
      );
      await loadAll();
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error ? error.message : `Failed to remove ${coreId}.`,
      );
    } finally {
      const next = { ...uninstallingCoreIds };
      delete next[coreId];
      uninstallingCoreIds = next;
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col gap-4">
  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <div class="mb-2">
      <h2 class="text-sm font-semibold text-dark-fg">Boards Manager</h2>
      <!-- <p class="text-xs text-dark-fg4">
        Browse and install Arduino official, certified, and partner platforms.
      </p> -->
    </div>

    <div class="flex flex-col gap-2 md:flex-row">
      <div class="input-field flex h-9 min-w-0 flex-1 items-center gap-2">
        <Search class="h-4 w-4 shrink-0 text-dark-fg4" />
        <input
          class="h-full w-full border-0 bg-transparent p-0 text-sm text-dark-fg outline-none ring-0 placeholder:text-dark-fg4 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          placeholder="Search by package, id, or maintainer..."
          bind:value={searchQuery}
        />
      </div>
      <button
        class="btn-secondary inline-flex h-9 items-center justify-center gap-2 px-3 py-0 md:w-auto"
        onclick={() => void refreshIndex()}
        disabled={refreshBusy}
        aria-label="Refresh Arduino core index"
      >
        {#if refreshBusy}
          <Loader class="h-4 w-4 animate-spin" />
        {:else}
          <RefreshCw class="h-4 w-4" />
        {/if}
        <span>{refreshBusy ? "Refreshing..." : "Refresh index"}</span>
      </button>
    </div>

    <div
      class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-dark-fg3"
    >
      <span class="rounded border border-dark-border bg-dark-surface px-2 py-1">
        Installed: {installedCores.length}
      </span>
      <span class="rounded border border-dark-border bg-dark-surface px-2 py-1">
        Catalog: {catalogCores.length}
      </span>
      {#if loadingInstalled || loadingCatalog}
        <span
          class="inline-flex items-center gap-1 rounded border border-dark-border bg-dark-surface px-2 py-1"
        >
          <Loader class="h-3 w-3 animate-spin" />
          Loading...
        </span>
      {/if}
    </div>
  </div>

  {#if errorMessage}
    <div
      class="rounded-md border border-dark-red/40 bg-dark-red/15 px-3 py-2 text-sm text-dark-red2"
    >
      {errorMessage}
    </div>
  {/if}

  {#if statusMessage}
    <div
      class="rounded-md border border-dark-green/40 bg-dark-green/15 px-3 py-2 text-sm text-dark-green2"
    >
      {statusMessage}
    </div>
  {/if}

  <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
    <section class="card flex min-h-0 flex-col overflow-hidden">
      <header
        class="flex items-center justify-between border-b border-dark-border px-3 py-2"
      >
        <h3 class="text-sm font-semibold text-dark-fg">Installed Packages</h3>
        <span class="text-xs text-dark-fg3">{filteredInstalled.length}</span>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {#if loadingInstalled && installedCores.length === 0}
          <div
            class="flex h-full items-center justify-center gap-2 px-3 text-sm text-dark-fg3"
          >
            <Loader class="h-4 w-4 animate-spin" />
            <span>Loading installed packages...</span>
          </div>
        {:else if filteredInstalled.length === 0}
          <div class="px-3 py-4 text-sm text-dark-fg3">
            {normalizedQuery
              ? "No installed packages match your search."
              : "No installed packages in this scope."}
          </div>
        {:else}
          <ul class="divide-y divide-dark-border/60">
            {#each filteredInstalled as core (core.id)}
              {@const removing = !!uninstallingCoreIds[core.id]}
              {@const installing = !!installingCoreIds[core.id]}
              <li class="px-3 py-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-dark-fg">{core.name}</p>
                    <p
                      class="mt-0.5 break-all font-mono text-[11px] text-dark-fg4"
                    >
                      {core.id}
                    </p>
                    <p class="mt-1 text-[11px] text-dark-fg4">
                      {core.maintainer}
                      {#if core.boardCount > 0}
                        · {core.boardCount} boards
                      {/if}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1">
                      <span
                        class={`inline-flex rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${getTierClasses(core.tier)}`}
                      >
                        {getTierLabel(core.tier)}
                      </span>
                      {#if core.deprecated}
                        <span
                          class="inline-flex rounded border border-dark-fg3/40 bg-dark-fg3/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-dark-fg3"
                        >
                          Deprecated
                        </span>
                      {/if}
                    </div>
                  </div>

                  <div class="shrink-0 text-right text-xs text-dark-fg2">
                    <p>Installed: {core.installedVersion ?? "—"}</p>
                    <!-- <p class="text-dark-fg4">Latest: {core.latestVersion ?? "—"}</p> -->
                    <button
                      class="mt-2 inline-flex h-8 items-center gap-1 rounded-md border border-dark-border bg-dark-bg px-2.5 text-xs text-dark-red2 transition-colors hover:bg-dark-red/10 hover:text-dark-red disabled:cursor-not-allowed disabled:opacity-60"
                      onclick={() => void uninstallCore(core.id)}
                      disabled={removing || installing}
                      aria-label={removing
                        ? `Removing ${core.name}`
                        : `Remove ${core.name}`}
                    >
                      {#if removing}
                        <Loader class="h-3.5 w-3.5 animate-spin" />
                        <span>Removing</span>
                      {:else}
                        <Trash2 class="h-3.5 w-3.5" />
                        <span>Remove</span>
                      {/if}
                    </button>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>

    <section class="card flex min-h-0 flex-col overflow-hidden">
      <header
        class="flex items-center justify-between border-b border-dark-border px-3 py-2"
      >
        <h3 class="text-sm font-semibold text-dark-fg">Available Catalog</h3>
        <span class="text-xs text-dark-fg3">{filteredCatalog.length}</span>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {#if loadingCatalog && catalogCores.length === 0}
          <div
            class="flex h-full items-center justify-center gap-2 px-3 text-sm text-dark-fg3"
          >
            <Loader class="h-4 w-4 animate-spin" />
            <span>Loading catalog...</span>
          </div>
        {:else if filteredCatalog.length === 0}
          <div class="px-3 py-4 text-sm text-dark-fg3">
            {normalizedQuery
              ? "No catalog packages match your search."
              : "No catalog packages available."}
          </div>
        {:else}
          <ul class="divide-y divide-dark-border/60">
            {#each filteredCatalog as core (core.id)}
              {@const alreadyInstalled = installedCoreIds.has(core.id)}
              {@const installing = !!installingCoreIds[core.id]}
              {@const removing = !!uninstallingCoreIds[core.id]}
              <li class="px-3 py-3">
                <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-dark-fg">{core.name}</p>
                    <p
                      class="mt-0.5 break-all font-mono text-[11px] text-dark-fg4"
                    >
                      {core.id}
                    </p>
                    <p class="mt-1 text-[11px] text-dark-fg4">
                      {core.maintainer}
                      {#if core.boardCount > 0}
                        · {core.boardCount} boards
                      {/if}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1">
                      <span
                        class={`inline-flex rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${getTierClasses(core.tier)}`}
                      >
                        {getTierLabel(core.tier)}
                      </span>
                      {#if core.deprecated}
                        <span
                          class="inline-flex rounded border border-dark-fg3/40 bg-dark-fg3/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-dark-fg3"
                        >
                          Deprecated
                        </span>
                      {/if}
                    </div>
                  </div>

                  <div
                    class="flex min-w-[160px] items-center justify-between gap-3 md:block md:text-right"
                  >
                    <p class="text-xs text-dark-fg2">
                      Latest: {core.latestVersion ?? "—"}
                    </p>
                    <button
                      class="mt-0 inline-flex h-8 items-center gap-1 rounded-md border border-dark-border bg-dark-bg px-2.5 text-xs text-dark-fg2 transition-colors hover:bg-dark-bgH hover:text-dark-fg disabled:cursor-not-allowed disabled:opacity-60 md:mt-2"
                      onclick={() => void installCore(core.id)}
                      disabled={alreadyInstalled || installing || removing}
                      aria-label={alreadyInstalled
                        ? `${core.name} already installed`
                        : `Install ${core.name}`}
                    >
                      {#if installing}
                        <Loader class="h-3.5 w-3.5 animate-spin" />
                        <span>Installing</span>
                      {:else if alreadyInstalled}
                        <span>Installed</span>
                      {:else}
                        <Download class="h-3.5 w-3.5" />
                        <span>Install</span>
                      {/if}
                    </button>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>
  </div>
</div>
