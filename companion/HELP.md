## Auri TX2N

Connection is via UDP on Port 54666

Minimum supported firmware version 1.5

When used, output level polling occurs on 100ms intervals. It runs only while an output level feedback, or a button
showing an output meter, is in use.

### Actions

- Identify

#### TX2N

- Audio Stream - Input Mute

- Audio Stream - Program Info

- Radio - Broadcast Name

- Radio - Encryption

- Radio - Privacy Key

- Radio - Transmitter Output

#### D4

- Position - Broadcast Name

- Position - Privacy Key

### Feedbacks

- System Status

#### TX2N

- Audio Stream - Input Mute

- Audio Stream - Output Level

- Audio Stream - Output Level Meter (deprecated: use the Output Meter presets, or the Level Meter composite element,
  instead)

- Audio Stream - Program Info

- Radio - Broadcast Name

- Radio - Encryption

- Radio - Privacy Key

- Radio - Transmitter Output

#### D4

- Position - Broadcast Name

- Position - Privacy Key

### Presets

#### TX2N

- Output Meters: a layered button per stream showing its left and right output levels as meters, in two sets
  - Vertical: the left meter up the left edge, the right meter up the right edge
  - Horizontal: both meters along the bottom edge.

### Composite Elements

#### TX2N

- Level Meter: a bar meter for an output level, from its minimum value up to 0 dB, along any edge of the button. Feed
  it a level, e.g. a local variable driven by the Audio Stream - Output Level feedback. The Output Meter presets show
  how.
