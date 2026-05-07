# Exort Landing Page File Map

## Primary files

- `packages/web/src/routes/+page.svelte`
Owns the navbar, hero, footer, top-level page shell, and section composition.

- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
Owns the feature showcase markup, carousel state, navigation controls, and section-local motion.

- `packages/web/src/lib/components/landing/DownloadSection.svelte`
Owns the download cards, local setup panel, copy buttons, and section-local motion.

- `packages/web/tailwind.config.cjs`
Owns shared gruvbox theme tokens such as colors, fonts, shadows, and reusable animation definitions.

- `packages/web/src/app.css`
Contains global primitives only: Tailwind directives, `@font-face`, base/reset behavior, body background, selection styling, and reduced-motion global rules.

## Ownership rules

- Navbar, footer, and whole-page layout:
Edit `+page.svelte`.

- Feature showcase structure and state:
Edit `FeaturesSection.svelte`.

- Download cards, setup commands, and copy interactions:
Edit `DownloadSection.svelte`.

- Shared gruvbox colors, fonts, shadows, and animation tokens:
Edit `tailwind.config.cjs`.

- Global-only concerns such as `@font-face`, document-level resets, body background, and shared selection styling:
Keep in `app.css` if still needed.

## Use the narrower skills when possible

- Use `$exort-hero-section` for hero-only work.
- Use `$exort-features-section` for feature-showcase work.
- Use `$exort-download-section` for download or local setup work.
