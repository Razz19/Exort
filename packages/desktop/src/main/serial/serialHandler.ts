import { SerialPort } from 'serialport';

export type SerialMonitorStatus = 'disconnected' | 'connected' | 'streaming';
export type SerialLogDirection = 'rx' | 'tx' | 'system';

export type SerialLogEntry = {
  id: string;
  timestamp: string;
  direction: SerialLogDirection;
  text: string;
};

export type SerialMonitorSnapshot = {
  status: SerialMonitorStatus;
  port: string | null;
  baudRate: number | null;
  entries: SerialLogEntry[];
};

export type SerialMonitorEvent =
  | {
      type: 'status';
      status: SerialMonitorStatus;
      port: string | null;
      baudRate: number | null;
    }
  | {
      type: 'entry';
      entry: SerialLogEntry;
    }
  | {
      type: 'cleared';
    }
  | {
      type: 'error';
      message: string;
    };

type SerialConnectPayload = {
  port: string;
  baudRate: number;
};

type SerialSendPayload = {
  text: string;
  appendNewline?: boolean;
};

type SerialDisconnectPayload = {
  reason?: string;
};

const MAX_BUFFER_BYTES = 100 * 1024;
const STREAMING_IDLE_MS = 1500;
const RX_FRAGMENT_FLUSH_MS = 90;
const DEFAULT_MAX_ENTRIES = 500;
const MIN_MAX_ENTRIES = 100;
const MAX_MAX_ENTRIES = 5000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeMaxEntries(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_ENTRIES;
  }

  return clamp(Math.floor(value), MIN_MAX_ENTRIES, MAX_MAX_ENTRIES);
}

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeCsvField(value: string): string {
  const escaped = value.replaceAll('"', '""').replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', '\\n');
  return `"${escaped}"`;
}

export class SerialMonitorHandler {
  private status: SerialMonitorStatus = 'disconnected';
  private currentPort: string | null = null;
  private currentBaudRate: number | null = null;
  private serialPort: SerialPort | null = null;
  private entries: SerialLogEntry[] = [];
  private entryBytes = 0;
  private maxEntries = DEFAULT_MAX_ENTRIES;
  private streamingTimer: ReturnType<typeof setTimeout> | null = null;
  private rxFragmentFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRxFragment = '';
  private disconnecting = false;

  constructor(private readonly emitEvent: (event: SerialMonitorEvent) => void) {}

  setMaxEntries(next: number): void {
    this.maxEntries = sanitizeMaxEntries(next);
    this.trimEntries();
  }

  getSnapshot(): SerialMonitorSnapshot {
    return {
      status: this.status,
      port: this.currentPort,
      baudRate: this.currentBaudRate,
      entries: [...this.entries]
    };
  }

