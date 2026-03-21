<script lang="ts">
  import { Download, ChartLine, ClockFading, Plug, Send, Trash2, Tv } from "lucide-svelte";
  import { onMount } from "svelte";
  import SerialPlotterView from "../SerialPlotterView.svelte";
  import {
    appStateStore,
    upsertWorkspaceState,
    workspaceManagerStore,
  } from "../../lib/state/stateManager";
  import {
    SERIAL_BAUD_RATE_DEFAULT,
    createDefaultWorkspaceManagerState,
  } from "../../lib/state/defaults";
  import {
    SERIAL_BUFFER_SIZE_DEFAULT,
    sanitizeSerialBufferSize,
    trimEntriesToLimit,
  } from "../../lib/serial/bufferSettings";
  import { createSerialPlotAccumulator } from "../../lib/serial/plotParser";
  import type {
    SerialLogDirection,
    SerialLogEntry,
    SerialMonitorEvent,
    SerialMonitorSnapshot,
    SerialMonitorStatus,
    SerialPlotState,
    WorkspaceManagerState,
  } from "../../lib/types";

  const BAUD_OPTIONS = [
    300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400,
    250000, 500000, 1000000, 2000000,
  ];

  let { selectedPort = "", activeWorkspaceRoot = null } = $props<{
    selectedPort: string;
    activeWorkspaceRoot: string | null;
  }>();

  let serialBufferSize = $state(SERIAL_BUFFER_SIZE_DEFAULT);
  let plotAccumulator = createSerialPlotAccumulator(SERIAL_BUFFER_SIZE_DEFAULT);
  let showTimestamps = $state(true);
  let workspaceManagerSnapshot = $state<WorkspaceManagerState>(
    createDefaultWorkspaceManagerState(),
  );

  let entries = $state<SerialLogEntry[]>([]);
  let status = $state<SerialMonitorStatus>("disconnected");
  let baudRate = $state(SERIAL_BAUD_RATE_DEFAULT);
  let sendText = $state("");
  let activeMonitorView = $state<"monitor" | "plotter">("monitor");
  let plotState = $state<SerialPlotState>(plotAccumulator.getState());

  let busyConnect = $state(false);
  let busyDisconnect = $state(false);
  let busySend = $state(false);
  let busyExport = $state(false);

  let infoMessage = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);

  let outputContainerEl = $state<HTMLDivElement | null>(null);
  let stickToBottom = true;
  let portWatcherReady = false;
  let previousSelectedPort = "";

  let normalizedSelectedPort = $derived(selectedPort.trim());
  let isConnected = $derived(status !== "disconnected");
  let isBusy = $derived(
    busyConnect || busyDisconnect || busySend || busyExport,
  );
  let canConnect = $derived(
    status === "disconnected" && !!normalizedSelectedPort && !busyConnect,
  );
  let canDisconnect = $derived(status !== "disconnected" && !busyDisconnect);
  let canSend = $derived(
    status !== "disconnected" && sendText.length > 0 && !busySend,
  );
  let hasEntries = $derived(entries.length > 0);
  let workspaceName = $derived.by(() => {
    if (!activeWorkspaceRoot) return "workspace";
    const parts = activeWorkspaceRoot.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? "workspace";
  });
  let statusLabel = $derived.by(() => {
    if (status === "streaming") return "streaming";
    if (status === "connected") return "connected";
    return "disconnected";
  });
  let statusDotClass = $derived.by(() => {
    if (status === "streaming") return "bg-dark-aqua";
    if (status === "connected") return "bg-dark-green";
    return "bg-dark-red";
  });
  let statusBadgeClass = $derived.by(() => {
    if (status === "streaming") return " text-dark-aqua ";
    if (status === "connected") return " text-dark-green ";
    return "text-dark-red ";
  });
  let connectButtonLabel = $derived.by(() => {
    if (busyConnect) return "Connecting...";
    if (busyDisconnect) return "Disconnecting...";
    return isConnected ? "Disconnect" : "Connect";
  });

  $effect(() => {
    if (!activeWorkspaceRoot) {
      showTimestamps = true;
      return;
    }

    const workspaceState = workspaceManagerSnapshot.byRoot[activeWorkspaceRoot];
    showTimestamps = workspaceState?.serialMonitorShowTimestamps ?? true;
  });

  $effect(() => {
    if (!activeWorkspaceRoot) {
      baudRate = SERIAL_BAUD_RATE_DEFAULT;
      return;
    }

    if (status !== "disconnected") return;

    const workspaceState = workspaceManagerSnapshot.byRoot[activeWorkspaceRoot];
    baudRate = workspaceState?.serialBaudRate ?? SERIAL_BAUD_RATE_DEFAULT;
  });

  function rebuildPlotStateFromEntries(serialEntries: SerialLogEntry[]): void {
    plotAccumulator.reset();
    for (const entry of serialEntries) {
      plotAccumulator.ingestEntry(entry);
    }
    plotState = plotAccumulator.getState();
  }

  function recreatePlotAccumulator(): void {
    plotAccumulator = createSerialPlotAccumulator(serialBufferSize);
    rebuildPlotStateFromEntries(entries);
  }

  function applySnapshot(snapshot: SerialMonitorSnapshot): void {
    entries = trimEntriesToLimit(snapshot.entries ?? [], serialBufferSize);
    status = snapshot.status ?? "disconnected";
    if (
      typeof snapshot.baudRate === "number" &&
      Number.isFinite(snapshot.baudRate)
    ) {
      baudRate = snapshot.baudRate;
    }
    rebuildPlotStateFromEntries(entries);
  }

  function directionLabel(direction: SerialLogDirection): string {
    if (direction === "rx") return "RX";
    if (direction === "tx") return "TX";
    return "SYSTEM";
  }

  function directionClass(direction: SerialLogDirection): string {
    if (direction === "rx") return "text-dark-blue2";
    if (direction === "tx") return "text-dark-green2";
    return "text-dark-yellow2";
  }

  function formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString();
  }

  function onLogScroll(): void {
    if (!outputContainerEl) return;
    const distanceFromBottom =
      outputContainerEl.scrollHeight -
      outputContainerEl.scrollTop -
      outputContainerEl.clientHeight;
    stickToBottom = distanceFromBottom < 24;
  }

  function handleSerialEvent(event: SerialMonitorEvent): void {
    if (event.type === "status") {
      status = event.status;
      return;
    }

    if (event.type === "entry") {
      entries = trimEntriesToLimit([...entries, event.entry], serialBufferSize);
      plotAccumulator.ingestEntry(event.entry);
      plotState = plotAccumulator.getState();
      return;
    }

    if (event.type === "cleared") {
      entries = [];
      plotAccumulator.reset();
      plotState = plotAccumulator.getState();
      return;
    }

    errorMessage = event.message;
  }

  async function loadSnapshot(): Promise<void> {
    try {
      const response = await window.electronAPI.serialGetSnapshot();
      if (!response.ok || !response.snapshot) {
        if (!response.ok) {
          errorMessage =
            response.error ?? "Failed to load serial monitor state.";
        }
        return;
      }
      applySnapshot(response.snapshot);
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load serial monitor state.";
    }
  }

  async function connectSerial(): Promise<void> {
    if (!normalizedSelectedPort) {
      errorMessage = "Select a serial port in the navbar before connecting.";
      return;
    }

    busyConnect = true;
    errorMessage = null;
    infoMessage = null;

    try {
      const response = await window.electronAPI.serialConnect({
        port: normalizedSelectedPort,
        baudRate,
      });
      if (!response.ok) {
        errorMessage = response.error ?? "Failed to connect to serial port.";
        return;
      }

      infoMessage = `Connected to ${normalizedSelectedPort} at ${baudRate} baud.`;
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to connect to serial port.";
    } finally {
      busyConnect = false;
    }
  }

  async function disconnectSerial(reason?: string): Promise<void> {
    busyDisconnect = true;
    errorMessage = null;

    try {
      const response = await window.electronAPI.serialDisconnect(
        reason ? { reason } : undefined,
      );
      if (!response.ok) {
        errorMessage = response.error ?? "Failed to disconnect serial monitor.";
        return;
      }
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to disconnect serial monitor.";
    } finally {
      busyDisconnect = false;
    }
  }

  async function toggleConnection(): Promise<void> {
    if (isConnected) {
      await disconnectSerial("Disconnected from serial monitor.");
      return;
    }
    await connectSerial();
  }

  async function clearLog(): Promise<void> {
    errorMessage = null;
    infoMessage = null;

    try {
      const response = await window.electronAPI.serialClear();
      if (!response.ok) {
        errorMessage = "Failed to clear serial monitor output.";
      }
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to clear serial monitor output.";
    }
  }

  function toggleTimestamps(): void {
    const next = !showTimestamps;
    showTimestamps = next;

    if (!activeWorkspaceRoot) return;
    upsertWorkspaceState(activeWorkspaceRoot, {
      serialMonitorShowTimestamps: next,
    });
  }

  async function exportCsv(): Promise<void> {
    busyExport = true;
    errorMessage = null;
    infoMessage = null;

    try {
      const response = await window.electronAPI.serialExportCsv();
      if (!response.ok) {
        errorMessage = response.error ?? "Failed to export serial monitor CSV.";
        return;
      }

      infoMessage = response.path
        ? `Exported CSV for ${workspaceName}.`
        : "CSV export cancelled.";
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to export serial monitor CSV.";
    } finally {
      busyExport = false;
    }
  }

  async function sendToSerial(): Promise<void> {
    if (!canSend) return;

    busySend = true;
    errorMessage = null;

    try {
      const response = await window.electronAPI.serialSend({
        text: sendText,
        appendNewline: true,
      });
      if (!response.ok) {
        errorMessage = response.error ?? "Failed to send serial data.";
        return;
      }

      sendText = "";
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to send serial data.";
    } finally {
      busySend = false;
    }
  }

  function handleSendKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void sendToSerial();
  }

  function onBaudRateChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;
    const nextBaudRate = Number(target.value);
    if (!Number.isFinite(nextBaudRate) || nextBaudRate <= 0) return;
    baudRate = nextBaudRate;
    if (!activeWorkspaceRoot) return;
    upsertWorkspaceState(activeWorkspaceRoot, {
      serialBaudRate: nextBaudRate,
    });
  }

  async function maybeAutoDisconnectOnPortChange(
    previousPort: string,
    nextPort: string,
  ): Promise<void> {
    const previousLabel = previousPort || "none";
    const nextLabel = nextPort || "none";
    const reason = `Serial monitor auto-disconnected because navbar port changed (${previousLabel} -> ${nextLabel}).`;

    await disconnectSerial(reason);
  }

  $effect(() => {
    if (
      activeMonitorView !== "monitor" ||
      !outputContainerEl ||
      !stickToBottom ||
      entries.length === 0
    )
      return;

    queueMicrotask(() => {
      if (!outputContainerEl || !stickToBottom) return;
      outputContainerEl.scrollTop = outputContainerEl.scrollHeight;
    });
  });

  $effect(() => {
    if (!portWatcherReady) {
      previousSelectedPort = normalizedSelectedPort;
      portWatcherReady = true;
      return;
    }

    if (normalizedSelectedPort === previousSelectedPort) return;

    const oldPort = previousSelectedPort;
    const nextPort = normalizedSelectedPort;
    previousSelectedPort = nextPort;

    if (!isConnected || busyDisconnect) return;
    void maybeAutoDisconnectOnPortChange(oldPort, nextPort);
  });

  onMount(() => {
    const unsubscribeAppState = appStateStore.subscribe((state) => {
      const nextBufferSize = sanitizeSerialBufferSize(state.serial.bufferSize);
      if (nextBufferSize === serialBufferSize) return;

      serialBufferSize = nextBufferSize;
      entries = trimEntriesToLimit(entries, serialBufferSize);
      recreatePlotAccumulator();
    });
    const unsubscribeWorkspaceState = workspaceManagerStore.subscribe((state) => {
      workspaceManagerSnapshot = state;
    });

    void loadSnapshot();
    window.electronAPI.onSerialMonitorEvent(handleSerialEvent);

    return () => {
      unsubscribeAppState();
      unsubscribeWorkspaceState();
      window.electronAPI.offSerialMonitorEvent(handleSerialEvent);
    };
  });
