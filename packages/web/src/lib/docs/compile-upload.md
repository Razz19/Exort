---
title: Compile and Upload
description: Build and flash firmware through Exort using Arduino CLI workflows.
order: 3
section: Usage
---

# Compile and Upload

Exort supports automatic and manual compile/upload flows through Arduino CLI.

## Before Compiling

Make sure you selected:

- Correct board
- Correct port
- Correct project folder
- Required board core
- Required libraries

## Compile

Compile checks whether your firmware can build for the selected board.

Common compile problems:

- Missing library
- Wrong board selected
- Syntax error
- Incorrect include path
- Board core not installed
- Wrong function or class name

## Upload

Upload sends the compiled firmware to the connected board.

Common upload problems:

- Wrong port selected
- Board not connected
- USB cable is power-only
- Missing USB driver
- Board is not in bootloader mode
- Another app is using the serial port

## Recommended Workflow

1. Ask Exort Agent to review or generate code
2. Compile
3. Fix compile errors
4. Upload
5. Open Serial Monitor
6. Observe logs
7. Iterate

This matches Exort recommended edit, compile, upload, observe cycle.
