<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import heroAppImage from "../../../../assets/app.png";
  import serialMonitorImage from "../../../../assets/features/serial-monitor.png";
  import serialPlotterImage from "../../../../assets/features/serial-plotter.png";
  import boardManagerImage from "../../../../assets/features/board-manager.png";
  import providerImage from "../../../../assets/features/provider-connection.png";
  import embeddedAgentImage from "../../../../assets/features/embedded-agent.png";

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "Download", href: "#try-exort" },
  ];

  const headlineLines = [
    "Embedded development",
    "with AI, code,",
    "and hardware tools in one app.",
  ];

  const featureRotationDelay = 4000;
  const manualFeaturePause = 8000;

  const features = [
    {
      title: "Serial Monitor",
      description:
        "Watch live device output in a dedicated pane while you debug firmware behavior, inspect logs, and keep iteration focused inside Exort.",
      image: serialMonitorImage,
    },
    {
      title: "Serial Plotter",
      description:
        "Turn streaming values into readable charts so sensor tuning, calibration, and runtime validation happen without leaving the workspace.",
      image: serialPlotterImage,
    },
    {
      title: "Board Manager",
      description:
        "Manage board platforms from the same app and keep toolchains ready for Arduino, ESP32, RP2040, STM32, Teensy, and more.",
      image: boardManagerImage,
    },
    {
      title: "Provider Connection",
      description:
        "Connect your preferred AI provider setup and route workflows through the models that fit your embedded development stack.",
      image: providerImage,
    },
    {
      title: "Embedded Agent",
      description:
        "Use the embedded-focused agent to inspect the workspace, edit code, and assist with compile or upload loops from the same environment.",
      image: embeddedAgentImage,
    },
  ];

  const workflowSteps = [
    "Open a workspace and let Exort inspect the project.",
    "Edit files in the Monaco-based editor with AI help close by.",
    "Select your board and serial port, then compile or upload.",
    "Use Serial Monitor or Plotter to validate behavior and iterate fast.",
  ];

  const appleIcon = `<svg viewBox="-1.5 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M57.5708873,7282.19296 C58.2999598,7281.34797 58.7914012,7280.17098 58.6569121,7279 C57.6062792,7279.04 56.3352055,7279.67099 55.5818643,7280.51498 C54.905374,7281.26397 54.3148354,7282.46095 54.4735932,7283.60894 C55.6455696,7283.69593 56.8418148,7283.03894 57.5708873,7282.19296 M60.1989864,7289.62485 C60.2283111,7292.65181 62.9696641,7293.65879 63,7293.67179 C62.9777537,7293.74279 62.562152,7295.10677 61.5560117,7296.51675 C60.6853718,7297.73474 59.7823735,7298.94772 58.3596204,7298.97372 C56.9621472,7298.99872 56.5121648,7298.17973 54.9134635,7298.17973 C53.3157735,7298.17973 52.8162425,7298.94772 51.4935978,7298.99872 C50.1203933,7299.04772 49.0738052,7297.68074 48.197098,7296.46676 C46.4032359,7293.98379 45.0330649,7289.44985 46.8734421,7286.3899 C47.7875635,7284.87092 49.4206455,7283.90793 51.1942837,7283.88393 C52.5422083,7283.85893 53.8153044,7284.75292 54.6394294,7284.75292 C55.4635543,7284.75292 57.0106846,7283.67793 58.6366882,7283.83593 C59.3172232,7283.86293 61.2283842,7284.09893 62.4549652,7285.8199 C62.355868,7285.8789 60.1747177,7287.09489 60.1989864,7289.62485" transform="translate(-46 -7279)" fill="currentColor"></path></svg>`;
  const windowsIcon = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13.1458647,7289.43426 C13.1508772,7291.43316 13.1568922,7294.82929 13.1619048,7297.46884 C16.7759398,7297.95757 20.3899749,7298.4613 23.997995,7299 C23.997995,7295.84873 24.002005,7292.71146 23.997995,7289.71311 C20.3809524,7289.71311 16.7649123,7289.43426 13.1458647,7289.43426 M4,7289.43526 L4,7296.22153 C6.72581454,7296.58933 9.45162907,7296.94113 12.1724311,7297.34291 C12.1774436,7294.71736 12.1704261,7292.0908 12.1704261,7289.46524 C9.44661654,7289.47024 6.72380952,7289.42627 4,7289.43526 M4,7281.84344 L4,7288.61071 C6.72581454,7288.61771 9.45162907,7288.57673 12.1774436,7288.57973 C12.1754386,7285.96017 12.1754386,7283.34361 12.1724311,7280.72405 C9.44461153,7281.06486 6.71679198,7281.42567 4,7281.84344 M24,7288.47179 C20.3879699,7288.48578 16.7759398,7288.54075 13.1619048,7288.55175 C13.1598997,7285.88921 13.1598997,7283.22967 13.1619048,7280.56914 C16.7689223,7280.01844 20.3839599,7279.50072 23.997995,7279 C24,7282.15826 23.997995,7285.31353 24,7288.47179" transform="translate(-4 -7279)" fill="currentColor"></path></svg>`;
  const linuxIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14.62,8.35c-.42.28-1.75,1-1.95,1.19a.82.82,0,0,1-1.14,0c-.2-.16-1.53-.92-1.95-1.19s-.45-.7.08-.92a6.16,6.16,0,0,1,4.91,0c.49.21.51.6,0,.9m7.22,7.28A19.09,19.09,0,0,0,18,10a4.31,4.31,0,0,1-1.06-1.88c-.1-.33-.17-.67-.24-1A11.32,11.32,0,0,0,16,4.47,4.06,4.06,0,0,0,12.16,2,4.2,4.2,0,0,0,8.21,4.4a5.9,5.9,0,0,0-.46,1.34c-.17.76-.32,1.55-.5,2.32a3.38,3.38,0,0,1-1,1.71,19.53,19.53,0,0,0-3.88,5.35A6.09,6.09,0,0,0,2,16c-.19.66.29,1.12,1,1,.44-.09.88-.18,1.3-.31s.57,0,.67.35a6.73,6.73,0,0,0,4.24,4.5c4.12,1.56,8.93-.66,10-4.58.07-.27.17-.37.47-.27.46.14.93.24,1.4.35a.72.72,0,0,0,.92-.64,1.44,1.44,0,0,0-.16-.73" fill="currentColor"></path></svg>`;

  const downloads = [
    {
      label: "macOS Apple Silicon",
      file: "Exort-0.1.0-mac-arm64.dmg",
      href: "/downloads/Exort-0.1.0-mac-arm64.dmg",
      icon: appleIcon,
    },
    {
      label: "macOS Intel",
      file: "Exort-0.1.0-mac-x64.dmg",
      href: "/downloads/Exort-0.1.0-mac-x64.dmg",
      icon: appleIcon,
    },
    {
      label: "Windows",
      file: "Exort-0.1.0-win-x64.exe",
      href: "/downloads/Exort-0.1.0-win-x64.exe",
      icon: windowsIcon,
    },
    {
      label: "Linux",
      file: "Exort-0.1.0-linux-x86_64.AppImage",
      href: "/downloads/Exort-0.1.0-linux-x86_64.AppImage",
      icon: linuxIcon,
    },
  ];
  const downloadVersion = "0.1.0";

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
  let featuresSection: HTMLElement | null = null;
  let featuresIntroEl: HTMLElement | null = null;
  let featureSidebarEl: HTMLElement | null = null;
  let featurePanelEl: HTMLElement | null = null;
  let workflowSection: HTMLElement | null = null;
  let ctaSection: HTMLElement | null = null;

  let headlineLineEls: HTMLSpanElement[] = [];
  let workflowCardEls: HTMLElement[] = [];
  let workflowStepEls: HTMLElement[] = [];
  let heroTrailFrame = 0;
  let heroTrailRunning = false;
  let activeFeatureIndex = 0;
  let featureRotationTimeout: number | null = null;
  let featureRotationResumeAt = 0;
  let downloadCardEls: HTMLElement[] = [];
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;
  let downloadHoverTimelines: Array<{
    play: () => void;
    reverse: () => void;
    kill: () => void;
  } | null> = [];

  const clearFeatureRotation = () => {
    if (featureRotationTimeout) {
      window.clearTimeout(featureRotationTimeout);
      featureRotationTimeout = null;
    }
  };

  const scheduleFeatureRotation = (delay = featureRotationDelay) => {
    if (typeof window === "undefined") {
      return;
    }

    clearFeatureRotation();
    featureRotationTimeout = window.setTimeout(() => {
      const pauseRemaining = featureRotationResumeAt - Date.now();
      if (pauseRemaining > 0) {
        scheduleFeatureRotation(pauseRemaining);
        return;
      }

      activeFeatureIndex = (activeFeatureIndex + 1) % features.length;
      scheduleFeatureRotation(featureRotationDelay);
    }, delay);
  };

  const setActiveFeature = (index: number, pauseAuto = false) => {
    activeFeatureIndex = index;

    if (typeof window === "undefined") {
      return;
    }

    if (pauseAuto) {
      featureRotationResumeAt = Date.now() + manualFeaturePause;
      scheduleFeatureRotation(manualFeaturePause);
      return;
    }

    scheduleFeatureRotation(featureRotationDelay);
  };

  const showPreviousFeature = () => {
    setActiveFeature(
      (activeFeatureIndex - 1 + features.length) % features.length,
      true,
    );
  };

  const showNextFeature = () => {
    setActiveFeature((activeFeatureIndex + 1) % features.length, true);
  };

  const preloadFeatureImages = () => {
    if (typeof window === "undefined") {
      return;
    }

    features.forEach((feature) => {
      if (!feature.image) {
        return;
      }

      const image = new Image();
      image.src = feature.image;
    });
  };

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
            ...headlineLineEls,
            heroCopy,
            heroActions,
            heroScreenshotWrap,
            featuresIntroEl,
            featureSidebarEl,
            featurePanelEl,
            ...workflowCardEls,
            ...workflowStepEls,
            ctaSection,
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

        if (
          featuresSection &&
          (featuresIntroEl || featureSidebarEl || featurePanelEl)
        ) {
          const featuresTimeline = gsap.timeline({
            defaults: {
              duration: 0.75,
              ease: "power3.out",
            },
            scrollTrigger: {
              trigger: featuresSection,
              start: "top 70%",
              once: true,
              invalidateOnRefresh: true,
            },
          });

          if (featuresIntroEl) {
            featuresTimeline.from(
              featuresIntroEl,
              {
                x: -32,
                opacity: 0,
              },
              0,
            );
          }

          if (featurePanelEl) {
            featuresTimeline.from(
              featurePanelEl,
              {
                x: -48,
                opacity: 0,
              },
              0.08,
            );
          }

          if (featureSidebarEl) {
            featuresTimeline.from(
              featureSidebarEl,
              {
                x: 40,
                opacity: 0,
              },
              0.2,
            );
          }
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

        if (ctaSection) {
          gsap.from(ctaSection, {
            y: 26,
            opacity: 0,
            duration: 0.88,
            ease: "power2.out",
            scrollTrigger: {
              trigger: ctaSection,
              start: "top 78%",
              once: true,
            },
          });
        }
      });

      cleanupAnimations = () => {
        ctx.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };
    };

    scheduleFeatureRotation(featureRotationDelay);
    preloadFeatureImages();
    void loadAnimations();

    return () => {
      window.removeEventListener("scroll", syncNavState);
      mediaQuery.removeEventListener("change", syncReducedMotion);
      pointerQuery.removeEventListener("change", syncPointerMode);
      if (heroTrailFrame) {
        window.cancelAnimationFrame(heroTrailFrame);
      }
      clearFeatureRotation();
      downloadHoverTimelines.forEach((timeline) => timeline?.kill());
      downloadHoverTimelines = [];
      cleanupAnimations();
    };
  });
