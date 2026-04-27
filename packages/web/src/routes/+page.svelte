<script lang="ts">
  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Download', href: '#try-exort' }
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
</script>

<svelte:head>
  <title>Exort | Embedded Development In One Workspace</title>
  <meta
    name="description"
    content="Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent for code, compile, upload, and device interaction in one place."
  />
</svelte:head>

<div class="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
  <nav class="sticky top-0 z-30 bg-[color:var(--color-nav)]/80 backdrop-blur-2xl">
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
    <section class="relative mx-auto max-w-7xl px-6 pb-8 pt-12 lg:px-8 lg:pt-16">
      <div class="relative z-10 lg:grid lg:grid-cols-[minmax(0,1.28fr)_minmax(16rem,0.72fr)] lg:items-start lg:gap-8 xl:gap-12">
        <div>
          <h1 class="max-w-4xl text-3xl font-semibold leading-[1.02] text-white sm:text-4xl lg:max-w-5xl lg:text-5xl">
            Embedded development with AI, code,
           and hardware tools in one app.
          </h1>
          <p class="mt-4 max-w-xl text-sm leading-6 text-[color:var(--color-text-muted)] sm:text-base">
            Edit, compile, upload, and monitor devices from one desktop workspace.
          </p>

          <div class="mt-6 flex flex-col gap-4 sm:flex-row">
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

        <div aria-hidden="true" class="pointer-events-none mt-6 hidden justify-end lg:mt-0 lg:flex">
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
        </div>
      </div>

      <div class="relative left-1/2 z-10 -mt-8 w-[calc(100%+1.5rem)] max-w-none -translate-x-1/2 px-2 sm:-mt-6 sm:w-[calc(100%+3rem)] sm:px-0 lg:-mt-10 lg:w-[calc(100%+6rem)]">
        <img
          src="/exort-screenshot.png"
          alt="Exort desktop application screenshot"
          class="h-auto w-full object-cover object-top drop-shadow-[0_48px_120px_rgba(0,0,0,0.46)]"
        />
      </div>
    </section>

    <section id="features" class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
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
        {#each features as feature}
          <article class="rounded-3xl bg-[color:var(--color-surface)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-2xl transition hover:bg-[color:var(--color-surface-strong)]">
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

    <section id="workflow" class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
      <div class="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div class="rounded-[2rem] bg-[color:var(--color-surface)] p-8 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-2xl">
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

        <div class="rounded-[2rem] bg-[color:var(--color-surface)] p-8 shadow-[0_18px_48px_rgba(0,0,0,0.14)] backdrop-blur-2xl">
          <ol class="space-y-5">
            {#each workflowSteps as step, index}
              <li class="flex gap-4 rounded-3xl bg-[color:var(--color-surface-strong)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
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
      <div class="rounded-[2rem] bg-[color:var(--color-surface)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:p-10 lg:p-12">
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
