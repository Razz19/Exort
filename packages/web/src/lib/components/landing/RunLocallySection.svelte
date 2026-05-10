<script lang="ts">
  import { onMount } from "svelte";
  import { Copy, CopyCheck } from "lucide-svelte";

  const localSetupCommands = [
    {
      key: "clone",
      command: "git clone https://github.com/Razz19/Exort.git",
    },
    {
      key: "cd",
      command: "cd Exort",
    },
    {
      key: "install",
      command: "npm install",
    },
    {
      key: "dev-web",
      command: "npm run dev",
    },
  ] as const;

  const localSetupCopyAccentClasses = {
    "copy-all":
      "text-gruvbox-fg1 hover:text-gruvbox-orange focus-visible:text-gruvbox-orange",
    clone: "hover:text-gruvbox-orange focus-visible:text-gruvbox-orange",
    cd: "hover:text-gruvbox-green focus-visible:text-gruvbox-green",
    install: "hover:text-gruvbox-blue focus-visible:text-gruvbox-blue",
    "dev-web": "hover:text-gruvbox-yellow focus-visible:text-gruvbox-yellow",
  } as const;

  const localSetupCopiedTextClasses = {
    "copy-all": "text-gruvbox-orange",
    clone: "text-gruvbox-orange",
    cd: "text-gruvbox-green",
    install: "text-gruvbox-blue",
    "dev-web": "text-gruvbox-yellow",
  } as const;

  const localSetupAllCommand = localSetupCommands
    .map((item) => item.command)
    .join("\n");

  let localSetupPanelEl: HTMLElement | null = null;
  let localSetupHeaderEl: HTMLElement | null = null;
  let localSetupCommandEls: HTMLElement[] = [];
  let copiedCommandKey = $state<string | null>(null);
  let copyResetTimeout: number | null = null;
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;

  const ensureGsap = async () => {
    if (gsapRef) {
      return gsapRef;
    }

    const { gsap } = await import("gsap");
    gsapRef = gsap;
    return gsap;
  };

  const setCopiedCommand = (key: string) => {
    copiedCommandKey = key;
    if (typeof window === "undefined") {
      return;
    }

    if (copyResetTimeout) {
      window.clearTimeout(copyResetTimeout);
    }

    copyResetTimeout = window.setTimeout(() => {
      copiedCommandKey = null;
      copyResetTimeout = null;
    }, 1800);
  };

  const copyCommand = async (key: string, command: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(key);
    } catch {
      copiedCommandKey = null;
    }
  };

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cleanupAnimations = () => {};

    const loadAnimations = async () => {
      if (mediaQuery.matches || !localSetupPanelEl) {
        return;
      }

      const gsap = await ensureGsap();
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.set(
          [
            localSetupPanelEl,
            localSetupHeaderEl,
            ...localSetupCommandEls,
          ].filter(Boolean),
          {
            willChange: "transform, opacity",
          },
        );

        if (localSetupHeaderEl) {
          gsap.from(localSetupHeaderEl, {
            y: 20,
            opacity: 0,
            duration: 0.62,
            ease: "power3.out",
            scrollTrigger: {
              trigger: localSetupPanelEl,
              start: "top 82%",
              once: true,
            },
          });
        }

        if (localSetupCommandEls.length) {
          gsap.from(localSetupCommandEls, {
            y: 18,
            opacity: 0,
            duration: 0.56,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: localSetupPanelEl,
              start: "top 78%",
              once: true,
            },
          });
        }
      }, localSetupPanelEl);

      cleanupAnimations = () => {
        ctx.revert();
      };
    };

    void loadAnimations();

    return () => {
      if (copyResetTimeout) {
        window.clearTimeout(copyResetTimeout);
      }
      cleanupAnimations();
    };
  });
</script>

<div class="px-4 sm:px-6 lg:px-8">
  <div
    bind:this={localSetupPanelEl}
    class="mx-auto mt-8 sm:mt-10 mb-16 w-full max-w-4xl rounded-[1.5rem] border border-[rgba(235,219,178,0.08)] bg-gruvbox-ink p-5 text-left shadow-card-sm"
  >
    <div
      bind:this={localSetupHeaderEl}
      class="relative gap-3 pb-4 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <span
          class="text-xs sm:text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft"
        >
          Run Exort Locally
        </span>
        <h3 class="mt-2 text-sm font-semibold text-white sm:text-2xl">
          Clone the repo and run Exort locally
        </h3>
      </div>

      <button
        type="button"
        class={`inline-flex absolute top-0 right-0 h-9 w-9 items-center justify-center self-start bg-transparent p-2 transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none ${
          copiedCommandKey === "copy-all"
            ? "text-gruvbox-orange"
            : localSetupCopyAccentClasses["copy-all"]
        }`}
        onclick={() => void copyCommand("copy-all", localSetupAllCommand)}
        aria-label="Copy all local setup commands"
        title="Copy all commands"
      >
        {#if copiedCommandKey === "copy-all"}
          <CopyCheck class="h-4 w-4" aria-hidden="true" />
        {:else}
          <Copy class="h-4 w-4" aria-hidden="true" />
        {/if}
      </button>
    </div>

    <div class="mt-4 space-y-2">
      {#each localSetupCommands as item, index (item.key)}
        <div bind:this={localSetupCommandEls[index]}>
          <div class="relative">
            <pre
              class={`m-0 overflow-x-auto rounded-[0.85rem] bg-gruvbox-ink-strong px-[0.85rem] py-[0.72rem] pr-14 text-xs sm:text-[0.88rem] leading-[1.45] transition-colors duration-200 ${
                copiedCommandKey === "copy-all"
                  ? localSetupCopiedTextClasses["copy-all"]
                  : copiedCommandKey === item.key
                    ? localSetupCopiedTextClasses[item.key]
                    : "text-gruvbox-fg0"
              }`}><code>{item.command}</code></pre>
            <button
              type="button"
              class={`absolute right-[0.6rem] top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-transparent p-2 transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none ${
                copiedCommandKey === item.key
                  ? item.key === "clone"
                    ? "text-gruvbox-orange"
                    : item.key === "cd"
                      ? "text-gruvbox-green"
                      : item.key === "install"
                        ? "text-gruvbox-blue"
                        : "text-gruvbox-yellow"
                  : `text-gruvbox-fg1 ${localSetupCopyAccentClasses[item.key]}`
              }`}
              onclick={() => void copyCommand(item.key, item.command)}
              aria-label="Copy command"
              title="Copy command"
            >
              {#if copiedCommandKey === item.key}
                <CopyCheck class="h-4 w-4" aria-hidden="true" />
              {:else}
                <Copy class="h-4 w-4" aria-hidden="true" />
              {/if}
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
