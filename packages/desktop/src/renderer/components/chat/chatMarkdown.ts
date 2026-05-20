import DOMPurify from "dompurify";
import { marked } from "marked";

let configured = false;
const FILE_PATH_TOKEN_REGEX =
  /(^|[\s([{"'`])((?:(?:[A-Za-z]:[\\/])|\/|\.{1,2}[\\/])?[^\s<>:"'`|?*]+(?:[\\/][^\s<>:"'`|?*]+)*\.[A-Za-z][A-Za-z0-9_+-]{0,15})(?=$|[\s)\]},"'`:;!?])/g;
const KNOWN_FILE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "csv",
  "go",
  "h",
  "hpp",
  "html",
  "ino",
  "java",
  "js",
  "json",
  "jsx",
  "md",
  "mdx",
  "mjs",
  "pdf",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "svelte",
  "svg",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

function hasKnownFileExtension(value: string): boolean {
  const extIndex = value.lastIndexOf(".");
  if (extIndex < 0 || extIndex >= value.length - 1) return false;
  const ext = value.slice(extIndex + 1).toLowerCase();
  return KNOWN_FILE_EXTENSIONS.has(ext);
}

function decodeFileUrl(urlValue: string): string | null {
  if (!urlValue.toLowerCase().startsWith("file://")) return null;
  try {
    const parsed = new URL(urlValue);
    return decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
}

function normalizeFileLinkCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decodedFileUrl = decodeFileUrl(trimmed);
  const candidate = decodedFileUrl ?? trimmed;
  if (!hasKnownFileExtension(candidate)) return null;

  return candidate.replace(/\\/g, "/");
}

function markPathLinks(root: ParentNode): void {
  const anchors = root.querySelectorAll("a[href]");
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href") ?? "";
    const normalized = normalizeFileLinkCandidate(href);
    if (!normalized) continue;

    anchor.setAttribute("href", "#");
    anchor.setAttribute("data-exort-file-path", normalized);
    anchor.classList.add("chat-file-link");
  }
}

function linkifyPathText(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement) continue;
    if (node.parentElement.closest("a, pre, code")) continue;
    textNodes.push(node);
  }

  for (const node of textNodes) {
    const original = node.nodeValue ?? "";
    if (!original.trim()) continue;

    FILE_PATH_TOKEN_REGEX.lastIndex = 0;
    const matches = [...original.matchAll(FILE_PATH_TOKEN_REGEX)];
    if (matches.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let replaced = false;

    for (const match of matches) {
      const full = match[0] ?? "";
      const prefix = match[1] ?? "";
      const candidate = match[2] ?? "";
      if (typeof match.index !== "number") continue;

      const normalized = normalizeFileLinkCandidate(candidate);
      if (!normalized) continue;

      const fullStart = match.index;
      const candidateStart = fullStart + prefix.length;

      if (fullStart > cursor) {
        fragment.append(original.slice(cursor, fullStart));
      }
      if (prefix) {
        fragment.append(prefix);
      }

      const anchor = document.createElement("a");
      anchor.href = "#";
      anchor.textContent = candidate;
      anchor.setAttribute("data-exort-file-path", normalized);
      anchor.className = "chat-file-link";
      fragment.append(anchor);

      cursor = candidateStart + candidate.length;
      replaced = true;
    }

    if (!replaced) continue;
    if (cursor < original.length) {
      fragment.append(original.slice(cursor));
    }
    node.replaceWith(fragment);
  }
}

function markChatFileLinks(content: string): string {
  const template = document.createElement("template");
  template.innerHTML = content;
  markPathLinks(template.content);
  linkifyPathText(template.content);
  return template.innerHTML;
}

export function filePathFromChatClickTarget(target: EventTarget | null): string | null {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!element) {
    console.debug("[ChatFileLink] click target is not an element/node", {
      targetType: typeof target,
    });
    return null;
  }
  const anchor = element.closest("a[data-exort-file-path]");
  if (!anchor) {
    const plainAnchor = element.closest("a");
    if (plainAnchor) {
      console.debug("[ChatFileLink] clicked anchor without data-exort-file-path", {
        href: plainAnchor.getAttribute("href"),
        text: plainAnchor.textContent?.trim() ?? "",
      });
    }
    return null;
  }
  const taggedPath = anchor.getAttribute("data-exort-file-path")?.trim() ?? null;
  console.debug("[ChatFileLink] extracted tagged path", {
    taggedPath,
    text: anchor.textContent?.trim() ?? "",
  });
  return taggedPath;
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function joinPath(root: string, child: string): string {
  const separator = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  const normalizedRoot = root.replace(/[\\/]+$/, "");
  const normalizedChild = child.replace(/^[.][\\/]/, "").replace(/^[\\/]+/, "");
  if (!normalizedChild) return normalizedRoot;
  return `${normalizedRoot}${separator}${normalizedChild}`;
}

export function resolveChatFilePath(
  rawPath: string,
  workspaceRoot: string | null | undefined,
): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (isAbsolutePath(trimmed)) return trimmed;
  if (!workspaceRoot) return null;
  return joinPath(workspaceRoot, trimmed);
}

function configureMarkdown(): void {
  if (configured) return;
  marked.setOptions({
    gfm: true,
    breaks: true,
  });
  configured = true;
}

export function renderMarkdown(content: string): string {
  configureMarkdown();
  const html = DOMPurify.sanitize(String(marked.parse(content)));
  return markChatFileLinks(html);
}
