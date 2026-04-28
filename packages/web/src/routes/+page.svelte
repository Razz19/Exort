<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { onMount } from 'svelte';

  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Download', href: '#try-exort' }
  ];

  const headlineLines = [
    'Embedded development',
    'with AI, code,',
    'and hardware tools in one app.'
  ];

  const featureRotationDelay = 4000;
  const manualFeaturePause = 8000;

  const features = [
    {
      title: 'Serial Monitor',
      description:
        'Watch live device output in a dedicated pane while you debug firmware behavior, inspect logs, and keep iteration focused inside Exort.',
      image: '/features/serial-monitor.png'
    },
    {
      title: 'Serial Plotter',
      description:
        'Turn streaming values into readable charts so sensor tuning, calibration, and runtime validation happen without leaving the workspace.',
      image: '/features/serial-plotter.png'
    },
    {
      title: 'Board Manager',
      description:
        'Manage board platforms from the same app and keep toolchains ready for Arduino, ESP32, RP2040, STM32, Teensy, and more.',
      image: '/features/board-manager.png'
    },
    {
      title: 'Project Manager',
      description:
        'Switch between embedded workspaces, preserve local project state, and keep active files and context organized across sessions.',
      image: null
    },
    {
      title: 'Provider Connection',
      description:
        'Connect your preferred AI provider setup and route workflows through the models that fit your embedded development stack.',
      image: null
    },
    {
      title: 'Embedded Agent',
      description:
        'Use the embedded-focused agent to inspect the workspace, edit code, and assist with compile or upload loops from the same environment.',
      image: null
    }
  ];

  const workflowSteps = [
    'Open a workspace and let Exort inspect the project.',
    'Edit files in the Monaco-based editor with AI help close by.',
    'Select your board and serial port, then compile or upload.',
    'Use Serial Monitor or Plotter to validate behavior and iterate fast.'
  ];

  const heroPulseSegments = [
    { top: '10%', left: '9%', width: '12rem', delay: '0.2s', duration: '7.4s' },
    { top: '22%', left: '65%', width: '9rem', delay: '1.8s', duration: '8.6s' },
    { top: '39%', left: '18%', width: '7rem', delay: '1.1s', duration: '6.9s' },
    { top: '53%', left: '72%', width: '10rem', delay: '2.8s', duration: '8.1s' },
    { top: '72%', left: '41%', width: '11rem', delay: '0.8s', duration: '7.8s' }
  ];

  let isNavScrolled = false;
  let prefersReducedMotion = false;
  let supportsHeroPointerEffect = false;
  let isHeroPointerActive = false;
  let heroPointerTargetX = 50;
  let heroPointerTargetY = 40;
  let heroPointerRenderX = 50;
  let heroPointerRenderY = 40;
  let heroPointerX = '50%';
  let heroPointerY = '40%';
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

  const clearFeatureRotation = () => {
    if (featureRotationTimeout) {
      window.clearTimeout(featureRotationTimeout);
      featureRotationTimeout = null;
    }
  };

  const scheduleFeatureRotation = (delay = featureRotationDelay) => {
    if (typeof window === 'undefined') {
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

    if (typeof window === 'undefined') {
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
    setActiveFeature((activeFeatureIndex - 1 + features.length) % features.length, true);
  };

  const showNextFeature = () => {
    setActiveFeature((activeFeatureIndex + 1) % features.length, true);
  };

  const preloadFeatureImages = () => {
    if (typeof window === 'undefined') {
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
    if (heroTrailRunning || typeof window === 'undefined') {
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
    if (typeof window === 'undefined') {
      return;
    }

    const syncNavState = () => {
      isNavScrolled = window.scrollY > 18;
    };

    syncNavState();
    window.addEventListener('scroll', syncNavState, { passive: true });

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
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
    mediaQuery.addEventListener('change', syncReducedMotion);
    pointerQuery.addEventListener('change', syncPointerMode);

    let cleanupAnimations = () => {};

    const loadAnimations = async () => {
      if (mediaQuery.matches) {
        return;
      }

      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');

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
            ctaSection
          ].filter(Boolean),
          {
            willChange: 'transform, opacity'
          }
        );

        gsap.from(headlineLineEls, {
          x: -36,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12
        });

        if (heroCopy) {
          gsap.from(heroCopy, {
            x: -24,
            opacity: 0,
            duration: 0.8,
            delay: 0.18,
            ease: 'power2.out'
          });
        }

        if (heroActions) {
          gsap.from(heroActions, {
            x: -20,
            opacity: 0,
            duration: 0.82,
            delay: 0.3,
            ease: 'power2.out'
          });
        }

        if (heroScreenshotWrap) {
          gsap.from(heroScreenshotWrap, {
            y: 24,
            opacity: 0,
            duration: 0.72,
            delay: 0.22,
            ease: 'power2.out'
          });
        }

        if (featuresSection && (featuresIntroEl || featureSidebarEl || featurePanelEl)) {
          const featuresTimeline = gsap.timeline({
            defaults: {
              duration: 0.75,
              ease: 'power3.out'
            },
            scrollTrigger: {
              trigger: featuresSection,
              start: 'top 70%',
              once: true,
              invalidateOnRefresh: true
            }
          });

          if (featuresIntroEl) {
            featuresTimeline.from(
              featuresIntroEl,
              {
                x: -32,
                opacity: 0
              },
              0
            );
          }

          if (featurePanelEl) {
            featuresTimeline.from(
              featurePanelEl,
              {
                x: -48,
                opacity: 0
              },
              0.08
            );
          }

          if (featureSidebarEl) {
            featuresTimeline.from(
              featureSidebarEl,
              {
                x: 40,
                opacity: 0
              },
              0.2
            );
          }
        }

        if (workflowCardEls.length) {
          gsap.from(workflowCardEls, {
            y: 26,
            opacity: 0,
            duration: 0.85,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: workflowSection,
              start: 'top 72%',
              once: true
            }
          });
        }

        workflowStepEls.forEach((stepEl) => {
          gsap.from(stepEl, {
            y: 22,
            opacity: 0,
            duration: 0.72,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: stepEl,
              start: 'top 82%',
              once: true
            }
          });

          ScrollTrigger.create({
            trigger: stepEl,
            start: 'top 75%',
            end: 'bottom 45%',
            onEnter: () => stepEl.classList.add('is-active'),
            onLeave: () => stepEl.classList.remove('is-active'),
            onEnterBack: () => stepEl.classList.add('is-active'),
            onLeaveBack: () => stepEl.classList.remove('is-active')
          });
        });

        if (ctaSection) {
          gsap.from(ctaSection, {
            y: 26,
            opacity: 0,
            duration: 0.88,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: ctaSection,
              start: 'top 78%',
              once: true
            }
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
      window.removeEventListener('scroll', syncNavState);
      mediaQuery.removeEventListener('change', syncReducedMotion);
      pointerQuery.removeEventListener('change', syncPointerMode);
      if (heroTrailFrame) {
        window.cancelAnimationFrame(heroTrailFrame);
      }
      clearFeatureRotation();
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

<div class="site-shell min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
  <nav class:nav-scrolled={isNavScrolled} class="site-nav sticky top-0 z-30 bg-[color:var(--color-nav)]/80 backdrop-blur-2xl">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
      <a href="#top" class="flex items-center">
        <img
          src="/exort-typography-logo3.png"
          alt="Exort AI"
          class="h-5 w-auto sm:h-6"
        />
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

      <div class="relative z-10 lg:grid lg:grid-cols-[minmax(0,1.28fr)_minmax(16rem,0.72fr)] lg:items-start lg:gap-8 xl:gap-12">
        <div class="w-fit">
          <h1 class="max-w-4xl text-3xl font-semibold leading-[1.02] text-white sm:text-4xl lg:max-w-5xl lg:text-5xl">
            {#each headlineLines as line, index}
              <span class="block overflow-hidden">
                <span bind:this={headlineLineEls[index]} class="block">{line}</span>
              </span>
            {/each}
          </h1>

          <p
            bind:this={heroCopy}
            class="mt-4 max-w-xl text-sm leading-6 text-[color:var(--color-text-muted)] sm:text-base"
          >
            Edit, compile, upload, and monitor devices from one desktop workspace.
          </p>

          <div bind:this={heroActions} class="mt-6 flex flex-col gap-4 sm:flex-row">
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

        <!-- <div aria-hidden="true" class="pointer-events-none mt-6 hidden justify-end lg:mt-0 lg:flex">
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
        class="relative left-1/2 z-10 -mt-8 w-[calc(100%+1.5rem)] max-w-none -translate-x-1/2 px-2 sm:-mt-6 sm:w-[calc(100%+3rem)] sm:px-0 lg:-mt-10 lg:w-[calc(100%+6rem)]"
      >
        <img
          bind:this={heroScreenshot}
          src="/exort-screenshot.png"
          alt="Exort desktop application screenshot"
          class="hero-screenshot h-auto w-full object-cover object-top "
        />
      </div>
    </section>

    <section
      id="features"
      bind:this={featuresSection}
      class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24"
    >
      <div bind:this={featuresIntroEl} class="max-w-2xl">
        <span class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]">
          Core Features
        </span>
      </div>

      <div class="feature-showcase mt-12">
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8">
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
                        <div class="feature-image-placeholder flex h-full w-full items-center justify-center">
                          <span class="px-6 text-center text-sm uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
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
                        <p class="feature-copy__inner text-sm leading-7 text-[color:var(--color-text-muted)]">
                          {features[activeFeatureIndex].description}
                        </p>
                      </article>
                    {/key}
                  </div>

                  <div class="absolute inset-y-0 left-3 z-10 flex items-center sm:hidden">
                    <button
                      type="button"
                      class="feature-arrow-button"
                      on:click={showPreviousFeature}
                      aria-label="Show previous feature"
                    >
                      &larr;
                    </button>
                  </div>
                  <div class="absolute inset-y-0 right-3 z-10 flex items-center sm:hidden">
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
                  class:feature-nav-button--active={index === activeFeatureIndex}
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

    <section id="try-exort" class="mx-auto max-w-7xl px-6 pb-16 pt-4 lg:px-8 lg:pb-24">
      <div
        bind:this={ctaSection}
        class="p-8 sm:p-10 lg:p-12"
      >
        <div class="flex min-h-[22rem] flex-col items-center justify-center text-center">
          <span class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]">
            Get Exort
          </span>
          <h2 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Let&apos;s get Exort running on your setup
          </h2>
          <p class="mt-4 text-base leading-8 text-[color:var(--color-text-muted)]">
            Choose your platform to download the right version
          </p>

          <div class="mt-8 grid w-full max-w-2xl gap-4 lg:grid-cols-2">
          <div class="rounded-3xl bg-[color:var(--color-surface-strong)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
            <p class="text-sm font-medium uppercase tracking-[0.2em] text-[color:var(--color-accent-soft)]">
              Install
            </p>
            <code class="mt-3 block text-sm text-slate-100">npm install</code>
          </div>
          <div class="rounded-3xl bg-[color:var(--color-surface-strong)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
            <p class="text-sm font-medium uppercase tracking-[0.2em] text-[color:var(--color-accent-soft)]">
              Run
            </p>
            <code class="mt-3 block text-sm text-slate-100">npm run dev</code>
          </div>
        </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[color:var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <p>Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent.</p>
      <p>AGPL-3.0-only</p>
    </div>
  </footer>
</div>
