---
name: exort-hero-section
description: Update the Exort landing-page hero in `packages/web/src/routes/+page.svelte`. Use when Codex needs to change hero layout, alignment, CTA placement, headline or supporting copy, screenshot positioning, highlight chips, hero CTA button behavior, or hero-specific animation such as the rotating `Open Source` color sweep while keeping the Tailwind-first gruvbox styling consistent.
---

# Exort Hero Section

## Overview

Use this skill to make focused changes to the Exort website hero without re-discovering the landing-page structure each time. Keep changes limited to the hero unless the request explicitly includes nearby sections such as navbar, features, or download. The hero styling now lives in Tailwind utilities and theme tokens rather than hero-specific CSS.

## Quick Start

Open these files first:
- `packages/web/src/routes/+page.svelte`
- `packages/web/tailwind.config.cjs`
- `packages/web/src/app.css`
- `references/file-map.md`

If the request is visual or layout-oriented, inspect the current hero markup first. Only touch `app.css` if the request truly affects a global base rule.

## Workflow

1. Confirm the scope.
Treat "hero" requests as landing-page work unless the user explicitly points to the desktop app or another page.

2. Map the requested change to the implementation surface.
Use `references/file-map.md` to identify whether the change belongs in hero markup, `tailwind.config.cjs`, or a genuine global rule in `app.css`.

3. Keep styling in `+page.svelte`.
Apply layout, spacing, typography, color, border, radius, shadow, and responsive changes in the hero markup with Tailwind utilities. Do not add new hero-specific selectors to `app.css`.

4. Keep hero visuals in utilities.
Express hero title treatment, highlight rows, CTA pills, and screenshot layout in utilities. Add theme tokens to `tailwind.config.cjs` when the same value is reused.

5. Split headline animation edits by responsibility.
Change animated headline overlay markup, stacking order, and per-color delays in `+page.svelte`. Change shared sweep keyframes, duration, and timing functions in `tailwind.config.cjs`.

6. Clean up dead behavior.
If removing an effect, also remove its state, handlers, CSS selectors, custom properties, and keyframes so the hero does not keep orphaned logic.

7. Verify in the web package.
Run `npm run build --workspace=packages/web` after substantial hero edits. Treat unrelated warnings as separate follow-up work unless they block the requested change.

## Editing Rules

- Prefer targeted edits in the hero section over broad refactors.
- When changing alignment, update both container layout classes and text-width constraints so the result is visually consistent.
- When changing visuals such as overlays, glow, grids, or gradients, keep them in markup or Tailwind config rather than section CSS.
- Keep the `Open Source` sweep architecture intact unless the request explicitly asks to replace it:
  - base text stays visible underneath as the fallback layer
  - color overlays are absolute-positioned duplicate text spans
  - per-color stagger delays live in `+page.svelte`
  - reusable sweep keyframes and durations live in `tailwind.config.cjs`
- Keep hero copy concise. Do not rewrite product messaging unless the user explicitly asks for copy changes.
- Preserve accessibility basics: meaningful heading structure, CTA text, and image alt text.
- Keep the hero CTA pills aligned with the current product language:
  - dark `#333231` resting background
  - slide-in color layer from the right on hover
  - dark label text once the hover layer covers the button
  - download uses gruvbox orange
  - Discord uses gruvbox blue

## Common Requests

- Center or realign hero text:
Adjust the hero content wrapper, text alignment classes, CTA container alignment, and width-constraining utility classes together so the layout stays balanced.

- Remove decorative effects:
Search for the effect in both `+page.svelte` and `app.css`. Delete event handlers, reactive state, loop logic, keyframes, and effect-specific markup together.

- Adjust the `Open Source` color sweep:
Treat the base text and overlay spans as a layered system. For startup flashes, fix initial hidden state in `+page.svelte`. For speed, smoothness, pauses, or sweep direction, adjust the keyframes and duration in `tailwind.config.cjs` and keep the stagger delays in sync in `+page.svelte`.

- Update screenshot placement:
Treat the screenshot wrapper as a separate block below the hero copy unless the user asks for a split-column hero. Keep the image centered within the existing max-width shell and preserve the current GSAP bindings.

## Reference

Read `references/file-map.md` when the request touches hero layout, typography, CTA placement, screenshot position, or visual effects and you need the current repo-specific file map.
