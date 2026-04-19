<script lang="ts">
  import { onMount } from "svelte";
  import { appStateStore, patchAppState } from "../../lib/state/stateManager";
  import type {
    ChatFontSizePreset,
    MonacoThemeId,
  } from "../../lib/state/types";
  import {
    SERIAL_BUFFER_SIZE_DEFAULT,
    SERIAL_BUFFER_SIZE_MAX,
    SERIAL_BUFFER_SIZE_MIN,
    sanitizeSerialBufferSize,
  } from "../../lib/serial/bufferSettings";
  import {
    CheckCircle2,
    Download,
    Loader,
    RefreshCw,
    Wrench,
    XCircle,
  } from "lucide-svelte";

  const requirementOrder: RequirementId[] = ["opencode", "arduino-cli"];
  const requirementDisplayNames: Record<RequirementId, string> = {
    opencode: "OpenCode",
    "arduino-cli": "Arduino CLI",
  };
  const requirementDescriptions: Record<RequirementId, string> = {
    opencode:
      "Managed by Exort as a private runtime. This does not rely on global OpenCode in terminal PATH.",
    "arduino-cli": "",
  };
  const monacoThemeOptions: Array<{ value: MonacoThemeId; label: string }> = [
    { value: "vs-dark", label: "VS Dark" },
    { value: "arduino-dark", label: "Arduino Dark" },
    { value: "gruvbox-dark", label: "Gruvbox Dark" },
    { value: "hc-black", label: "High Contrast Dark" },
  ];
  const chatFontSizeOptions: Array<{
    value: ChatFontSizePreset;
    label: string;
  }> = [
    { value: "small", label: "Small" },
    { value: "default", label: "Default" },
    { value: "large", label: "Large" },
  ];

  let requirements = $state<RequirementStatus[]>([]);
  let loading = $state(false);
  let refreshBusy = $state(false);
  let installingIds = $state<Partial<Record<RequirementId, true>>>({});
  let errorMessage = $state<string | null>(null);
  let statusMessage = $state<string | null>(null);
  let manualCommands = $state<string[]>([]);
  let monacoTheme = $state<MonacoThemeId>("vs-dark");
  let chatFontSize = $state<ChatFontSizePreset>("default");
  let serialBufferSize = $state<number>(SERIAL_BUFFER_SIZE_DEFAULT);
  let serialBufferInput = $state<string>(String(SERIAL_BUFFER_SIZE_DEFAULT));

  let requirementMap = $derived.by(() => {
    const map: Partial<Record<RequirementId, RequirementStatus>> = {};
    for (const requirement of requirements) {
      map[requirement.id] = requirement;
    }
    return map;
  });

  onMount(() => {
    const unsubscribe = appStateStore.subscribe((state) => {
      monacoTheme = state.appearance.monacoTheme;
      chatFontSize = state.appearance.chatFontSize ?? "default";
      serialBufferSize = sanitizeSerialBufferSize(state.serial.bufferSize);
      serialBufferInput = String(serialBufferSize);
    });
    void loadRequirements();

    return () => {
      unsubscribe();
    };
  });

  function isMonacoThemeId(value: string): value is MonacoThemeId {
    return (
      value === "vs-dark" ||
      value === "arduino-dark" ||
      value === "gruvbox-dark" ||
      value === "vs" ||
      value === "hc-black" ||
      value === "hc-light"
    );
  }

  function onMonacoThemeChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;

    const nextTheme = target.value;
    if (!isMonacoThemeId(nextTheme)) return;
    monacoTheme = nextTheme;

    patchAppState({
      appearance: {
        monacoTheme: nextTheme,
      },
    });
  }

  function isChatFontSizePreset(value: string): value is ChatFontSizePreset {
    return value === "small" || value === "default" || value === "large";
  }

  function onChatFontSizeChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;

    const nextValue = isChatFontSizePreset(target.value)
      ? target.value
      : "default";
    chatFontSize = nextValue;

    patchAppState({
      appearance: {
        chatFontSize: nextValue,
      },
    });
  }

  function onSerialBufferInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;
    serialBufferInput = target.value;
  }

  function commitSerialBuffer(): void {
    const parsed = Number(serialBufferInput);
    const nextValue = sanitizeSerialBufferSize(
      Number.isFinite(parsed) ? parsed : serialBufferSize,
    );

    serialBufferSize = nextValue;
    serialBufferInput = String(nextValue);
    patchAppState({
      serial: {
        bufferSize: nextValue,
      },
    });
  }

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
    if (!status || id !== "opencode") return [];

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

    try {
      const response = await window.electronAPI.getRequirementsStatus();
      if (!response.ok) {
        errorMessage = normalizeStatusMessage(
          response.error ?? "Failed to load requirements status.",
        );
        return;
      }

      requirements = response.requirements ?? [];
      if (refresh) {
        statusMessage = normalizeStatusMessage(
          "Requirements status refreshed.",
        );
      }
    } catch (error) {
      errorMessage = normalizeStatusMessage(
        error instanceof Error
          ? error.message
          : "Failed to load requirements status.",
      );
    } finally {
      if (refresh) {
        refreshBusy = false;
      } else {
        loading = false;
      }
    }
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
      const response = await window.electronAPI.installRequirement({ id });
      if (!response.ok || !response.result) {
        errorMessage = normalizeStatusMessage(
          response.error ?? `Failed to install ${id}.`,
        );
        return;
      }

      const result = response.result;
      if (result.ok) {
        statusMessage = normalizeStatusMessage(
          formatRequirementInstallMessage(id, result.message),
        );
      } else {
        errorMessage = normalizeStatusMessage(
          formatRequirementInstallMessage(id, result.message),
        );
        manualCommands = result.manualCommands ?? [];
      }

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
</script>

