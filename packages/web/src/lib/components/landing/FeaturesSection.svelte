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

  let prefersReducedMotion = false;
  let activeFeatureIndex = 0;
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
      }, featuresSection);

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
