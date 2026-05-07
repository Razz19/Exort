# Contributing to Exort

Thanks for contributing to Exort.

Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent. Most contributions will happen in the Electron desktop app, with the landing site living separately in `packages/web`.

## Getting Started

Clone the repository and install dependencies from the repo root:

```bash
git clone https://github.com/Razz19/Exort.git
cd Exort
npm install
```

## Running the Project

### Desktop App

Run the main Exort desktop app:

```bash
npm run dev
```

This starts the Electron desktop app from `packages/desktop`.

### Web Landing App

If you are working on the landing site:

```bash
npm run dev:web
```

### Run Everything

If you need both workspaces running together:

```bash
npm run dev:all
```

## Validation

Before opening a pull request, run the relevant checks from the repo root:

```bash
npm run lint
npm run typecheck
npm run typecheck:web
npm run build
npm run build:web
npm run build:all
```

If your change only touches one area, you can focus on the matching commands, but desktop changes should at minimum pass:

```bash
npm run typecheck
npm run build
```

## How to Contribute

1. Fork the repository and create a branch for your change.
2. Keep the change focused and avoid unrelated refactors.
3. Reuse existing patterns before introducing new ones.
4. Run the relevant validation commands.
5. Open a pull request with a clear summary of what changed and why.

For UI changes, screenshots are helpful. For behavioral changes, include the expected user impact in the pull request description.

## Short Directory Guide

```text
packages/
  desktop/   Electron app, Svelte UI, embedded workflow, OpenCode integration
  web/       Marketing and landing site
assets/      README images and shared visual assets
docs/        Project documentation and supporting notes
```

## Not Sure Where to Start?

Good contributions include:

- fixing bugs
- improving UX polish
- tightening validation or error handling
- improving documentation
- reporting issues with clear reproduction steps

## Questions

Open an issue or ask in Discord.

[![Discord](https://img.shields.io/badge/Discord-Join-8c7ae6?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/xmcmcWkr4V)