<div class="flex min-w-0 flex-col gap-4">
  <div class="flex items-center gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-dark-fg3">
      Appearance
    </h2>
    <div class="h-px flex-1 bg-dark-border"></div>
  </div>

  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <h3 class="text-sm font-semibold text-dark-fg">Theme</h3>
    <p class="mt-1 text-xs text-dark-fg4">
      Choose the color theme for the Monaco code editor.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <label class="text-xs text-dark-fg3" for="monaco-theme-select">
        Editor theme
      </label>
      <select
        id="monaco-theme-select"
        class="input-field h-8 rounded-md py-1 text-sm"
        value={monacoTheme}
        onchange={onMonacoThemeChange}
        aria-label="Editor theme"
      >
        {#each monacoThemeOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <label class="text-xs text-dark-fg3" for="chat-font-size-select">
        Chat font size
      </label>
      <select
        id="chat-font-size-select"
        class="input-field h-8 rounded-md py-1 text-sm"
        value={chatFontSize}
        onchange={onChatFontSizeChange}
        aria-label="Chat font size"
      >
        {#each chatFontSizeOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      <span class="text-[11px] text-dark-fg4">
        Applies to the whole chat panel.
      </span>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-dark-fg3">
      Serial Settings
    </h2>
    <div class="h-px flex-1 bg-dark-border"></div>
  </div>

  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <h3 class="text-sm font-semibold text-dark-fg">Serial Buffer</h3>
    <p class="mt-1 text-xs text-dark-fg4">
      Global maximum entries/samples retained for Serial Monitor and Plotter.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <label class="text-xs text-dark-fg3" for="serial-buffer-size">
        Buffer size
      </label>
      <input
        id="serial-buffer-size"
        class="input-field h-8 w-28 rounded-md py-1 text-xs"
        type="number"
        min={SERIAL_BUFFER_SIZE_MIN}
        max={SERIAL_BUFFER_SIZE_MAX}
        step="1"
        value={serialBufferInput}
        oninput={onSerialBufferInput}
        onchange={commitSerialBuffer}
        onblur={commitSerialBuffer}
        aria-label="Serial buffer size"
      />
      <span class="text-[11px] text-dark-fg4">
        Range {SERIAL_BUFFER_SIZE_MIN}-{SERIAL_BUFFER_SIZE_MAX}, default {SERIAL_BUFFER_SIZE_DEFAULT}
      </span>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide text-dark-fg3">
      Requirements
    </h2>
    <div class="h-px flex-1 bg-dark-border"></div>
  </div>

  <div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-3">
    <div class="mb-2 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-dark-fg">Requirements</h3>
        <p class="text-xs text-dark-fg4">
          Manage external dependencies required by ExortAi desktop features.
        </p>
      </div>
      <button
        class="btn-secondary inline-flex h-8 items-center justify-center gap-2 px-2.5 py-0 text-xs"
        onclick={() => void loadRequirements({ refresh: true })}
        disabled={refreshBusy || loading}
        aria-label="Refresh requirements status"
      >
        {#if refreshBusy}
          <Loader class="h-3.5 w-3.5 animate-spin" />
        {:else}
          <RefreshCw class="h-3.5 w-3.5" />
        {/if}
        <span>{refreshBusy ? "Refreshing" : "Refresh"}</span>
      </button>
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
              disabled={installing || loading || checking}
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
