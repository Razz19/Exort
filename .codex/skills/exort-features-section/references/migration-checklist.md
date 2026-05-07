# Feature Styling Migration Checklist

When a request touches any of these areas, migrate the touched styling from `app.css` into `FeaturesSection.svelte` instead of extending the CSS:

- `.feature-showcase`
- `.feature-nav-button`
- `.feature-nav-button--active`
- `.feature-image-shell`
- `.feature-stage`
- `.feature-stage__layer`
- `.feature-image`
- `.feature-image-placeholder`
- `.feature-copy`
- `.feature-copy__inner`
- `.feature-arrow-button`

Keep behavior-only logic in the component script. Only move presentation into Tailwind utilities.
