# Exort Features Section File Map

## Primary files

- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
Owns the feature showcase markup, active feature state, timers, image preload behavior, fade transitions, reduced-motion handling, and GSAP setup.

- `packages/web/tailwind.config.cjs`
Contains shared gruvbox theme tokens and the hero/title animation definitions that may also influence shared landing-page visuals.

- `packages/web/src/app.css`
Contains global base concerns only. Do not use it for feature presentation.

## Ownership rules

- Structure, spacing, responsive layout, control markup, and presentation:
Prefer editing `FeaturesSection.svelte` with Tailwind utilities.

- Behavior:
Keep the existing rotation, manual pause, image preload, transitions, and GSAP semantics unless the user explicitly requests a motion or interaction change.

- CSS:
Keep feature presentation in markup utilities. Keep non-utility classes only when transitions or scripts need stable structure.
