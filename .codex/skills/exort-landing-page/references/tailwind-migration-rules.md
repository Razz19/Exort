# Tailwind Migration Rules

## Default rule

Prefer Tailwind utilities in Svelte markup for all landing-page styling work.

## Do not do this

- Do not add new section-specific selectors to `packages/web/src/app.css`.
- Do not extend existing `.hero-*`, `.feature-*`, `.download-*`, or `.local-setup-*` blocks when the same change can live in markup.
- Do not leave partially migrated styles split between new utility classes and old dead CSS.

## Do this instead

- Move touched layout, spacing, color, border, radius, shadow, overlay, and responsive styling into the relevant Svelte markup.
- Delete or shrink legacy selectors in `app.css` once the touched styling has moved.
- Keep `app.css` only for truly global concerns when practical:
  - `@font-face`
  - `:root` tokens
  - document-level resets
  - shared selection styling
  - other non-section-specific primitives

## Migration heuristic

When a request touches a section that still depends on legacy selectors, migrate the styling for the touched element set in the same change. Do not defer that migration unless the user explicitly asks for the smallest possible change.
