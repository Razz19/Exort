import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type MaterializablePromptAttachment = {
  id: string;
  name: string;
  path: string;
  mime: string;
  size: number;
  url?: string;
};

const MAX_INLINE_IMAGE_BYTES = 25 * 1024 * 1024;
const DATA_IMAGE_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i;
const MIME_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp'
};

function safeAttachmentFilename(name: string, mime: string): string {
  const basename = path.basename(name.replace(/\\/g, '/')).trim();
  const sanitized = basename
    .replace(/[^a-z0-9._ -]/gi, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  const fallbackExtension = MIME_EXTENSION_BY_TYPE[mime.toLowerCase()] ?? '.img';
  const filename = sanitized || `clipboard-image${fallbackExtension}`;
  return path.extname(filename) ? filename : `${filename}${fallbackExtension}`;
}

function decodeInlineImage(url: string): { data: Buffer; mime: string } {
  const match = DATA_IMAGE_PATTERN.exec(url);
  if (!match?.[1] || !match[2]) {
    throw new Error('Clipboard image data is invalid or unsupported.');
  }

  const data = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (data.length === 0) {
    throw new Error('Clipboard image is empty.');
  }
  if (data.length > MAX_INLINE_IMAGE_BYTES) {
    throw new Error('Clipboard image exceeds the 25 MB attachment limit.');
  }

  return {
    data,
    mime: match[1].toLowerCase()
  };
}

export async function materializeInlineImageAttachments(
  attachments: MaterializablePromptAttachment[] | undefined,
  managedRoot: string
): Promise<MaterializablePromptAttachment[] | undefined> {
  if (!attachments) return undefined;

  const storageRoot = path.join(managedRoot, 'chat-attachments');
  const materialized: MaterializablePromptAttachment[] = [];

  for (const attachment of attachments) {
    const inlineUrl = attachment.url?.trim();
    if (!inlineUrl?.startsWith('data:image/')) {
      materialized.push(attachment);
      continue;
    }

    const { data, mime } = decodeInlineImage(inlineUrl);
    const storageKey = createHash('sha256')
      .update(attachment.id)
      .update('\0')
      .update(data)
      .digest('hex')
      .slice(0, 32);
    const attachmentDirectory = path.join(storageRoot, storageKey);
    const filePath = path.join(
      attachmentDirectory,
      safeAttachmentFilename(attachment.name, mime)
    );

    await mkdir(attachmentDirectory, { recursive: true });
    await writeFile(filePath, data);
    materialized.push({
      ...attachment,
      path: filePath,
      mime,
      size: data.length,
      url: undefined
    });
  }

  return materialized;
}
