---
name: exort-landing-page
description: Update the Exort marketing site at `packages/web` when requests span multiple landing-page sections or target shared page structure such as navbar, footer, section spacing, or overall layout. Use when Codex needs to edit the whole landing page, coordinate changes across hero/features/download, or keep the landing pages aligned with the Tailwind-first gruvbox theme defined in `packages/web/tailwind.config.cjs`.
---

# Exort Landing Page

## Overview

Use this skill for whole-page Exort landing-site work and for requests that cross section boundaries. The landing site is now Tailwind-first: treat section-specific CSS in `packages/web/src/app.css` as removed migration debt, and keep new visual work in Svelte markup plus `packages/web/tailwind.config.cjs` theme tokens.

## Quick Start

Open these files first:
- `packages/web/src/routes/+page.svelte`
- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
- `packages/web/src/lib/components/landing/DownloadSection.svelte`
- `packages/web/tailwind.config.cjs`
- `packages/web/src/app.css`
- `references/file-map.md`
- `references/tailwind-migration-rules.md`

Use `$exort-hero-section`, `$exort-features-section`, or `$exort-download-section` instead when the request clearly stays inside one section.

## Workflow

1. Confirm scope.
Treat requests that touch nav, footer, page shell, section spacing, or more than one landing section as site-wide work.

2. Map ownership before editing.
Use `references/file-map.md` to decide whether the change belongs in `+page.svelte`, `FeaturesSection.svelte`, `DownloadSection.svelte`, or a genuinely global part of `app.css`.

3. Prefer markup-level styling.
Apply layout, spacing, color, border, radius, typography, motion, and responsive changes in Svelte markup with Tailwind utilities. Put shared gruvbox values in `tailwind.config.cjs` instead of repeating arbitrary values.

4. Touch `app.css` only for true globals.
Keep `app.css` limited to `@font-face`, base/reset behavior, body background, selection styling, and reduced-motion global rules. Do not reintroduce section styling there.

5. Preserve behavior while migrating presentation.
Keep existing GSAP, reduced-motion handling, copy-to-clipboard behavior, and carousel timing unless the user explicitly asks to change behavior.

6. Verify in the web package.
Run `npm run build --workspace=packages/web` after substantial landing-page changes. Treat unrelated warnings as follow-up work unless they block the requested change.

## Editing Rules

- Keep `app.css` for global concerns only: font-face declarations, document-level resets, body-level background treatment, selection styling, and reduced-motion globals.
- Keep shared colors, fonts, shadows, and animation tokens in `tailwind.config.cjs`.
- Keep section ownership clear. Avoid mixing hero work into download or feature components unless the request requires a cross-section redesign.
- Preserve accessibility basics: heading order, link labels, button labels, image alt text, and keyboard focus states.
- Keep the few remaining hook classes only when script logic queries them directly.

## References

- Read `references/file-map.md` for the current landing-page ownership map.
- Read `references/tailwind-migration-rules.md` before any styling change that touches `app.css`.
