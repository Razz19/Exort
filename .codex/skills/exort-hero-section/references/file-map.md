# Hero File Map

## Primary files

- `packages/web/src/routes/+page.svelte`
Contains the landing-page hero markup, hero-local reactive state, animation setup, headline copy, CTA markup, screenshot placement, and the utility classes that should absorb touched hero styling over time.

- `packages/web/src/app.css`
Still contains legacy hero-specific styling such as title treatment, highlight-chip presentation, gradient effects, animation keyframes, and screenshot presentation. Treat touched hero selectors here as migration debt.

## What belongs where

- Layout classes, spacing, typography, color, borders, shadows, responsive behavior, bindings, and section structure:
Edit `+page.svelte`.

- Global-only or not-yet-migrated hero selectors and keyframes:
Inspect in `app.css`, then move touched styling into `+page.svelte` when you edit that area.

- Shared landing sections such as features or download:
Do not touch unless the request explicitly expands beyond the hero.

## Fast checks

- Search `hero-` selectors in `app.css` before editing hero visuals.
- Search `hero` in `+page.svelte` before introducing new state or handlers.
- Delete or shrink touched hero selector blocks after migrating their styling into Tailwind utilities.
- After removing an interaction, verify no dead variables, media-query listeners, or keyframes remain.
