<script lang="ts">
  import { onMount } from "svelte";
  import { Copy, CopyCheck } from "lucide-svelte";

  type InstallationGuideStep = {
    number: string;
    title: string;
    body: string[];
    warningTitle?: string;
    warningBody?: string[];
    command?: string;
    imagePlaceholderLabel?: string;
    substeps?: InstallationGuideStep[];
  };

  type InstallationGuidePlatform = {
    name: string;
    eyebrow: string;
    steps: InstallationGuideStep[];
  };

  let { showInstallationGuide = true }: { showInstallationGuide?: boolean } =
    $props();

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

  const downloadVersion = "0.1.2";
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
    clone:
      "hover:text-gruvbox-orange focus-visible:text-gruvbox-orange",
    cd: "hover:text-gruvbox-green focus-visible:text-gruvbox-green",
    install: "hover:text-gruvbox-blue focus-visible:text-gruvbox-blue",
    "dev-web":
      "hover:text-gruvbox-yellow focus-visible:text-gruvbox-yellow",
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
  const installationGuidePlatforms: InstallationGuidePlatform[] = [
    {
      name: "macOS",
      eyebrow: "For Mac devices",
      steps: [
        {
          number: "1",
          title: "Open the downloaded DMG file",
          body: [
            "Locate the downloaded Exort-0.2.2-arm64.dmg file in your Downloads folder and double-click to open it.",
            "You’ll see a window with the Exort app and Applications folder. Drag Exort to Applications to install.",
          ],
          imagePlaceholderLabel: "Add macOS installer window screenshot",
        },
        {
          number: "2",
          title: "Handle security warnings",
          body: [],
          warningTitle: "Security Notice",
          warningBody: [
            "macOS will show security warnings since Exort is not signed with an Apple Developer certificate. Follow the appropriate solution below.",
          ],
          substeps: [
            {
              number: "2.1",
              title: 'If you see "Exort is damaged" error',
              body: [
                "This error occurs due to macOS Gatekeeper. Fix it using Terminal.",
                "Open Terminal (Applications → Utilities → Terminal).",
                "Navigate to Applications with the command below.",
                "Try opening Exort again after running it.",
              ],
              command: "cd /Applications\nxattr -c Exort.app",
              imagePlaceholderLabel:
                'Add "Exort is damaged" warning screenshot',
            },
            {
              number: "2.2",
              title: 'If you see "Developer cannot be verified" error',
              body: [
                "Click Cancel on the error dialog.",
                "Go to System Preferences → Security & Privacy → General.",
                "Click Open Anyway next to the blocked app message.",
                "Confirm by clicking Open in the next dialog.",
              ],
              imagePlaceholderLabel:
                'Add "Developer cannot be verified" screenshot',
            },
          ],
        },
        {
          number: "3",
          title: "Launch Exort",
          body: [
            "Once you’ve resolved any security warnings, you can launch Exort from your Applications folder or using Spotlight search.",
            "The app will now run normally without further security prompts.",
          ],
        },
        {
          number: "4",
          title: "You’re all set!",
          body: [
            "Once installed, launch Exort and start building amazing Arduino projects with AI assistance.",
          ],
        },
      ],
    },
    {
      name: "Windows",
      eyebrow: "For Windows devices",
      steps: [
        {
          number: "1",
          title: "Run the installer",
          body: [
            "Locate the downloaded Exort.Setup.0.2.2-x64.exe file and double-click to run it.",
          ],
          warningTitle: "Security Notice",
          warningBody: [
            "Windows will show security warnings since Exort is not signed with a trusted certificate.",
          ],
          imagePlaceholderLabel: "Add Windows installer warning screenshot",
        },
        {
          number: "2",
          title: "Bypass Windows security warnings",
          body: [
            "You may encounter two types of security warnings.",
            "Publisher Verification Dialog: Click Run to proceed with installation.",
            "Windows SmartScreen: Click Run anyway to bypass the protection warning.",
          ],
          imagePlaceholderLabel: "Add Windows SmartScreen warning screenshot",
        },
        {
          number: "3",
          title: "Complete installation",
          body: [
            "Follow the installation wizard prompts. Exort will be installed to your Programs folder and a desktop shortcut will be created.",
            "After installation, you can launch Exort from the Start menu, desktop shortcut, or by searching for Exort.",
          ],
        },
        {
          number: "4",
          title: "You’re all set!",
          body: [
            "Once installed, launch Exort and start building amazing Arduino projects with AI assistance.",
          ],
        },
      ],
    },
  ];
  let activeInstallationGuidePlatform = $state(
    installationGuidePlatforms[0]?.name ?? "",
  );

  let ctaSection: HTMLElement | null = null;
  let ctaIntroEl: HTMLElement | null = null;
  let downloadCardEls: HTMLElement[] = [];
  let localSetupPanelEl: HTMLElement | null = null;
  let localSetupHeaderEl: HTMLElement | null = null;
  let localSetupCommandEls: HTMLElement[] = [];
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;
  let copiedCommandKey = $state<string | null>(null);
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
          class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft"
        >
          Get Exort
        </span>
        <h2 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          Let&apos;s get Exort running on your setup
        </h2>
        <p
          class="mt-4 text-base leading-8 text-gruvbox-muted"
        >
          Choose your platform to download the right version
        </p>
      </div>

      <div
        class="mt-10 grid w-fit grid-cols-1 justify-items-center gap-5 sm:grid-cols-2"
      >
        {#each downloads as item, index}
          <article
            bind:this={downloadCardEls[index]}
            class="group relative h-56 w-56 overflow-hidden border border-[rgba(235,219,178,0.08)] shadow-[0_18px_44px_rgba(0,0,0,0.16)] [isolation:isolate]"
            style={`--download-card-color:${item.color};`}
            onmouseenter={() => void showDownloadOverlay(index)}
            onmouseleave={() => void hideDownloadOverlay(index)}
            onfocusin={() => void showDownloadOverlay(index)}
            onfocusout={() => void hideDownloadOverlay(index)}
          >
            <div
              class="absolute inset-0 z-[1] flex flex-col items-center justify-center bg-gruvbox-ink px-6 text-center"
            >
              <span
                class="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center text-[rgba(251,241,199,0.78)] [&>svg]:h-full [&>svg]:w-full"
                aria-hidden="true"
              >
                {@html item.icon}
              </span>
              <p
                class="mt-4 text-sm font-light text-gruvbox-text sm:text-base"
              >
                {item.label}
              </p>
            </div>

            <div
              class="download-card__overlay absolute inset-0 z-[2] overflow-hidden bg-[var(--download-card-color,#fe8019)] p-6 shadow-[inset_0_0_0_1px_rgba(251,241,199,0.14)] [will-change:transform]"
            >
              <span
                class="download-card__overlay-icon absolute left-[1.4rem] top-[1.4rem] inline-flex h-[2.1rem] w-[2.1rem] items-center justify-center text-gruvbox-text [will-change:transform,opacity] [&>svg]:h-full [&>svg]:w-full"
                aria-hidden="true"
              >
                {@html item.icon}
              </span>
              <div
                class="download-card__overlay-content absolute inset-0 flex h-full items-center justify-center p-6 text-center [will-change:transform,opacity]"
              >
                <p class="text-base font-medium text-gruvbox-ink sm:text-lg">
                  Exort {downloadVersion}
                </p>
              </div>
              <div
                class="download-card__overlay-actions absolute bottom-6 left-6 right-6 flex justify-center"
              >
                <a
                  href={item.href}
                  download
                  class="group/download-btn relative mt-5 inline-flex min-w-[8.25rem] items-center justify-center overflow-hidden rounded-full border border-[rgba(69,44,18,0.18)] bg-[rgba(251,241,199,0.92)] px-5 py-2 text-sm font-medium text-[#3c3836] shadow-[0_10px_24px_rgba(69,44,18,0.18)] transition-[box-shadow] duration-300 ease-out hover:shadow-[0_14px_28px_rgba(69,44,18,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(60,56,54,0.35)] motion-reduce:transition-none"
                >
                  <span
                    class="absolute inset-0 bg-[#3c3836] translate-x-full transition-transform duration-300 ease-out group-hover/download-btn:translate-x-0 group-focus-visible/download-btn:translate-x-0 motion-reduce:translate-x-full"
                    aria-hidden="true"
                  ></span>
                  <span
                    class="relative z-10 transition-colors duration-300 group-hover/download-btn:text-[rgba(251,241,199,0.92)] group-focus-visible/download-btn:text-[rgba(251,241,199,0.92)]"
                  >
                    Download
                  </span>
                </a>
              </div>
            </div>
          </article>
        {/each}
      </div>

      {#if showInstallationGuide}
        <div class="mt-16 w-full max-w-6xl text-left">
        <div class="mx-auto max-w-3xl text-center">
          <span
            class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft"
          >
            Installation Guide
          </span>
          <h3 class="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            Follow these steps to install Exort on your computer
          </h3>
          <p
            class="mt-4 text-base leading-8 text-gruvbox-muted"
          >
            Choose your platform below.
          </p>
        </div>

        <div class="mt-10">
          <div class="flex justify-center">
            <div
              class="inline-flex w-fit flex-wrap justify-center gap-3"
              role="tablist"
              aria-label="Installation guide platforms"
            >
              {#each installationGuidePlatforms as platform}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeInstallationGuidePlatform ===
                    platform.name}
                  class={`group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full px-6 py-3 text-sm font-medium backdrop-blur transition motion-reduce:transition-none ${
                    activeInstallationGuidePlatform === platform.name
                      ? "text-[#333231]"
                      : "border border-[rgba(235,219,178,0.12)] bg-gruvbox-ink hover:border-[rgba(235,219,178,0.2)]"
                  }`}
                  onclick={() => {
                    activeInstallationGuidePlatform = platform.name;
                  }}
                >
                  <span
                    class={`absolute inset-0 transition-transform duration-300 ease-out ${
                      platform.name === "macOS"
                        ? "bg-[#b8bb26]"
                        : "bg-gruvbox-orange"
                    } ${
                      activeInstallationGuidePlatform === platform.name
                        ? "translate-x-0"
                        : "translate-x-full group-hover:translate-x-0 motion-reduce:translate-x-full"
                    }`}
                    aria-hidden="true"
                  ></span>
                  <span
                    class={`relative z-10 transition-colors duration-300 ${
                      activeInstallationGuidePlatform === platform.name
                        ? "text-[#333231]"
                        : "text-gruvbox-muted group-hover:text-gruvbox-ink"
                    }`}
                  >
                    {platform.name}
                  </span>
                </button>
              {/each}
            </div>
          </div>

          {#each installationGuidePlatforms as platform}
            {#if activeInstallationGuidePlatform === platform.name}
              <div
                class="mx-auto mt-6 w-full max-w-4xl rounded-[1.5rem] border border-[rgba(235,219,178,0.08)] bg-gruvbox-ink p-5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.16)]"
                role="tabpanel"
              >
                <div
                  class="border-b items-center flex flex-col border-[rgba(235,219,178,0.1)] pb-5"
                >
                  <span
                    class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft"
                  >
                    {platform.eyebrow}
                  </span>
                  <h4 class="mt-2 text-xl font-semibold text-white sm:text-2xl">
                    {platform.name}
                  </h4>
                </div>

                <div class="mt-6 space-y-5">
                  {#each platform.steps as step}
                    <section
                      class="rounded-[1.1rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(29,32,33,0.28)] p-5"
                    >
                      <div class="flex items-start gap-4">
                        <div
                          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(60,56,54,0.42)] text-sm font-semibold text-gruvbox-accent"
                        >
                          {step.number}
                        </div>
                        <div class="min-w-0 flex-1">
                          <h5 class="text-lg font-medium text-white">
                            {step.title}
                          </h5>
                          <div
                            class={`mt-3 ${
                              step.imagePlaceholderLabel
                                ? "grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,1fr)] xl:items-start"
                                : ""
                            }`}
                          >
                            <div class="min-w-0">
                              <div
                                class="space-y-3 text-sm leading-7 text-gruvbox-muted"
                              >
                                {#each step.body as paragraph}
                                  <p>{paragraph}</p>
                                {/each}
                              </div>

                              {#if step.warningTitle}
                                <div
                                  class="mt-4 rounded-[0.85rem] border border-[rgba(235,219,178,0.08)] bg-gruvbox-ink p-4"
                                >
                                  <p
                                    class="text-xs font-semibold uppercase tracking-[0.18em] text-gruvbox-accent"
                                  >
                                    {step.warningTitle}
                                  </p>
                                  {#if step.warningBody}
                                    <div
                                      class="mt-2 space-y-2 text-sm leading-7 text-gruvbox-muted"
                                    >
                                      {#each step.warningBody as paragraph}
                                        <p>{paragraph}</p>
                                      {/each}
                                    </div>
                                  {/if}
                                </div>
                              {/if}

                              {#if step.command}
                                <div class="mt-4">
                                  <div class="relative">
                                    <pre
                                      class="m-0 overflow-x-auto rounded-[0.85rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(29,32,33,0.72)] px-[0.85rem] py-[0.72rem] pr-14 text-[0.88rem] leading-[1.45] text-gruvbox-fg0"
                                    ><code
                                        >{step.command}</code
                                      ></pre>
                                  </div>
                                </div>
                              {/if}
                            </div>

                            {#if step.imagePlaceholderLabel}
                              <div
                                class="flex min-h-[12rem] items-start xl:pt-1"
                              >
                                <div
                                  class="flex min-h-[12rem] w-full items-center justify-center rounded-[0.85rem] border border-dashed border-[rgba(235,219,178,0.14)] bg-[rgba(29,32,33,0.72)] px-5 py-8 text-center text-sm leading-6 text-gruvbox-muted"
                                >
                                  {step.imagePlaceholderLabel}
                                </div>
                              </div>
                            {/if}
                          </div>

                          {#if step.substeps}
                            <div class="mt-5 space-y-4">
                              {#each step.substeps as substep}
                                <div
                                  class="rounded-[0.95rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(60,56,54,0.24)] p-4"
                                >
                                  <div class="flex items-start gap-3">
                                    <div
                                      class="flex h-9 min-w-[3rem] shrink-0 items-center justify-center rounded-[0.75rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(29,32,33,0.72)] px-3 text-xs font-semibold text-gruvbox-accent-soft"
                                    >
                                      {substep.number}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                      <h6
                                        class="text-base font-medium text-white"
                                      >
                                        {substep.title}
                                      </h6>
                                      <div
                                        class={`mt-3 ${
                                          substep.imagePlaceholderLabel
                                            ? "grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(17rem,1fr)] xl:items-start"
                                            : ""
                                        }`}
                                      >
                                        <div class="min-w-0">
                                          <div
                                            class="space-y-3 text-sm leading-7 text-gruvbox-muted"
                                          >
                                            {#each substep.body as paragraph}
                                              <p>{paragraph}</p>
                                            {/each}
                                          </div>

                                          {#if substep.command}
                                            <div class="mt-4">
                                              <div class="relative">
                                                <pre
                                                  class="m-0 overflow-x-auto rounded-[0.85rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(29,32,33,0.72)] px-[0.85rem] py-[0.72rem] pr-14 text-[0.88rem] leading-[1.45] text-gruvbox-fg0"
                                                ><code
                                                    >{substep.command}</code
                                                  ></pre>
                                              </div>
                                            </div>
                                          {/if}
                                        </div>

                                        {#if substep.imagePlaceholderLabel}
                                          <div
                                            class="flex min-h-[11rem] items-start xl:pt-1"
                                          >
                                            <div
                                              class="flex min-h-[11rem] w-full items-center justify-center rounded-[0.85rem] border border-dashed border-[rgba(235,219,178,0.14)] bg-[rgba(29,32,33,0.72)] px-5 py-8 text-center text-sm leading-6 text-gruvbox-muted"
                                            >
                                              {substep.imagePlaceholderLabel}
                                            </div>
                                          </div>
                                        {/if}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </div>
                    </section>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
        </div>
      {/if}

      <div
        bind:this={localSetupPanelEl}
        class="mt-12 w-full max-w-4xl rounded-[1.5rem] border border-[rgba(235,219,178,0.08)] bg-gruvbox-ink p-5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.16)]"
      >
        <div
          bind:this={localSetupHeaderEl}
          class="flex flex-col gap-3 border-b border-[rgba(235,219,178,0.08)] pb-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <span
              class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft"
            >
              OR Run Locally
            </span>
            <h3 class="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Clone the repo and run Exort locally
            </h3>
          </div>

          <button
            type="button"
            class={`inline-flex h-9 w-9 items-center justify-center self-start bg-transparent p-2 transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none ${
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
          {#each localSetupCommands as item, index}
            <div
              bind:this={localSetupCommandEls[index]}
              class=""
            >
              <div class="relative">
                <pre
                  class={`m-0 overflow-x-auto rounded-[0.85rem] border border-[rgba(235,219,178,0.08)] bg-[rgba(29,32,33,0.72)] px-[0.85rem] py-[0.72rem] pr-14 text-[0.88rem] leading-[1.45] transition-colors duration-200 ${
                    copiedCommandKey === "copy-all"
                      ? localSetupCopiedTextClasses["copy-all"]
                      : copiedCommandKey === item.key
                        ? localSetupCopiedTextClasses[item.key]
                      : "text-gruvbox-fg0"
                  }`}
                ><code
                    >{item.command}</code
                  ></pre>
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
  </div>
</section>
