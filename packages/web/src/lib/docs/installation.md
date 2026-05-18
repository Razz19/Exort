---
title: Installation
description: Install Exort from releases or run the desktop app from source.
order: 3
section: Intro
---

<script lang="ts">
  import { EXORT_GITHUB_LINK, EXORT_GITHUB_RELEASES_LINK } from "$lib/constant";
</script>

# Installation

Exort is a desktop-only Electron app. The main app lives in `packages/desktop`, while the website lives separately in `packages/web`.

## Download

Use the latest build from:

- [https://exort.dev/download](https://exort.dev/download)
- <a href={EXORT_GITHUB_RELEASES_LINK}>{EXORT_GITHUB_RELEASES_LINK}</a>

## Run from Source

<pre><code>git clone {EXORT_GITHUB_LINK}.git
cd Exort
npm install
npm run dev
</code></pre>

The repository uses npm workspaces under `packages/*`.

## Useful Development Commands

```bash
npm run dev
npm run dev:web
npm run dev:all

npm run build
npm run build:web
npm run build:all

npm run lint
npm run typecheck
npm run typecheck:web
npm run typecheck:all
```

These commands are defined in the root `package.json`.
