<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
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

  let {
    onRequirementsUpdated = () => {},
    autoInstallOnMount = false,
    onAutoInstallTriggered = () => {},
  } = $props<{
    onRequirementsUpdated?: (requirements: RequirementStatus[]) => void;
    autoInstallOnMount?: boolean;
    onAutoInstallTriggered?: () => void;
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
  let expandedInfoIds = $state<Partial<Record<RequirementId, true>>>({});
  let installProgress = $state<Partial<Record<RequirementId, number>>>({});
  let errorMessage = $state<string | null>(null);
  let manualCommands = $state<string[]>([]);
  const progressTimers = new Map<RequirementId, number>();
  let autoInstallTriggered = $state(false);

  let requirements = $derived(requirementsState.requirements);
  let loading = $derived(requirementsState.loading);
  let checkedAt = $derived(requirementsState.checkedAt);
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

  onDestroy(() => {
    for (const timer of progressTimers.values()) {
      window.clearInterval(timer);
    }
    progressTimers.clear();
  });

  $effect(() => {
    if (autoInstallTriggered) return;
    if (!autoInstallOnMount) return;
    if (!checkedAt || loading || installAllBusy) return;
    if (requirements.length === 0) return;
    if (missingRequirementIds.length === 0) return;

    autoInstallTriggered = true;
    onAutoInstallTriggered();
    void installAll();
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
    if (status.releaseTargetKey) {
      lines.push(`Release target: ${status.releaseTargetKey}`);
    }
    if (status.releaseArchiveName) {
      lines.push(`Release archive: ${status.releaseArchiveName}`);
    }
    if (status.releaseArchiveSha256) {
      lines.push(`Release SHA-256: ${status.releaseArchiveSha256}`);
    }
    return lines;
  }

  function toggleInfo(id: RequirementId): void {
    expandedInfoIds = {
      ...expandedInfoIds,
      [id]: expandedInfoIds[id] ? undefined : true,
    };
  }

  function setInstalling(id: RequirementId, installing: boolean): void {
    if (installing) {
      installingIds = {
        ...installingIds,
        [id]: true,
      };
      return;
    }

    const next = { ...installingIds };
    delete next[id];
    installingIds = next;
  }

  function setProgress(id: RequirementId, value: number): void {
    installProgress = {
      ...installProgress,
      [id]: Math.max(0, Math.min(100, Math.round(value))),
    };
  }

  function clearProgress(id: RequirementId): void {
    const next = { ...installProgress };
    delete next[id];
    installProgress = next;
  }

  function stopProgressTimer(id: RequirementId): void {
    const timer = progressTimers.get(id);
    if (!timer) return;
    window.clearInterval(timer);
    progressTimers.delete(id);
  }

  function startProgress(id: RequirementId): void {
    stopProgressTimer(id);
    setProgress(id, 8);

    const timer = window.setInterval(() => {
      const current = installProgress[id] ?? 8;
      if (current >= 92) return;
      setProgress(id, current + Math.max(1, (92 - current) * 0.12));
    }, 300);
    progressTimers.set(id, timer);
  }

  function finishProgress(id: RequirementId): void {
    stopProgressTimer(id);
    setProgress(id, 100);
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function loadRequirements(
    options: { refresh?: boolean } = {},
  ): Promise<void> {
    const refresh = options.refresh === true;

    if (refresh) {
      if (refreshBusy) return;
      refreshBusy = true;
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

    setInstalling(id, true);
    startProgress(id);
    errorMessage = null;
    manualCommands = [];

    try {
      const installed = await installRequirement(id);
      if (installed) finishProgress(id);
      await loadRequirements();
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error ? error.message : `Failed to install ${id}.`,
      );
    } finally {
      stopProgressTimer(id);
      setInstalling(id, false);
      clearProgress(id);
    }
  }

  async function installAll(): Promise<void> {
    if (installAllBusy || loading || missingRequirementIds.length === 0) return;

    installAllBusy = true;
    errorMessage = null;
    manualCommands = [];

    try {
      for (const id of missingRequirementIds) {
        setInstalling(id, true);
        startProgress(id);
        const installed = await installRequirement(id);
        if (installed) {
          finishProgress(id);
          await sleep(250);
        }
        await loadRequirements();
        stopProgressTimer(id);
        setInstalling(id, false);
        clearProgress(id);
      }
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to install requirements.",
      );
    } finally {
      installAllBusy = false;
      for (const id of requirementOrder) {
        stopProgressTimer(id);
      }
      installingIds = {};
      installProgress = {};
    }
  }
</script>

<div class="flex min-w-0 flex-col gap-4">
  {#if autoInstallTriggered && installAllBusy}
    <p class="text-sm text-dark-fg3">
      Please wait while requirements are installed.
    </p>
  {/if}

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

  </div>

  {#if errorMessage}
    <div
      class="rounded-md border border-dark-red/40 bg-dark-red/15 px-3 py-2 text-sm text-dark-red2"
    >
      {errorMessage}
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
      {@const expanded = !!expandedInfoIds[id]}
      {@const progress = installProgress[id] ?? 0}
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

        {#if installing}
          <div class="rounded">
            <div
              class="flex items-center justify-between gap-3 text-[11px] text-dark-fg3"
            >
              <span>Downloading and installing...</span>
              <span>{progress}%</span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-dark-bg2">
              <div
                class="h-full rounded-full bg-primary-600 transition-[width] duration-300"
                style={`width: ${progress}%`}
              ></div>
            </div>
          </div>
        {/if}

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

        {#if metaLines.length > 0}
          <button
            class="inline-flex w-fit items-center gap-1 rounded-md text-xs
             text-dark-fg3 hover:text-dark-fg"
            onclick={() => toggleInfo(id)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} ${requirementDisplayNames[id]} information`}
          >
            {#if expanded}
              <ChevronDown class="h-3.5 w-3.5" />
            {:else}
              <ChevronRight class="h-3.5 w-3.5" />
            {/if}
            <span>Info</span>
          </button>

          {#if expanded}
            <div
              class="rounded border border-dark-border bg-dark-bg px-2 py-1 text-[11px] text-dark-fg3"
            >
              {#each metaLines as line (line)}
                <p class="break-all">{line}</p>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    {/each}
  </div>
</div>
