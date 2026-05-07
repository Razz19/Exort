# Feature Styling Migration Checklist

When a request touches any of these areas, keep the styling in `FeaturesSection.svelte` utilities instead of moving it back into `app.css`:

- feature navigation buttons
- feature image shell sizing
- feature fade layers
- copy overlay panel
- mobile arrow controls

Keep behavior-only logic in the component script. Keep all presentation in Tailwind utilities.
