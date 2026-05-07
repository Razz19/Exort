# Exort Landing Page File Map

## Primary files

- `packages/web/src/routes/+page.svelte`
Owns the navbar, hero, footer, top-level page shell, and section composition.

- `packages/web/src/lib/components/landing/FeaturesSection.svelte`
Owns the feature showcase markup, carousel state, navigation controls, and section-local motion.

- `packages/web/src/lib/components/landing/DownloadSection.svelte`
Owns the download cards, local setup panel, copy buttons, and section-local motion.

- `packages/web/src/app.css`
Still contains global primitives plus legacy section styling for hero, features, download, and local setup. Treat section selectors here as migration debt.

## Ownership rules

- Navbar, footer, and whole-page layout:
Edit `+page.svelte`.

- Feature showcase structure and state:
Edit `FeaturesSection.svelte`.

- Download cards, setup commands, and copy interactions:
Edit `DownloadSection.svelte`.

- Global-only concerns such as `@font-face`, root tokens, document-level resets, and shared selection styling:
Keep in `app.css` if still needed.

## Use the narrower skills when possible

- Use `$exort-hero-section` for hero-only work.
- Use `$exort-features-section` for feature-showcase work.
- Use `$exort-download-section` for download or local setup work.
