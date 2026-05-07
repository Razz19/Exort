<script lang="ts">
  import { onMount } from "svelte";
  import FeaturesSection from "$lib/components/landing/FeaturesSection.svelte";
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

<div
  class="site-shell min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
>
  <SiteNav />

  <main id="top">
    <section
      class="hero-section relative mx-auto max-w-7xl overflow-hidden px-6 pb-8 pt-12 lg:px-8 lg:pt-16"
    >
      <div
        class="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <h1
          class="hero-title max-w-4xl text-3xl font-semibold sm:text-4xl lg:max-w-5xl lg:text-5xl"
        >
          <span class="block">
            <span bind:this={headlineLineEls[0]} class="hero-title__line block">
              <span class="hero-title__accent">Open Source</span>
              <span class="hero-title__plain">Coding Agent</span></span
            >
          </span>
          <span class="block">
            <span
              bind:this={headlineLineEls[1]}
              class="hero-title__line block md:whitespace-nowrap"
            >
              For Embedded Development
            </span>
          </span>
        </h1>

        <p
          bind:this={heroCopy}
          class="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--color-text-muted)] sm:text-base"
        >
          Edit, compile, upload, and monitor devices from one desktop workspace.
        </p>

        <div
          bind:this={heroActions}
          class="mt-6 flex w-full justify-center"
        >
          <a
            href="/download"
            class="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(247,84,0,0.28)] transition hover:brightness-110"
          >
            Download Exort
          </a>
        </div>

        <div
          bind:this={heroHighlightsWrap}
          class="hero-highlights mt-8"
          aria-label="Key hero highlights"
        >
          {#each heroHighlights as highlight}
            <span class="hero-highlights__item">{highlight}</span>
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
          class="hero-screenshot h-auto w-full object-contain object-top"
        />
      </div>
    </section>

    <FeaturesSection {features} />
  </main>

  <footer class="bg-[rgba(60,56,54,0.42)]">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[color:var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8"
    >
      <p>
        made with love by
        <a
          href="https://github.com/Razz19"
          target="_blank"
          rel="noreferrer"
          class="text-[color:var(--color-text)] transition hover:text-[color:var(--color-accent)]"
        >
          Razz19
        </a>
      </p>
      <p>AGPL-3.0-only</p>
    </div>
  </footer>
</div>
