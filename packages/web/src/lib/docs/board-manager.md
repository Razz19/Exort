---
title: Board Manager
description: Install board platforms and cores for Arduino CLI-compatible hardware.
order: 4
section: Board Manager
---

<script lang="ts">
  import { ArrowRight } from "lucide-svelte";
</script>

# Board Manager

Board Manager helps install and manage Arduino CLI board platforms and cores.

Exort can also install board packages for you when you ask it to.

## Install A Board Package

To install a board package in Exort:

<div class="inline-flex items-center gap-2">
  <span class="inline-flex items-center gap-2">
    <code>Settings</code>
  </span>
  <ArrowRight class="h-4 w-4 text-gruvbox-muted/80" />
  <span class="inline-flex items-center gap-2">
    <code>Boards</code>
  </span>
  <ArrowRight class="h-4 w-4 text-gruvbox-muted/80" />
  <span class="inline-flex items-center gap-2">
    <span>Search for the board you want to use</span>
  </span>
  <ArrowRight class="h-4 w-4 text-gruvbox-muted/80" />
  <span class="inline-flex items-center gap-2">
    <code>Install</code>
  </span>
</div>

Once installed, the board package is ready to use.

## Supported Boards

Exort is designed to work with Arduino CLI-compatible platforms, including:

### Arduino

- Uno
- Nano
- Mega
- Leonardo

### ESP32

- ESP32 Dev Module
- ESP32-S3
- ESP32-C3

### ESP8266

- NodeMCU
- Wemos D1 Mini

### STM32

- STM32 Blue Pill
- STM32 Nucleo

### Teensy

- Teensy 4.x
- Teensy LC

Other Arduino CLI-compatible boards may also work if the correct core and toolchain are installed.

## When You Need To Install A Package

You usually need to install a board package when:

- your board does not appear
- compile says board platform is missing
- upload tool is missing
- you are using a new board family

In many cases, Exort can identify the correct package and install it for you.

## Common Problems

<span class="text-gruvbox-orange">Ask Exort first.</span>

Exort can often identify the most likely issue, guide you through the correct checks, and handle many of the fixes directly inside the app.

### Board Not Found

- Verify the USB cable
- Verify the drivers
- Reconnect the device

### Port Missing

- Restart Exort
- Reconnect the hardware
- Install the required USB drivers

### Upload Failed

- Verify the correct board selection
- Verify the correct serial port
- Press the `BOOT` button if required by the board
