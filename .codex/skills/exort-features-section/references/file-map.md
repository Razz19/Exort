# Exort Features Section File Map

## Primary files

- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
Owns the feature showcase markup, active feature state, timers, image preload behavior, fade transitions, reduced-motion handling, and GSAP setup.

- `packages/web/src/app.css`
Still contains feature presentation selectors such as `.feature-showcase`, `.feature-nav-button`, `.feature-image-shell`, `.feature-stage`, `.feature-copy`, and `.feature-arrow-button`.

## Ownership rules

- Structure, spacing, responsive layout, control markup, and presentation:
Prefer editing `FeaturesSection.svelte` with Tailwind utilities.

- Behavior:
Keep the existing rotation, manual pause, image preload, transitions, and GSAP semantics unless the user explicitly requests a motion or interaction change.

- CSS:
Treat touched `.feature-*` selectors in `app.css` as migration debt and move them into the markup.
