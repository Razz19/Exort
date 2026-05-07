<script lang="ts">
  import { onMount } from "svelte";
  import { Copy, CopyCheck } from "lucide-svelte";

  const appleIcon = `<svg viewBox="-1.5 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M57.5708873,7282.19296 C58.2999598,7281.34797 58.7914012,7280.17098 58.6569121,7279 C57.6062792,7279.04 56.3352055,7279.67099 55.5818643,7280.51498 C54.905374,7281.26397 54.3148354,7282.46095 54.4735932,7283.60894 C55.6455696,7283.69593 56.8418148,7283.03894 57.5708873,7282.19296 M60.1989864,7289.62485 C60.2283111,7292.65181 62.9696641,7293.65879 63,7293.67179 C62.9777537,7293.74279 62.562152,7295.10677 61.5560117,7296.51675 C60.6853718,7297.73474 59.7823735,7298.94772 58.3596204,7298.97372 C56.9621472,7298.99872 56.5121648,7298.17973 54.9134635,7298.17973 C53.3157735,7298.17973 52.8162425,7298.94772 51.4935978,7298.99872 C50.1203933,7299.04772 49.0738052,7297.68074 48.197098,7296.46676 C46.4032359,7293.98379 45.0330649,7289.44985 46.8734421,7286.3899 C47.7875635,7284.87092 49.4206455,7283.90793 51.1942837,7283.88393 C52.5422083,7283.85893 53.8153044,7284.75292 54.6394294,7284.75292 C55.4635543,7284.75292 57.0106846,7283.67793 58.6366882,7283.83593 C59.3172232,7283.86293 61.2283842,7284.09893 62.4549652,7285.8199 C62.355868,7285.8789 60.1747177,7287.09489 60.1989864,7289.62485" transform="translate(-46 -7279)" fill="currentColor"></path></svg>`;
  const windowsIcon = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13.1458647,7289.43426 C13.1508772,7291.43316 13.1568922,7294.82929 13.1619048,7297.46884 C16.7759398,7297.95757 20.3899749,7298.4613 23.997995,7299 C23.997995,7295.84873 24.002005,7292.71146 23.997995,7289.71311 C20.3809524,7289.71311 16.7649123,7289.43426 13.1458647,7289.43426 M4,7289.43526 L4,7296.22153 C6.72581454,7296.58933 9.45162907,7296.94113 12.1724311,7297.34291 C12.1774436,7294.71736 12.1704261,7292.0908 12.1704261,7289.46524 C9.44661654,7289.47024 6.72380952,7289.42627 4,7289.43526 M4,7281.84344 L4,7288.61071 C6.72581454,7288.61771 9.45162907,7288.57673 12.1774436,7288.57973 C12.1754386,7285.96017 12.1754386,7283.34361 12.1724311,7280.72405 C9.44461153,7281.06486 6.71679198,7281.42567 4,7281.84344 M24,7288.47179 C20.3879699,7288.48578 16.7759398,7288.54075 13.1619048,7288.55175 C13.1598997,7285.88921 13.1598997,7283.22967 13.1619048,7280.56914 C16.7689223,7280.01844 20.3839599,7279.50072 23.997995,7279 C24,7282.15826 23.997995,7285.31353 24,7288.47179" transform="translate(-4 -7279)" fill="currentColor"></path></svg>`;
  const linuxIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14.62,8.35c-.42.28-1.75,1-1.95,1.19a.82.82,0,0,1-1.14,0c-.2-.16-1.53-.92-1.95-1.19s-.45-.7.08-.92a6.16,6.16,0,0,1,4.91,0c.49.21.51.6,0,.9m7.22,7.28A19.09,19.09,0,0,0,18,10a4.31,4.31,0,0,1-1.06-1.88c-.1-.33-.17-.67-.24-1A11.32,11.32,0,0,0,16,4.47,4.06,4.06,0,0,0,12.16,2,4.2,4.2,0,0,0,8.21,4.4a5.9,5.9,0,0,0-.46,1.34c-.17.76-.32,1.55-.5,2.32a3.38,3.38,0,0,1-1,1.71,19.53,19.53,0,0,0-3.88,5.35A6.09,6.09,0,0,0,2,16c-.19.66.29,1.12,1,1,.44-.09.88-.18,1.3-.31s.57,0,.67.35a6.73,6.73,0,0,0,4.24,4.5c4.12,1.56,8.93-.66,10-4.58.07-.27.17-.37.47-.27.46.14.93.24,1.4.35a.72.72,0,0,0,.92-.64,1.44,1.44,0,0,0-.16-.73" fill="currentColor"></path></svg>`;

  const downloads = [
    {
      label: "macOS Apple Silicon",
      file: "Exort-0.1.0-mac-arm64.dmg",
      href: "https://github.com/Razz19/Exort/releases/download/v0.1.2/Exort-0.1.2-mac-arm64.dmg",
      icon: appleIcon,
      color: "#98971a",
    },
    {
      label: "macOS Intel",
      file: "Exort-0.1.0-mac-x64.dmg",
      href: "https://github.com/Razz19/Exort/releases/download/v0.1.2/Exort-0.1.2-mac-x64.dmg",
      icon: appleIcon,
      color: "#458588",
    },
    {
      label: "Windows",
      file: "Exort-0.1.0-win-x64.exe",
      href: "https://github.com/Razz19/Exort/releases/download/v0.1.2/Exort-0.1.2-win-x64.exe",
      icon: windowsIcon,
      color: "#fe8019",
    },
    {
      label: "Linux",
      file: "Exort-0.1.0-linux-x86_64.AppImage",
      href: "https://github.com/Razz19/Exort/releases/download/v0.1.2/Exort-0.1.2-linux-x86_64.AppImage",
      icon: linuxIcon,
      color: "#d79921",
    },
  ];

  const downloadVersion = "0.1.0";
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
  const localSetupAllCommand = localSetupCommands
    .map((item) => item.command)
    .join("\n");

  let ctaSection: HTMLElement | null = null;
  let ctaIntroEl: HTMLElement | null = null;
  let downloadCardEls: HTMLElement[] = [];
  let localSetupPanelEl: HTMLElement | null = null;
  let localSetupHeaderEl: HTMLElement | null = null;
  let localSetupCommandEls: HTMLElement[] = [];
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;
  let copiedCommandKey: string | null = null;
  let copyResetTimeout: number | null = null;
  let downloadHoverTimelines: Array<{
    play: () => void;
    reverse: () => void;
    kill: () => void;
  } | null> = [];

  const ensureGsap = async () => {
    if (gsapRef) {
      return gsapRef;
    }

    const { gsap } = await import("gsap");
    gsapRef = gsap;
    return gsap;
  };

  const getDownloadCardParts = (index: number) => {
    const cardEl = downloadCardEls[index];
    if (!cardEl) {
      return null;
    }

    const overlayEl = cardEl.querySelector<HTMLElement>(
      ".download-card__overlay",
    );
    const iconEl = cardEl.querySelector<HTMLElement>(
      ".download-card__overlay-icon",
    );
    const contentEl = cardEl.querySelector<HTMLElement>(
      ".download-card__overlay-content",
    );

    if (!overlayEl || !iconEl || !contentEl) {
      return null;
    }

    return { cardEl, overlayEl, iconEl, contentEl };
  };

  const showDownloadOverlay = (index: number) => {
    const timeline = downloadHoverTimelines[index];
    if (!timeline) {
      return;
    }

    timeline.play();
  };

  const hideDownloadOverlay = (index: number) => {
    const timeline = downloadHoverTimelines[index];
    if (!timeline) {
      return;
    }

    timeline.reverse();
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
      const gsap = await ensureGsap();
      downloadHoverTimelines = downloadCardEls.map((_, index) => {
        const parts = getDownloadCardParts(index);
        if (!parts) {
          return null;
        }

        const { overlayEl, iconEl, contentEl } = parts;
        gsap.set(overlayEl, { xPercent: 100, autoAlpha: 1 });
        gsap.set(iconEl, { x: 12, y: -8, scale: 0.88, opacity: 0 });
        gsap.set(contentEl, { x: 18, opacity: 0 });

        const timeline = gsap.timeline({
          paused: true,
          defaults: { overwrite: "auto" },
        });

        timeline.to(
          overlayEl,
          {
            xPercent: 0,
            duration: 0.42,
            ease: "power3.out",
          },
          0,
        );

        timeline.to(
          iconEl,
          {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.34,
            ease: "power2.out",
          },
          0.12,
        );

        timeline.to(
          contentEl,
          {
            x: 0,
            opacity: 1,
            duration: 0.34,
            ease: "power2.out",
          },
          0.16,
        );

        return timeline;
      });

      if (mediaQuery.matches) {
        return;
      }

      const { ScrollTrigger } = await import("gsap/ScrollTrigger");

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.set(
          [
            ctaIntroEl,
            ...downloadCardEls,
            localSetupPanelEl,
            localSetupHeaderEl,
            ...localSetupCommandEls,
          ].filter(Boolean),
          {
            willChange: "transform, opacity",
          },
        );

        if (ctaSection) {
          if (ctaIntroEl) {
            gsap.from(ctaIntroEl, {
              y: -28,
              opacity: 0,
              duration: 0.68,
              ease: "power3.out",
              scrollTrigger: {
                trigger: ctaSection,
                start: "top 78%",
                once: true,
              },
            });
          }
        }

        if (ctaSection && downloadCardEls.length) {
          const downloadCardsTimeline = gsap.timeline({
            delay: 0.5,
            scrollTrigger: {
              trigger: ctaSection,
              start: "top 78%",
              once: true,
            },
          });

          const cardAnimations = [
            { index: 0, vars: { y: -64, opacity: 0 } },
            { index: 1, vars: { x: 64, opacity: 0 } },
            { index: 3, vars: { y: 64, opacity: 0 } },
            { index: 2, vars: { x: -64, opacity: 0 } },
          ];

          cardAnimations.forEach((cardAnimation, orderIndex) => {
            const cardEl = downloadCardEls[cardAnimation.index];
            if (!cardEl) {
              return;
            }

            downloadCardsTimeline.from(
              cardEl,
              {
                ...cardAnimation.vars,
                duration: 0.62,
                ease: "power3.out",
                clearProps: "transform,opacity,willChange",
              },
              orderIndex * 0.12,
            );
          });
        }

        if (localSetupPanelEl) {
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
        }
      }, ctaSection || undefined);

      cleanupAnimations = () => {
        ctx.revert();
      };
    };

    void loadAnimations();

    return () => {
      if (copyResetTimeout) {
        window.clearTimeout(copyResetTimeout);
      }
      downloadHoverTimelines.forEach((timeline) => timeline?.kill());
      downloadHoverTimelines = [];
      cleanupAnimations();
    };
  });
