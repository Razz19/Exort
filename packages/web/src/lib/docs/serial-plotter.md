---
title: Serial Plotter
description: Plot numeric serial data from your board and inspect value changes over time.
order: 8
section: Serial Monitor & Plotter
---

# Serial Plotter

Serial Plotter graphs numeric values printed by your board.

It uses the same serial connection as Serial Monitor, but instead of showing plain text logs, it turns numeric output into a visual graph.

You can always <span class="text-gruvbox-orange">ask Exort</span> to prepare the plotter setup for you. Exort can configure the stream in the most effective way for clear plotting and easier analysis.

Use it for:

- Sensor calibration
- Analog readings
- Temperature changes
- Distance measurements
- Motor values
- Battery voltage
- PID tuning
- quick visual checks during tuning

## Basic Example

```cpp
void setup() {
  Serial.begin(115200);
}

void loop() {
  int sensorValue = analogRead(A0);
  Serial.println(sensorValue);
  delay(100);
}
```

## Multiple Values

Print values in a consistent numeric format:

```cpp
Serial.print(sensorA);
Serial.print(",");
Serial.println(sensorB);
```

## Plotting Numeric Streams

Serial Plotter works best when you print plain numbers, one sample per line, or a stable set of comma-separated numbers.
