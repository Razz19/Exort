---
title: Getting Started
description: What Exort is, who it is for, and how to start using it.
order: 1
section: Getting Started
---

# Getting Started

Exort is a free, open-source AI coding workspace for embedded development.

It combines a desktop code editor, an AI agent, Arduino CLI integration, board management, compile and upload tools, serial monitoring, and serial plotting in one app.

![Exort screenshot](/exort-screenshot.webp)

## What Exort Is For

Exort is designed for:

- Developers building microcontroller firmware
- Students learning embedded systems
- Makers prototyping hardware projects
- Teams that want faster edit, compile, upload, observe loops
- Anyone who wants AI help without leaving the local workspace

## What You Can Do

- Open a local embedded workspace
- Ask the agent to explain, generate, or edit code
- Install board platforms and cores
- Compile and upload sketches
- Watch serial logs and runtime output
- Plot numeric streams from sensors or device telemetry
- Keep code and session state on your machine

## Arduino And PlatformIO Compatibility

Exort is designed to work with existing embedded projects. You can open and continue developing projects created with Arduino IDE or PlatformIO without starting from scratch.

Supported project types:

- Arduino sketches (`.ino`)
- Arduino CLI projects
- PlatformIO projects
- Multi-file C/C++ firmware projects

### Arduino Projects

#### Opening An Existing Arduino Project

1. Click `Open Workspace`
2. Select the folder containing your `.ino` file
3. Exort will automatically detect the project structure

Example:

```text
Blink/
├── Blink.ino
```

Once loaded, you can:

- Edit code manually
- Ask the AI agent to modify the project
- Compile and upload firmware
- Monitor serial output

#### Creating Arduino Code With AI

Example prompts:

- Create an Arduino Uno project that reads an HC-SR04 ultrasonic sensor.
- Add EEPROM storage to this Arduino project.
- Convert this polling loop to use interrupts.

### PlatformIO Projects

#### Opening A PlatformIO Project

Open the folder containing `platformio.ini`.

Example:

```text
MyProject/
├── platformio.ini
├── src/
│   └── main.cpp
├── include/
├── lib/
```

Exort will detect the PlatformIO structure and provide AI assistance directly inside the project.

#### Working With Existing Code

The AI agent understands common PlatformIO project structure, including:

- `platformio.ini`
- `src/`
- `include/`
- `lib/`

Example prompts:

- Analyze this PlatformIO project and explain its architecture.
- Add MQTT support using PubSubClient.
- Migrate this project from ESP8266 to ESP32.

### Supported Languages

Exort can assist with:

- Arduino C++
- C
- C++
- Embedded frameworks built on Arduino
- ESP-IDF-based projects
- PlatformIO projects

## Download And Install

Download Exort for your operating system from the release page or the download page:

- Windows: download the Windows installer or portable package from the release page
- macOS: download the `.dmg` build for Apple Silicon or Intel Macs
- Linux: download the AppImage build
- Source builds: use the repository if you want to run the app locally during development

The main entry point is the desktop app. Once installed, launch Exort and open a folder that contains your firmware project.

## First Launch Setup

On first launch, Exort is usually easiest to set up in this order:

1. Open or create a workspace folder.
2. Confirm Arduino CLI and OpenCode/provider setup in Settings.
3. Install any missing board platforms or cores.
4. Select your board and port.
5. Ask the agent for a small change or a starter sketch.

If you want the shortest path to a working project, continue with [First Project Tutorial](/docs/quick-start).
