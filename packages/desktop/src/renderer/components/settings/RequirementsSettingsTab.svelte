<script lang="ts">
  import { onMount } from "svelte";
  import {
    CheckCircle2,
    Download,
    Loader,
    RefreshCw,
    Wrench,
    XCircle,
  } from "lucide-svelte";
  import {
    refreshRequirementsStatus,
    requirementsStore,
  } from "../../lib/state/stateManager";
  import type { RequirementsState } from "../../lib/state/types";

  let { onRequirementsUpdated = () => {} } = $props<{
    onRequirementsUpdated?: (requirements: RequirementStatus[]) => void;
  }>();

  const requirementOrder: RequirementId[] = ["opencode", "arduino-cli"];
  const requirementDisplayNames: Record<RequirementId, string> = {
    opencode: "OpenCode",
    "arduino-cli": "Arduino CLI",
  };
  const requirementDescriptions: Record<RequirementId, string> = {
    opencode:
      "Managed by Exort as a private runtime. This does not rely on global OpenCode in terminal PATH.",
    "arduino-cli":
      "Managed by Exort as a private runtime. Board tools use this pinned binary instead of terminal PATH.",
  };

  let requirementsState = $state<RequirementsState>({
    requirements: [],
    loading: false,
    error: null,
    checkedAt: null,
  });
  let refreshBusy = $state(false);
  let installAllBusy = $state(false);
  let installingIds = $state<Partial<Record<RequirementId, true>>>({});
  let errorMessage = $state<string | null>(null);
  let statusMessage = $state<string | null>(null);
  let manualCommands = $state<string[]>([]);

  let requirements = $derived(requirementsState.requirements);
  let loading = $derived(requirementsState.loading);
  let requirementMap = $derived.by(() => {
    const map: Partial<Record<RequirementId, RequirementStatus>> = {};
    for (const requirement of requirements) {
      map[requirement.id] = requirement;
    }
    return map;
  });
  let missingRequirementIds = $derived(
    requirementOrder.filter((id) => requirementMap[id]?.installed !== true),
  );

  onMount(() => {
    const unsubscribe = requirementsStore.subscribe((state) => {
      requirementsState = state;
    });
    void loadRequirements();

    return () => {
      unsubscribe();
    };
  });

  function normalizeStatusMessage(input: string): string {
    const compact = input.replace(/\s+/g, " ").trim();
    const MAX_LEN = 220;
    if (compact.length <= MAX_LEN) return compact;
    return `${compact.slice(0, MAX_LEN - 1)}...`;
  }

  function normalizeStatusText(input: string): string {
    const compact = input.replace(/\s+/g, " ").trim();
    const MAX_LEN = 120;
    if (compact.length <= MAX_LEN) return compact;
    return `${compact.slice(0, MAX_LEN - 1)}...`;
  }

  function formatRequirementInstallMessage(
    id: RequirementId,
    input: string,
  ): string {
    const displayName = requirementDisplayNames[id];
    return input.replace(/\bopencode\b/gi, displayName);
  }

  function getVersionText(status: RequirementStatus | undefined): string {
    if (!status) return "Checking...";
    return status.version ?? "Not found";
  }

  function getDetailsText(
    status: RequirementStatus | undefined,
  ): string | null {
    if (!status || status.installed) return null;
    if (!status.details) return null;
    return normalizeStatusText(status.details);
  }

  function getRequirementMetaLines(
    id: RequirementId,
    status: RequirementStatus | undefined,
  ): string[] {
    if (!status) return [];

    const lines: string[] = [];
    if (status.source) {
      lines.push(
        `Source: ${
          status.source === "managed" ? "Managed runtime" : "System override"
        }`,
      );
    }
    if (status.managedVersion) {
      lines.push(`Managed version: ${status.managedVersion}`);
    }
    if (status.binaryPath) {
      lines.push(`Binary: ${status.binaryPath}`);
    }
    if (status.provisionDiagnostics) {
      lines.push(
        `Diagnostics: ${normalizeStatusText(status.provisionDiagnostics)}`,
      );
    }
    if (id !== "opencode") return lines;

    lines.push(
      `Isolation: ${
        status.isolated === true
          ? "Enabled"
          : status.isolated === false
            ? "Unavailable"
            : "Unknown"
      }`,
    );
    if (status.runtimeConfigRoot) {
      lines.push(`Config root: ${status.runtimeConfigRoot}`);
    }
    if (status.runtimeDataRoot) {
      lines.push(`Data root: ${status.runtimeDataRoot}`);
    }
    if (status.runtimeStateRoot) {
      lines.push(`State root: ${status.runtimeStateRoot}`);
    }
    return lines;
  }

  async function loadRequirements(
    options: { refresh?: boolean } = {},
  ): Promise<void> {
    const refresh = options.refresh === true;

    if (refresh) {
      if (refreshBusy) return;
      refreshBusy = true;
    } else {
      loading = true;
    }

    errorMessage = null;

    const response = await refreshRequirementsStatus();
    if (!response.ok) {
      errorMessage = normalizeStatusMessage(
        response.error ?? "Failed to load requirements status.",
      );
      if (refresh) {
        refreshBusy = false;
      }
      return;
    }

    const nextRequirements = response.requirements ?? [];
    if (typeof onRequirementsUpdated === "function") {
      onRequirementsUpdated(nextRequirements);
    }
    if (refresh) {
      statusMessage = normalizeStatusMessage("Requirements status refreshed.");
    }

    if (refresh) {
      refreshBusy = false;
    }
  }

  async function installRequirement(id: RequirementId): Promise<boolean> {
    const response = await window.electronAPI.installRequirement({ id });
    if (!response.ok || !response.result) {
      errorMessage = normalizeStatusMessage(
        response.error ?? `Failed to install ${id}.`,
      );
      return false;
    }

    const result = response.result;
    if (result.ok) {
      statusMessage = normalizeStatusMessage(
        formatRequirementInstallMessage(id, result.message),
      );
      return true;
    }

    errorMessage = normalizeStatusMessage(
      formatRequirementInstallMessage(id, result.message),
    );
    manualCommands = [...manualCommands, ...(result.manualCommands ?? [])];
    return false;
  }

  async function install(id: RequirementId): Promise<void> {
    if (installingIds[id]) return;

    const currentStatus = requirementMap[id];
    if (currentStatus?.installed) return;

    installingIds = {
      ...installingIds,
      [id]: true,
    };
    errorMessage = null;
    statusMessage = null;
    manualCommands = [];

    try {
      await installRequirement(id);
      await loadRequirements();
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error ? error.message : `Failed to install ${id}.`,
      );
    } finally {
      const next = { ...installingIds };
      delete next[id];
      installingIds = next;
    }
  }

  async function installAll(): Promise<void> {
    if (installAllBusy || loading || missingRequirementIds.length === 0) return;

    installAllBusy = true;
    errorMessage = null;
    statusMessage = null;
    manualCommands = [];
    installingIds = Object.fromEntries(
      missingRequirementIds.map((id) => [id, true]),
    ) as Partial<Record<RequirementId, true>>;

    let installedCount = 0;
    try {
      for (const id of missingRequirementIds) {
        const installed = await installRequirement(id);
        if (installed) installedCount += 1;
      }

      await loadRequirements();
      if (!errorMessage) {
        statusMessage = normalizeStatusMessage(
          installedCount === 0
            ? "No requirements were installed."
            : `Installed ${installedCount} requirement${installedCount === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to install requirements.",
      );
    } finally {
      installAllBusy = false;
      installingIds = {};
    }
  }
</script>

<div class="flex min-w-0 flex-col gap-4">
  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <div class="mb-2 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-dark-fg">Requirements</h3>
        <p class="text-xs text-dark-fg4">
          Manage external dependencies required by Exort desktop features.
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <button
          class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-2.5 py-0 text-xs"
          onclick={() => void loadRequirements({ refresh: true })}
          disabled={refreshBusy || loading || installAllBusy}
          aria-label="Refresh requirements status"
        >
          {#if refreshBusy}
            <Loader class="h-3.5 w-3.5 animate-spin" />
          {:else}
            <RefreshCw class="h-3.5 w-3.5" />
          {/if}
          <span>{refreshBusy ? "Refreshing" : "Refresh"}</span>
        </button>
        <button
          class="btn-primary inline-flex h-8 items-center justify-center gap-2 px-2.5 py-0 text-xs"
          onclick={() => void installAll()}
          disabled={installAllBusy ||
            loading ||
            missingRequirementIds.length === 0}
          aria-label="Install all missing requirements"
        >
          {#if installAllBusy}
            <Loader class="h-3.5 w-3.5 animate-spin" />
            <span>Installing</span>
          {:else}
            <Download class="h-3.5 w-3.5" />
            <span>Install All</span>
          {/if}
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-[11px] text-dark-fg3">
      <span class="rounded border border-dark-border bg-dark-surface px-2 py-1">
        Tracked: {requirementOrder.length}
      </span>
      {#if loading}
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

  {#if manualCommands.length > 0}
    <div
      class="rounded-md border border-dark-yellow/40 bg-dark-yellow/10 px-3 py-2 text-xs text-dark-yellow2"
    >
      <p class="font-medium">Manual install commands:</p>
      <ul class="mt-1 space-y-1">
        {#each manualCommands as command (command)}
          <li class="font-mono text-[11px] text-dark-fg2">{command}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="grid content-start grid-cols-1 gap-2">
    {#each requirementOrder as id (id)}
      {@const status = requirementMap[id]}
      {@const checking = !status && loading}
      {@const installing = !!installingIds[id]}
      {@const installed = status?.installed === true}
      {@const metaLines = getRequirementMetaLines(id, status)}
      <section class="card flex flex-col gap-2 px-3 py-2.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-dark-fg">
              {requirementDisplayNames[id]}
            </p>
            <p class="mt-1 text-xs text-dark-fg4">
              {requirementDescriptions[id]}
            </p>
          </div>

          <span
            class={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium ${
              checking
                ? "border-dark-blue/40 bg-dark-blue/15 text-dark-blue2"
                : installed
                  ? "border-dark-green/40 bg-dark-green/15 text-dark-green2"
                  : "border-dark-red/40 bg-dark-red/15 text-dark-red2"
            }`}
          >
            {#if checking}
              <Loader class="h-3.5 w-3.5 animate-spin" />
              <span>Checking...</span>
            {:else if installed}
              <CheckCircle2 class="h-3.5 w-3.5" />
              <span>Installed</span>
            {:else}
              <XCircle class="h-3.5 w-3.5" />
              <span>Not installed</span>
            {/if}
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="inline-flex items-center gap-2 text-xs text-dark-fg3">
            <Wrench class="h-3.5 w-3.5" />
            <span>Version: {getVersionText(status)}</span>
          </div>

          {#if !installed || installing}
            <button
              class="inline-flex h-8 items-center gap-1 rounded-md border border-dark-border bg-dark-bg px-2.5 text-xs text-dark-fg2 transition-colors hover:bg-dark-bgH hover:text-dark-fg disabled:cursor-not-allowed disabled:opacity-60"
              onclick={() => void install(id)}
              disabled={installing || installAllBusy || loading || checking}
              aria-label={`Install ${id}`}
            >
              {#if installing}
                <Loader class="h-3.5 w-3.5 animate-spin" />
                <span>Installing</span>
              {:else}
                <Download class="h-3.5 w-3.5" />
                <span>Install</span>
              {/if}
            </button>
          {/if}
        </div>

        {#if getDetailsText(status)}
          <p
            class="rounded border border-dark-border bg-dark-bg px-2 py-1 text-[11px] text-dark-fg3"
          >
            {getDetailsText(status)}
          </p>
        {/if}

        {#if metaLines.length > 0}
          <div
            class="rounded border border-dark-border bg-dark-bg px-2 py-1 text-[11px] text-dark-fg3"
          >
            {#each metaLines as line (line)}
              <p class="break-all">{line}</p>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>
