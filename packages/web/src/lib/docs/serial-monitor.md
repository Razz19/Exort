---
title: Serial Monitor
description: View live board output for debugging, logs, and runtime inspection.
order: 4
section: Usage
---

# Serial Monitor

Serial Monitor shows live output from your connected board.

Use it for:

- Debug prints
- Boot logs
- Sensor values
- Calibration messages
- Runtime state
- Error messages
- Communication output

## Example Arduino Code

```cpp
void setup() {
  Serial.begin(9600);
  Serial.println("Device started");
}

void loop() {
  int value = analogRead(A0);
  Serial.println(value);
  delay(500);
}
```

## Tips

Make sure the baud rate in Exort matches your code.

If your code uses `115200`, select `115200` in Serial Monitor.

## Common Problems

No output:

- Wrong port
- Wrong baud rate
- Board not running
- Upload failed
- Serial not initialized

Garbled output:

- Baud rate mismatch

Port busy:

- Another app is using the same port
