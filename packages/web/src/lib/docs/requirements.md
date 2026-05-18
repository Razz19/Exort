---
title: Requirements
description: Required tools for packaged desktop usage and source development.
order: 4
section: Intro
---

# Requirements

Exort needs a few tools depending on whether you use the packaged desktop app or run from source.

## Desktop App Requirements

- Arduino CLI
- OpenCode runtime/provider configuration
- USB drivers for your board
- Board platform/core installed

Exort uses Arduino CLI for board packages, compile, and upload flows. It also uses OpenCode as the AI runtime/provider layer.

## Source Development Requirements

- Node.js 20 or newer
- npm 10 or newer
- Git
- Platform build tools required by Electron/native Node dependencies

These are listed in Exort repository requirements.

## Check Desktop Requirements

```bash
npm --workspace @exort/desktop run requirements:status
```