</script>

<svelte:head>
  <title>Exort | Embedded Development In One Workspace</title>
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
          class="h-11 w-11 object-contain"
        />
        <span
          class="text-base font-medium tracking-[0.02em] text-white sm:text-lg"
          >Exort</span
        >
      </a>

      <div class="hidden items-center gap-8 md:flex">
        {#each navItems as item}
          <a
            href={item.href}
            class="text-sm text-[color:var(--color-text-muted)] transition hover:text-white"
          >
            {item.label}
          </a>
        {/each}
      </div>

      <a
        href="#try-exort"
        class="rounded-full bg-[color:var(--color-surface-strong)] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:bg-[color:var(--color-surface)]"
      >
        Download
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
            class="max-w-4xl text-3xl font-semibold leading-[1.02] text-white sm:text-4xl lg:max-w-5xl lg:text-5xl"
          >
            {#each headlineLines as line, index}
              <span class="block overflow-hidden">
                <span bind:this={headlineLineEls[index]} class="block"
                  >{line}</span
                >
              </span>
            {/each}
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
            <a
              href="#features"
              class="inline-flex items-center justify-center rounded-full bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(0,0,0,0.14)] transition hover:bg-[color:var(--color-surface-strong)]"
            >
              Explore Features
            </a>
          </div>
        </div>

        <!-- <div
          aria-hidden="true"
          class="pointer-events-none mt-6 hidden justify-end lg:mt-0 lg:flex"
        >
          <div class="relative w-full max-w-[17rem] xl:max-w-[20rem]">
            <img
              src="/2d-fire.gif"
              alt=""
              class="absolute inset-0 z-0 h-full w-full object-contain opacity-80"
            />
            <img
              src="/exort-transparent-hair.png"
              alt=""
              class="relative z-10 w-full"
            />
          </div>
        </div> -->
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

    <section
      id="features"
      bind:this={featuresSection}
      class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24"
    >
      <div bind:this={featuresIntroEl} class="max-w-2xl">
        <span
          class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]"
        >
          Core Features
        </span>
      </div>

      <div class="feature-showcase mt-12">
        <div
          class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8"
        >
          <div bind:this={featurePanelEl} class="min-w-0">
            <div class="grid gap-6">
              <div class="relative">
                <div class="feature-image-shell relative overflow-hidden">
                  <div class="feature-stage">
                    {#key activeFeatureIndex}
                      <div
                        class="feature-stage__layer"
                        in:fade={{ duration: prefersReducedMotion ? 0 : 180 }}
                        out:fade={{ duration: prefersReducedMotion ? 0 : 140 }}
                      >
                        {#if features[activeFeatureIndex].image}
                          <img
                            src={features[activeFeatureIndex].image}
                            alt={`${features[activeFeatureIndex].title} screenshot`}
                            class="feature-image"
                          />
                        {:else}
                          <div
                            class="feature-image-placeholder flex h-full w-full items-center justify-center"
                          >
                            <span
                              class="px-6 text-center text-sm uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]"
                            >
                              Image Coming Soon
                            </span>
                          </div>
                        {/if}
                      </div>
                    {/key}

                    {#key activeFeatureIndex}
                      <article
                        class="feature-copy absolute bottom-0 left-0 z-10 w-full p-0"
                        in:fade={{ duration: prefersReducedMotion ? 0 : 180 }}
                        out:fade={{ duration: prefersReducedMotion ? 0 : 140 }}
                      >
                        <p
                          class="feature-copy__inner text-sm leading-7 text-[color:var(--color-text-muted)]"
                        >
                          {features[activeFeatureIndex].description}
                        </p>
                      </article>
                    {/key}
                  </div>

                  <div
                    class="absolute inset-y-0 left-3 z-10 flex items-center sm:hidden"
                  >
                    <button
                      type="button"
                      class="feature-arrow-button"
                      on:click={showPreviousFeature}
                      aria-label="Show previous feature"
                    >
                      &larr;
                    </button>
                  </div>
                  <div
                    class="absolute inset-y-0 right-3 z-10 flex items-center sm:hidden"
                  >
                    <button
                      type="button"
                      class="feature-arrow-button"
                      on:click={showNextFeature}
                      aria-label="Show next feature"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside bind:this={featureSidebarEl} class="hidden lg:block">
            <div class="sticky top-24 space-y-3">
              {#each features as feature, index}
                <button
                  type="button"
                  class:feature-nav-button--active={index ===
                    activeFeatureIndex}
                  class="feature-nav-button w-full text-right"
                  on:click={() => setActiveFeature(index, true)}
                  aria-pressed={index === activeFeatureIndex}
                >
                  {feature.title}
                </button>
              {/each}
            </div>
          </aside>
        </div>
      </div>
    </section>

    <!--
    <section
      id="workflow"
      bind:this={workflowSection}
      class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24"
    >
      <div class="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div
          bind:this={workflowCardEls[0]}
          class="rounded-[2rem] bg-[color:var(--color-surface)] p-8 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-2xl"
        >
          <span class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]">
            Workflow
          </span>
          <h2 class="mt-3 text-3xl font-semibold text-white">One loop from code to hardware.</h2>
          <p class="mt-4 text-base leading-8 text-[color:var(--color-text-muted)]">
            Exort keeps the typical embedded cycle in one place: inspect the project, make code
            changes, choose the board, compile or upload, and validate output with built-in serial
            tools.
          </p>
        </div>

        <div
          bind:this={workflowCardEls[1]}
          class="rounded-[2rem] bg-[color:var(--color-surface)] p-8 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-2xl"
        >
          <ol class="space-y-5">
            {#each workflowSteps as step, index}
              <li
                bind:this={workflowStepEls[index]}
                class="workflow-step flex gap-4 rounded-3xl bg-[color:var(--color-surface-strong)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
              >
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-sm font-semibold text-white">
                  0{index + 1}
                </span>
                <p class="pt-2 text-sm leading-7 text-[color:var(--color-text-muted)]">{step}</p>
              </li>
            {/each}
          </ol>
        </div>
      </div>
    </section>
    -->

    <section
      id="try-exort"
      class="mx-auto max-w-7xl px-6 pb-16 pt-4 lg:px-8 lg:pb-24"
    >
      <div bind:this={ctaSection} class="p-8 sm:p-10 lg:p-12">
        <div
          class="flex min-h-[22rem] flex-col items-center justify-center text-center"
        >
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

          <div
            class="download-grid mt-10 grid w-full max-w-[30rem] grid-cols-1 gap-5 sm:grid-cols-2"
          >
            {#each downloads as item, index}
              <article
                bind:this={downloadCardEls[index]}
                class="download-card group relative h-56 w-56 overflow-hidden bg-[rgba(60,56,54,0.48)]"
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
                  <div
                    class="download-card__overlay-actions flex justify-center"
                  >
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
        </div>
      </div>
    </section>
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
