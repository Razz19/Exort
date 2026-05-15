<script lang="ts">
  import { onMount } from "svelte";
  import SelectDropdown from "../SelectDropdown.svelte";
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

  let monacoTheme = $state<MonacoThemeId>("vs-dark");
  let chatFontSize = $state<ChatFontSizePreset>("default");
  let serialBufferSize = $state<number>(SERIAL_BUFFER_SIZE_DEFAULT);
  let serialBufferInput = $state<string>(String(SERIAL_BUFFER_SIZE_DEFAULT));

  onMount(() => {
    const unsubscribe = appStateStore.subscribe((state) => {
      monacoTheme = state.appearance.monacoTheme;
      chatFontSize = state.appearance.chatFontSize ?? "default";
      serialBufferSize = sanitizeSerialBufferSize(state.serial.bufferSize);
      serialBufferInput = String(serialBufferSize);
    });

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

  function onMonacoThemeChange(nextTheme: string): void {
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

  function onChatFontSizeChange(nextValue: string): void {
    const resolvedValue = isChatFontSizePreset(nextValue)
      ? nextValue
      : "default";
    chatFontSize = resolvedValue;

    patchAppState({
      appearance: {
        chatFontSize: resolvedValue,
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
      <label class="text-xs text-dark-fg3">
        Editor theme
      </label>
      <div class="w-56 min-w-0">
        <SelectDropdown
          options={monacoThemeOptions}
          value={monacoTheme}
          onChange={onMonacoThemeChange}
          ariaLabel="Editor theme"
        />
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <label class="text-xs text-dark-fg3">
        Chat font size
      </label>
      <div class="w-44 min-w-0">
        <SelectDropdown
          options={chatFontSizeOptions}
          value={chatFontSize}
          onChange={onChatFontSizeChange}
          ariaLabel="Chat font size"
        />
      </div>
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
</div>