</script>

<section
  id="try-exort"
  class="mx-auto max-w-7xl px-6 pb-16 pt-4 lg:px-8 lg:pb-24"
>
  <div bind:this={ctaSection} class="p-8 sm:p-10 lg:p-12">
    <div
      class="flex min-h-[22rem] flex-col items-center justify-center text-center"
    >
      <div bind:this={ctaIntroEl}>
        <span
          class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]"
        >
          Get Exort
        </span>
        <h2 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          Let&apos;s get Exort running on your setup
        </h2>
        <p
          class="mt-4 text-base leading-8 text-[color:var(--color-text-muted)]"
        >
          Choose your platform to download the right version
        </p>
      </div>

      <div
        class="download-grid mt-10 grid w-fit grid-cols-1 gap-5 justify-items-center sm:grid-cols-2"
      >
        {#each downloads as item, index}
          <article
            bind:this={downloadCardEls[index]}
            class="download-card group relative h-56 w-56 overflow-hidden"
            style={`--download-card-color:${item.color};`}
            on:mouseenter={() => void showDownloadOverlay(index)}
            on:mouseleave={() => void hideDownloadOverlay(index)}
            on:focusin={() => void showDownloadOverlay(index)}
            on:focusout={() => void hideDownloadOverlay(index)}
          >
            <div
              class="download-card__base absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            >
              <span class="download-card__icon" aria-hidden="true">
                {@html item.icon}
              </span>
              <p
                class="mt-4 text-sm font-light text-[color:var(--color-text)] sm:text-base"
              >
                {item.label}
              </p>
            </div>

            <div class="download-card__overlay absolute inset-0 p-6">
              <span class="download-card__overlay-icon" aria-hidden="true">
                {@html item.icon}
              </span>
              <div
                class="download-card__overlay-content flex h-full flex-col items-center justify-center text-center"
              >
                <p
                  class="text-base font-medium text-[color:var(--color-ink)] sm:text-lg"
                >
                  Exort {downloadVersion}
                </p>
              </div>
              <div class="download-card__overlay-actions flex justify-center">
                <a
                  href={item.href}
                  download
                  class="download-card__button mt-5 inline-flex items-center justify-center px-5 py-2 text-sm font-medium transition"
                >
                  Download
                </a>
              </div>
            </div>
          </article>
        {/each}
      </div>

      <div
        bind:this={localSetupPanelEl}
        class="local-setup-panel mt-12 w-full max-w-4xl text-left"
      >
        <div
          bind:this={localSetupHeaderEl}
          class="flex flex-col gap-3 border-b border-[rgba(235,219,178,0.08)] pb-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <span
              class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]"
            >
              OR Run Locally
            </span>
            <h3 class="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Clone the repo and run Exort locally
            </h3>
          </div>

          <button
            type="button"
            class="local-setup-copy-all inline-flex items-center justify-center self-start p-2 transition"
            on:click={() => void copyCommand("copy-all", localSetupAllCommand)}
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
          {#each localSetupCommands as item, index}
            <div
              bind:this={localSetupCommandEls[index]}
              class="local-setup-command"
            >
              <div class="local-setup-command__inner">
                <pre class="local-setup-command__code"><code
                    >{item.command}</code
                  ></pre>
                <button
                  type="button"
                  class="local-setup-copy inline-flex items-center justify-center p-2 transition"
                  on:click={() => void copyCommand(item.key, item.command)}
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
  </div>
</section>
