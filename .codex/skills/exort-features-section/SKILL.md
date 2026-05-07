---
name: exort-features-section
description: Update the Exort landing-page feature showcase in `packages/web/src/lib/components/landing/FeaturesSection.svelte`. Use when Codex needs to change the feature carousel layout, feature image stage, copy panel, navigation buttons, arrow controls, responsive arrangement, or to migrate touched `.feature-*` styling from `packages/web/src/app.css` into Tailwind utilities.
---

# Exort Features Section

## Overview

Use this skill for focused work on the Exort feature showcase. Keep behavior intact while migrating touched feature styling out of `app.css` and into Tailwind classes in `FeaturesSection.svelte`.

## Quick Start

Open these files first:
- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
- `packages/web/src/app.css`
- `references/file-map.md`
- `references/migration-checklist.md`

Use `$exort-landing-page` instead if the request also touches navbar, footer, hero, download, or shared page structure.

## Workflow

1. Confirm that the request is features-only.
Stay inside the feature showcase unless the user explicitly asks for wider landing-page edits.

2. Inspect markup and behavior together.
Review the active feature state, rotation timers, GSAP setup, reduced-motion handling, and current feature markup before changing styling or layout.

3. Style in Tailwind, not new CSS.
Apply layout, spacing, colors, borders, shadows, overlay placement, and responsive behavior in `FeaturesSection.svelte` with Tailwind utilities.

4. Migrate touched selectors.
If the request touches any `.feature-*` selector listed in `references/migration-checklist.md`, move that styling into the markup during the same change and remove or reduce the old selector.

5. Preserve behavior by default.
Keep feature rotation timing, manual pause behavior, image preloading, fade transitions, GSAP entrance sequencing, and reduced-motion compatibility unless the user explicitly requests motion changes.

6. Verify in the web package.
Run `npm run build --workspace=packages/web` after substantial changes.

## Editing Rules

- Keep feature image semantics and alt text intact.
- Keep interactive controls keyboard-accessible.
- Remove dead selectors and keyframes when a visual treatment is migrated or deleted.
- Do not move section work into `app.css` unless the change is genuinely global.

## References

- Read `references/file-map.md` for the feature section ownership map.
- Read `references/migration-checklist.md` before changing feature visuals backed by `app.css`.
