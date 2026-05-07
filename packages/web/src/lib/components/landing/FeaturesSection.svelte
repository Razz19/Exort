<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  const featureRotationDelay = 4000;
  const manualFeaturePause = 8000;

  type FeatureItem = {
    title: string;
    description: string;
    image?: string;
  };

  let { features }: { features: FeatureItem[] } = $props();

  let prefersReducedMotion = $state(false);
  let activeFeatureIndex = $state(0);
  let featureRotationTimeout: number | null = null;
  let featureRotationResumeAt = 0;
  let featuresSection: HTMLElement | null = null;
  let featuresIntroEl: HTMLElement | null = null;
  let featureSidebarEl: HTMLElement | null = null;
  let featurePanelEl: HTMLElement | null = null;
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;

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
      if (mediaQuery.matches) {
        return;
      }

      const gsap = await ensureGsap();
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.set(
          [featuresIntroEl, featureSidebarEl, featurePanelEl].filter(Boolean),
          {
            willChange: "transform, opacity",
          },
        );

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
      }, featuresSection ?? undefined);

      cleanupAnimations = () => {
        ctx.revert();
      };
    };

    scheduleFeatureRotation(featureRotationDelay);
    preloadFeatureImages();
    void loadAnimations();

    return () => {
      mediaQuery.removeEventListener("change", syncReducedMotion);
      clearFeatureRotation();
      cleanupAnimations();
    };
  });
</script>

<section
  id="features"
  bind:this={featuresSection}
  class="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24"
>
  <div bind:this={featuresIntroEl} class="max-w-2xl">
    <span
      class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft"
    >
      Core Features
    </span>
  </div>

  <div class="mt-12">
    <div
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8"
    >
      <div bind:this={featurePanelEl} class="min-w-0">
        <div class="grid gap-6">
          <div class="relative">
            <div
              class="group relative h-[clamp(19rem,46vw,38rem)] w-full overflow-hidden bg-transparent sm:h-[clamp(22rem,44vw,38rem)] md:h-[clamp(20rem,42vw,34rem)] lg:h-[clamp(27rem,36vw,38rem)]"
            >
              <div class="relative h-full w-full">
                {#key activeFeatureIndex}
                  <div
                    class="absolute inset-0"
                    in:fade={{ duration: prefersReducedMotion ? 0 : 180 }}
                    out:fade={{ duration: prefersReducedMotion ? 0 : 140 }}
                  >
                    {#if features[activeFeatureIndex].image}
                      <img
                        src={features[activeFeatureIndex].image}
                        alt={`${features[activeFeatureIndex].title} screenshot`}
                        class="block h-full max-h-full w-full max-w-full object-fill"
                      />
                    {:else}
                      <div
                        class="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(146,131,116,0.34),rgba(104,92,83,0.54)),rgba(120,110,100,0.42)]"
                      >
                        <span
                          class="px-6 text-center text-sm uppercase tracking-[0.22em] text-gruvbox-muted"
                        >
                          Image Coming Soon
                        </span>
                      </div>
                    {/if}
                  </div>
                {/key}

                {#key activeFeatureIndex}
                  <article
                    class="absolute bottom-0 left-0 z-10 flex h-full w-full items-end justify-center p-0 transition-[transform,opacity] duration-200 ease-out group-hover:translate-y-[1.35rem] group-hover:opacity-0 group-focus-within:translate-y-[1.35rem] group-focus-within:opacity-0 motion-reduce:transition-none"
                    in:fade={{ duration: prefersReducedMotion ? 0 : 180 }}
                    out:fade={{ duration: prefersReducedMotion ? 0 : 140 }}
                  >
                    <p
                      class="m-0 max-h-80 w-full overflow-auto bg-[rgba(255,255,255,0.1)] px-4 py-[0.9rem] text-sm leading-7 text-gruvbox-muted shadow-[0_-10px_24px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[18px]"
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
                  class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(235,219,178,0.12)] bg-[rgba(40,40,40,0.72)] text-base leading-none text-gruvbox-text shadow-[0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur-[12px] transition-[transform,border-color,color,background-color] duration-200 ease-out hover:-translate-y-px hover:border-[rgba(254,128,25,0.3)] hover:bg-[rgba(60,56,54,0.9)] hover:text-white motion-reduce:transition-none"
                  onclick={showPreviousFeature}
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
                  class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(235,219,178,0.12)] bg-[rgba(40,40,40,0.72)] text-base leading-none text-gruvbox-text shadow-[0_10px_26px_rgba(0,0,0,0.18)] backdrop-blur-[12px] transition-[transform,border-color,color,background-color] duration-200 ease-out hover:-translate-y-px hover:border-[rgba(254,128,25,0.3)] hover:bg-[rgba(60,56,54,0.9)] hover:text-white motion-reduce:transition-none"
                  onclick={showNextFeature}
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
              class={`group relative w-full bg-transparent py-[0.7rem] pr-[14px] text-right text-base font-light leading-[1.35] transition-[color,transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                index === activeFeatureIndex
                  ? "font-semibold text-gruvbox-accent [text-shadow:0_0_18px_rgba(254,128,25,0.12)]"
                  : "text-[rgba(235,219,178,0.88)] hover:-translate-x-1 hover:text-gruvbox-text"
              }`}
              onclick={() => setActiveFeature(index, true)}
              aria-pressed={index === activeFeatureIndex}
            >
              <span
                class={`absolute right-0 top-1/2 h-1.5 w-px -translate-y-1/2 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                  index === activeFeatureIndex
                    ? "bg-current opacity-100"
                    : "bg-current opacity-70"
                }`}
                aria-hidden="true"
              ></span>
              {feature.title}
            </button>
          {/each}
        </div>
      </aside>
    </div>
  </div>
</section>
