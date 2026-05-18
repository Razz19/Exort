import type { Component } from 'svelte';

export interface DocsFrontmatter {
  title: string;
  description?: string;
  order?: number;
  section?: string;
}

export interface DocsEntry {
  filePath: string;
  modulePath: string;
  slug: string;
  slugParts: string[];
  href: string;
  title: string;
  description?: string;
  order: number;
  section: string;
}

export interface DocsSidebarLinkNode {
  type: 'link';
  id: string;
  title: string;
  href: string;
  order: number;
}

export interface DocsSidebarFolderNode {
  type: 'folder';
  id: string;
  title: string;
  children: DocsSidebarNode[];
}

export type DocsSidebarNode = DocsSidebarFolderNode | DocsSidebarLinkNode;

export interface DocsSidebarSection {
  id: string;
  title: string;
  nodes: DocsSidebarNode[];
}

export interface DocsCatalog {
  docs: DocsEntry[];
  sidebar: DocsSidebarSection[];
}

const docsModules = import.meta.glob('/src/lib/docs/**/*.{md,svx}');
const sectionOrder = ['Intro', 'Usage', 'Configuration', 'Guides', 'Reference', 'Community'] as const;
let docsCatalogPromise: Promise<DocsCatalog> | null = null;
const docsModuleCache = new Map<string, { default?: Component; metadata?: unknown }>();

export async function getDocsCatalog(): Promise<DocsCatalog> {
  docsCatalogPromise ??= buildDocsCatalog();
  return docsCatalogPromise;
}

export async function getDocBySlug(slugParts: string[]): Promise<DocsEntry | undefined> {
  const catalog = await getDocsCatalog();
  const slug = slugParts.join('/');
  return catalog.docs.find((entry) => entry.slug === slug);
}

export async function loadDocComponent(modulePath: string): Promise<Component> {
  const loaded = await loadDocsModule(modulePath);
  if (!loaded.default) {
    throw new Error(`Docs module "${modulePath}" does not export a default component`);
  }

  return loaded.default;
}

async function buildDocsCatalog(): Promise<DocsCatalog> {
  const docs: DocsEntry[] = [];

  for (const modulePath of Object.keys(docsModules)) {
    const moduleValue = await loadDocsModule(modulePath);
    const frontmatter = parseFrontmatter(moduleValue.metadata, modulePath);
    const slugParts = toSlugParts(modulePath);

    // Root-level index/readme is not used in the current docs setup.
    if (slugParts.length === 0) {
      continue;
    }

    const { slug, href } = resolveDocRoute(slugParts);
    const section = resolveSection(frontmatter.section, slugParts);

    docs.push({
      filePath: toDocsRelativePath(modulePath),
      modulePath,
      slug,
      slugParts,
      href,
      title: frontmatter.title,
      description: frontmatter.description,
      order: frontmatter.order ?? Number.MAX_SAFE_INTEGER,
      section
    });
  }

  docs.sort(sortDocsEntries);

  return {
    docs,
    sidebar: buildSidebar(docs)
  };
}

async function loadDocsModule(modulePath: string): Promise<{ default?: Component; metadata?: unknown }> {
  const fromCache = docsModuleCache.get(modulePath);
  if (fromCache) {
    return fromCache;
  }

  const loader = docsModules[modulePath];
  if (!loader) {
    throw new Error(`No docs module loader found for "${modulePath}"`);
  }

  const loaded = (await loader()) as { default?: Component; metadata?: unknown };
  docsModuleCache.set(modulePath, loaded);
  return loaded;
}

