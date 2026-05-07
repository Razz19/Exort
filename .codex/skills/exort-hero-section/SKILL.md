---
name: exort-hero-section
description: Update the Exort landing-page hero in `packages/web/src/routes/+page.svelte`. Use when Codex needs to change hero layout, alignment, CTA placement, headline or supporting copy, screenshot positioning, highlight chips, or hero-specific animation, and migrate any touched hero styling from `packages/web/src/app.css` into Tailwind utilities instead of adding new hero CSS.
---

# Exort Hero Section

## Overview

Use this skill to make focused changes to the Exort website hero without re-discovering the landing-page structure each time. Keep changes limited to the hero unless the request explicitly includes nearby sections such as navbar, features, or download, and treat touched hero CSS as migration debt to move into Tailwind utilities.

## Quick Start

Open these files first:
- `packages/web/src/routes/+page.svelte`
- `packages/web/src/app.css`
- `references/file-map.md`

If the request is visual or layout-oriented, inspect the current hero markup before editing and identify which hero selectors in `app.css` should be migrated into the markup as part of the change.

## Workflow

1. Confirm the scope.
Treat "hero" requests as landing-page work unless the user explicitly points to the desktop app or another page.

2. Map the requested change to the implementation surface.
Use `references/file-map.md` to identify the current hero markup and the hero selectors that still live in `app.css`.

3. Keep styling in `+page.svelte`.
Apply layout, spacing, typography, color, border, radius, shadow, and responsive changes in the hero markup with Tailwind utilities. Do not add new hero-specific selectors to `app.css`.

4. Migrate touched hero CSS.
When a request touches styling currently expressed through `.hero-*` selectors or related hero-only styles in `app.css`, move that styling into the markup during the same edit and shrink or delete the old selector block.

5. Clean up dead behavior.
If removing an effect, also remove its state, handlers, CSS selectors, custom properties, and keyframes so the hero does not keep orphaned logic.

6. Verify in the web package.
Run `npm run build --workspace=packages/web` after substantial hero edits. Treat unrelated warnings as separate follow-up work unless they block the requested change.

## Editing Rules

- Prefer targeted edits in the hero section over broad refactors.
- When changing alignment, update both container layout classes and text-width constraints so the result is visually consistent.
- When changing visuals such as overlays, glow, grids, or gradients, migrate or remove the paired CSS and markup together.
- Keep hero copy concise. Do not rewrite product messaging unless the user explicitly asks for copy changes.
- Preserve accessibility basics: meaningful heading structure, CTA text, and image alt text.

## Common Requests

- Center or realign hero text:
Adjust the hero content wrapper, text alignment classes, CTA container alignment, and any width-constraining utility classes that still force the wrong layout. Migrate any touched hero alignment selectors out of `app.css`.

- Remove decorative effects:
Search for the effect in both `+page.svelte` and `app.css`. Delete event handlers, reactive state, loop logic, keyframes, and effect-specific markup together.

- Update screenshot placement:
Treat the screenshot wrapper as a separate block below the hero copy unless the user asks for a split-column hero. Keep the image centered within the existing max-width shell while moving touched screenshot styling into Tailwind.

## Reference

Read `references/file-map.md` when the request touches hero layout, typography, CTA placement, screenshot position, or visual effects and you need the current repo-specific file map.
