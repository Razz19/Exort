---
title: Contributing
description: Development setup, validation commands, and contribution areas.
order: 1
section: Community
---

<script lang="ts">
  import { EXORT_GITHUB_LINK } from "$lib/constant";
</script>

# Contributing

Thanks for contributing to Exort.

Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent. Most contributions happen in the Electron desktop app, while the landing site lives in `packages/web`.

## Setup

<pre><code>git clone {EXORT_GITHUB_LINK}.git
cd Exort
npm install
</code></pre>

## Run Desktop App

```bash
npm run dev
```

## Run Web App

```bash
npm run dev:web
```

## Run Everything

```bash
npm run dev:all
```

## Validate Changes

```bash
npm run lint
npm run typecheck
npm run typecheck:web
npm run build
npm run build:web
npm run build:all
```

These validation commands are listed in the contributing guide.

## Contribution Ideas

- Fix bugs
- Improve UX
- Improve error handling
- Improve documentation
- Add board-specific guides
- Improve serial monitor/plotter behavior
- Improve compile/upload messages
