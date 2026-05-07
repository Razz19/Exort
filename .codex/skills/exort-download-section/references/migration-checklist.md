# Download Styling Migration Checklist

When a request touches any of these areas, keep the styling in `DownloadSection.svelte` utilities instead of moving it back into `app.css`:

- `.download-card__overlay`
- `.download-card__overlay-icon`
- `.download-card__overlay-content`
- `.download-card__overlay-actions`

Keep behavior-only logic and queried GSAP hook classes in the component script/markup. Keep all presentation in Tailwind utilities.
