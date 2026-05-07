<script lang="ts">
  import { onMount } from "svelte";
  import FeaturesSection from "$lib/components/landing/FeaturesSection.svelte";
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
  import SiteNav from "$lib/components/landing/SiteNav.svelte";
  import heroAppImage from "../../../../assets/app.png";
  import serialMonitorImage from "$lib/assets/features/serial-monitor.webp";
  import serialPlotterImage from "$lib/assets/features/serial-plotter.webp";
  import boardManagerImage from "$lib/assets/features/board-manager.webp";
  import providerImage from "$lib/assets/features/provider-connection.webp";
  import embeddedAgentImage from "$lib/assets/features/embedded-agent.webp";

  const features = [
    {
      title: "Serial Monitor",
      description:
        "Read live device output. Ideal for boot logs, debug prints, and quick checks while you iterate.",
      image: serialMonitorImage,
    },
    {
      title: "Serial Plotter",
      description:
        "Plot streaming values as simple charts so sensor tuning, calibration, and runtime issues are easier to spot.",
      image: serialPlotterImage,
    },
    {
      title: "Board Manager",
      description:
        "Install and switch board platforms in one place, with support for Arduino, ESP32, RP2040, STM32, Teensy, and more.",
      image: boardManagerImage,
    },
    {
      title: "Provider Connection",
      description:
        "Bring your own AI provider setup and choose the models that match your workflow and budget.",
      image: providerImage,
    },
    {
      title: "Embedded Agent",
      description:
        "Let the agent inspect the project, edit code, and help with compile or upload.",
      image: embeddedAgentImage,
    },
  ];

  const workflowSteps = [
    "Open a workspace and let Exort inspect the project.",
    "Edit files in the Monaco-based editor with AI help close by.",
    "Select your board and serial port, then compile or upload.",
    "Use Serial Monitor or Plotter to validate behavior and iterate fast.",
  ];

  const heroHighlights = [
    "Bring your own model",
    "Compile, upload, debug",
    "1,000+ boards",
    "4 free models",
    "Built for Arduino",
  ];

  let prefersReducedMotion = false;
  let heroCopy: HTMLElement | null = null;
  let heroActions: HTMLElement | null = null;
  let heroHighlightsWrap: HTMLElement | null = null;
  let heroScreenshotWrap: HTMLElement | null = null;
  let heroScreenshot: HTMLImageElement | null = null;
  let workflowSection: HTMLElement | null = null;

  let headlineLineEls: HTMLSpanElement[] = [];
  let workflowCardEls: HTMLElement[] = [];
  let workflowStepEls: HTMLElement[] = [];
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
    prefersReducedMotion = mediaQuery.matches;
    const syncReducedMotion = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
    };
    mediaQuery.addEventListener("change", syncReducedMotion);

    let cleanupAnimations = () => {};

    const loadAnimations = async () => {
      const gsap = await ensureGsap();
      if (mediaQuery.matches) {
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
          class="flex max-w-4xl flex-col gap-[0.08em] overflow-visible font-heading text-3xl font-semibold leading-none tracking-[0.04em] sm:text-4xl lg:max-w-5xl lg:text-5xl"
        >
          <span class="block">
            <span
              bind:this={headlineLineEls[0]}
              class="block overflow-visible pb-[0.08em] leading-[1.08] text-gruvbox-fg0"
            >
              <span
                class="relative inline-block overflow-hidden whitespace-nowrap align-top drop-shadow-[0_0_14px_rgba(250,189,47,0.14)]"
              >
                <span class="block text-gruvbox-fg0">
                  Open Source
                </span>
                <span
                  class="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
                  aria-hidden="true"
                >
                  <span class="block whitespace-nowrap animate-hero-text-sweep-right text-gruvbox-orange">
                    Open Source
                  </span>
                </span>
                <span
                  class="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
                  aria-hidden="true"
                >
                  <span class="block whitespace-nowrap animate-hero-text-sweep-left text-gruvbox-green [animation-delay:3s]">
                    Open Source
                  </span>
                </span>
                <span
                  class="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
                  aria-hidden="true"
                >
                  <span class="block whitespace-nowrap animate-hero-text-sweep-right text-gruvbox-blue [animation-delay:6s]">
                    Open Source
                  </span>
                </span>
                <span
                  class="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
                  aria-hidden="true"
                >
                  <span class="block whitespace-nowrap animate-hero-text-sweep-left text-gruvbox-yellow [animation-delay:9s]">
                    Open Source
                  </span>
                </span>
              </span>
              <span class="inline-block text-gruvbox-fg0">Coding Agent</span
              ></span
            >
          </span>
          <span class="block">
            <span
              bind:this={headlineLineEls[1]}
              class="block overflow-visible pb-[0.08em] leading-[1.08] text-gruvbox-fg0 md:whitespace-nowrap"
            >
              For Embedded Development
            </span>
          </span>
        </h1>

        <p
          bind:this={heroCopy}
          class="mt-4 max-w-2xl text-sm leading-6 text-gruvbox-muted sm:text-base"
        >
          Edit, compile, upload, and monitor devices from one desktop workspace.
        </p>

        <div
          bind:this={heroActions}
          class="mt-6 flex w-full justify-center space-x-4"
        >
          <a
            href="/download"
            class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full border border-[rgba(235,219,178,0.12)] bg-gruvbox-ink px-6 py-3 text-sm font-medium backdrop-blur transition motion-reduce:transition-none"
          >
            <span
              class="absolute inset-0 translate-x-full bg-gruvbox-orange transition-transform duration-300 ease-out group-hover:translate-x-0"
              aria-hidden="true"
            ></span>
            <span
              class="relative z-10 transition-colors duration-300 group-hover:text-[#333231]"
            >
              Download Exort
            </span>
          </a>
          <a
            href="https://discord.com/invite/xmcmcWkr4V"
            class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full border border-[rgba(235,219,178,0.12)] bg-gruvbox-ink px-6 py-3 text-sm font-medium backdrop-blur transition motion-reduce:transition-none"
          >
            <span
              class="absolute inset-0 translate-x-full bg-gruvbox-blue transition-transform duration-300 ease-out group-hover:translate-x-0"
              aria-hidden="true"
            ></span>
            <span
              class="relative z-10 transition-colors duration-300 group-hover:text-[#333231]"
            >
              Join Our Discord
            </span>
          </a>
        </div>

        <div
          bind:this={heroHighlightsWrap}
          class="mt-8 flex w-full max-w-full flex-nowrap items-center justify-center whitespace-nowrap text-[clamp(0.62rem,1vw,0.82rem)] uppercase tracking-[clamp(0.04em,0.12vw,0.08em)] text-[color:color-mix(in_srgb,rgba(213,196,161,0.78)_72%,#282828_28%)]"
          aria-label="Key hero highlights"
        >
          {#each heroHighlights as highlight, index}
            <span class="inline-flex shrink-0 items-center whitespace-nowrap">
              {#if index > 0}
                <span class="mx-[0.7rem]" aria-hidden="true">&bull;</span>
              {/if}
              {highlight}
            </span>
          {/each}
        </div>
      </div>

      <div
        bind:this={heroScreenshotWrap}
        class="relative left-1/2 z-10 mt-0 w-[min(100%,72rem)] -translate-x-1/2 px-2 sm:mt-1 sm:px-0 lg:mt-2"
      >
        <img
          bind:this={heroScreenshot}
          src={heroAppImage}
          alt="Exort desktop application screenshot"
          class="block h-auto w-full object-contain object-top [will-change:transform]"
        />
      </div>
    </section>

    <FeaturesSection {features} />

    <DownloadSection showInstallationGuide={false} />
  </main>

  <footer class="bg-[rgba(60,56,54,0.42)]">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-gruvbox-muted sm:flex-row sm:items-center sm:justify-between lg:px-8"
    >
      <p>
        made with love by
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
