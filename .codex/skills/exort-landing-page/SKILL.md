---
name: exort-landing-page
description: Update the Exort marketing site at `packages/web` when requests span multiple landing-page sections or target shared page structure such as navbar, footer, section spacing, or overall layout. Use when Codex needs to edit the whole landing page, coordinate changes across hero/features/download, or migrate touched landing-page styling from `packages/web/src/app.css` into Tailwind utilities in Svelte markup.
---

# Exort Landing Page

## Overview

Use this skill for whole-page Exort landing-site work and for requests that cross section boundaries. Treat section-specific CSS in `packages/web/src/app.css` as migration debt: when you touch a section, move its styling into Tailwind utilities instead of extending the CSS file.

## Quick Start

Open these files first:
- `packages/web/src/routes/+page.svelte`
- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
- `packages/web/src/lib/components/landing/DownloadSection.svelte`
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
Apply layout, spacing, color, border, radius, typography, and responsive changes in Svelte markup with Tailwind utilities. Do not add new section-specific selectors to `app.css`.

4. Migrate touched CSS instead of extending it.
If a request touches a section that still depends on `.hero-*`, `.feature-*`, `.download-*`, `.local-setup-*`, or similar selectors, move the touched styling into the markup as part of the same change and delete or shrink the old selector block.

5. Preserve behavior while migrating presentation.
Keep existing GSAP, reduced-motion handling, copy-to-clipboard behavior, and carousel timing unless the user explicitly asks to change behavior.

6. Verify in the web package.
Run `npm run build --workspace=packages/web` after substantial landing-page changes. Treat unrelated warnings as follow-up work unless they block the requested change.

## Editing Rules

- Keep `app.css` for global concerns only when practical: font-face declarations, root tokens, document-level resets, selection styling, and other truly shared primitives.
- Keep section ownership clear. Avoid mixing hero work into download or feature components unless the request requires a cross-section redesign.
- Preserve accessibility basics: heading order, link labels, button labels, image alt text, and keyboard focus states.
- Remove dead selectors, keyframes, and variables when their paired markup or behavior is removed.

## References

- Read `references/file-map.md` for the current landing-page ownership map.
- Read `references/tailwind-migration-rules.md` before any styling change that touches `app.css`.
