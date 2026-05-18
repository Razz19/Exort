<script lang="ts">
  import DocsSidebarTree from "$lib/components/docs/DocsSidebarTree.svelte";

  import type { DocsSidebarNode, DocsSidebarSection } from "$lib/docs/registry";

  interface Props {
    sections: DocsSidebarSection[];
    currentPath: string;
    compact?: boolean;
  }

  let { sections, currentPath, compact = false }: Props = $props();

  const hasActivePath = (nodes: DocsSidebarNode[]): boolean =>
    nodes.some((node) =>
      node.type === "link"
        ? node.href === currentPath
        : hasActivePath(node.children)
    );
</script>

{#each sections as section}
  <details class="group mb-3 last:mb-0" open={!compact && hasActivePath(section.nodes)}>
    <summary
      class="flex cursor-pointer list-none items-center justify-between gap-3 px-2 py-2 text-left text-[0.72rem] uppercase tracking-[0.2em] text-gruvbox-muted/85 [&::-webkit-details-marker]:hidden"
    >
      <span>{section.title}</span>
      <svg
        class="h-3.5 w-3.5 shrink-0 text-gruvbox-muted/75 transition-transform duration-150 group-open:rotate-180"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 6L8 10L12 6"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </summary>

    <div class={compact ? "pl-3" : "pl-3"}>
      <DocsSidebarTree nodes={section.nodes} {currentPath} />
    </div>
  </details>
{/each}
