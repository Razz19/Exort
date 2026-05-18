---
title: Troubleshooting
description: Practical checks for setup, compile/upload, serial, and provider issues.
order: 2
section: Reference
---

# Troubleshooting

## Exort Does Not Detect My Board

Try:

- Reconnect the board
- Use a data USB cable
- Install the board driver
- Close Arduino IDE or other serial tools
- Restart Exort
- Check if the board appears in your OS device list

## Compile Fails

Common reasons:

- Missing library
- Wrong board selected
- Board core not installed
- Syntax error
- Wrong file structure
- Unsupported board package

Ask Exort Agent:

`Read this compile error and explain what is causing it. Then suggest the smallest safe fix.`

## Upload Fails

Common reasons:

- Wrong port
- Board busy
- Serial Monitor open in another app
- USB driver missing
- Bootloader mode required
- Bad cable

## Serial Monitor Shows Nothing

Check:

- Correct port
- Correct baud rate
- `Serial.begin` exists
- Code actually prints output
- Upload succeeded
- Board is powered

## Serial Output Is Unreadable

Usually this means the baud rate is wrong.

Example:

`Serial.begin(115200);`

Then Exort Serial Monitor should also use:

`115200`

## AI Agent Gives Weak Answers

Give more context:

- Board model
- Sensor/module
- Pin connections
- Code file
- Compile error
- Serial output
- Expected behavior
- Actual behavior
