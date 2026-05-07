# Exort Download Section File Map

## Primary files

- `packages/web/src/lib/components/landing/DownloadSection.svelte`
Owns the download-card markup, platform metadata, optional installation-guide rendering via `showInstallationGuide`, overlay timelines, copy-to-clipboard behavior, local setup commands, reduced-motion handling, and GSAP setup.

- `packages/web/tailwind.config.cjs`
Owns shared gruvbox theme tokens used by the download section, including solid card colors such as `gruvbox.ink`.

- `packages/web/src/app.css`
Contains global base concerns only. Do not use it for download or installation-guide presentation.

## Ownership rules

- Structure, spacing, responsive layout, CTA presentation, card styling, and icon-button styling:
Prefer editing `DownloadSection.svelte` with Tailwind utilities.

- Route-specific visibility:
Use `showInstallationGuide={false}` on the landing page to hide the installation guide while keeping the local-run card. Leave the prop unset on `/download` to show the full section.

- Behavior:
Keep the existing overlay timeline logic, copy-to-clipboard state, and motion semantics unless the user explicitly requests a behavior change.

- Stable DOM hooks:
Keep `download-card__overlay`, `download-card__overlay-icon`, `download-card__overlay-content`, and similar queried classes only when the script uses them for GSAP targeting.
