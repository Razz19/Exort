---
title: Serial Plotter
description: Graph numeric board output for sensors, calibration, and tuning.
order: 5
section: Usage
---

# Serial Plotter

Serial Plotter graphs numeric values printed by your board.

Use it for:

- Sensor calibration
- Analog readings
- Temperature changes
- Distance measurements
- Motor values
- Battery voltage
- PID tuning

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

## Best Practice

Do not mix text logs and plotter values too much.

Good for plotter:

```text
123
124
125
```

or:

```text
123,456
124,458
125,459
```

Bad for plotter:

```text
Sensor value is: 123
Temperature now equals 24.3 C
```
