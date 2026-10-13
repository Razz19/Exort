---
title: Serial Monitor
description: Read live board logs and debug serial output from the active connection.
order: 7
section: Serial Monitor & Plotter
---

# Serial Monitor

Serial Monitor shows live output from your connected board.

You can always <span class="text-gruvbox-orange">ask Exort</span> to prepare the serial setup for you. Exort can configure the monitor in the most effective way for your current board, sketch, and workflow.

## How To Connect

Select the board and port first, then open the serial view for the active workspace.

If the connection does not behave as expected, <span class="text-gruvbox-orange">Ask Exort first.</span> In many cases, Exort can identify the most likely cause and guide you through the correct fix.

If nothing appears, check:

- the board is powered
- the selected port is correct
- the sketch was uploaded successfully
- another app is not holding the port open

## Baud Rate

The baud rate in Exort must match the baud rate in your sketch.

For example, if your code uses:

```cpp
Serial.begin(115200);
```

then the monitor should also use `115200`.

## Viewing Logs

Serial Monitor helps you debug and verify device behavior.

Examples:

```text
System Started
WiFi Connected
Temperature: 23.7
```

You can use it for:

- Debug prints
- Boot logs
- Sensor values
- Calibration messages
- Runtime state
- Error messages
- Communication output

Example firmware:

```cpp
void setup() {
  Serial.begin(115200);
  Serial.println("Device started");
}

void loop() {
  int value = analogRead(A0);
  Serial.println(value);
  delay(500);
}
```
