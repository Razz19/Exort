<script lang="ts">
  import { Activity } from "lucide-svelte";
  import { onMount } from "svelte";
  import uPlot from "uplot";
  import type { AlignedData, Series } from "uplot";
  import type { SerialPlotState } from "../lib/types";

  const SERIES_COLORS = [
    "#8ec07c",
    "#83a598",
    "#d3869b",
    "#fabd2f",
    "#b8bb26",
    "#fe8019",
    "#fb4934",
    "#b16286",
  ];

  let { plotState } = $props<{
    plotState: SerialPlotState;
  }>();

  let rootEl = $state<HTMLDivElement | null>(null);
  let hostEl = $state<HTMLDivElement | null>(null);
  let plotInstance: uPlot | null = null;
  let currentSchema = "";
  let width = $state(0);
  let height = $state(0);

  let hasPlottableData = $derived(
    plotState.seriesOrder.length > 0 && plotState.samplesX.length > 0,
  );

  function seriesColorAt(index: number): string {
    return SERIES_COLORS[index % SERIES_COLORS.length] ?? "#83a598";
  }

  function buildAlignedData(): AlignedData {
    const aligned: AlignedData = [plotState.samplesX];

    for (const key of plotState.seriesOrder) {
      aligned.push(plotState.seriesValues[key] ?? []);
    }

    return aligned;
  }

  function buildSeriesConfig(): Series[] {
    const config: Series[] = [{ label: "sample" }];

    for (const [index, key] of plotState.seriesOrder.entries()) {
      const series = plotState.seriesByKey[key];
      config.push({
        label: series?.label ?? key,
        stroke: seriesColorAt(index),
        width: 1.8,
        points: { show: false },
      });
    }

    return config;
  }

  function destroyPlot(): void {
    if (!plotInstance) return;
    plotInstance.destroy();
    plotInstance = null;
    currentSchema = "";
  }

  function createPlot(nextWidth: number, nextHeight: number): void {
    if (!hostEl) return;

    const nextSchema = plotState.seriesOrder.join("|");
    const options: uPlot.Options = {
      width: nextWidth,
      height: nextHeight,
      padding: [8, 8, 2, 8],
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { auto: true },
      },
      cursor: {
        drag: {
          x: false,
          y: false,
        },
      },
      axes: [
        {
          stroke: "#a89984",
          grid: { stroke: "#3c3836", width: 1 },
        },
        {
          stroke: "#a89984",
          grid: { stroke: "#3c3836", width: 1 },
        },
      ],
      series: buildSeriesConfig(),
    };

    plotInstance = new uPlot(options, buildAlignedData(), hostEl);
    currentSchema = nextSchema;
  }

  $effect(() => {
    if (!hasPlottableData || !hostEl) {
      destroyPlot();
      return;
    }

    const nextWidth = Math.floor(width);
    const nextHeight = Math.max(220, Math.floor(height));
    if (nextWidth < 200 || nextHeight < 180) return;

    const nextSchema = plotState.seriesOrder.join("|");
    if (!plotInstance || currentSchema !== nextSchema) {
      destroyPlot();
      createPlot(nextWidth, nextHeight);
      return;
    }

    plotInstance.setSize({ width: nextWidth, height: nextHeight });
    plotInstance.setData(buildAlignedData());
  });

  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    });

    if (rootEl) {
      resizeObserver.observe(rootEl);
    }

    return () => {
      resizeObserver.disconnect();
      destroyPlot();
    };
  });
</script>

<div class="serial-plotter flex h-full min-h-0 flex-col">
  <div
    class="flex flex-wrap items-center justify-between gap-2 border-b border-dark-border bg-dark-bgS px-3 py-1.5 text-xs"
  >
    <div class="flex items-center gap-2 text-dark-fg2">
      <Activity class="h-3.5 w-3.5 text-dark-aqua2" />
      <span>Line Plotter</span>
    </div>
    <div class="flex items-center gap-3 text-dark-fg3">
      <span>series {plotState.seriesOrder.length}</span>
      <span>parsed {plotState.parsedCount}</span>
      <span>ignored {plotState.ignoredCount}</span>
    </div>
  </div>

  {#if !hasPlottableData}
    <div
      class="flex min-h-0 flex-1 items-center justify-center px-4 text-sm text-dark-fg3"
    >
      Waiting for plottable RX numeric data...
    </div>
  {:else}
    <div class="min-h-0 flex-1 p-2">
      <div
        class="h-full w-full overflow-hidden rounded-md border border-dark-border bg-dark-bg"
        bind:this={rootEl}
      >
        <div class="h-full w-full" bind:this={hostEl}></div>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center gap-2 border-t border-dark-border bg-dark-bgS px-3 py-1.5 text-[11px]"
    >
      {#each plotState.seriesOrder as key, index (key)}
        <span
          class="inline-flex items-center gap-1.5 rounded border border-dark-border bg-dark-bg px-2 py-0.5 text-dark-fg2"
        >
          <span
            class="h-2 w-2 rounded-full"
            style={`background-color: ${seriesColorAt(index)}`}
          ></span>
          <span>{plotState.seriesByKey[key]?.label ?? key}</span>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .serial-plotter :global(.uplot),
  .serial-plotter :global(.u-title),
  .serial-plotter :global(.u-wrap) {
    background: transparent;
  }

  .serial-plotter :global(.u-axis) {
    color: #a89984;
  }
</style>
