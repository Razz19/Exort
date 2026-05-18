<script lang="ts">
  import { onMount } from "svelte";
  import SiteNav from "$lib/components/landing/SiteNav.svelte";

  type RoadmapStatus = "planning" | "in progress" | "shipped";
  type RoadmapItem = {
    title: string;
    detail: string;
    status: RoadmapStatus;
  };

  const roadmapItems: RoadmapItem[] = [
    {
      title: "Boards Workspace Presets",
      detail:
        "Save reusable board + port + baud presets per project so setup is instant on every open.",
      status: "shipped",
    },
    {
      title: "Provider Connection Flow",
      detail:
        "Unified provider onboarding with clearer setup states and connection feedback.",
      status: "shipped",
    },
    {
      title: "Serial Monitor Session Markers",
      detail:
        "Add timestamped markers and quick filters to isolate relevant output during long debug sessions.",
      status: "in progress",
    },
    {
      title: "Compile Insight Timeline",
      detail:
        "Expose compile/upload lifecycle steps with actionable error context for faster fixes.",
      status: "planning",
    },
    {
      title: "Workspace Import Detection",
      detail:
        "Auto-detect Arduino-style structures and prefill project metadata on import.",
      status: "planning",
    },
  ];

  const statusMeta: Record<RoadmapStatus, { label: string; tone: string }> = {
    planning: {
      label: "Planned",
      tone: "text-gruvbox-blue/90",
    },
    "in progress": {
      label: "In Progress",
      tone: "text-gruvbox-yellow/90",
    },
    shipped: {
      label: "Shipped",
      tone: "text-gruvbox-green/90",
    },
  };

  const firstInProgressIndex = roadmapItems.findIndex(
    (item) => item.status === "in progress",
  );
  const firstPlanningIndex = roadmapItems.findIndex(
    (item) => item.status === "planning",
  );
  const currentStepIndex =
    firstInProgressIndex !== -1
      ? firstInProgressIndex
      : firstPlanningIndex !== -1
        ? firstPlanningIndex
        : Math.max(roadmapItems.length - 1, 0);

  let timelineRootEl: HTMLElement | null = null;
  let railEl: HTMLElement | null = null;
  let progressEl: HTMLElement | null = null;
  let upcomingRailEl: HTMLElement | null = null;

  onMount(() => {
    if (
      typeof window === "undefined" ||
      !timelineRootEl ||
      !railEl ||
      !progressEl ||
      !upcomingRailEl
    ) {
      return;
    }

    let isDisposed = false;
    let cleanup = () => {};

    const applyAnimations = async () => {
      const { gsap } = await import("gsap");

      if (
        isDisposed ||
        !timelineRootEl ||
        !railEl ||
        !progressEl ||
        !upcomingRailEl
      ) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const nodeEls = Array.from(
        timelineRootEl.querySelectorAll<HTMLElement>("[data-step-node]"),
      );
      const itemEls = Array.from(
        timelineRootEl.querySelectorAll<HTMLElement>("[data-step-item]"),
      );

      const currentNodeEl = nodeEls[currentStepIndex];
      if (!currentNodeEl) {
        return;
      }

      const railRect = railEl.getBoundingClientRect();
      const stepHeights = nodeEls.map((nodeEl) => {
        const nodeRect = nodeEl.getBoundingClientRect();
        return Math.max(0, nodeRect.top + nodeRect.height / 2 - railRect.top);
      });

      const railHeight = railRect.height;
      const currentStepHeight = stepHeights[currentStepIndex] ?? 0;
      const upcomingHeight = Math.max(0, railHeight - currentStepHeight);

      gsap.set(upcomingRailEl, {
        top: currentStepHeight,
        height: upcomingHeight,
      });

      if (prefersReducedMotion) {
        gsap.set(progressEl, { height: currentStepHeight });
        gsap.set(upcomingRailEl, { opacity: 1 });
        gsap.set(itemEls, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(progressEl, { height: 0 });
      gsap.set(upcomingRailEl, { opacity: 0, height: 0 });
      gsap.set(itemEls, { opacity: 0, y: 8 });

      const introTimeline = gsap.timeline({
        defaults: { ease: "power1.out" },
      });
      let breatheTween: { kill: () => void } | null = null;

      itemEls.forEach((itemEl, index) => {
        introTimeline.to(itemEl, {
          opacity: 1,
          y: 0,
          duration: index === currentStepIndex ? 0.28 : 0.22,
        });

        if (index <= currentStepIndex) {
          introTimeline.to(
            progressEl,
            {
              height: stepHeights[index],
              duration: 0.2,
              ease: "power1.out",
            },
            "<",
          );
        }

        if (index === currentStepIndex) {
          introTimeline.set(
            upcomingRailEl,
            {
              opacity: 1,
            },
            "<+=0.14",
          );
          introTimeline.call(() => {
            breatheTween = gsap.to(currentNodeEl, {
              scale: 1.24,
              duration: 0.9,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              transformOrigin: "50% 50%",
            });
          });
        }

        if (index > currentStepIndex) {
          introTimeline.to(
            upcomingRailEl,
            {
              height: Math.max(0, stepHeights[index] - currentStepHeight),
              duration: 0.2,
              ease: "power1.out",
            },
            "<",
          );
        }
      });

      introTimeline.to(upcomingRailEl, {
        height: upcomingHeight,
        duration: 0.18,
        ease: "power1.out",
      });

      cleanup = () => {
        introTimeline.kill();
        if (breatheTween) {
          breatheTween.kill();
        }
      };
    };

    void applyAnimations();

    return () => {
      isDisposed = true;
      cleanup();
    };
  });
</script>

<svelte:head>
  <title>Exort Roadmap</title>
  <meta
    name="description"
    content="Track Exort roadmap updates across planning, in progress, and shipped milestones."
  />
</svelte:head>

<div class="relative isolate">
  <SiteNav />
  <main
    class="mx-auto flex w-full max-w-4xl flex-col px-4 pb-20 pt-10 sm:px-6 lg:px-8"
  >
    <header class="max-w-3xl">
      <p class="text-xs uppercase tracking-[0.24em] text-gruvbox-accent-soft">
        Product Roadmap
      </p>
      <h1
        class="mt-3 font-heading text-4xl leading-[1.04] tracking-[0.08em] text-gruvbox-fg0"
      >
        What We Are Building Next
      </h1>
      <p class="mt-5 max-w-2xl text-base leading-relaxed text-gruvbox-muted">
        Oldest to newest progression, with the current step highlighted.
      </p>
    </header>

    <section
      class="relative mt-10 pb-16"
      bind:this={timelineRootEl}
      aria-label="Roadmap timeline"
    >
      <div class="absolute bottom-0 left-0 top-0 w-10 sm:w-12">
        <span
          class="absolute bottom-0 left-[14px] top-2 w-px bg-transparent sm:left-[18px]"
          bind:this={railEl}
          aria-hidden="true"
        ></span>
        <span
          class="absolute left-[14px] w-px bg-[repeating-linear-gradient(to_bottom,rgba(168,153,132,0.9)_0_6px,transparent_6px_11px)] sm:left-[18px]"
          bind:this={upcomingRailEl}
          aria-hidden="true"
        ></span>
        <span
          class="absolute left-[14px] top-2 w-px bg-gruvbox-green/75 sm:left-[18px]"
          bind:this={progressEl}
          aria-hidden="true"
        ></span>
      </div>

      <div class="space-y-7 sm:space-y-9">
        {#each roadmapItems as item, index}
          {@const isDone = index < currentStepIndex}
          {@const isCurrent = index === currentStepIndex}
          {@const statusLabel = isDone
            ? "Completed"
            : statusMeta[item.status].label}
          {@const statusTone = isDone
            ? "text-gruvbox-green/80"
            : statusMeta[item.status].tone}
          <article data-step-item class="relative pl-14 opacity-0 sm:pl-16">
            <span
              data-step-node
              class={`absolute left-[10px] top-2 h-[9px] w-[9px] sm:left-[14px] ${
                isDone
                  ? "bg-gruvbox-green"
                  : isCurrent
                    ? "bg-gruvbox-yellow"
                    : "bg-gruvbox-muted"
              }`}
              aria-hidden="true"
            ></span>

            <div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2
                  class={`font-heading tracking-[0.06em] ${
                    isCurrent
                      ? "text-2xl text-gruvbox-fg0 sm:text-[1.75rem]"
                      : "text-lg text-gruvbox-fg1/60 sm:text-xl"
                  }`}
                >
                  {item.title}
                </h2>
                <span
                  class={`text-[0.68rem] uppercase tracking-[0.24em] ${statusTone}`}
                >
                  {statusLabel}
                </span>
              </div>

              {#if isCurrent}
                <p
                  class="mt-2 max-w-2xl text-base leading-relaxed text-gruvbox-text"
                >
                  {item.detail}
                </p>
              {:else if isDone}
                <p
                  class="mt-1.5 max-w-2xl text-sm leading-relaxed text-gruvbox-muted/70"
                >
                  {item.detail}
                </p>
              {:else if !isDone}
                <p
                  class="mt-1.5 max-w-2xl text-sm leading-relaxed text-gruvbox-muted/60"
                >
                  {item.detail}
                </p>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </section>
  </main>
</div>
