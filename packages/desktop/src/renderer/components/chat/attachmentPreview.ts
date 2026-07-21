import type { ChatAttachment } from "../../lib/types";

const IMAGE_FILE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;

export function isImageAttachment(
  attachment: Pick<ChatAttachment, "name" | "mime">,
): boolean {
  if (attachment.mime.startsWith("image/")) return true;
  return IMAGE_FILE_EXTENSION_PATTERN.test(attachment.name);
}

export function formatAttachmentSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function fileUrlFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const withLeadingSlash = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
  const encodedPath = withLeadingSlash
    .split("/")
    .map((segment, index) => {
      if (index === 0) return "";
      if (/^[A-Za-z]:$/.test(segment)) return segment;
      return encodeURIComponent(segment);
    })
    .join("/");
  return `file://${encodedPath}`;
}

export function attachmentPreviewUrl(
  attachment: Pick<ChatAttachment, "path" | "url">,
): string {
  if (
    attachment.url?.startsWith("data:") ||
    attachment.url?.startsWith("blob:")
  ) {
    return attachment.url;
  }
  return fileUrlFromPath(attachment.path);
}
