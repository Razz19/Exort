---
name: exort-download-section
description: Update the Exort landing-page download and local setup area in `packages/web/src/lib/components/landing/DownloadSection.svelte`. Use when Codex needs to change download card layout, installation-guide panels, overlay behavior, CTA presentation, version block, local setup command rows, copy icon controls, responsive arrangement, or keep the section aligned with the Tailwind-first gruvbox theme.
---

# Exort Download Section

## Overview

Use this skill for focused work on the Exort download cards and local setup panel. Keep behavior intact while editing the Tailwind classes in `DownloadSection.svelte`; the section no longer relies on `app.css` for presentation.

## Quick Start

Open these files first:
- `packages/web/src/lib/components/landing/DownloadSection.svelte`
- `packages/web/tailwind.config.cjs`
- `packages/web/src/app.css`
- `references/file-map.md`
- `references/migration-checklist.md`

Use `$exort-landing-page` instead if the request also touches hero, features, nav, footer, or other shared layout.

## Workflow

1. Confirm that the request is download-section work.
Stay inside `DownloadSection.svelte` unless the request clearly expands beyond this section.

2. Inspect markup and behavior together.
Review download overlay timelines, copy-to-clipboard state, GSAP entrance setup, and reduced-motion handling before making visual changes.

3. Style in Tailwind, not new CSS.
Apply layout, spacing, color, borders, shadows, and responsive behavior in the Svelte markup with Tailwind utilities. Add theme tokens to `tailwind.config.cjs` when a design value is reused.

4. Keep only justified hook classes.
Retain non-utility classes only where the script queries DOM nodes directly for GSAP timelines. Do not keep presentation-only class names.

5. Preserve behavior by default.
Keep copy-to-clipboard behavior, overlay hover timelines, section animations, and reduced-motion compatibility unless the user explicitly requests a behavior change.

6. Verify in the web package.
Run `npm run build --workspace=packages/web` after substantial changes.

## Editing Rules

- Keep download links, platform labels, and copy button labels intact unless the user asks to change content.
- Keep interactive controls keyboard-accessible.
- Keep the current surface hierarchy unless the user asks otherwise:
  - download card bases use solid `#333231`
  - installation-guide and local-run outer panels use solid `#333231`
  - nested code or warning surfaces can stay darker for contrast
- Remove dead selectors when a visual treatment is migrated or deleted.
- Do not add new section-specific selectors to `app.css`.

## References

- Read `references/file-map.md` for the download/local-setup ownership map.
- Read `references/migration-checklist.md` before changing visuals backed by `app.css`.
