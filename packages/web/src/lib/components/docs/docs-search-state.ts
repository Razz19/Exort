import { writable } from "svelte/store";

export const docsSearchOpen = writable(false);

export function openDocsSearch() {
  docsSearchOpen.set(true);
}

export function closeDocsSearch() {
  docsSearchOpen.set(false);
}
