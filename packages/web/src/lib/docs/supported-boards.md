---
title: Supported Boards
description: Board families supported through Arduino CLI-compatible platforms.
order: 1
section: Reference
---

# Supported Boards

Exort works with Arduino CLI-compatible board platforms, including Arduino, ESP32, ESP8266, RP2040, STM32, Teensy, and other Arduino CLI-compatible cores.

## Important Note

Actual compile/upload success depends on:

- board core
- toolchain
- USB driver
- upload protocol
- operating system
- local machine setup

This limitation is also noted in the Exort README.

## Suggested Table

| Board family | Status | Notes |
| --- | --- | --- |
| Arduino | Supported | Works through Arduino CLI cores |
| ESP32 | Supported | Requires ESP32 core |
| ESP8266 | Supported | Requires ESP8266 core |
| RP2040 | Supported | Requires compatible core |
| STM32 | Supported | Depends on installed STM32 core |
| Teensy | Supported | Depends on Teensy toolchain/core |
| Other Arduino CLI-compatible boards | Partial | Depends on core/toolchain support |
