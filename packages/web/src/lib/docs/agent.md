---
title: Use the Exort Agent
description: Practical prompting patterns for embedded coding with Exort Agent.
order: 2
section: Usage
---

# Use the Exort Agent

Exort Agent helps you understand, edit, generate, and debug embedded code.

It is powered by OpenCode, which can inspect workspaces, explain code, edit files, and stream agent sessions.

## Good Tasks for Exort Agent

- Explain firmware code
- Generate a new sketch
- Add a sensor library example
- Fix compile errors
- Refactor messy code
- Add serial debug logs
- Create calibration logic
- Split code into smaller files
- Explain board-specific issues

## Good Prompt Examples

- Explain this project structure and tell me where the main firmware starts.
- Add serial logs to show the sensor value every 500ms.
- This project fails to compile. Read the error and fix the code.
- Create a simple ESP32 Wi-Fi scanner and print networks to Serial Monitor.
- Refactor this Arduino sketch into `main.ino`, `sensors.h`, and `sensors.cpp`.

## Prompting Tip

Treat Exort Agent like a junior embedded developer. Give it:

- The board name
- The sensor/module name
- The pins you used
- The error message
- The behavior you expected
- The behavior you actually see

Bad prompt:

`Fix this.`

Good prompt:

`I am using an ESP32 DevKit V1 with a DHT22 sensor on GPIO 4. The code compiles, but Serial Monitor always prints nan. Find the problem and suggest a fix.`
