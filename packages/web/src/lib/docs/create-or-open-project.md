---
title: Open A Workspace
description: Start from an existing firmware folder or create a new local project workspace.
order: 1
section: First Project Tutorial
---

# Open A Workspace

A project in Exort is just a local folder. Exort does not force your code into a cloud workspace.

## Open an Existing Project

Use this when you already have firmware code.

Good examples:

- Arduino sketch folder
- ESP32 project folder
- Folder with `.ino` files
- Folder with `.cpp` and `.h` files
- Sensor prototype project
- Robotics firmware project

## Create a New Project with AI

Open an empty folder and ask Exort Agent:

- Create a new Arduino project that blinks an LED on pin 13.
- Create an ESP32 project that reads a DHT22 sensor and prints temperature and humidity.
- Create a clean firmware structure with separate files for config, sensors, and main logic.

## Best Practice

Keep each hardware project in its own folder:

```text
projects/
  esp32-weather-station/
  arduino-line-follower/
  rp2040-sensor-logger/
```

This helps Exort keep local workspace state and chat history organized per project.
