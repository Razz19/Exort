# Download Styling Migration Checklist

When a request touches any of these areas, migrate the touched styling from `app.css` into `DownloadSection.svelte` instead of extending the CSS:

- `.download-card`
- `.download-card__base`
- `.download-card__icon`
- `.download-card__overlay`
- `.download-card__overlay-icon`
- `.download-card__overlay-content`
- `.download-card__overlay-actions`
- `.download-card__button`
- `.local-setup-panel`
- `.local-setup-command`
- `.local-setup-command__inner`
- `.local-setup-command__code`
- `.local-setup-copy`
- `.local-setup-copy-all`

Keep behavior-only logic in the component script. Only move presentation into Tailwind utilities.
