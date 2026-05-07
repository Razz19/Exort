# Hero File Map

## Primary files

- `packages/web/src/routes/+page.svelte`
Contains the landing-page hero markup, hero-local reactive state, animation setup, headline copy, CTA markup, screenshot placement, and the utility classes that should absorb touched hero styling over time. The `Open Source` color sweep overlay spans and their per-color `animation-delay` values live here.

- `packages/web/tailwind.config.cjs`
Contains shared hero-facing theme tokens such as gruvbox colors, fonts, shadows, and the hero headline sweep keyframes, timing functions, and animation durations.

- `packages/web/src/app.css`
Contains only global base concerns. Do not put hero presentation here unless the request is genuinely global.

## What belongs where

- Layout classes, spacing, typography, color, borders, shadows, responsive behavior, bindings, and section structure:
Edit `+page.svelte`.

- Headline overlay markup and stagger timing:
Edit `+page.svelte`.

- Shared reusable hero values and sweep keyframes:
Prefer `tailwind.config.cjs` when the same color, shadow, or animation token will be reused.

- Shared landing sections such as features or download:
Do not touch unless the request explicitly expands beyond the hero.

## Fast checks

- Search `hero` in `+page.svelte` before introducing new state or handlers.
- For `Open Source` sweep edits, verify the duration in `tailwind.config.cjs` and the stagger delays in `+page.svelte` stay mathematically aligned.
- Keep the CTA hover pattern consistent with the current hero buttons: dark base, right-to-left color layer, dark hover text.
- After removing an interaction, verify no dead variables, media-query listeners, or keyframes remain.