</script>

<div class="flex h-full min-h-0 flex-col bg-dark-bg">
  <div
    class="flex flex-wrap items-center gap-2 border-b border-dark-border bg-dark-surface px-3 py-2"
  >
    <div
      class="inline-flex items-center gap-1 rounded-md border border-dark-fg4 bg-dark-bgS p-0.5"
    >
      <button
        class={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${activeMonitorView === "monitor" ? "bg-dark-blue text-dark-fg" : "text-dark-fg3 hover:text-dark-fg1"}`}
        onclick={() => (activeMonitorView = "monitor")}
      >
        <Tv class="h-4 w-4" />
        <span>Monitor</span>
      </button>
      <button
        class={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${activeMonitorView === "plotter" ? "bg-dark-blue text-dark-fg" : "text-dark-fg3 hover:text-dark-fg1"}`}
        onclick={() => (activeMonitorView = "plotter")}
      >
        <ChartLine class="h-4 w-4" />
        <span>Plotter</span>
      </button>
    </div>

    <!-- Status -->
    <!-- <span
      class={`inline-flex items-center gap-1 rounded  ml-2 px-2 py-1 text-[11px] uppercase tracking-wide ${statusBadgeClass}`}
    >
      <span class={`h-1.5 w-1.5 rounded-full ${statusDotClass}`}></span>
      {statusLabel}
    </span> -->

    <div class="ml-auto flex min-w-0 items-center gap-2">
      <div class="flex items-center gap-2">
        <!-- <span class="text-xs text-dark-fg3">Baud</span> -->
        <select
          class="input-field h-8 rounded-md py-1 text-sm"
          value={baudRate}
          onchange={onBaudRateChange}
          disabled={isConnected || isBusy}
          aria-label="Select serial baud rate"
        >
          {#each BAUD_OPTIONS as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>

      <button
        class={`border inline-flex h-8 items-center gap-1.5 rounded-md px-3 py-1 text-xs text-dark-fg3
       ${isConnected ? "border-dark-red/70 text-dark-red/70 hover:bg-dark-red/10" : "border-primary-500 text-primary-300 hover:bg-dark-aqua/10"}`}
        onclick={() => void toggleConnection()}
        disabled={isConnected ? !canDisconnect : !canConnect}
        title={isConnected
          ? "Disconnect serial monitor"
          : "Connect serial monitor"}
      >
        <Plug class="h-4 w-4" />
        <span>{connectButtonLabel}</span>
      </button>

      <button
        class=" inline-flex h-8 items-center gap-1 rounded-md px-1 py-1 text-xs text-dark-fg3 hover:text-dark-fg1"
        onclick={() => void clearLog()}
        disabled={!hasEntries || isBusy}
        title="Clear monitor output"
      >
        <Trash2 class="h-4 w-4" />
      </button>

      <button
        class={`inline-flex h-8 items-center gap-1 rounded-md px-1 py-1 text-xs transition-colors ${
          showTimestamps
            ? "text-dark-aqua2 hover:text-dark-aqua2"
            : "text-dark-fg3 hover:text-dark-fg1"
        }`}
        onclick={toggleTimestamps}
        title={showTimestamps ? "Hide timestamps" : "Show timestamps"}
        aria-pressed={showTimestamps}
        aria-label="Toggle serial monitor timestamps"
      >
        <ClockFading class="h-4 w-4" />
      </button>

      <button
        class=" inline-flex h-8 items-center gap-1 rounded-md px-1 py-1 text-xs text-dark-fg3 hover:text-dark-fg1"
        onclick={() => void exportCsv()}
        disabled={!hasEntries || busyExport}
        title="Export monitor output as CSV"
      >
        <Download class="h-4 w-4" />
        <span>{busyExport ? "Exporting..." : ""}</span>
      </button>
    </div>
  </div>

  <div class="flex min-h-0 flex-1 flex-col">
    {#if activeMonitorView === "monitor"}
      <div
        class="min-h-0 flex-1 overflow-auto bg-dark-bg px-3 py-2 font-mono text-xs"
        bind:this={outputContainerEl}
        onscroll={onLogScroll}
      >
        {#if entries.length === 0}
          <div class="text-dark-fg3">
            {#if status === "disconnected"}
              Connect to a serial port to begin monitoring.
            {:else}
              Waiting for serial data...
            {/if}
          </div>
        {:else}
          {#each entries as entry (entry.id)}
            <div class="mb-1 whitespace-pre">
              {#if showTimestamps}
                <span class="mr-2 text-[10px] text-dark-fg4">
                  {formatTimestamp(entry.timestamp)}
                </span>
              {/if}
              {#if showTimestamps || entry.direction === "system"}
                <span
                  class={`mr-2 text-[10px] uppercase ${directionClass(entry.direction)}`}
                >
                  [{directionLabel(entry.direction)}]
                </span>
              {/if}
              <span class="text-dark-fg1">{entry.text}</span>
            </div>
          {/each}
        {/if}
      </div>
    {:else}
      <div class="min-h-0 flex-1">
        <SerialPlotterView {plotState} />
      </div>
    {/if}
  </div>

  {#if errorMessage || infoMessage}
    <div class="border-t border-dark-border bg-dark-bgS px-3 py-1.5 text-xs">
      {#if errorMessage}
        <div class="text-dark-red">{errorMessage}</div>
      {/if}
      <!-- {#if infoMessage}
        <div class="text-dark-green">{infoMessage}</div>
      {/if} -->
    </div>
  {/if}

  <div class="border-t border-dark-border bg-dark-surface p-2">
    <div class="flex items-center gap-2">
      <input
        class="input-field h-9 flex-1 rounded-md py-1.5 font-mono text-xs"
        placeholder="Send data to serial device..."
        bind:value={sendText}
        onkeydown={handleSendKeydown}
        disabled={status === "disconnected" || busySend}
      />

      <button
        class="btn-primary inline-flex h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
        onclick={() => void sendToSerial()}
        disabled={!canSend}
        title="Send data with newline"
      >
        <Send class="h-3.5 w-3.5" />
        <span>{busySend ? "Sending..." : "Send"}</span>
      </button>
    </div>
  </div>
</div>
