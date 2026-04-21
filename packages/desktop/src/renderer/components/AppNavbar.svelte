<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import {
    ChevronDown,
    Hammer,
    Loader,
    RefreshCw,
    Search,
    Settings2,
    Star,
    Upload,
    X,
  } from "lucide-svelte";
  import type {
    ArduinoBoardDetails,
    ArduinoBoardOption,
    ArduinoCommandOutputEnvelope,
    ArduinoOutputEvent,
    ArduinoOperation,
    ArduinoPortOption,
  } from "../lib/types";

  type ArduinoUploadResult = {
    ok: boolean;
    status: "uploaded" | "upload_failed" | "upload_cancelled";
    message: string;
    exitCode: number | null;
    command: string[];
  };

  let {
    userEmail,
    statusText,
    activeWorkspaceRoot,
    activeFilePath,
    activeFileDirty,
    selectedPort = "",
    selectedBoardFqbn = "",
    boardOptionSelections = {},
    effectiveBoardFqbn = "",
    favoriteBoardFqbns = [],
    onPortChange = () => {},
    onBoardChange = () => {},
    onBoardOptionSelectionsChange = () => {},
    onToggleFavoriteBoard = () => {},
    onOpenBoardsManager = () => {},
    onSaveActiveFile,
    onArduinoOutputEvent = () => {},
    onOverlayOpenChange = () => {},
  } = $props<{
    userEmail: string | null;
    statusText: string;
    activeWorkspaceRoot: string | null;
    activeFilePath: string | null;
    activeFileDirty: boolean;
    selectedPort: string;
    selectedBoardFqbn: string;
    boardOptionSelections: Record<string, string>;
    effectiveBoardFqbn: string;
    favoriteBoardFqbns: string[];
    onPortChange: (port: string) => void;
    onBoardChange: (fqbn: string) => void;
    onBoardOptionSelectionsChange: (selections: Record<string, string>) => void;
    onToggleFavoriteBoard: (fqbn: string) => void;
    onOpenBoardsManager: () => void;
    onSaveActiveFile: () => Promise<void> | void;
    onArduinoOutputEvent: (event: ArduinoOutputEvent) => void;
    onOverlayOpenChange: (open: boolean) => void;
  }>();

  const safeSetPort = (port: string) => {
    if (typeof onPortChange === "function") {
      onPortChange(port);
    }
  };

  const safeSetBoard = (fqbn: string) => {
    if (typeof onBoardChange === "function") {
      onBoardChange(fqbn);
    }
  };

  const safeSetBoardOptionSelections = (selections: Record<string, string>) => {
    if (typeof onBoardOptionSelectionsChange === "function") {
      onBoardOptionSelectionsChange(selections);
    }
  };

  const emitOutputEvent = (event: ArduinoOutputEvent) => {
    if (typeof onArduinoOutputEvent === "function") {
      onArduinoOutputEvent(event);
    }
  };
  const safeToggleFavoriteBoard = (fqbn: string) => {
    if (typeof onToggleFavoriteBoard === "function") {
      onToggleFavoriteBoard(fqbn);
    }
  };
  const safeOpenBoardsManager = () => {
    if (typeof onOpenBoardsManager === "function") {
      onOpenBoardsManager();
    }
  };

  const activeOutputRequestIds = new SvelteSet<string>();

  let ports = $state<ArduinoPortOption[]>([]);
  let boards = $state<ArduinoBoardOption[]>([]);
  let portsBusy = $state(false);
  let boardsBusy = $state(false);
  let compileBusy = $state(false);
  let uploadBusy = $state(false);
  let uploadCancelBusy = $state(false);
  let uploadRequestId = $state<string | null>(null);
  let portsError = $state<string | null>(null);
  let boardsError = $state<string | null>(null);
  let portsDropdownOpen = $state(false);
  let boardsDropdownOpen = $state(false);
  let boardSettingsDropdownOpen = $state(false);
  let boardSearch = $state("");
  let portsDropdownElement: HTMLDivElement | null = null;
  let boardsDropdownElement: HTMLDivElement | null = null;
  let boardSettingsDropdownElement: HTMLDivElement | null = null;
  let boardSettingsBusy = $state(false);
  let boardSettingsError = $state<string | null>(null);
  let boardCurrentDetails = $state<ArduinoBoardDetails | null>(null);
  let boardBaseDetails = $state<ArduinoBoardDetails | null>(null);
  let boardSettingsRequestId = 0;

  let isActiveIno = $derived(
    !!activeFilePath && activeFilePath.toLowerCase().endsWith(".ino"),
  );
  let compileDisabled = $derived(
    !activeWorkspaceRoot ||
      !isActiveIno ||
      !selectedBoardFqbn ||
      compileBusy ||
      uploadBusy,
  );
  let uploadStartDisabled = $derived(
    !activeWorkspaceRoot ||
      !isActiveIno ||
      !selectedBoardFqbn ||
      !selectedPort ||
      uploadBusy ||
      compileBusy,
  );
  let uploadButtonDisabled = $derived(
    (!uploadBusy && uploadStartDisabled) || (uploadBusy && uploadCancelBusy),
  );
  let compileTooltip = $derived.by(() => {
    if (uploadBusy) return "Upload in progress";
    if (compileBusy) return "Compile in progress";
    if (!activeWorkspaceRoot) return "Open a workspace first";
    if (!activeFilePath) return "Open an .ino file first";
    if (!isActiveIno) return "Compile requires an active .ino file";
    if (!selectedBoardFqbn) return "Select a board first";
    return "Compile active sketch";
  });
  let uploadTooltip = $derived.by(() => {
    if (uploadBusy) return "Cancel current upload";
    if (compileBusy) return "Compile is in progress";
    if (!activeWorkspaceRoot) return "Open a workspace first";
    if (!activeFilePath) return "Open an .ino file first";
    if (!isActiveIno) return "Upload requires an active .ino file";
    if (!selectedBoardFqbn) return "Select a board first";
    if (!selectedPort) return "Select a serial port first";
    return "Compile and upload active sketch";
  });
  const primaryIconButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary-500 bg-primary-600 text-dark-fg0 transition-colors duration-150 hover:bg-primary-700  disabled:cursor-not-allowed disabled:opacity-50";
  const cancelIconButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-dark-red bg-dark-bg text-dark-red transition-colors duration-150 hover:border-dark-red hover:text-dark-red  disabled:cursor-not-allowed disabled:opacity-50";
  const dropdownTriggerClass =
    "input-field inline-flex h-9 w-full items-center justify-between gap-2 rounded-md py-1.5 text-left text-dark-fg focus:ring-0 [-webkit-app-region:no-drag]";
  const dropdownPanelClass =
    "absolute right-0 top-full z-30 mt-1 max-h-72 w-full overflow-x-hidden overflow-y-auto rounded-md border border-dark-border bg-dark-surface p-1 shadow-lg shadow-dark-bg/40 [-webkit-app-region:no-drag]";
  const dropdownItemClass =
    "w-full rounded-md px-2 py-1.5 text-left text-sm text-dark-fg2 transition-colors duration-150 hover:bg-dark-bgH hover:text-dark-fg0  ";
  const isMac =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  let selectedPortLabel = $derived.by(() => {
    if (!selectedPort) return portsBusy ? "Loading ports..." : "Select port";
    return (
      ports.find((port) => port.address === selectedPort)?.label ?? selectedPort
    );
  });
  let selectedBoardLabel = $derived.by(() => {
    if (!selectedBoardFqbn)
      return boardsBusy ? "Loading boards..." : "Select board";
    const match = boards.find((board) => board.fqbn === selectedBoardFqbn);
    return match ? match.name : "Select board";
  });
  const boardMatchesQuery = (
    board: ArduinoBoardOption,
    query: string,
  ): boolean => {
    return (
      board.name.toLowerCase().includes(query) ||
      board.fqbn.toLowerCase().includes(query) ||
      board.platform.toLowerCase().includes(query)
    );
  };
  let favoriteBoardSet = $derived.by(() => new Set(favoriteBoardFqbns));
  let overlayOpen = $derived(
    portsDropdownOpen || boardsDropdownOpen || boardSettingsDropdownOpen,
  );
  let favoriteBoardsOrdered = $derived.by(() => {
    if (favoriteBoardFqbns.length === 0 || boards.length === 0) return [];
    const boardByFqbn = new Map(boards.map((board) => [board.fqbn, board]));
    const ordered: ArduinoBoardOption[] = [];

    for (const fqbn of favoriteBoardFqbns) {
      const match = boardByFqbn.get(fqbn);
      if (match) ordered.push(match);
    }

    return ordered;
  });
  let filteredFavoriteBoards = $derived.by(() => {
    const query = boardSearch.trim().toLowerCase();
    if (!query) return favoriteBoardsOrdered;
    return favoriteBoardsOrdered.filter((board) =>
      boardMatchesQuery(board, query),
    );
  });
  let filteredRegularBoards = $derived.by(() => {
    const query = boardSearch.trim().toLowerCase();
    return boards.filter((board) => {
      if (favoriteBoardSet.has(board.fqbn)) return false;
      return !query || boardMatchesQuery(board, query);
    });
  });
  let selectedBoardSettingsCount = $derived(
    Object.keys(boardOptionSelections).length,
  );
  let boardSettingsButtonLabel = $derived.by(() => {
    if (!selectedBoardFqbn) return "Settings";
    if (selectedBoardSettingsCount === 0) return "Settings";
    return `Settings (${selectedBoardSettingsCount})`;
  });
  let boardSettingsTooltip = $derived.by(() => {
    if (!selectedBoardFqbn) return "Select a board first";
    return "Configure board-specific settings";
  });

  function getSelectedBoardOptionValues(
    details: ArduinoBoardDetails | null,
  ): Record<string, string> {
    if (!details) return {};

    const selectedEntries = details.configOptions
      .map((option) => {
        const selectedValue = option.values.find((value) => value.selected);
        if (!selectedValue) return null;
        return [option.id, selectedValue.id] as const;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null);

    return Object.fromEntries(selectedEntries);
  }

  function shallowEqualSelections(
    left: Record<string, string>,
    right: Record<string, string>,
  ): boolean {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) return false;

    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index];
      if (key !== rightKeys[index]) return false;
      if (left[key] !== right[key]) return false;
    }

    return true;
  }

  function sanitizeBoardOptionSelections(
    nextSelections: Record<string, string>,
    details: ArduinoBoardDetails | null,
    defaultSelections: Record<string, string>,
  ): Record<string, string> {
    if (!details) return {};

    const validByOptionId = new Map(
      details.configOptions.map((option) => [
        option.id,
        new Set(option.values.map((value) => value.id)),
      ]),
    );

    const sanitizedEntries = Object.entries(nextSelections).filter(
      ([optionId, valueId]) => {
        const validValues = validByOptionId.get(optionId);
        if (!validValues || !validValues.has(valueId)) return false;
        return defaultSelections[optionId] !== valueId;
      },
    );

    return Object.fromEntries(sanitizedEntries);
  }

  let boardDefaultSelections = $derived.by(() =>
    getSelectedBoardOptionValues(boardBaseDetails),
  );

  onMount(() => {
    void refreshPorts();
    void refreshBoards();

    const outputListener = (payload: ArduinoCommandOutputEnvelope) => {
      if (!activeOutputRequestIds.has(payload.requestId)) return;

      emitOutputEvent({
        type: "chunk",
        requestId: payload.requestId,
        operation: payload.operation,
        stream: payload.stream,
        chunk: payload.chunk,
      });
    };
    const onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        portsDropdownOpen &&
        portsDropdownElement &&
        target &&
        !portsDropdownElement.contains(target)
      ) {
        portsDropdownOpen = false;
      }
      if (
        boardsDropdownOpen &&
        boardsDropdownElement &&
        target &&
        !boardsDropdownElement.contains(target)
      ) {
        boardsDropdownOpen = false;
      }
      if (
        boardSettingsDropdownOpen &&
        boardSettingsDropdownElement &&
        target &&
        !boardSettingsDropdownElement.contains(target)
      ) {
        boardSettingsDropdownOpen = false;
      }
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      portsDropdownOpen = false;
      boardsDropdownOpen = false;
      boardSettingsDropdownOpen = false;
    };

    window.electronAPI.onArduinoCommandOutput(outputListener);
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      window.electronAPI.offArduinoCommandOutput(outputListener);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  });

  $effect(() => {
    if (typeof onOverlayOpenChange === "function") {
      onOverlayOpenChange(overlayOpen);
    }
  });

  onDestroy(() => {
    if (typeof onOverlayOpenChange === "function") {
      onOverlayOpenChange(false);
    }
  });

  function togglePortsDropdown(): void {
    portsDropdownOpen = !portsDropdownOpen;
    if (portsDropdownOpen) {
      boardsDropdownOpen = false;
      boardSettingsDropdownOpen = false;
      void refreshPorts();
    }
  }

  function toggleBoardsDropdown(): void {
    boardsDropdownOpen = !boardsDropdownOpen;
    if (boardsDropdownOpen) {
      portsDropdownOpen = false;
      boardSettingsDropdownOpen = false;
      boardSearch = "";
      void refreshBoards();
    }
  }

  async function refreshBoardSettings(): Promise<void> {
    const baseFqbn = selectedBoardFqbn.trim();
    if (!baseFqbn) {
      boardCurrentDetails = null;
      boardBaseDetails = null;
      boardSettingsError = null;
      boardSettingsBusy = false;
      return;
    }

    const currentFqbn = effectiveBoardFqbn.trim() || baseFqbn;
    const currentRequestId = ++boardSettingsRequestId;
    boardSettingsBusy = true;
    boardSettingsError = null;

    try {
      const currentPromise = window.electronAPI.getArduinoBoardDetails({
        fqbn: currentFqbn,
      });
      const basePromise =
        currentFqbn === baseFqbn
          ? currentPromise
          : window.electronAPI.getArduinoBoardDetails({ fqbn: baseFqbn });
      const [currentResponse, baseResponse] = await Promise.all([
        currentPromise,
        basePromise,
      ]);

      if (currentRequestId !== boardSettingsRequestId) return;
      if (!currentResponse.ok || !currentResponse.details) {
        boardCurrentDetails = null;
        boardBaseDetails = null;
        boardSettingsError =
          currentResponse.error ?? "Failed to load board settings.";
        return;
      }

      const nextCurrentDetails = currentResponse.details;
      const nextBaseDetails =
        baseResponse.ok && baseResponse.details
          ? baseResponse.details
          : nextCurrentDetails;
      boardCurrentDetails = nextCurrentDetails;
      boardBaseDetails = nextBaseDetails;

      const cleanedSelections = sanitizeBoardOptionSelections(
        boardOptionSelections,
        nextCurrentDetails,
        getSelectedBoardOptionValues(nextBaseDetails),
      );
      if (!shallowEqualSelections(cleanedSelections, boardOptionSelections)) {
        safeSetBoardOptionSelections(cleanedSelections);
      }
    } catch (error) {
      if (currentRequestId !== boardSettingsRequestId) return;
      boardCurrentDetails = null;
      boardBaseDetails = null;
      boardSettingsError =
        error instanceof Error
          ? error.message
          : "Failed to load board settings.";
    } finally {
      if (currentRequestId === boardSettingsRequestId) {
        boardSettingsBusy = false;
      }
    }
  }

  function toggleBoardSettingsDropdown(): void {
    if (!selectedBoardFqbn) return;

    boardSettingsDropdownOpen = !boardSettingsDropdownOpen;
    if (boardSettingsDropdownOpen) {
      portsDropdownOpen = false;
      boardsDropdownOpen = false;
    }
  }

  function handlePortSelection(address: string): void {
    safeSetPort(address);
    portsDropdownOpen = false;
  }

  function handleBoardSelection(fqbn: string): void {
    safeSetBoard(fqbn);
    boardsDropdownOpen = false;
    boardSettingsDropdownOpen = false;
  }

  function handleBoardOptionSelection(optionId: string, valueId: string): void {
    if (!selectedBoardFqbn) return;

    const nextSelections = { ...boardOptionSelections };
    if (boardDefaultSelections[optionId] === valueId) {
      delete nextSelections[optionId];
    } else {
      nextSelections[optionId] = valueId;
    }

    safeSetBoardOptionSelections(
      sanitizeBoardOptionSelections(
        nextSelections,
        boardCurrentDetails,
        boardDefaultSelections,
      ),
    );
  }

  function handleOpenBoardsManager(): void {
    boardsDropdownOpen = false;
    boardSettingsDropdownOpen = false;
    safeOpenBoardsManager();
  }

  function handleFavoriteToggleClick(event: MouseEvent, fqbn: string): void {
    event.preventDefault();
    event.stopPropagation();
    safeToggleFavoriteBoard(fqbn);
  }

  function emitStart(
    requestId: string,
    operation: ArduinoOperation,
    command?: string[],
  ): void {
    emitOutputEvent({
      type: "start",
      requestId,
      operation,
      startedAt: new Date().toISOString(),
      command,
    });
  }

  function emitFinish(
    requestId: string,
    operation: ArduinoOperation,
    status: "ok" | "error" | "cancelled",
    message: string,
    exitCode: number | null,
    command?: string[],
  ): void {
    emitOutputEvent({
      type: "finish",
      requestId,
      operation,
      status,
      message,
      exitCode,
      command,
      finishedAt: new Date().toISOString(),
    });
  }

  async function refreshPorts(): Promise<void> {
    portsBusy = true;
    portsError = null;

    try {
      const response = await window.electronAPI.listArduinoPorts();
      if (!response.ok) {
        ports = [];
        portsError = response.error ?? "Failed to load serial ports.";
        safeSetPort("");
        return;
      }

      const nextPorts = response.ports ?? [];
      ports = nextPorts;

      const keepCurrent = nextPorts.some(
        (item) => item.address === selectedPort,
      );
      if (!keepCurrent) {
        safeSetPort(nextPorts[0]?.address ?? "");
      }
    } catch (error) {
      ports = [];
      portsError =
        error instanceof Error ? error.message : "Failed to load serial ports.";
      safeSetPort("");
    } finally {
      portsBusy = false;
    }
  }

  async function refreshBoards(): Promise<void> {
    boardsBusy = true;
    boardsError = null;

    try {
      const response = await window.electronAPI.listArduinoBoards();
      if (!response.ok) {
        boards = [];
        boardsError = response.error ?? "Failed to load boards.";
        safeSetBoard("");
        return;
      }

      const nextBoards = response.boards ?? [];
      boards = nextBoards;

      const keepCurrent = nextBoards.some(
        (item) => item.fqbn === selectedBoardFqbn,
      );
      if (!keepCurrent) {
        safeSetBoard("");
      }
    } catch (error) {
      boards = [];
      boardsError =
        error instanceof Error ? error.message : "Failed to load boards.";
      safeSetBoard("");
    } finally {
      boardsBusy = false;
    }
  }

  async function compileActiveSketch(): Promise<void> {
    if (compileDisabled || !activeWorkspaceRoot || !activeFilePath) return;

    const requestId = crypto.randomUUID();
    compileBusy = true;
    activeOutputRequestIds.add(requestId);
    emitStart(requestId, "compile");
    try {
      if (activeFileDirty) {
        await onSaveActiveFile();
      }

      const response = await window.electronAPI.compileArduinoOpenSketch({
        requestId,
        workspaceRoot: activeWorkspaceRoot,
        activeFilePath,
        fqbn: effectiveBoardFqbn,
      });

      if (!response.ok || !response.result) {
        const detail =
          response.error ?? "Compile failed before running arduinoCompile.";
        emitFinish(requestId, "compile", "error", detail, null);
        return;
      }

      const result = response.result;
      const success = result.status === "compiled" && result.ok;
      const status = result.aborted ? "cancelled" : success ? "ok" : "error";
      const detail =
        result.message ??
        (success
          ? "Arduino compile completed successfully."
          : "Compile failed.");
      emitFinish(
        requestId,
        "compile",
        status,
        detail,
        result.exitCode ?? null,
        result.command,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Compile failed unexpectedly.";
      emitFinish(requestId, "compile", "error", detail, null);
    } finally {
      activeOutputRequestIds.delete(requestId);
      compileBusy = false;
    }
  }

  async function cancelUpload(): Promise<void> {
    if (!uploadBusy || !uploadRequestId || uploadCancelBusy) return;

    uploadCancelBusy = true;
    try {
      await window.electronAPI.cancelArduinoUpload(uploadRequestId);
    } catch (error) {
      void error;
    } finally {
      uploadCancelBusy = false;
    }
  }

  async function uploadActiveSketch(): Promise<void> {
    if (uploadStartDisabled || !activeWorkspaceRoot || !activeFilePath) return;

    const requestId = crypto.randomUUID();
    uploadBusy = true;
    uploadRequestId = requestId;
    uploadCancelBusy = false;
    activeOutputRequestIds.add(requestId);
    emitStart(requestId, "upload");

    try {
      if (activeFileDirty) {
        await onSaveActiveFile();
      }

      const response = await window.electronAPI.uploadArduinoOpenSketch({
        requestId,
        workspaceRoot: activeWorkspaceRoot,
        activeFilePath,
        fqbn: effectiveBoardFqbn,
        port: selectedPort,
      });

      if (!response.ok || !response.result) {
        const detail =
          response.error ?? "Upload failed before running upload command.";
        emitFinish(requestId, "upload", "error", detail, null);
        return;
      }

      const result = response.result as ArduinoUploadResult;

      const status =
        result.status === "uploaded"
          ? "ok"
          : result.status === "upload_cancelled"
            ? "cancelled"
            : "error";
      emitFinish(
        requestId,
        "upload",
        status,
        result.message,
        result.exitCode ?? null,
        result.command,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Upload failed unexpectedly.";
      emitFinish(requestId, "upload", "error", detail, null);
    } finally {
      activeOutputRequestIds.delete(requestId);
      uploadBusy = false;
      uploadCancelBusy = false;
      uploadRequestId = null;
    }
  }

  function onUploadButtonClick(): void {
    if (uploadBusy) {
      void cancelUpload();
      return;
    }

    void uploadActiveSketch();
  }

  function isBoardOptionValueSelected(
    optionId: string,
    valueId: string,
  ): boolean {
    const effectiveValue =
      boardOptionSelections[optionId] ??
      boardDefaultSelections[optionId] ??
      null;
    return effectiveValue === valueId;
  }

  $effect(() => {
    if (!boardSettingsDropdownOpen) return;
    selectedBoardFqbn;
    effectiveBoardFqbn;
    void refreshBoardSettings();
  });

  $effect(() => {
    if (selectedBoardFqbn) return;
    boardSettingsDropdownOpen = false;
    boardCurrentDetails = null;
    boardBaseDetails = null;
    boardSettingsError = null;
  });
</script>

<header
  class={`border-b border-dark-border bg-dark-surface px-4 [-webkit-app-region:drag] ${
    isMac ? "pb-2 pl-[86px] pt-1.5" : "py-2.5"
  }`}
>
  <!-- <div class="flex flex-wrap items-center gap-3">
    <h1 class="text-lg font-semibold text-white">Exort Desktop</h1>
    {#if userEmail}
      <span class="rounded border border-dark-border bg-dark-bg px-2 py-1 text-xs text-gray-300">{userEmail}</span>
    {/if}
    <span class="text-xs text-gray-400">{statusText}</span>
  </div> -->

  <div class="flex flex-wrap items-end justify-end gap-2">
    <div class="flex items-center gap-2" bind:this={portsDropdownElement}>
      <span class="w-10 shrink-0 text-right text-xs text-dark-fg3">Port</span>
      <div class="relative w-64 shrink-0">
        <button
          class={dropdownTriggerClass}
          onclick={togglePortsDropdown}
          disabled={uploadBusy}
          title={selectedPortLabel}
          aria-label="Select serial port"
          aria-expanded={portsDropdownOpen}
        >
          <span class="truncate">{selectedPortLabel}</span>
          <ChevronDown
            class={`h-4 w-4 text-dark-fg3 transition-transform ${portsDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {#if portsDropdownOpen}
          <div class={dropdownPanelClass}>
            <button
              class={`${dropdownItemClass} mb-1 inline-flex items-center gap-2 border border-dark-border`}
              onclick={() => void refreshPorts()}
              disabled={portsBusy || uploadBusy}
              aria-label="Refresh connected serial ports"
            >
              <RefreshCw class={`h-4 w-4 ${portsBusy ? "animate-spin" : ""}`} />
              <span>{portsBusy ? "Refreshing ports..." : "Refresh ports"}</span>
            </button>

            {#if ports.length === 0}
              <div class="px-2 py-1.5 text-sm text-dark-fg3">
                {portsBusy ? "Loading ports..." : "No serial ports found"}
              </div>
            {:else}
              {#each ports as port (port.address)}
                <button
                  class={`${dropdownItemClass} ${port.address === selectedPort ? "bg-dark-bgH text-primary-300" : ""}`}
                  onclick={() => handlePortSelection(port.address)}
                  title={port.address}
                  aria-label={`Select ${port.label}`}
                >
                  <span class="block truncate">{port.label}</span>
                  <span class="block truncate text-xs text-dark-fg4">
                    {port.address}
                  </span>
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2" bind:this={boardsDropdownElement}>
      <span class="w-10 shrink-0 text-right text-xs text-dark-fg3">Board</span>
      <div class="relative w-72 shrink-0">
        <button
          class={dropdownTriggerClass}
          onclick={toggleBoardsDropdown}
          disabled={boardsBusy}
          title={selectedBoardLabel}
          aria-label="Select board"
          aria-expanded={boardsDropdownOpen}
        >
          <span class="truncate">{selectedBoardLabel}</span>
          <ChevronDown
            class={`h-4 w-4 text-dark-fg3 transition-transform ${boardsDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {#if boardsDropdownOpen}
          <div
            class={`${dropdownPanelClass} flex max-h-[28rem] flex-col overflow-hidden p-0`}
          >
            <div class="p-1">
              <div
                class="input-field flex h-8 items-center gap-2 rounded-md px-2 py-1"
              >
                <Search class="h-4 w-4 shrink-0 text-dark-fg4" />
                <input
                  class="h-full w-full bg-transparent p-0 text-sm text-dark-fg placeholder:text-dark-fg4"
                  placeholder="Search boards..."
                  bind:value={boardSearch}
                />
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
              <!-- <button
                class={`${dropdownItemClass} ${!selectedBoardFqbn ? "bg-dark-bgH text-primary-300" : ""}`}
                onclick={() => handleBoardSelection("")}
              >
                Select board
              </button> -->

              {#if filteredFavoriteBoards.length > 0}
                <div
                  class="px-2 py-1 text-xs uppercase tracking-wide text-dark-fg4"
                >
                  Favorites
                </div>
                {#each filteredFavoriteBoards as board (board.fqbn)}
                  <div
                    class={`mb-0.5 flex items-center gap-1 rounded-md pr-1 ${board.fqbn === selectedBoardFqbn ? "bg-dark-bgH" : "hover:bg-dark-bgH"}`}
                  >
                    <button
                      class={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150  ${board.fqbn === selectedBoardFqbn ? "text-primary-300" : "text-dark-fg2 hover:text-dark-fg0"}`}
                      onclick={() => handleBoardSelection(board.fqbn)}
                      aria-label={`Select ${board.name}`}
                    >
                      <span
                        class="block overflow-hidden whitespace-normal break-words leading-snug"
                        style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;"
                      >
                        {board.name}
                      </span>
                    </button>

                    <button
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-dark-yellow transition-colors duration-150 hover:text-dark-yellow2"
                      onclick={(event) =>
                        handleFavoriteToggleClick(event, board.fqbn)}
                      title="Remove from favorites"
                      aria-label={`Remove ${board.name} from favorites`}
                    >
                      <Star class="h-4 w-4 fill-current" />
                    </button>
                  </div>
                {/each}
              {/if}

              {#if filteredRegularBoards.length > 0}
                {#if filteredFavoriteBoards.length > 0}
                  <div class="my-1 border-t border-dark-border"></div>
                {/if}
                {#each filteredRegularBoards as board (board.fqbn)}
                  <div
                    class={`mb-0.5 flex items-center gap-1 rounded-md pr-1 ${board.fqbn === selectedBoardFqbn ? "bg-dark-bgH" : "hover:bg-dark-bgH"}`}
                  >
                    <button
                      class={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150  ${board.fqbn === selectedBoardFqbn ? "text-primary-300" : "text-dark-fg2 hover:text-dark-fg0"}`}
                      onclick={() => handleBoardSelection(board.fqbn)}
                      aria-label={`Select ${board.name}`}
                    >
                      <span
                        class="block overflow-hidden whitespace-normal break-words leading-snug"
                        style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;"
                      >
                        {board.name}
                      </span>
                    </button>

                    <button
                      class="inline-flex h-7 w-7 items-center justify-center rounded-md text-dark-fg4 transition-colors duration-150 hover:text-dark-yellow"
                      onclick={(event) =>
                        handleFavoriteToggleClick(event, board.fqbn)}
                      title="Add to favorites"
                      aria-label={`Add ${board.name} to favorites`}
                    >
                      <Star class="h-4 w-4" />
                    </button>
                  </div>
                {/each}
              {/if}

              {#if filteredFavoriteBoards.length === 0 && filteredRegularBoards.length === 0}
                <div class="px-2 py-1.5 text-sm text-dark-fg3">
                  {boardsBusy
                    ? "Loading boards..."
                    : boardSearch.trim()
                      ? "No boards match your search"
                      : "No boards available"}
                </div>
              {/if}
            </div>

            <div class="border-t border-dark-border p-1">
              <button
                class={`${dropdownItemClass} inline-flex items-center gap-2 border border-dark-border`}
                onclick={handleOpenBoardsManager}
                aria-label="Open boards manager"
              >
                <Settings2 class="h-4 w-4" />
                <span>Install boards</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <div
      class="flex items-center gap-2"
      bind:this={boardSettingsDropdownElement}
    >
      <span class="w-14 shrink-0 text-right text-xs text-dark-fg3">
        Config
      </span>
      <div class="relative w-44 shrink-0">
        <button
          class={dropdownTriggerClass}
          onclick={toggleBoardSettingsDropdown}
          disabled={!selectedBoardFqbn}
          title={boardSettingsTooltip}
          aria-label="Configure board settings"
          aria-expanded={boardSettingsDropdownOpen}
        >
          <span class="truncate">{boardSettingsButtonLabel}</span>
          <ChevronDown
            class={`h-4 w-4 text-dark-fg3 transition-transform ${boardSettingsDropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {#if boardSettingsDropdownOpen}
          <div
            class={`${dropdownPanelClass} max-h-[28rem] w-[22rem] overflow-y-auto p-2`}
          >
            <div class="mb-2 border-b border-dark-border pb-2">
              <div class="flex items-center gap-2 text-sm text-dark-fg1">
                <Settings2 class="h-4 w-4 shrink-0" />
                <span class="truncate">Board settings</span>
              </div>
              <div class="mt-1 text-xs text-dark-fg4">
                {boardCurrentDetails?.boardName ?? selectedBoardLabel}
              </div>
            </div>

            {#if boardSettingsBusy && !boardCurrentDetails}
              <div class="px-1 py-2 text-sm text-dark-fg3">
                Loading board settings...
              </div>
            {:else if boardSettingsError}
              <div class="px-1 py-2 text-sm text-dark-red">
                {boardSettingsError}
              </div>
            {:else if boardCurrentDetails}
              {#if boardCurrentDetails.configOptions.length === 0}
                <div class="px-1 py-2 text-sm text-dark-fg3">
                  This board has no configurable board settings.
                </div>
              {:else}
                <div class="space-y-3">
                  {#each boardCurrentDetails.configOptions as option (option.id)}
                    <section>
                      <div
                        class="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-dark-fg4"
                      >
                        {option.label}
                      </div>
                      <div class="space-y-1">
                        {#each option.values as value (value.id)}
                          <button
                            class={`w-full rounded-md border px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
                              isBoardOptionValueSelected(option.id, value.id)
                                ? "border-primary-500 bg-dark-bgH text-primary-300"
                                : "border-dark-border bg-dark-bg text-dark-fg2 hover:bg-dark-bgH hover:text-dark-fg0"
                            }`}
                            onclick={() =>
                              handleBoardOptionSelection(option.id, value.id)}
                            title={value.label}
                            aria-label={`Set ${option.label} to ${value.label}`}
                          >
                            <span class="block truncate">{value.label}</span>
                          </button>
                        {/each}
                      </div>
                    </section>
                  {/each}
                </div>
              {/if}
            {:else}
              <div class="px-1 py-2 text-sm text-dark-fg3">
                Board settings unavailable.
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <button
      class={`${primaryIconButtonClass} [-webkit-app-region:no-drag]`}
      onclick={() => void compileActiveSketch()}
      disabled={compileDisabled}
      title={compileTooltip}
      aria-label="Compile active sketch"
    >
      {#if compileBusy}
        <Loader class="h-4 w-4 animate-spin" />
      {:else}
        <Hammer class="h-4 w-4" />
      {/if}
      <span class="sr-only">Compile</span>
    </button>

    <button
      class={`${uploadBusy ? cancelIconButtonClass : primaryIconButtonClass} [-webkit-app-region:no-drag]`}
      onclick={onUploadButtonClick}
      disabled={uploadButtonDisabled}
      title={uploadTooltip}
      aria-label={uploadBusy ? "Cancel upload" : "Upload active sketch"}
    >
      {#if uploadBusy}
        {#if uploadCancelBusy}
          <Loader class="h-4 w-4 animate-spin" />
        {:else}
          <X class="h-4 w-4" />
        {/if}
      {:else}
        <Upload class="h-4 w-4" />
      {/if}
      <span class="sr-only">{uploadBusy ? "Cancel upload" : "Upload"}</span>
    </button>
  </div>

  {#if portsError || boardsError}
    <div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
      {#if portsError}
        <span class="text-dark-red">Ports: {portsError}</span>
      {/if}
      {#if boardsError}
        <span class="text-dark-red">Boards: {boardsError}</span>
      {/if}
    </div>
  {/if}
</header>