  async connect(payload: SerialConnectPayload): Promise<{ ok: boolean; error?: string }> {
    const port = asNonBlankString(payload?.port);
    const baudRate =
      typeof payload?.baudRate === 'number' && Number.isFinite(payload.baudRate) ? Math.floor(payload.baudRate) : NaN;

    if (!port) return { ok: false, error: 'Serial port is required.' };
    if (!Number.isInteger(baudRate) || baudRate <= 0) return { ok: false, error: 'A valid baud rate is required.' };

    if (this.serialPort && this.currentPort === port && this.currentBaudRate === baudRate) {
      this.setStatus('connected');
      return { ok: true };
    }

    if (this.serialPort) {
      await this.disconnect({ reason: 'Switched serial monitor connection.' });
    }

    const nextPort = new SerialPort({
      path: port,
      baudRate,
      autoOpen: false
    });

    nextPort.on('data', this.onData);
    nextPort.on('error', this.onPortError);
    nextPort.on('close', this.onClose);

    try {
      await new Promise<void>((resolve, reject) => {
        nextPort.open((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    } catch (error) {
      nextPort.off('data', this.onData);
      nextPort.off('error', this.onPortError);
      nextPort.off('close', this.onClose);
      const message = error instanceof Error ? error.message : 'Failed to open serial port.';
      this.emitEvent({ type: 'error', message });
      this.pushEntry('system', `Failed to connect: ${message}`);
      return { ok: false, error: message };
    }

    this.serialPort = nextPort;
    this.currentPort = port;
    this.currentBaudRate = baudRate;
    this.setStatus('connected');
    this.pushEntry('system', `Connected to ${port} @ ${baudRate} baud.`);
    return { ok: true };
  }

  async disconnect(payload?: SerialDisconnectPayload): Promise<{ ok: boolean; error?: string }> {
    const reason = asNonBlankString(payload?.reason) ?? 'Disconnected from serial monitor.';
    const port = this.serialPort;
    if (!port) {
      this.clearStreamingTimer();
      this.flushPendingRxFragment();
      this.currentPort = null;
      this.currentBaudRate = null;
      this.setStatus('disconnected');
      return { ok: true };
    }

    this.disconnecting = true;
    this.clearStreamingTimer();
    this.flushPendingRxFragment();

    port.off('data', this.onData);
    port.off('error', this.onPortError);
    port.off('close', this.onClose);

    try {
      await this.closePort(port);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close serial port.';
      this.emitEvent({ type: 'error', message });
      this.disconnecting = false;
      return { ok: false, error: message };
    }

    this.serialPort = null;
    this.currentPort = null;
    this.currentBaudRate = null;
    this.setStatus('disconnected');
    this.pushEntry('system', reason);
    this.disconnecting = false;
    return { ok: true };
  }

  async send(payload: SerialSendPayload): Promise<{ ok: boolean; error?: string }> {
    const port = this.serialPort;
    if (!port || this.status === 'disconnected') {
      return { ok: false, error: 'Serial monitor is not connected.' };
    }

    const text = typeof payload?.text === 'string' ? payload.text : '';
    const appendNewline = payload?.appendNewline !== false;
    const finalText = appendNewline ? `${text}\n` : text;

    if (!finalText) {
      return { ok: false, error: 'Cannot send an empty payload.' };
    }

    try {
      await new Promise<void>((resolve, reject) => {
        port.write(finalText, (error) => {
          if (error) {
            reject(error);
            return;
          }

          port.drain((drainError) => {
            if (drainError) {
              reject(drainError);
              return;
            }
            resolve();
          });
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to write to serial port.';
      this.emitEvent({ type: 'error', message });
      return { ok: false, error: message };
    }

    this.pushEntry('tx', finalText);
    return { ok: true };
  }

  clearEntries(): { ok: true } {
    this.entries = [];
    this.entryBytes = 0;
    this.pendingRxFragment = '';
    this.clearRxFragmentFlushTimer();
    this.emitEvent({ type: 'cleared' });
    return { ok: true };
  }

  toCsv(): string {
    const rows = ['timestamp,direction,text'];
    for (const entry of this.entries) {
      rows.push(
        `${escapeCsvField(entry.timestamp)},${escapeCsvField(entry.direction)},${escapeCsvField(entry.text)}`
      );
    }
    return rows.join('\n');
  }

  async dispose(): Promise<void> {
    await this.disconnect({ reason: 'Serial monitor closed.' });
  }

  private onData = (chunk: Buffer): void => {
    if (!chunk || chunk.length === 0) return;
    const text = chunk.toString('utf8');
    if (!text) return;

    this.pendingRxFragment += text;
    this.drainRxLines();
    this.setStatus('streaming');
    this.scheduleStreamingIdleReset();
  };

  private onPortError = (error: Error): void => {
    this.flushPendingRxFragment();
    const message = error?.message?.trim() || 'Unknown serial port error.';
    this.emitEvent({ type: 'error', message });
    this.pushEntry('system', `Serial error: ${message}`);
  };

  private onClose = (): void => {
    const closedPort = this.currentPort;
    this.serialPort = null;
    this.currentPort = null;
    this.currentBaudRate = null;
    this.clearStreamingTimer();
    this.flushPendingRxFragment();
    this.setStatus('disconnected');

    if (!this.disconnecting) {
      this.pushEntry('system', `Serial port ${closedPort ?? 'unknown'} closed.`);
    }
  };

  private setStatus(status: SerialMonitorStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emitEvent({
      type: 'status',
      status: this.status,
      port: this.currentPort,
      baudRate: this.currentBaudRate
    });
  }

  private scheduleStreamingIdleReset(): void {
    this.clearStreamingTimer();
    this.streamingTimer = setTimeout(() => {
      if (!this.serialPort) return;
      this.setStatus('connected');
    }, STREAMING_IDLE_MS);
  }

  private clearStreamingTimer(): void {
    if (!this.streamingTimer) return;
    clearTimeout(this.streamingTimer);
    this.streamingTimer = null;
  }

  private drainRxLines(): void {
    let buffer = this.pendingRxFragment;

    while (true) {
      let lineBreakIndex = buffer.indexOf('\n');
      let lineBreakLength = 1;
      const carriageIndex = buffer.indexOf('\r');

      if (carriageIndex >= 0 && (lineBreakIndex < 0 || carriageIndex < lineBreakIndex)) {
        lineBreakIndex = carriageIndex;
        lineBreakLength = buffer[carriageIndex + 1] === '\n' ? 2 : 1;
      }

      if (lineBreakIndex < 0) break;

      const line = buffer.slice(0, lineBreakIndex);
      this.pushEntry('rx', line);
      buffer = buffer.slice(lineBreakIndex + lineBreakLength);
    }

    this.pendingRxFragment = buffer;
    if (this.pendingRxFragment.length > 0) {
      this.scheduleRxFragmentFlush();
      return;
    }

    this.clearRxFragmentFlushTimer();
  }

  private scheduleRxFragmentFlush(): void {
    this.clearRxFragmentFlushTimer();
    this.rxFragmentFlushTimer = setTimeout(() => {
      this.flushPendingRxFragment();
    }, RX_FRAGMENT_FLUSH_MS);
  }

  private clearRxFragmentFlushTimer(): void {
    if (!this.rxFragmentFlushTimer) return;
    clearTimeout(this.rxFragmentFlushTimer);
    this.rxFragmentFlushTimer = null;
  }

  private flushPendingRxFragment(): void {
    this.clearRxFragmentFlushTimer();
    if (!this.pendingRxFragment) return;
    this.pushEntry('rx', this.pendingRxFragment);
    this.pendingRxFragment = '';
  }

  private pushEntry(direction: SerialLogDirection, text: string): void {
    const entry: SerialLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      direction,
      text
    };

    this.entries.push(entry);
    this.entryBytes += Buffer.byteLength(entry.text, 'utf8');
    this.trimEntries();
    this.emitEvent({ type: 'entry', entry });
  }

  private trimEntries(): void {
    while (this.entries.length > this.maxEntries) {
      const first = this.entries.shift();
      if (!first) break;
      this.entryBytes -= Buffer.byteLength(first.text, 'utf8');
      if (this.entryBytes < 0) this.entryBytes = 0;
    }

    while (this.entries.length > 0 && this.entryBytes > MAX_BUFFER_BYTES) {
      const first = this.entries.shift();
      if (!first) break;
      this.entryBytes -= Buffer.byteLength(first.text, 'utf8');
      if (this.entryBytes < 0) this.entryBytes = 0;
    }
  }

  private async closePort(port: SerialPort): Promise<void> {
    if (!port.isOpen) return;

    await new Promise<void>((resolve, reject) => {
      port.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
