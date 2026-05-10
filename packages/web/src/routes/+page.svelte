<script lang="ts">
  import { onMount } from "svelte";
  type GsapTimeline = gsap.core.Timeline;
  import AppFrame from "$lib/components/landing/AppFrame.svelte";
  import FeaturesSection from "$lib/components/landing/FeaturesSection.svelte";
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
  import RunLocallySection from "$lib/components/landing/RunLocallySection.svelte";
  import SiteNav from "$lib/components/landing/SiteNav.svelte";
  const features = [
    {
      title: "Serial Monitor",
      description:
        "Read live device output. Ideal for boot logs, debug prints, and quick checks while you iterate.",
      video: "/features/Exort-monitor.mp4",
    },
    {
      title: "Serial Plotter",
      description:
        "Plot streaming values as simple charts so sensor tuning, calibration, and runtime issues are easier to spot.",
      video: "/features/Exort-plotter.mp4",
    },
    {
      title: "Board Manager",
      description:
        "Install and switch board platforms in one place, with support for Arduino, ESP32, RP2040, STM32, Teensy, and more.",
      video: "/features/Exort-board-manager.mp4",
    },
    {
      title: "Provider Connection",
      description:
        "Bring your own AI provider setup and choose the models that match your workflow and budget.",
      video: "/features/Exort-provider.mp4",
    },
    {
      title: "Embedded Agent",
      description:
        "Let the agent inspect the project, edit code, and help with compile or upload.",
      video: "/Exort.mp4",
    },
  ];

  const heroHighlights = [
    "Bring your own model",
    "Compile, upload, debug",
    "1,000+ boards",
    "4 free models",
    "Built for Arduino",
  ];

  const mobileHeroHighlightGroups = heroHighlights.map(
    (_, index, highlights) => [
      highlights[index],
      highlights[(index + 1) % highlights.length],
    ],
  );

  let prefersReducedMotion = false;
  let heroCopy: HTMLElement | null = null;
  let heroActions: HTMLElement | null = null;
  let heroHighlightsWrap: HTMLElement | null = null;
  let heroScreenshotWrap: HTMLElement | null = null;
  let heroScreenshot: HTMLVideoElement | null = null;
  let workflowSection: HTMLElement | null = null;

  let headlineLineEls: HTMLSpanElement[] = [];
  let workflowCardEls: HTMLElement[] = [];
  let workflowStepEls: HTMLElement[] = [];
  let mobileHeroHighlightRow: HTMLDivElement | null = null;
  let mobileHeroHighlightFirst: HTMLParagraphElement | null = null;
  let mobileHeroHighlightSecond: HTMLParagraphElement | null = null;
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;

  const ensureGsap = async () => {
    if (gsapRef) {
      return gsapRef;
    }

    const { gsap } = await import("gsap");
    gsapRef = gsap;
    return gsap;
  };

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileViewportQuery = window.matchMedia("(max-width: 639px)");
    prefersReducedMotion = mediaQuery.matches;
    let mobileHighlightTimeline: GsapTimeline | null = null;
    let mobileHeroHighlightIndex = 0;

    const applyMobileHeroHighlightGroup = (groupIndex: number) => {
      if (!mobileHeroHighlightFirst || !mobileHeroHighlightSecond) {
        return;
      }

      const [firstHighlight, secondHighlight] =
        mobileHeroHighlightGroups[groupIndex];
      mobileHeroHighlightFirst.textContent = firstHighlight;
      mobileHeroHighlightSecond.textContent = secondHighlight;
    };

    const syncReducedMotion = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
    };
    mediaQuery.addEventListener("change", syncReducedMotion);
    applyMobileHeroHighlightGroup(mobileHeroHighlightIndex);

    let cleanupAnimations = () => {};

    const loadAnimations = async () => {
      const gsap = await ensureGsap();

      const syncMobileHighlightAnimation = () => {
        mobileHighlightTimeline?.kill();
        mobileHighlightTimeline = null;

        if (!mobileHeroHighlightRow) {
          return;
        }

        if (mediaQuery.matches || !mobileViewportQuery.matches) {
          gsap.set(mobileHeroHighlightRow, {
            clearProps: "transform,opacity",
          });
          applyMobileHeroHighlightGroup(mobileHeroHighlightIndex);
          return;
        }

        gsap.set(mobileHeroHighlightRow, {
          transformPerspective: 900,
          transformOrigin: "50% 50%",
          transformStyle: "preserve-3d",
        });

        mobileHighlightTimeline = gsap.timeline({
          repeat: -1,
          repeatDelay: 1.35,
        });

        mobileHighlightTimeline
          .to(mobileHeroHighlightRow, {
            duration: 0.36,
            rotationX: -90,
            y: -8,
            opacity: 0.78,
            ease: "power2.in",
          })
          .call(() => {
            mobileHeroHighlightIndex =
              (mobileHeroHighlightIndex + 1) % mobileHeroHighlightGroups.length;
            applyMobileHeroHighlightGroup(mobileHeroHighlightIndex);
            gsap.set(mobileHeroHighlightRow, {
              rotationX: 90,
              y: 8,
              opacity: 0.78,
            });
          })
          .to(mobileHeroHighlightRow, {
            duration: 0.42,
            rotationX: 0,
            y: 0,
            opacity: 1,
            ease: "back.out(1.1)",
          });
      };

      const syncAnimationPreferences = () => {
        syncMobileHighlightAnimation();
      };

      mediaQuery.addEventListener("change", syncAnimationPreferences);
      mobileViewportQuery.addEventListener("change", syncAnimationPreferences);
      syncMobileHighlightAnimation();

      if (mediaQuery.matches) {
        cleanupAnimations = () => {
          mediaQuery.removeEventListener("change", syncAnimationPreferences);
          mobileViewportQuery.removeEventListener(
            "change",
            syncAnimationPreferences,
          );
          mobileHighlightTimeline?.kill();
        };
        return;
      }

      const { ScrollTrigger } = await import("gsap/ScrollTrigger");

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.set(
          [
            ...headlineLineEls,
            heroCopy,
            heroActions,
            heroHighlightsWrap,
            heroScreenshotWrap,
            ...workflowCardEls,
            ...workflowStepEls,
          ].filter(Boolean),
          {
            willChange: "transform, opacity",
          },
        );

        gsap.from(headlineLineEls, {
          x: -36,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.12,
        });

        if (heroCopy) {
          gsap.from(heroCopy, {
            x: -24,
            opacity: 0,
            duration: 0.8,
            delay: 0.18,
            ease: "power2.out",
          });
        }

        if (heroActions) {
          gsap.from(heroActions, {
            x: -20,
            opacity: 0,
            duration: 0.82,
            delay: 0.3,
            ease: "power2.out",
          });
        }

        if (heroHighlightsWrap) {
          gsap.from(heroHighlightsWrap, {
            y: 18,
            opacity: 0,
            duration: 0.76,
            delay: 0.38,
            ease: "power2.out",
          });
        }

        if (heroScreenshotWrap) {
          gsap.from(heroScreenshotWrap, {
            y: 24,
            opacity: 0,
            duration: 0.72,
            delay: 0.48,
            ease: "power2.out",
          });
        }

        if (workflowCardEls.length) {
          gsap.from(workflowCardEls, {
            y: 26,
            opacity: 0,
            duration: 0.85,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: workflowSection,
              start: "top 72%",
              once: true,
            },
          });
        }

        workflowStepEls.forEach((stepEl) => {
          gsap.from(stepEl, {
            y: 22,
            opacity: 0,
            duration: 0.72,
            ease: "power2.out",
            scrollTrigger: {
              trigger: stepEl,
              start: "top 82%",
              once: true,
            },
          });

          ScrollTrigger.create({
            trigger: stepEl,
            start: "top 75%",
            end: "bottom 45%",
            onEnter: () => stepEl.classList.add("is-active"),
            onLeave: () => stepEl.classList.remove("is-active"),
            onEnterBack: () => stepEl.classList.add("is-active"),
            onLeaveBack: () => stepEl.classList.remove("is-active"),
          });
        });
      });

      cleanupAnimations = () => {
        mediaQuery.removeEventListener("change", syncAnimationPreferences);
        mobileViewportQuery.removeEventListener(
          "change",
          syncAnimationPreferences,
        );
        mobileHighlightTimeline?.kill();
        ctx.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    };

    void loadAnimations();

    return () => {
      mediaQuery.removeEventListener("change", syncReducedMotion);
      cleanupAnimations();
    };
  });
