<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import AppFrame from "$lib/components/landing/AppFrame.svelte";

  type FeatureItem = {
    title: string;
    description: string;
    video: string;
  };

  type FeatureAccent = {
    text: string;
    muted: string;
  };

  let { features }: { features: FeatureItem[] } = $props();

  let prefersReducedMotion = $state(false);
  let activeFeatureIndex = $state(0);
  let featureVideoEl = $state<HTMLVideoElement | null>(null);
  let featureVideoDuration = $state(0);
  let featureVideoCurrentTime = $state(0);
  let featuresSection: HTMLElement | null = null;
  let featuresIntroEl: HTMLElement | null = null;
  let featurePanelEl: HTMLElement | null = null;
  let featureInfoEl: HTMLElement | null = null;
  let gsapRef: Awaited<typeof import("gsap")>["gsap"] | null = null;
  const videoProgressRadius = 20;
  const videoProgressCircumference = 2 * Math.PI * videoProgressRadius;
  const sidebarFeatureAccentByTitle: Record<string, FeatureAccent> = {
    "Provider Connection": {
      text: "text-gruvbox-blue",
      muted: "text-gruvbox-blue/80",
    },
    "Board Manager": {
      text: "text-gruvbox-green",
      muted: "text-gruvbox-green/80",
    },
    "Serial Monitor": {
      text: "text-gruvbox-yellow",
      muted: "text-gruvbox-yellow/80",
    },
    "Serial Plotter": {
      text: "text-gruvbox-orange",
      muted: "text-gruvbox-orange/80",
    },
  };
  const featureButtonAccentByTitle: Record<string, string> = {
    "Provider Connection": "bg-gruvbox-blue",
    "Board Manager": "bg-gruvbox-green",
    "Serial Monitor": "bg-gruvbox-yellow",
    "Serial Plotter": "bg-gruvbox-orange",
  };
  const featureBorderAccentByTitle: Record<string, string> = {
    "Provider Connection": "border-gruvbox-blue/45",
    "Board Manager": "border-gruvbox-green/45",
    "Serial Monitor": "border-gruvbox-yellow/45",
    "Serial Plotter": "border-gruvbox-orange/45",
  };
  const featureSurfaceAccentByTitle: Record<string, string> = {
    "Provider Connection": "bg-gruvbox-blue/10",
    "Board Manager": "bg-gruvbox-green/10",
    "Serial Monitor": "bg-gruvbox-yellow/10",
    "Serial Plotter": "bg-gruvbox-orange/10",
  };
  const featureRailAccentByTitle: Record<string, string> = {
    "Provider Connection": "bg-gruvbox-blue",
    "Board Manager": "bg-gruvbox-green",
    "Serial Monitor": "bg-gruvbox-yellow",
    "Serial Plotter": "bg-gruvbox-orange",
  };
  const activeFeature = $derived(features[activeFeatureIndex]);
  const activeFeatureAccent = $derived(
    sidebarFeatureAccentByTitle[activeFeature?.title] ?? {
      text: "text-gruvbox-accent",
      muted: "text-gruvbox-text/70",
    },
  );

  const remainingVideoTime = $derived.by(() =>
    Math.max(0, featureVideoDuration - featureVideoCurrentTime),
  );

  const videoProgress = $derived.by(() =>
    featureVideoDuration > 0
      ? Math.min(featureVideoCurrentTime / featureVideoDuration, 1)
      : 0,
  );

  const videoProgressOffset = $derived.by(
    () => videoProgressCircumference * (1 - videoProgress),
  );

  const setActiveFeature = (index: number) => {
    featureVideoCurrentTime = 0;
    featureVideoDuration = 0;
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

  const syncFeatureVideoProgress = () => {
    if (!featureVideoEl) {
      featureVideoCurrentTime = 0;
      return;
    }

    featureVideoCurrentTime = featureVideoEl.currentTime;
  };

  const syncFeatureVideoDuration = () => {
    if (!featureVideoEl) {
      featureVideoDuration = 0;
      return;
    }

    featureVideoDuration = Number.isFinite(featureVideoEl.duration)
      ? featureVideoEl.duration
      : 0;
  };

  const syncFeatureVideoState = () => {
    syncFeatureVideoDuration();
    syncFeatureVideoProgress();
  };

  const formatRemainingTime = (seconds: number) => {
    const roundedSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(roundedSeconds / 60);
    const remainingSeconds = roundedSeconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const ensureGsap = async () => {
    if (gsapRef) {
      return gsapRef;
    }

    const { gsap } = await import("gsap");
    gsapRef = gsap;
    return gsap;
  };

  $effect(() => {
    const video = featureVideoEl;
    activeFeatureIndex;

    if (!video || typeof window === "undefined") {
      return;
    }

    const sync = () => {
      if (featureVideoEl === video) {
        syncFeatureVideoState();
      }
    };

    sync();

    const rafId = window.requestAnimationFrame(sync);

    video.addEventListener("loadedmetadata", sync);
    video.addEventListener("loadeddata", sync);
    video.addEventListener("canplay", sync);

    return () => {
      window.cancelAnimationFrame(rafId);
      video.removeEventListener("loadedmetadata", sync);
      video.removeEventListener("loadeddata", sync);
      video.removeEventListener("canplay", sync);
    };
  });

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
          [featuresIntroEl, featurePanelEl, featureInfoEl].filter(Boolean),
          {
            willChange: "transform, opacity",
          },
        );

        if (featuresSection && (featuresIntroEl || featurePanelEl)) {
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

          if (featureInfoEl) {
            featuresTimeline.from(
              featureInfoEl,
              {
                x: 40,
                opacity: 0,
              },
              0.18,
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
  class="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:pt-16 lg:pb-20"
>
  <div bind:this={featuresIntroEl} class="flex w-full justify-start">
    <span class="text-sm uppercase tracking-[0.24em] text-gruvbox-accent-soft">
      Core Features
    </span>
  </div>

  <div class="mt-12">
    <div
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch lg:gap-8"
    >
      <div bind:this={featurePanelEl} class="order-2 min-w-0 lg:order-1">
        <div class="grid gap-6">
          <div class="relative mx-auto w-full max-w-4xl">
            <AppFrame contentClass="p-2 sm:p-3" showIndicator={true}>
              {#snippet indicator()}
                <div
                  class="flex items-center gap-3 rounded-full px-3 py-2 text-gruvbox-fg0"
                >
                  <div class="relative h-8 w-8 shrink-0">
                    <svg
                      class="-rotate-90 h-full w-full"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r={videoProgressRadius}
                        fill="none"
                        stroke="rgba(251, 241, 199, 0.14)"
                        stroke-width="3.5"
                      ></circle>
                      <circle
                        cx="24"
                        cy="24"
                        r={videoProgressRadius}
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-width="3.5"
                        stroke-dasharray={videoProgressCircumference}
                        stroke-dashoffset={videoProgressOffset}
                      ></circle>
                    </svg>
                    <div
                      class="absolute inset-0 flex items-center justify-center text-[10px] font-medium tracking-[0.08em] text-gruvbox-fg0"
                    >
                      {Math.max(0, Math.ceil(remainingVideoTime))}
                    </div>
                  </div>
                </div>
              {/snippet}
              <div
                class="relative aspect-[16/10] w-full overflow-hidden bg-gruvbox-ink-strong"
                aria-label={`${features[activeFeatureIndex].title} feature preview`}
                style="border-radius: 10px !important;"
              >
                {#key activeFeatureIndex}
                  <div
                    class="absolute inset-0"
                    in:fade={{ duration: prefersReducedMotion ? 0 : 180 }}
                    out:fade={{ duration: prefersReducedMotion ? 0 : 140 }}
                  >
                    <video
                      bind:this={featureVideoEl}
                      src={features[activeFeatureIndex].video}
                      aria-label={`${features[activeFeatureIndex].title} demo video`}
                      class="block h-full w-full object-contain object-top"
                      autoplay
                      onloadeddata={syncFeatureVideoState}
                      onloadedmetadata={syncFeatureVideoDuration}
                      oncanplay={syncFeatureVideoState}
                      ondurationchange={syncFeatureVideoDuration}
                      ontimeupdate={syncFeatureVideoProgress}
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

          <div class="flex items-center justify-center gap-2.5">
            {#each features as _, index}
              <button
                type="button"
                aria-label={`Show feature ${index + 1}`}
                aria-pressed={index === activeFeatureIndex}
                class={`h-0.5 w-4 rounded-full transition-colors ${
                  index === activeFeatureIndex
                    ? (featureButtonAccentByTitle[features[index]?.title] ??
                      "bg-gruvbox-accent")
                    : "bg-gruvbox-muted/55"
                }`}
                onclick={() => setActiveFeature(index)}
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <aside
        bind:this={featureInfoEl}
        class="order-1 min-w-0 lg:order-2 lg:pr-2"
      >
        <div class="relative h-fit overflow-hidden">
          <div class="flex flex-col space-y-2">
            {#each features as feature, index}
              <button
                type="button"
                aria-pressed={index === activeFeatureIndex}
                class={`relative overflow-hidden px-4 py-2 text-left transition duration-200 ${
                  index === activeFeatureIndex
                    ? "block w-full"
                    : "hidden w-full lg:block"
                } ${
                  index === activeFeatureIndex
                    ? `${featureBorderAccentByTitle[feature.title] ?? "border-gruvbox-accent/45"} ${featureSurfaceAccentByTitle[feature.title] ?? "bg-gruvbox-accent/10"}`
                    : " bg-gruvbox-bg0/15 hover:bg-gruvbox-bg0/30"
                }`}
                onclick={() => setActiveFeature(index)}
              >
                <div
                  class={`absolute inset-y-0 left-0 w-0.5 ${
                    featureRailAccentByTitle[feature.title] ??
                    "bg-gruvbox-accent"
                  }`}
                  aria-hidden="true"
                ></div>
                <div class="flex items-start gap-4">
                  <div class="min-w-0 space-y-2">
                    <h3
                      class={`text-base sm:text-xl font-semibold font-heading ${
                        index === activeFeatureIndex
                          ? (sidebarFeatureAccentByTitle[feature.title]?.text ??
                            "text-gruvbox-accent")
                          : "text-gruvbox-fg1"
                      }`}
                    >
                      {feature.title}
                    </h3>
                    <p
                      class="text-sm leading-6 sm:leading-7 text-gruvbox-text/85"
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </aside>
    </div>
  </div>
</section>
