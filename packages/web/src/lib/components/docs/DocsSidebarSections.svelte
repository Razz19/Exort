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

  const getSingleLinkNode = (nodes: DocsSidebarNode[]) =>
    nodes.length === 1 && nodes[0]?.type === "link" ? nodes[0] : null;
</script>

{#each sections as section}
  {@const singleLink = getSingleLinkNode(section.nodes)}

  {#if singleLink}
    <a
      href={singleLink.href}
      class={`mb-3 flex list-none items-center justify-between gap-3 px-2 py-2 text-left text-[0.72rem] uppercase tracking-[0.2em] transition-colors duration-150 last:mb-0 ${
        singleLink.href === currentPath
          ? "text-gruvbox-orange"
          : "text-gruvbox-muted/85 hover:text-gruvbox-fg1 focus-visible:text-gruvbox-fg1 active:text-gruvbox-orange"
      }`}
      aria-current={singleLink.href === currentPath ? "page" : undefined}
    >
      <span>{section.title}</span>
    </a>
  {:else}
    <details class="group mb-3 last:mb-0" open={!compact && hasActivePath(section.nodes)}>
      <summary
        class="flex cursor-pointer list-none items-start justify-between gap-3 px-2 py-2 text-left text-[0.72rem] uppercase tracking-[0.2em] text-gruvbox-muted/85 transition-colors duration-150 hover:text-gruvbox-fg1 focus-visible:text-gruvbox-fg1 [&::-webkit-details-marker]:hidden"
      >
        <span class="min-w-0">{section.title}</span>
        <svg
          class="mt-0.5 h-3.5 w-3.5 shrink-0 text-gruvbox-muted/75 transition-transform duration-150 group-open:rotate-180"
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
  {/if}
{/each}