</script>

<svelte:head>
  <title>Exort</title>
  <meta
    name="description"
    content="Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent for code, compile, upload, and device interaction in one place."
  />
</svelte:head>

<div class="relative isolate min-h-screen bg-gruvbox-bg text-gruvbox-text">
  <SiteNav />

  <main id="top">
    <section
      class="relative mx-auto max-w-7xl overflow-hidden px-6 pb-8 pt-12 lg:px-8 lg:pt-16"
    >
      <div
        class="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <h1
          class="flex max-w-4xl flex-col gap-[0.08em] overflow-visible font-heading text-md font-semibold leading-none tracking-[0.04em] sm:text-4xl lg:max-w-5xl lg:text-4xl"
        >
          <span
            bind:this={headlineLineEls[0]}
            class="block overflow-visible pb-[0.08em] leading-[1.08] text-gruvbox-fg0"
          >
            <span
              class="relative inline-block overflow-visible whitespace-nowrap align-top pb-[0.08em] leading-[1.08] drop-shadow-[0_0_14px_rgba(250,189,47,0.14)]"
            >
              <span class="block text-gruvbox-fg0"> Open Source </span>
            </span>
            <span
              class="relative inline-block overflow-visible whitespace-nowrap align-top pb-[0.08em] leading-[1.08] drop-shadow-[0_0_14px_rgba(250,189,47,0.14)]"
            >
              <span
                class="inline-grid overflow-visible whitespace-nowrap pb-[0.1em] leading-[1.08]"
              >
                <span
                  class="col-start-1 row-start-1 whitespace-nowrap text-transparent"
                >
                  Coding Agent
                </span>
                <span
                  class="pointer-events-none col-start-1 row-start-1 whitespace-nowrap text-gruvbox-fg0"
                >
                  Coding Agent
                </span>
                <span
                  class="pointer-events-none col-start-1 row-start-1 whitespace-nowrap pb-[0.12em] -mb-[0.12em] text-gruvbox-orange [clip-path:inset(0_100%_0_0)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-right"
                  aria-hidden="true"
                >
                  Coding Agent
                </span>
                <span
                  class="pointer-events-none col-start-1 row-start-1 whitespace-nowrap pb-[0.12em] -mb-[0.12em] text-gruvbox-green [clip-path:inset(0_0_0_100%)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-left [animation-delay:1.5s]"
                  aria-hidden="true"
                >
                  Coding Agent
                </span>
                <span
                  class="pointer-events-none col-start-1 row-start-1 whitespace-nowrap pb-[0.12em] -mb-[0.12em] text-gruvbox-blue [clip-path:inset(0_100%_0_0)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-right [animation-delay:3s]"
                  aria-hidden="true"
                >
                  Coding Agent
                </span>
                <span
                  class="pointer-events-none col-start-1 row-start-1 whitespace-nowrap pb-[0.12em] -mb-[0.12em] text-gruvbox-yellow [clip-path:inset(0_0_0_100%)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-left [animation-delay:4.5s]"
                  aria-hidden="true"
                >
                  Coding Agent
                </span>
              </span>
            </span>
          </span>
          <span
            bind:this={headlineLineEls[1]}
            class="block overflow-visible pb-[0.08em] leading-[1.08] text-gruvbox-fg0 md:whitespace-nowrap"
          >
            For Embedded Development
          </span>
        </h1>

        <div
          bind:this={heroHighlightsWrap}
          class="mt-4 w-full max-w-full uppercase text-gruvbox-text/50 sm:mt-8"
          aria-label="Key hero highlights"
        >
          <div
            class="flex min-h-[2rem] items-center justify-center text-center sm:hidden"
          >
            <div
              bind:this={mobileHeroHighlightRow}
              class="flex items-center justify-center whitespace-nowrap"
            >
              <p
                bind:this={mobileHeroHighlightFirst}
                class="text-xs tracking-[0.08em] text-gruvbox-text/60"
              >
                {mobileHeroHighlightGroups[0][0]}
              </p>
              <span
                class="mx-[0.45rem] text-sm font-bold text-gruvbox-accent/70"
                aria-hidden="true">&bull;</span
              >
              <p
                bind:this={mobileHeroHighlightSecond}
                class="text-xs tracking-[0.08em] text-gruvbox-text/60"
              >
                {mobileHeroHighlightGroups[0][1]}
              </p>
            </div>
          </div>

          <div
            class="hidden w-full max-w-full items-center justify-center whitespace-nowrap sm:flex"
          >
            {#each heroHighlights as highlight, index}
              <span
                class="inline-flex shrink-0 items-center whitespace-nowrap text-sm"
              >
                {#if index > 0}
                  <span
                    class="mx-[0.6rem] text-lg font-bold text-gruvbox-accent/70"
                    aria-hidden="true">&bull;</span
                  >
                {/if}
                {highlight}
              </span>
            {/each}
          </div>
        </div>
        <!-- <p
          bind:this={heroCopy}
          class="mt-4 max-w-2xl text-sm leading-6 text-gruvbox-muted sm:text-base"
        >
          Edit, compile, upload, and monitor devices from one desktop workspace.
        </p> -->

        <div
          bind:this={heroActions}
          class="mt-6 flex w-full justify-center space-x-4"
        >
          <a
            href="/download"
            class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full bg-gruvbox-ink px-6 py-3 text-sm font-medium backdrop-blur transition motion-reduce:transition-none"
          >
            <span
              class="absolute inset-0 translate-x-full bg-gruvbox-orange transition-transform duration-300 ease-out group-hover:translate-x-0"
              aria-hidden="true"
            ></span>
            <span
              class="relative z-10 transition-colors duration-300 group-hover:text-gruvbox-ink"
            >
              Download Exort
            </span>
          </a>
          <a
            href="https://discord.com/invite/xmcmcWkr4V"
            class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full bg-gruvbox-ink px-6 py-3 text-sm font-medium backdrop-blur transition motion-reduce:transition-none"
          >
            <span
              class="absolute inset-0 translate-x-full bg-gruvbox-blue transition-transform duration-300 ease-out group-hover:translate-x-0"
              aria-hidden="true"
            ></span>
            <span
              class="relative z-10 transition-colors duration-300 group-hover:text-gruvbox-ink"
            >
              Join Our Discord
            </span>
          </a>
        </div>
      </div>

      <div
        bind:this={heroScreenshotWrap}
        class="relative left-1/2 z-10 mt-0 max-w-4xl -translate-x-1/2 px-2 sm:mt-1 sm:px-0 lg:mt-2"
      >
        <div class="relative mt-6 px-1 pb-4 sm:mt-8 sm:px-3 sm:pb-6">
          <AppFrame contentClass="p-2 sm:p-3">
            <div
              class="relative overflow-hidden"
              style="border-radius: 10px !important;"
            >
              <video
                bind:this={heroScreenshot}
                src="/Exort.mp4"
                autoplay
                muted
                loop
                playsinline
                aria-label="Exort desktop application walkthrough video"
                class="relative z-10 block h-auto w-full object-contain object-top [will-change:transform]"
                style="border-radius: 10px !important;"
              >
                <track kind="captions" />
              </video>
            </div>
          </AppFrame>
        </div>
      </div>
    </section>

    <FeaturesSection {features} />
    <RunLocallySection />

    <!-- <DownloadSection showInstallationGuide={false} />
     -->
  </main>

  <footer class="bg-gruvbox-surface">
    <div
      class="mx-auto flex justify-between max-w-7xl gap-4 px-6 py-6 sm:py-8 text-sm text-gruvbox-muted sm:flex-row sm:items-center sm:justify-between lg:px-8"
    >
      <p>
        Made with love by
        <a
          href="https://github.com/Razz19"
          target="_blank"
          rel="noreferrer"
          class="text-gruvbox-text transition-colors duration-200 hover:text-gruvbox-accent motion-reduce:transition-none"
        >
          Razz19
        </a>
      </p>
      <p>AGPL-3.0-only</p>
    </div>
  </footer>
</div>
