<script lang="ts">
  import { onMount } from "svelte";
  import FeaturesSection from "$lib/components/landing/FeaturesSection.svelte";
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
  import heroAppImage from "../../../../assets/app.png";
  import serialMonitorImage from "$lib/assets/features/serial-monitor.webp";
  import serialPlotterImage from "$lib/assets/features/serial-plotter.webp";
  import boardManagerImage from "$lib/assets/features/board-manager.webp";
  import providerImage from "$lib/assets/features/provider-connection.webp";
  import embeddedAgentImage from "$lib/assets/features/embedded-agent.webp";

  const githubIcon = `<svg viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399" transform="translate(-84 -7399)" fill="currentColor"></path></svg>`;

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "Download", href: "#try-exort" },
    {
      label: "View on GitHub",
      href: "https://github.com/Razz19/Exort",
      external: true,
    },
  ];

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

  const heroPulseSegments = [
    { top: "10%", left: "9%", width: "12rem", delay: "0.2s", duration: "7.4s" },
    { top: "22%", left: "65%", width: "9rem", delay: "1.8s", duration: "8.6s" },
    { top: "39%", left: "18%", width: "7rem", delay: "1.1s", duration: "6.9s" },
    {
      top: "53%",
      left: "72%",
      width: "10rem",
      delay: "2.8s",
      duration: "8.1s",
    },
    {
      top: "72%",
      left: "41%",
      width: "11rem",
      delay: "0.8s",
      duration: "7.8s",
    },
  ];

  let isNavScrolled = false;
  let prefersReducedMotion = false;
  let supportsHeroPointerEffect = false;
  let isHeroPointerActive = false;
  let heroPointerTargetX = 50;
  let heroPointerTargetY = 40;
  let heroPointerRenderX = 50;
  let heroPointerRenderY = 40;
  let heroPointerX = "50%";
  let heroPointerY = "40%";
  let heroSection: HTMLElement | null = null;
  let heroCopy: HTMLElement | null = null;
  let heroActions: HTMLElement | null = null;
  let heroScreenshotWrap: HTMLElement | null = null;
  let heroScreenshot: HTMLImageElement | null = null;
  let workflowSection: HTMLElement | null = null;

  let headlineLineEls: HTMLSpanElement[] = [];
  let workflowCardEls: HTMLElement[] = [];
  let workflowStepEls: HTMLElement[] = [];
  let heroTrailFrame = 0;
  let heroTrailRunning = false;
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;

  const ensureGsap = async () => {
    if (gsapRef) {
      return gsapRef;
    }

    const { gsap } = await import("gsap");
    gsapRef = gsap;
    return gsap;
  };

  const syncHeroTrail = () => {
    heroPointerRenderX += (heroPointerTargetX - heroPointerRenderX) * 0.18;
    heroPointerRenderY += (heroPointerTargetY - heroPointerRenderY) * 0.18;

    heroPointerX = `${heroPointerRenderX.toFixed(2)}%`;
    heroPointerY = `${heroPointerRenderY.toFixed(2)}%`;

    const deltaX = Math.abs(heroPointerTargetX - heroPointerRenderX);
    const deltaY = Math.abs(heroPointerTargetY - heroPointerRenderY);

    if (isHeroPointerActive || deltaX > 0.05 || deltaY > 0.05) {
      heroTrailFrame = window.requestAnimationFrame(syncHeroTrail);
      return;
    }

    heroTrailRunning = false;
    heroTrailFrame = 0;
  };

  const ensureHeroTrail = () => {
    if (heroTrailRunning || typeof window === "undefined") {
      return;
    }

    heroTrailRunning = true;
    heroTrailFrame = window.requestAnimationFrame(syncHeroTrail);
  };

  const handleHeroPointerMove = (event: MouseEvent) => {
    if (!heroSection || prefersReducedMotion || !supportsHeroPointerEffect) {
      return;
    }

    const rect = heroSection.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    heroPointerTargetX = x;
    heroPointerTargetY = y;
    isHeroPointerActive = true;
    ensureHeroTrail();
  };

  const handleHeroPointerEnter = (event: MouseEvent) => {
    if (!supportsHeroPointerEffect) {
      return;
    }

    handleHeroPointerMove(event);
  };

  const handleHeroPointerLeave = () => {
    isHeroPointerActive = false;
  };

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncNavState = () => {
      isNavScrolled = window.scrollY > 18;
    };

    syncNavState();
    window.addEventListener("scroll", syncNavState, { passive: true });

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    prefersReducedMotion = mediaQuery.matches;
    supportsHeroPointerEffect = pointerQuery.matches && !mediaQuery.matches;
    const syncReducedMotion = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      supportsHeroPointerEffect = pointerQuery.matches && !event.matches;
      if (event.matches || !pointerQuery.matches) {
        isHeroPointerActive = false;
        if (heroTrailFrame) {
          window.cancelAnimationFrame(heroTrailFrame);
          heroTrailFrame = 0;
        }
        heroTrailRunning = false;
      }
    };
    const syncPointerMode = (event: MediaQueryListEvent) => {
      supportsHeroPointerEffect = event.matches && !mediaQuery.matches;
      if (!event.matches) {
        isHeroPointerActive = false;
        if (heroTrailFrame) {
          window.cancelAnimationFrame(heroTrailFrame);
          heroTrailFrame = 0;
        }
        heroTrailRunning = false;
      }
    };
    mediaQuery.addEventListener("change", syncReducedMotion);
    pointerQuery.addEventListener("change", syncPointerMode);

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

        if (heroScreenshotWrap) {
          gsap.from(heroScreenshotWrap, {
            y: 24,
            opacity: 0,
            duration: 0.72,
            delay: 0.22,
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
      window.removeEventListener("scroll", syncNavState);
      mediaQuery.removeEventListener("change", syncReducedMotion);
      pointerQuery.removeEventListener("change", syncPointerMode);
      if (heroTrailFrame) {
        window.cancelAnimationFrame(heroTrailFrame);
      }
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
  <nav
    class:nav-scrolled={isNavScrolled}
    class="site-nav sticky top-0 z-30 bg-[color:var(--color-nav)]/80 backdrop-blur-2xl"
  >
    <div
      class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
    >
      <a href="#top" class="flex items-center gap-3">
        <img
          src="/exort-logo.png"
          alt="Exort"
          class="h-12 w-12 object-contain"
        />
        <span class="brand-wordmark pt-2 font-mono">Exort</span>
      </a>

      <div class="hidden items-center gap-8 md:flex">
        {#each navItems as item}
          <a
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            class="text-sm text-[color:var(--color-text-muted)] transition hover:text-white"
          >
            {item.label}
          </a>
        {/each}
      </div>

      <a
        href="https://github.com/Razz19/Exort"
        target="_blank"
        rel="noreferrer"
        aria-label="Exort GitHub repository"
        class="github-nav-link"
      >
        <span class="github-nav-link__icon" aria-hidden="true">
          {@html githubIcon}
        </span>
      </a>
    </div>
  </nav>

  <main id="top">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <section
      bind:this={heroSection}
      on:mouseenter={handleHeroPointerEnter}
      on:mousemove={handleHeroPointerMove}
      on:mouseleave={handleHeroPointerLeave}
      class="hero-section relative mx-auto max-w-7xl overflow-hidden px-6 pb-8 pt-12 lg:px-8 lg:pt-16"
    >
      <div
        class:hero-grid--active={isHeroPointerActive}
        class="hero-grid"
        style={`--wand-x:${heroPointerX};--wand-y:${heroPointerY};`}
        aria-hidden="true"
      >
        {#each heroPulseSegments as segment}
          <span
            class="hero-grid__pulse"
            style={`top:${segment.top};left:${segment.left};width:${segment.width};animation-delay:${segment.delay};animation-duration:${segment.duration};`}
          ></span>
        {/each}
        <span class="hero-grid__highlight"></span>
      </div>

      <div
        class="relative z-10 lg:grid lg:grid-cols-[minmax(0,1.28fr)_minmax(16rem,0.72fr)] lg:items-start lg:gap-8 xl:gap-12"
      >
        <div class="w-fit">
          <h1
            class="hero-title max-w-4xl text-3xl font-semibold sm:text-4xl lg:max-w-5xl lg:text-5xl"
          >
            <span class="block">
              <span
                bind:this={headlineLineEls[0]}
                class="hero-title__line block"
              >
                Open Source Coding Agent</span
              >
            </span>
            <span class="block">
              <span
                bind:this={headlineLineEls[1]}
                class="hero-title__line block"
              >
                For Embedded Development
              </span>
            </span>
          </h1>

          <p
            bind:this={heroCopy}
            class="mt-4 max-w-xl text-sm leading-6 text-[color:var(--color-text-muted)] sm:text-base"
          >
            Edit, compile, upload, and monitor devices from one desktop
            workspace.
          </p>

          <div
            bind:this={heroActions}
            class="mt-6 flex flex-col gap-4 sm:flex-row"
          >
            <a
              href="#try-exort"
              class="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(247,84,0,0.28)] transition hover:brightness-110"
            >
              Download Exort
            </a>
          </div>
        </div>
      </div>

      <div
        bind:this={heroScreenshotWrap}
        class="relative left-1/2 z-10 mt-6 w-[min(100%,72rem)] -translate-x-1/2 px-2 sm:mt-8 sm:px-0 lg:mt-10"
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

    <DownloadSection />
  </main>

  <footer class="bg-[rgba(60,56,54,0.42)]">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[color:var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8"
    >
      <p>
        Exort is a desktop app for embedded development with an OpenCode-powered
        AI coding agent.
      </p>
      <p>AGPL-3.0-only</p>
    </div>
  </footer>
</div>
