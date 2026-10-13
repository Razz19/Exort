---
title: First Project Tutorial
description: A practical first run through opening a workspace, editing code, compiling, uploading, and reading serial output.
order: 3
section: First Project Tutorial
---

# First Project Tutorial

This is the fastest path from opening Exort to uploading a working sketch.

## 1. Open A Workspace

Open a local folder that contains your firmware project, or create a new empty folder for the first sketch.

Typical workspace choices:

- an Arduino sketch folder
- an ESP32 or ESP8266 project folder
- a folder with `.ino`, `.cpp`, `.h`, or config files
- a fresh empty folder where the agent will create the project

## 2. Choose A Model Or Provider

Open Settings and connect the provider you want Exort to use.

You can usually start with the default managed setup, then switch later to your own OpenCode-compatible provider if you need a different model, quota, or account.

## 3. Ask The Agent To Create Or Edit Code

Give the agent a concrete task and enough hardware context.

Example prompts:

- Create a Blink sketch for an Arduino Uno.
- Add serial logging that prints the sensor value every 500 ms.
- Refactor this project into separate files for main logic and sensor code.
- Explain why this ESP32 sketch is failing to compile.

## 4. Select Board And Port

Pick the target board family, the exact board, and the serial port before you compile or upload.

If you skip this step, Exort may compile for the wrong board definition or fail to find the target device.

## 5. Compile

Run compile to confirm the sketch builds for the selected board.

Fix compile errors before moving on. It is much faster to repair the code first than to guess at upload problems later.

## 6. Upload

Once the compile passes, upload the firmware to the connected board.

If the upload fails, check the port, USB cable, bootloader requirements, and whether another app is already using the port.

## 7. Read Serial Monitor

Open Serial Monitor to confirm the firmware is alive and printing the expected output.

Good first signals:

- boot messages
- a startup banner
- sensor values
- debug logs
- connection status

## 8. Iterate

Use the output from Serial Monitor and the code in the editor to make the next change.

The usual loop is:

1. ask the agent
2. edit the code
3. compile
4. upload
5. inspect logs
6. repeat
