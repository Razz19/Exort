<script lang="ts">
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

  const features = [
    {
      title: 'AI Coding Workspace',
      description:
        'Chat with the embedded-focused agent, edit project files, and keep code changes in the same workspace without switching tools.'
    },
    {
      title: 'Compile And Upload',
      description:
        'Run compile and upload flows directly from Exort so firmware iteration stays inside the app from first edit to device test.'
    },
    {
      title: 'Serial Tools Built In',
      description:
        'Use the Serial Monitor and Serial Plotter for live device output and data inspection while you tune embedded behavior.'
    },
    {
      title: 'Workspace Management',
      description:
        'Handle multiple embedded projects with persisted local state, tabbed editing, and project switching that survives restarts.'
    },
    {
      title: 'Model Flexibility',
      description:
        'Start with free OpenCode models or connect your own provider setup for workflows powered by ChatGPT, Claude, and other models.'
    },
    {
      title: 'Board Platform Support',
      description:
        'Work with Arduino CLI platforms including Arduino, ESP32, ESP8266, RP2040, STM32, Teensy, and more from one desktop app.'
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
  let heroSection: HTMLElement | null = null;
  let heroCopy: HTMLElement | null = null;
  let heroActions: HTMLElement | null = null;
  let heroScreenshotWrap: HTMLElement | null = null;
  let heroScreenshot: HTMLImageElement | null = null;
  let featuresSection: HTMLElement | null = null;
  let workflowSection: HTMLElement | null = null;
  let ctaSection: HTMLElement | null = null;

  let headlineLineEls: HTMLSpanElement[] = [];
  let featureCardEls: HTMLElement[] = [];
  let workflowCardEls: HTMLElement[] = [];
  let workflowStepEls: HTMLElement[] = [];

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
            ...featureCardEls,
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
            y: 34,
            opacity: 0,
            duration: 1,
            delay: 0.38,
            ease: 'power3.out'
          });
        }

        if (heroScreenshot) {
          gsap.to(heroScreenshot, {
            scale: 1.05,
            ease: 'none',
            scrollTrigger: {
              trigger: heroSection,
              start: 'top top',
              end: 'bottom top',
              scrub: 0.8
            }
          });
        }

        if (featureCardEls.length) {
          gsap.from(featureCardEls, {
            y: 28,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: featuresSection,
              start: 'top 72%',
              once: true
            }
          });
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

    void loadAnimations();

    return () => {
      window.removeEventListener('scroll', syncNavState);
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
    <section
      bind:this={heroSection}
      class="hero-section relative mx-auto max-w-7xl overflow-hidden px-6 pb-8 pt-12 lg:px-8 lg:pt-16"
    >
      <div class="hero-grid" aria-hidden="true">
        {#each heroPulseSegments as segment}
          <span
            class="hero-grid__pulse"
            style={`top:${segment.top};left:${segment.left};width:${segment.width};animation-delay:${segment.delay};animation-duration:${segment.duration};`}
          ></span>
        {/each}
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
          class="hero-screenshot h-auto w-full object-cover object-top drop-shadow-[0_48px_120px_rgba(0,0,0,0.46)]"
        />
      </div>
    </section>

    <section
      id="features"
      bind:this={featuresSection}
      class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24"
    >
      <div class="max-w-2xl">
        <span class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]">
          Features
        </span>
        <h2 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">
          The base toolkit for modern embedded workflows.
        </h2>
        <p class="mt-4 text-base leading-8 text-[color:var(--color-text-muted)]">
          Exort is built around the parts of embedded development that usually end up scattered
          across multiple tools. The result is a cleaner loop from idea to device feedback.
        </p>
      </div>

      <div class="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {#each features as feature, index}
          <article
            bind:this={featureCardEls[index]}
            class="feature-card rounded-3xl bg-[color:var(--color-surface)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-2xl transition hover:bg-[color:var(--color-surface-strong)]"
          >
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-surface-strong)] text-sm font-semibold text-[color:var(--color-accent)] shadow-[0_10px_28px_rgba(247,84,0,0.16)]">
              {feature.title.slice(0, 1)}
            </div>
            <h3 class="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
            <p class="mt-3 text-sm leading-7 text-[color:var(--color-text-muted)]">
              {feature.description}
            </p>
          </article>
        {/each}
      </div>
    </section>

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

    <section id="try-exort" class="mx-auto max-w-7xl px-6 pb-16 pt-4 lg:px-8 lg:pb-24">
      <div
        bind:this={ctaSection}
        class="rounded-[2rem] bg-[color:var(--color-surface)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:p-10 lg:p-12"
      >
        <div class="max-w-3xl">
          <span class="text-sm uppercase tracking-[0.24em] text-[color:var(--color-accent-soft)]">
            Try Exort Now
          </span>
          <h2 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Start with the base setup today and expand the experience later.
          </h2>
          <p class="mt-4 text-base leading-8 text-slate-300">
            This landing page is a clean foundation for the website. As the product evolves, the
            theme, component system, screenshots, docs links, and download actions can be extended
            without changing the overall structure.
          </p>
        </div>

        <div class="mt-8 flex flex-col gap-4 sm:flex-row">
          <a
            href="#workflow"
            class="inline-flex items-center justify-center rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(247,84,0,0.28)] transition hover:brightness-110"
          >
            Start With Exort
          </a>
          <a
            href="#top"
            class="inline-flex items-center justify-center rounded-full bg-[color:var(--color-surface-strong)] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)] transition hover:bg-[color:var(--color-surface)]"
          >
            Back To Top
          </a>
        </div>

        <div class="mt-8 grid gap-4 lg:grid-cols-2">
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
    </section>
  </main>

  <footer>
    <div class="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[color:var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <p>Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent.</p>
      <p>AGPL-3.0-only</p>
    </div>
  </footer>
</div>
