export function docsCodeCopy(node: HTMLElement) {
  const cleanupCallbacks: Array<() => void> = [];
  const copyIcon = `
    <svg class="h-4 w-4 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
    </svg>
  `;
  const copyCheckIcon = `
    <svg class="h-4 w-4 block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m12 15 2 2 4-4"></path>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
    </svg>
  `;

  const markCopied = (button: HTMLButtonElement) => {
    button.classList.add("text-gruvbox-orange");
    button.classList.remove("text-gruvbox-fg1");
    button.innerHTML = copyCheckIcon;
  };

  const clearCopied = (button: HTMLButtonElement) => {
    button.classList.remove("text-gruvbox-orange");
    button.classList.add("text-gruvbox-fg1");
    button.innerHTML = copyIcon;
  };

  const decorateCodeBlocks = () => {
    const codeBlocks = node.querySelectorAll<HTMLElement>("pre");

    for (const block of codeBlocks) {
      if (block.dataset.docsCopyReady === "true") {
        continue;
      }

      const codeEl = block.querySelector("code");
      if (!codeEl) {
        continue;
      }

      block.dataset.docsCopyReady = "true";
      block.classList.add("docs-code-copy-target");

      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "docs-code-copy-btn inline-flex absolute top-0 right-0 h-9 w-9 items-center justify-center self-start bg-transparent p-2 leading-none transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none text-gruvbox-fg1 hover:text-gruvbox-orange focus-visible:text-gruvbox-orange";
      button.setAttribute("aria-label", "Copy code");
      button.title = "Copy code";
      button.innerHTML = copyIcon;

      let resetTimeout: number | null = null;

      const copyHandler = async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
          return;
        }

        const command = codeEl.textContent ?? "";
        if (!command.trim()) {
          return;
        }

        try {
          await navigator.clipboard.writeText(command);
          if (resetTimeout) {
            window.clearTimeout(resetTimeout);
          }

          markCopied(button);
          resetTimeout = window.setTimeout(() => {
            clearCopied(button);
            resetTimeout = null;
          }, 1800);
        } catch {
          clearCopied(button);
        }
      };

      button.addEventListener("click", copyHandler);
      block.appendChild(button);

      cleanupCallbacks.push(() => {
        button.removeEventListener("click", copyHandler);
        if (resetTimeout) {
          window.clearTimeout(resetTimeout);
        }
      });
    }
  };

  decorateCodeBlocks();

  const observer = new MutationObserver(() => {
    decorateCodeBlocks();
  });

  observer.observe(node, {
    childList: true,
    subtree: true,
  });

  return {
    destroy() {
      observer.disconnect();
      for (const cleanup of cleanupCallbacks) {
        cleanup();
      }
    },
  };
}
