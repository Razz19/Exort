# Exort

Exort is a local-first desktop AI coding workspace for embedded development.

Ship firmware faster with an AI workspace that understands the way embedded development actually happens: code, boards, ports, serial output, and iterative debugging in one place.

It combines an AI chat workflow with a code editor, workspace explorer, Arduino tooling, and serial monitoring in a single Electron app. The agent runtime runs on your machine, not through an Exort backend service.


## What It Does

- Open local workspaces and keep their state on disk.
- Restore chat history and active sessions per workspace.
- Edit project files with Monaco.
- Stream Exort Agent output directly into the desktop chat UI.
- Connect ChatGPT/OpenAI from the app settings.
- Manage Arduino cores, boards, and ports.
- Compile and upload the active `.ino` sketch.
- Use a built-in Serial Monitor and line plotter.


## Desktop-Only

This repository is intentionally desktop-only.

- `packages/desktop` contains the Electron + Svelte app.
- Older backend/web auth and quota flows are not part of this project.
- OpenCode integration stays in the Electron main process and is exposed to the renderer through preload IPC.



## Getting Started

### Prerequisites

- Node.js
- npm
- Desktop dependencies required by Electron on your OS

### Install

```bash
npm install
```

### Run In Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Typecheck

```bash
npm run typecheck
```

## First Run

1. Launch the app with `npm run dev`.
2. Open a local project folder as a workspace.
3. In Settings, install the required runtimes if they are missing:
   - Exort Agent
   - Arduino CLI
4. In Settings > Providers, connect ChatGPT/OpenAI with OAuth or an API key.
5. Open an `.ino` file to compile or upload to a selected board.

## Core Workflow

1. Open a workspace.
2. Ask Exort Agent to inspect the project or make a change.
3. Edit and review files in Monaco.
4. Select a board and serial port.
5. Compile or upload the active sketch.
6. Inspect output in Serial Monitor or Plotter.

## Package Scripts

From the repo root:

```bash
npm run lint
npm run dev
npm run build
npm run typecheck
```

Desktop package only:

```bash
npm run lint --workspace @exort/desktop
npm run dev --workspace @exort/desktop
npm run build --workspace @exort/desktop
npm run typecheck --workspace @exort/desktop
```

Requirement helpers:

```bash
npm run requirements:status --workspace @exort/desktop
npm run requirements:install --workspace @exort/desktop
```

## Project Layout

```text
packages/
  desktop/   Electron desktop app
```

## Architecture Notes

- The Exort Agent / OpenCode runtime is hosted in the Electron main process.
- The renderer only talks to native capabilities through `window.electronAPI`.
- Workspace state, open files, and chat history are persisted locally.
- Logs stay in the terminal rather than an in-app log console.

## Current Scope

Exort is focused on a local embedded workflow:

- AI-assisted coding against your current workspace
- Arduino compile/upload flows
- Serial monitoring and plotting
- Multi-workspace desktop editing

Controller and simulator features are intentionally not included in this version.

## Open Source Release Notes

This is the desktop-first, local-first version of Exort being prepared for open source release.

- No Exort backend dependency is required
- No hosted auth/quota portal is required
- Runtime setup happens from inside the desktop app

## License

Exort is licensed under `AGPL-3.0-only`. See [LICENSE](/Users/razz/projects/Exort/LICENSE).

## Contributing

If you want to contribute, start by running the desktop app locally and working inside `packages/desktop`.

```bash
npm install
npm run dev
```
