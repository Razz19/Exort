import type { SerialLogEntry } from '../types';

export const SERIAL_BUFFER_SIZE_DEFAULT = 500;
export const SERIAL_BUFFER_SIZE_MIN = 100;
export const SERIAL_BUFFER_SIZE_MAX = 5000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeSerialBufferSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return SERIAL_BUFFER_SIZE_DEFAULT;
  }

  return clamp(Math.floor(value), SERIAL_BUFFER_SIZE_MIN, SERIAL_BUFFER_SIZE_MAX);
}

export function trimEntriesToLimit(entries: SerialLogEntry[], limit: number): SerialLogEntry[] {
  if (entries.length <= limit) return entries;
  return entries.slice(entries.length - limit);
}