function parseFrontmatter(raw: unknown, modulePath: string): DocsFrontmatter {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Missing frontmatter in docs file "${modulePath}"`);
  }

  const metadata = raw as Record<string, unknown>;

  if (typeof metadata.title !== 'string' || metadata.title.trim().length === 0) {
    throw new Error(`Docs file "${modulePath}" must define a non-empty frontmatter title`);
  }

  const parsed: DocsFrontmatter = {
    title: metadata.title.trim()
  };

  if (typeof metadata.description === 'string' && metadata.description.trim().length > 0) {
    parsed.description = metadata.description.trim();
  }

  if (typeof metadata.order === 'number' && Number.isFinite(metadata.order)) {
    parsed.order = metadata.order;
  }

  if (typeof metadata.section === 'string' && metadata.section.trim().length > 0) {
    parsed.section = metadata.section.trim();
  }

  return parsed;
}

function toSlugParts(modulePath: string): string[] {
  const relative = toDocsRelativePath(modulePath);
  const noExtension = relative.replace(/\.(md|svx)$/i, '');
  const segments = noExtension.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  const tail = segments.at(-1)?.toLowerCase();
  if (tail === 'index' || tail === 'readme') {
    segments.pop();
  }

  return segments;
}

function toDocsRelativePath(modulePath: string): string {
  return modulePath.replace('/src/lib/docs/', '');
}

function resolveSection(frontmatterSection: string | undefined, slugParts: string[]): string {
  if (frontmatterSection) {
    return frontmatterSection;
  }

  if (slugParts.length > 1) {
    return formatSegment(slugParts[0]);
  }

  return 'General';
}

function resolveDocRoute(slugParts: string[]): { slug: string; href: string } {
  if (slugParts.length === 1 && slugParts[0].toLowerCase() === 'introduction') {
    return { slug: '', href: '/docs' };
  }

  const slug = slugParts.join('/');
  return { slug, href: `/docs/${slug}` };
}

function buildSidebar(docs: DocsEntry[]): DocsSidebarSection[] {
  const sections = new Map<string, DocsSidebarSection>();

  for (const doc of docs) {
    const sectionId = toKebab(doc.section);
    const section =
      sections.get(sectionId) ??
      {
        id: sectionId,
        title: doc.section,
        nodes: []
      };

    if (!sections.has(sectionId)) {
      sections.set(sectionId, section);
    }

    const sidebarPath =
      doc.slugParts.length > 1 && doc.section === formatSegment(doc.slugParts[0])
        ? doc.slugParts.slice(1)
        : doc.slugParts;

    insertDocNode(section.nodes, sidebarPath, doc);
  }

  const orderedSections = Array.from(sections.values()).sort(sortSidebarSections);

  for (const section of orderedSections) {
    sortSidebarNodes(section.nodes);
  }

  return orderedSections;
}

function sortSidebarSections(a: DocsSidebarSection, b: DocsSidebarSection): number {
  const orderA = sectionOrder.indexOf(a.title as (typeof sectionOrder)[number]);
  const orderB = sectionOrder.indexOf(b.title as (typeof sectionOrder)[number]);

  if (orderA !== -1 || orderB !== -1) {
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    if (orderA !== orderB) return orderA - orderB;
  }

  return a.title.localeCompare(b.title);
}

function insertDocNode(rootNodes: DocsSidebarNode[], path: string[], doc: DocsEntry) {
  const folderSegments = path.slice(0, -1);
  let currentNodes = rootNodes;
  let parentId = `section:${toKebab(doc.section)}`;

  for (const segment of folderSegments) {
    const folderId = `${parentId}/${segment.toLowerCase()}`;
    let folder = currentNodes.find(
      (node): node is DocsSidebarFolderNode => node.type === 'folder' && node.id === folderId
    );

    if (!folder) {
      folder = {
        type: 'folder',
        id: folderId,
        title: formatSegment(segment),
        children: []
      };
      currentNodes.push(folder);
    }

    currentNodes = folder.children;
    parentId = folderId;
  }

  currentNodes.push({
    type: 'link',
    id: `doc:${doc.slug}`,
    title: doc.title,
    href: doc.href,
    order: doc.order
  });
}

function sortSidebarNodes(nodes: DocsSidebarNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }

    if (a.type === 'folder' && b.type === 'folder') {
      return a.title.localeCompare(b.title);
    }

    if (a.type === 'link' && b.type === 'link') {
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.title.localeCompare(b.title);
    }

    return 0;
  });

  for (const node of nodes) {
    if (node.type === 'folder') {
      sortSidebarNodes(node.children);
    }
  }
}

function sortDocsEntries(a: DocsEntry, b: DocsEntry): number {
  if (a.order !== b.order) {
    return a.order - b.order;
  }

  const titleCompare = a.title.localeCompare(b.title);
  if (titleCompare !== 0) {
    return titleCompare;
  }

  return a.slug.localeCompare(b.slug);
}

function formatSegment(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toKebab(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
