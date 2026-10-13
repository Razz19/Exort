---
title: Requirements
description: What Exort needs installed before you can compile, upload, and use the agent.
order: 2
section: Requirements
---

<script lang="ts">
  import { ArrowRight } from "lucide-svelte";
</script>

# Requirements

Exort depends on two main components:

- Arduino CLI for board management, compilation, and firmware uploads
- OpenCode for AI workspace access and provider integrations

## Arduino CLI

Exort uses Arduino CLI to manage boards, install board packages, compile firmware, and upload code to supported devices.

To install Arduino CLI in Exort:

<span class="inline-flex items-center gap-2">
  <code>Settings</code>
  <ArrowRight class="h-4 w-4" />
  <code>Requirements</code>
  <ArrowRight class="h-4 w-4" />
  <code>Install</code>
</span>

Once installed, Exort uses Arduino CLI for board-related workflows inside the app.

## OpenCode

Exort uses OpenCode for AI workspace access.

To install OpenCode:

<span class="inline-flex items-center gap-2">
  <code>Settings</code>
  <ArrowRight class="h-4 w-4" />
  <code>Requirements</code>
  <ArrowRight class="h-4 w-4" />
  <code>Install</code>
</span>

Once OpenCode is installed, Exort can connect to OpenCode-compatible AI providers.

## Providers

Exort supports AI providers through OpenCode-compatible integrations.

All supported providers are available through OpenCode. After OpenCode is installed, you can open the `Providers` section in Exort to:

- browse available providers
- connect your preferred provider
- select a model
- manage your AI setup inside the app

You can use the free AI options that are available through OpenCode, or connect your own account by adding an API key for a supported provider.

This gives you flexibility to use either the default OpenCode-based setup or your own provider credentials.

## Notes

- Some boards may also require platform packages, cores, or drivers
- If a required component is missing, open `Settings`, go to `Requirements`, and install it before continuing
