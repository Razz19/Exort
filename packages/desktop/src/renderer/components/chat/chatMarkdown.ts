import DOMPurify from "dompurify";
import { marked } from "marked";

let configured = false;

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
  return DOMPurify.sanitize(String(marked.parse(content)));
}
