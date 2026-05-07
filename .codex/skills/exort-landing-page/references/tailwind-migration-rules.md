# Tailwind Migration Rules

## Default rule

Prefer Tailwind utilities in Svelte markup for all landing-page styling work.

## Do not do this

- Do not add new section-specific selectors to `packages/web/src/app.css`.
- Do not treat `app.css` as the source of truth for section styling.
- Do not leave partially migrated styles split between utility classes and resurrected CSS.

## Do this instead

- Move touched layout, spacing, color, border, radius, shadow, overlay, and responsive styling into the relevant Svelte markup.
- Put reused design values in `packages/web/tailwind.config.cjs` instead of duplicating arbitrary values.
- Keep `app.css` only for truly global concerns:
  - `@font-face`
  - document-level resets
  - body background treatment
  - shared selection styling
  - reduced-motion globals

## Migration heuristic

When a request touches a landing section, prefer a complete local utility migration for the touched element set. Keep non-utility classes only when script logic needs them as stable DOM hooks.
