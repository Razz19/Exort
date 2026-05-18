<script lang="ts">
  import { onMount } from "svelte";
  type GsapTimeline = gsap.core.Timeline;
  import AppFrame from "$lib/components/landing/AppFrame.svelte";
  import FeaturesSection from "$lib/components/landing/FeaturesSection.svelte";
  import DownloadSection from "$lib/components/landing/DownloadSection.svelte";
  import RunLocallySection from "$lib/components/landing/RunLocallySection.svelte";
  import SiteNav from "$lib/components/landing/SiteNav.svelte";
  import { ArrowUpRight, Terminal } from "lucide-svelte";
  import { EXORT_APP_VERSION, EXORT_GITHUB_LINK } from "$lib/constant";

  const features = [
    {
      title: "Serial Monitor",
      description:
        "Read live device output for boot logs, debug prints, and quick checks while you iterate on hardware behavior.",
      video: "/features/Exort-monitor.mp4",
    },
    {
      title: "Serial Plotter",
      description:
        "Plot streaming values as simple charts so calibration, sensor tuning, and runtime issues are easier to spot fast.",
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
        "Bring your own provider setup and pick the models that match how you debug, refactor, and ship embedded projects.",
      video: "/features/Exort-provider.mp4",
    },
  ];

  const heroHighlights = [
    "Bring your own model",
    "Compile, upload, debug",
    "1,000+ boards",
    "4 free models",
    "Built for Arduino",
  ];

  const supportedBrands = [
    { name: "Arduino", logo: "/brands/arduino.webp" },
    { name: "ESP", logo: "/brands/ESP.webp" },
    { name: "Raspberry Pi", logo: "/brands/raspberry.webp" },
    { name: "STM32", logo: "/brands/STM32.webp" },
    { name: "PJRC", logo: "/brands/pjrc.webp" },
    { name: "Nordic", logo: "/brands/nordic.webp" },
    { name: "RISC-V", logo: "/brands/risc-v.webp" },
    { name: "Atmel", logo: "/brands/atmel.webp" },
  ];

  const workflowSteps = [
    {
      title: "4 Free AI Models",
      color: "text-gruvbox-orange",
      description:
        "Start with free included models or connect your own provider.",
    },
    {
      title: "Designed for Hardware",
      color: "text-gruvbox-blue",
      description:
        "The agent helps debug, compile, and upload to your target board.",
    },
    {
      title: "Monitor and Iterate",
      color: "text-gruvbox-green",
      description:
        "Write code, monitor device output, and iterate with built-in tools.",
    },
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
  const defaultHeroVideoAspectRatio = 16 / 9;
  let heroVideoAspectRatio = defaultHeroVideoAspectRatio;

  const syncHeroVideoAspectRatio = () => {
    if (!heroScreenshot) {
      return;
    }

    const { videoWidth, videoHeight } = heroScreenshot;
    if (videoWidth > 0 && videoHeight > 0) {
      heroVideoAspectRatio = videoWidth / videoHeight;
    }
  };

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
      const firstHighlightEl =
        mobileHeroHighlightFirst as HTMLParagraphElement | null;
      const secondHighlightEl =
        mobileHeroHighlightSecond as HTMLParagraphElement | null;

      if (!firstHighlightEl || !secondHighlightEl) {
        return;
      }

      const [firstHighlight, secondHighlight] =
        mobileHeroHighlightGroups[groupIndex];
      firstHighlightEl.textContent = firstHighlight;
      secondHighlightEl.textContent = secondHighlight;
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
            y: 16,
            opacity: 0,
            duration: 0.46,
            stagger: 0.06,
            ease: "power3.out",
            scrollTrigger: {
              trigger: workflowSection,
              start: "top 82%",
              once: true,
            },
          });
        }

        workflowStepEls.forEach((stepEl) => {
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

<div class="relative isolate">
  <SiteNav />

  <main id="top" class="relative overflow-hidden">
    <div class="relative z-10">
      <section class="relative my-10">
        <div
          class="relative mx-auto flex w-full max-w-7xl items-start px-4 py-6 md:px-6 lg:items-center lg:px-8 lg:py-10"
        >
          <div
            class="relative z-10 grid w-full items-center gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.52fr)] lg:items-center lg:gap-8"
          >
            <div class="relative min-w-0 pt-2 lg:pr-4">
              <div
                class="absolute left-0 top-2 z-20 inline-flex items-center gap-3 rounded-full bg-gruvbox-ink px-3.5 py-3 text-sm shadow-soft animate-hero-release-badge motion-reduce:animate-none"
                aria-label="Current Exort release"
              >
                <span
                  class="h-2.5 w-2.5 shrink-0 bg-gruvbox-green animate-hero-release-indicator motion-reduce:animate-none"
                  aria-hidden="true"
                ></span>
                <span
                  class="font-heading whitespace-nowrap text-xs uppercase leading-none tracking-[0.14em] text-gruvbox-text"
                  >v{EXORT_APP_VERSION} · NOW OPEN SOURCE</span
                >
              </div>
              <div
                bind:this={heroCopy}
                class="flex w-full max-w-4xl flex-col items-start pt-12 text-left sm:pt-14 lg:max-w-[44rem]"
              >
                <!-- <h1
              class="max-w-full overflow-hidden sm:overflow-visible font-heading font-bold leading-none tracking-[0.04em] text-2xl sm:text-5xl"
            >
              <span
                bind:this={headlineLineEls[0]}
                class="block max-w-full overflow-visible pb-[0.08em] leading-[1.08] text-gruvbox-fg0"
              >
                <span
                  class="relative block w-full max-w-full overflow-visible align-top pb-[0.08em] leading-[1.08]"
                >
                  <span class="block text-gruvbox-fg0 sm:whitespace-nowrap">
                    AI-powered</span
                  >
                </span>
              </span>
              <span
                bind:this={headlineLineEls[1]}
                class="block max-w-full overflow-visible pb-[0.08em] leading-[1.08] text-gruvbox-fg0"
              >
                <span
                  class="relative block w-full max-w-full overflow-visible align-top pb-[0.08em] leading-[1.08]"
                >
                  <span
                    class="inline-grid max-w-full overflow-hidden sm:overflow-visible pb-[0.1em] leading-[1.08] sm:whitespace-nowrap"
                  >
                    <span
                      class="col-start-1 row-start-1 text-transparent sm:whitespace-nowrap"
                    >
                      coding <br class="hidden lg:block" /> environment
                    </span>
                    <span
                      class="pointer-events-none col-start-1 row-start-1 text-gruvbox-fg0 sm:whitespace-nowrap"
                    >
                      coding <br class="hidden lg:block" /> environment
                    </span>
                    <span
                      class="pointer-events-none col-start-1 row-start-1 pb-[0.12em] -mb-[0.12em] text-gruvbox-orange [clip-path:inset(0_100%_0_0)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-right sm:whitespace-nowrap"
                      aria-hidden="true"
                    >
                      coding <br class="hidden lg:block" /> environment
                    </span>
                    <span
                      class="pointer-events-none col-start-1 row-start-1 pb-[0.12em] -mb-[0.12em] text-gruvbox-green [clip-path:inset(0_0_0_100%)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-left [animation-delay:1.5s] sm:whitespace-nowrap"
                      aria-hidden="true"
                    >
                      coding <br class="hidden lg:block" /> environment
                    </span>
                    <span
                      class="pointer-events-none col-start-1 row-start-1 pb-[0.12em] -mb-[0.12em] text-gruvbox-blue [clip-path:inset(0_100%_0_0)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-right [animation-delay:3s] sm:whitespace-nowrap"
                      aria-hidden="true"
                    >
                      coding <br class="hidden lg:block" /> environment
                    </span>
                    <span
                      class="pointer-events-none col-start-1 row-start-1 pb-[0.12em] -mb-[0.12em] text-gruvbox-yellow [clip-path:inset(0_0_0_100%)] opacity-0 motion-reduce:hidden animate-hero-text-sweep-left [animation-delay:4.5s] sm:whitespace-nowrap"
                      aria-hidden="true"
                    >
                      coding <br class="hidden lg:block" /> environment
                    </span>
                  </span>
                </span>
                <span class="block text-gruvbox-fg0">for Microcontrollers.</span
                >
              </span>
            </h1> -->
                <h1
                  class="max-w-full overflow-hidden sm:overflow-visible font-heading font-bold leading-lg text-2xl sm:text-4xl"
                >
                  Free AI-powered <span class="hero-gruvbox-text-cycle">
                    coding environment
                  </span> for Microcontrollers
                </h1>
                <p
                  class="mt-5 max-w-2xl text-md leading-6 lg:leading-6 xl:leading-8 text-gruvbox-muted sm:text-base"
                >
                  An <span class="underline underline-offset-4"
                    >open-source
                  </span> coding environment for embedded development that helps you
                  generate, shape, and improve microcontroller code with AI assistance.
                </p>

                <div
                  bind:this={heroActions}
                  class="mt-6 flex w-full flex-wrap justify-start gap-4 lg:flex-nowrap lg:gap-3"
                >
                  <a
                    href="/download"
                    class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full bg-gruvbox-ink px-3 sm:px-6 py-3 sm:py-3.5 text-sm font-medium backdrop-blur transition motion-reduce:transition-none lg:min-w-0 lg:flex-1 lg:px-4"
                  >
                    <span
                      class="absolute inset-0 translate-x-full bg-gruvbox-green transition-transform duration-300 ease-out group-hover:translate-x-0"
                      aria-hidden="true"
                    >
                    </span>
                    <span
                      class="relative flex items-center gap-4 z-10 transition-colors duration-300 group-hover:text-gruvbox-ink"
                    >
                      Download Exort <ArrowUpRight class="h-4 w-4 " />
                    </span>
                  </a>
                  <a
                    href={EXORT_GITHUB_LINK}
                    class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full bg-gruvbox-ink px-3 sm:px-6 py-3 sm:py-3.5 text-sm font-medium backdrop-blur transition motion-reduce:transition-none lg:min-w-0 lg:flex-1 lg:px-4"
                  >
                    <span
                      class="absolute inset-0 translate-x-full bg-gruvbox-blue transition-transform duration-300 ease-out group-hover:translate-x-0"
                      aria-hidden="true"
                    ></span>
                    <span
                      class="relative flex items-center gap-4 z-10 transition-colors duration-300 group-hover:text-gruvbox-ink"
                    >
                      View on GitHub
                      <ArrowUpRight class="h-4 w-4 " />
                    </span>
                  </a>
                </div>

                <div
                  class="mt-6 flex w-full flex-col items-center gap-2 sm:items-start"
                >
                  <div
                    class="flex w-full flex-nowrap items-center justify-center gap-x-1.5 opacity-30 sm:justify-start sm:gap-x-2"
                  >
                    {#each supportedBrands as brand}
                      <div class="flex min-w-0 flex-1 items-center justify-center">
                        <img
                          src={brand.logo}
                          alt={brand.name}
                          class="h-auto w-full max-w-[3rem] object-contain sm:max-w-[3.4rem] lg:max-w-[2.7rem] xl:max-w-[3.8rem]"
                          loading="lazy"
                        />
                      </div>
                    {/each}
                  </div>
                </div>
                <!-- <div
                      class="mt-6 flex items-center gap-3 text-xs font-mono text-gruvbox-muted"
                    >
                      <Terminal class="w-4 h-4" />
                      <span
                        >Supports: Arduino · ESP32 · STM32 · RP2040 · AVR · PJRC</span
                      >
                    </div> -->
              </div>
            </div>

            <div
              bind:this={heroScreenshotWrap}
              class="relative z-10 min-w-0 w-full lg:justify-self-end"
            >
              <div
                class="relative mx-auto w-full max-w-3xl p-2 sm:p-4 xl:max-w-[84rem]"
              >
                <AppFrame
                  frameClass="w-full min-w-0 bg-transparent"
                  contentClass="p-1 sm:p-2"
                >
                  <div
                    class="relative w-full overflow-hidden bg-gruvbox-ink-strong"
                    style={`border-radius: 10px !important; aspect-ratio: ${heroVideoAspectRatio};`}
                  >
                    <video
                      bind:this={heroScreenshot}
                      src="/Exort.mp4?v=20260524-2"
                      autoplay
                      muted
                      loop
                      playsinline
                      onloadedmetadata={syncHeroVideoAspectRatio}
                      onloadeddata={syncHeroVideoAspectRatio}
                      aria-label="Exort desktop application walkthrough video"
                      class="relative z-10 block h-full w-full object-contain object-center [will-change:transform]"
                      style="border-radius: 10px !important;"
                    >
                      <track kind="captions" />
                    </video>
                  </div>
                </AppFrame>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        bind:this={workflowSection}
        class="mx-auto grid max-w-7xl gap-6 sm:gap-10 px-6 pb-8 pt-16 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start lg:px-8"
      >
        <div class="flex flex-col items-start">
          <span
            class="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-gruvbox-accent-soft sm:text-sm"
          >
            What is Exort
          </span>
          <h1
            class="mt-2 max-w-xl text-md uppercase font-extrabold tracking-[0.24em] text-gruvbox-fg1"
          >
            One prompt away from idea to microcontroller code.
          </h1>
          <p
            class="mt-5 max-w-2xl leading-7 text-gruvbox-muted sm:text-base sm:leading-[1.45]"
          >
            Exort makes hardware coding feel less overwhelming. It’s an
            open-source desktop app for microcontroller development, powered by
            an AI agent that helps you write, improve, upload, and debug
            embedded code.
          </p>
        </div>

        <div
          class="grid max-w-xl grid-cols-1 sm:grid-cols-3 gap-0 sm:gap-3 justify-self-start. md:justify-self-center
          md:max-w-2xl lg:max-w-3xl lg:grid-cols-3"
        >
          {#each workflowSteps as step, index}
            <article
              bind:this={workflowCardEls[index]}
              class="group relative overflow-hidden rounded-3xl p-3 transition-colors duration-300"
            >
              <div
                bind:this={workflowStepEls[index]}
                class="flex h-full flex-col gap-5 p-4 transition-all bg-gruvbox-ink duration-300"
              >
                <span
                  class={`text-base font-heading font-semibold leading-none ${step.color} sm:text-xl`}
                >
                  {step.title}
                </span>

                <p class=" leading-6 text-gruvbox-fg1 sm:text-[0.9rem]">
                  {step.description}
                </p>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <FeaturesSection {features} />

      <!-- download section -->
      <section class="px-6 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div
          class="mx-auto grid max-w-7xl gap-8 px-0 sm:p-6 lg:grid-cols-3 lg:items-center lg:gap-10 lg:p-8"
        >
          <div class="relative h-full min-w-0 w-full text-left">
            <!-- <div
            class="absolute inset-y-0 left-0 w-0.5 bg-gruvbox-green"
            aria-hidden="true"
          ></div> -->

            <span
              class="text-xs sm:text-sm uppercase tracking-[0.24em] text-gruvbox-green"
            >
              Download Exort
            </span>
            <h3 class="mt-2 text-sm font-semibold text-gruvbox-fg1 sm:text-xl">
              Download Exort and start building
            </h3>

            <p
              class="mt-5 max-w-md text-sm leading-7 text-gruvbox-muted sm:text-base sm:leading-[1.45]"
            >
              Exort is available for Windows, macOS, and Linux. Download the
              latest version and get started today.
            </p>

            <div
              bind:this={heroActions}
              class="mt-6 flex w-full flex-wrap justify-start gap-4"
            >
              <a
                href="/download"
                class="group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-full bg-gruvbox-ink px-3 sm:px-6 py-3 sm:py-3.5 text-sm font-medium backdrop-blur transition motion-reduce:transition-none"
              >
                <span
                  class="absolute inset-0 translate-x-full bg-gruvbox-green transition-transform duration-300 ease-out group-hover:translate-x-0"
                  aria-hidden="true"
                >
                </span>
                <span
                  class="relative flex items-center gap-4 z-10 transition-colors duration-300 group-hover:text-gruvbox-ink"
                >
                  Download Exort <ArrowUpRight class="h-4 w-4 " />
                </span>
              </a>
            </div>
          </div>
          <div class="min-w-0 w-full col-span-2">
            <RunLocallySection embedded={true} />
          </div>
        </div>
      </section>

      <!-- <DownloadSection showInstallationGuide={false} />
       -->
    </div>
  </main>
</div>

<style>
  .animate-hero-release-badge {
    animation: hero-release-slide-in 0.72s cubic-bezier(0.21, 1.01, 0.31, 1)
      both;
  }

  .animate-hero-release-indicator {
    animation:
      hero-release-breathe 2.1s ease-in-out infinite,
      hero-release-color-cycle 4.8s ease-in-out infinite;
  }

  @keyframes hero-release-slide-in {
    from {
      opacity: 0;
      transform: translateX(-34px);
    }

    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes hero-release-breathe {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.85;
    }

    50% {
      transform: scale(1.22);
      opacity: 1;
    }
  }

  @keyframes hero-release-color-cycle {
    0%,
    100% {
      background: #98971a;
    }

    25% {
      background: #fabd2f;
    }

    50% {
      background: #fe8019;
    }

    75% {
      background: #458588;
    }
  }

  .hero-gruvbox-text-cycle {
    color: #fe8019;
    animation: hero-gruvbox-text-cycle 6s ease-in-out infinite;
  }

  @keyframes hero-gruvbox-text-cycle {
    0%,
    100% {
      color: #fe8019;
    }

    25% {
      color: #98971a;
    }

    50% {
      color: #458588;
    }

    75% {
      color: #fabd2f;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-gruvbox-text-cycle {
      animation: none;
      color: #fe8019;
    }
  }
</style>
