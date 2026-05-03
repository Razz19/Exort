<script lang="ts" generic="T extends string">
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  type Option = {
    value: T;
    label: string;
    description?: string;
  };

  let {
    options,
    value,
    ariaLabel,
    placeholder = "Select option",
    disabled = false,
    onChange,
  } = $props<{
    options: Option[];
    value: T | null;
    ariaLabel: string;
    placeholder?: string;
    disabled?: boolean;
    onChange: (value: T) => void;
  }>();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const triggerClass =
    "input-field inline-flex h-8 w-full items-center justify-between gap-2 rounded-md py-2 text-left text-dark-fg focus:ring-0";
  const panelClass =
    "absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-dark-border bg-dark-surface p-1 shadow-lg shadow-dark-bg/40";
  const itemClass =
    "w-full rounded-md px-2 py-1.5 text-left text-sm text-dark-fg2 transition-colors duration-150 hover:bg-dark-bgH hover:text-dark-fg0";

  let selectedLabel = $derived.by(() => {
    return options.find((option) => option.value === value)?.label ?? placeholder;
  });

  function closeDropdown(): void {
    open = false;
  }

  function toggleDropdown(): void {
    if (disabled) return;
    open = !open;
  }

  function handleOptionSelect(nextValue: T): void {
    onChange(nextValue);
    closeDropdown();
  }

  $effect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootEl?.contains(target)) return;
      closeDropdown();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });
</script>

<div class="relative min-w-0" bind:this={rootEl}>
  <button
    class={triggerClass}
    onclick={toggleDropdown}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    disabled={disabled}
    title={selectedLabel}
    type="button"
  >
    <span class="truncate text-dark-fg0">{selectedLabel}</span>
    <ChevronDown
      class={`h-4 w-4 shrink-0 text-dark-fg3 transition-transform ${open ? "rotate-180" : ""}`}
    />
  </button>

  {#if open}
    <div class={`${panelClass} chat-timeline-scroll`} role="listbox" aria-label={ariaLabel}>
      {#each options as option (option.value)}
        <button
          class={`${itemClass} ${option.value === value ? "bg-dark-bgH text-primary-300" : ""}`}
          onclick={() => handleOptionSelect(option.value)}
          aria-selected={option.value === value}
          role="option"
          title={option.label}
          type="button"
        >
          <span class="block truncate">{option.label}</span>
          {#if option.description}
            <span class="block truncate text-xs text-dark-fg4">
              {option.description}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
