# Exort Download Section File Map

## Primary files

- `packages/web/src/lib/components/landing/DownloadSection.svelte`
Owns the download-card markup, platform metadata, overlay timelines, copy-to-clipboard behavior, local setup commands, reduced-motion handling, and GSAP setup.

- `packages/web/src/app.css`
Still contains download and local setup presentation selectors such as `.download-card*`, `.local-setup-panel`, `.local-setup-command*`, `.local-setup-copy`, and `.local-setup-copy-all`.

## Ownership rules

- Structure, spacing, responsive layout, CTA presentation, card styling, and icon-button styling:
Prefer editing `DownloadSection.svelte` with Tailwind utilities.

- Behavior:
Keep the existing overlay timeline logic, copy-to-clipboard state, and motion semantics unless the user explicitly requests a behavior change.

- CSS:
Treat touched `.download-*` and `.local-setup-*` selectors in `app.css` as migration debt and move them into the markup.
