<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import AppFrame from "$lib/components/landing/AppFrame.svelte";

  type FeatureItem = {
    title: string;
    description: string;
    video: string;
  };

  let { features }: { features: FeatureItem[] } = $props();

  let prefersReducedMotion = $state(false);
  let activeFeatureIndex = $state(0);
  let featuresSection: HTMLElement | null = null;
  let featuresIntroEl: HTMLElement | null = null;
  let featureSidebarEl: HTMLElement | null = null;
  let featurePanelEl: HTMLElement | null = null;
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;

  const setActiveFeature = (index: number) => {
    activeFeatureIndex = index;
  };

  const showPreviousFeature = () => {
    setActiveFeature(
      (activeFeatureIndex - 1 + features.length) % features.length,
    );
  };

  const showNextFeature = () => {
    setActiveFeature((activeFeatureIndex + 1) % features.length);
  };

  const handleFeatureVideoEnded = () => {
    showNextFeature();
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

    void loadAnimations();

    return () => {
      mediaQuery.removeEventListener("change", syncReducedMotion);
      cleanupAnimations();
    };
  });
</script>

<section
  id="features"
  bind:this={featuresSection}
  class="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-24"
>
  <div bind:this={featuresIntroEl} class="flex w-full justify-center">
    <span class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft">
      Core Features
    </span>
  </div>

  <div class="mt-12">
    <div
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8"
    >
      <div bind:this={featurePanelEl} class="min-w-0">
        <div class="grid gap-6">
          <div class="relative mx-auto w-full max-w-4xl">
            <AppFrame contentClass="p-2 sm:p-3">
              <div
                class="relative aspect-[16/10] w-full overflow-hidden bg-gruvbox-ink-strong"
                style="border-radius: 10px !important;"
              >
                {#key activeFeatureIndex}
                  <div
                    class="absolute inset-0"
                    in:fade={{ duration: prefersReducedMotion ? 0 : 180 }}
                    out:fade={{ duration: prefersReducedMotion ? 0 : 140 }}
                  >
                    <video
                      src={features[activeFeatureIndex].video}
                      aria-label={`${features[activeFeatureIndex].title} demo video`}
                      class="block h-full w-full object-contain object-top"
                      autoplay
                      onended={handleFeatureVideoEnded}
                      muted
                      playsinline
                      preload="metadata"
                    ></video>
                  </div>
                {/key}
              </div>
            </AppFrame>
          </div>
        </div>
      </div>

      <div class="mt-1.5 flex items-center justify-center gap-2.5 lg:hidden">
        {#each features as _, index}
          <button
            type="button"
            aria-label={`Show feature ${index + 1}`}
            aria-pressed={index === activeFeatureIndex}
            class={`h-0.5 w-4 rounded-full transition-colors ${
              index === activeFeatureIndex
                ? "bg-gruvbox-accent"
                : "bg-gruvbox-muted/70"
            }`}
            onclick={() => setActiveFeature(index)}
          ></button>
        {/each}
      </div>

      <aside bind:this={featureSidebarEl} class="hidden lg:block">
        <div class="sticky top-24 space-y-3">
          {#each features as feature, index}
            <button
              type="button"
              class={`group relative w-full bg-transparent py-[0.7rem] pr-[14px] text-right text-base font-light leading-[1.35] transition-[color,transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
                index === activeFeatureIndex
                  ? "font-semibold text-gruvbox-accent "
                  : "text-gruvbox-muted hover:-translate-x-1 hover:text-gruvbox-text"
              }`}
              onclick={() => setActiveFeature(index)}
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
