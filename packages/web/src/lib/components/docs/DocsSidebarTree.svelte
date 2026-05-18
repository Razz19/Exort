<script lang="ts">
  import DocsSidebarTree from "$lib/components/docs/DocsSidebarTree.svelte";

  import type { DocsSidebarNode } from "$lib/docs/registry";

  interface Props {
    nodes: DocsSidebarNode[];
    currentPath?: string;
    depth?: number;
  }

  let { nodes, currentPath = "", depth = 0 }: Props = $props();

  const isActive = (href: string) => href === currentPath;
</script>

<ul class={depth > 0 ? "ml-3 border-l pl-2" : ""}>
  {#each nodes as node}
    <li class="py-1">
      {#if node.type === "link"}
        <a
          href={node.href}
          class={`relative block px-2 py-1 pr-4 text-sm transition-colors duration-150 after:absolute after:left-0 after:top-0 after:h-full after:w-0.5 after:bg-transparent after:transition-colors after:duration-150 ${
            isActive(node.href)
              ? "text-gruvbox-orange after:!bg-gruvbox-orange hover:text-gruvbox-orange hover:after:!bg-gruvbox-orange focus-visible:text-gruvbox-orange focus-visible:after:!bg-gruvbox-orange"
              : "text-gruvbox-fg1 hover:text-gruvbox-yellow hover:after:bg-gruvbox-yellow focus-visible:text-gruvbox-yellow focus-visible:after:bg-gruvbox-yellow active:text-gruvbox-orange active:after:bg-gruvbox-orange"
          }`}
          aria-current={isActive(node.href) ? "page" : undefined}
        >
          {node.title}
        </a>
      {:else}
        <p class="px-2 py-1 text-sm text-gruvbox-muted">{node.title}</p>
        <DocsSidebarTree
          nodes={node.children}
          {currentPath}
          depth={depth + 1}
        />
      {/if}
    </li>
  {/each}
</ul>
