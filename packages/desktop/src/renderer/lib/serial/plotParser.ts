import type {
  SerialLogEntry,
  SerialParsedLine,
  SerialParsedPoint,
  SerialPlotSeries,
  SerialPlotState
} from '../types';

const DEFAULT_MAX_SAMPLES = 100;
const LINE_SPLIT_PATTERN = /\r\n|\n|\r/g;
const NUMERIC_PATTERN = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const LABELED_PAIR_PATTERN =
  /([A-Za-z][^:=\t,;]*?)\s*[:=]\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(?:\s*([%a-zA-Z*°/_-]+))?(?=\s*(?:[,\t;]|$|[A-Za-z][^:=\t,;]*[:=]))/g;
const UNLABELED_SEPARATORS_PATTERN = /^[,\s;\t|]+$/;

type MutablePlotState = {
  maxSamples: number;
  parsedCount: number;
  ignoredCount: number;
  nextSampleIndex: number;
  samplesX: number[];
  seriesOrder: string[];
  seriesByKey: Record<string, SerialPlotSeries>;
  seriesValues: Record<string, Array<number | null>>;
};

export type SerialPlotAccumulator = {
  reset: () => void;
  ingestEntry: (entry: SerialLogEntry) => void;
  ingestText: (text: string) => void;
  ingestLine: (line: string) => void;
  getState: () => SerialPlotState;
};

function createMutableState(maxSamples: number): MutablePlotState {
  return {
    maxSamples,
    parsedCount: 0,
    ignoredCount: 0,
    nextSampleIndex: 0,
    samplesX: [],
    seriesOrder: [],
    seriesByKey: {},
    seriesValues: {}
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeUnit(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function ensureUniqueKey(baseKey: string, used: Set<string>): string {
  if (!used.has(baseKey)) {
    used.add(baseKey);
    return baseKey;
  }

  let suffix = 2;
  while (used.has(`${baseKey}_${suffix}`)) {
    suffix += 1;
  }

  const next = `${baseKey}_${suffix}`;
  used.add(next);
  return next;
}

function parseLabeledLine(line: string): SerialParsedLine | null {
  const points: SerialParsedPoint[] = [];
  const usedKeys = new Set<string>();

  for (const match of line.matchAll(LABELED_PAIR_PATTERN)) {
    const labelRaw = match[1]?.trim();
    const valueRaw = match[2];
    const unitRaw = normalizeUnit(match[3] ?? null);

    if (!labelRaw || !valueRaw) continue;

    const value = Number(valueRaw);
    if (!Number.isFinite(value)) continue;

    const normalizedLabel = normalizeLabel(labelRaw);
    const labelSlug = slugify(normalizedLabel);
    if (!labelSlug) continue;

    const unitSlug = unitRaw ? slugify(unitRaw) : '';
    const baseKey = unitSlug ? `${labelSlug}__${unitSlug}` : labelSlug;
    const key = ensureUniqueKey(baseKey, usedKeys);
    const label = unitRaw ? `${normalizedLabel} (${unitRaw})` : normalizedLabel;

    points.push({
      key,
      label,
      value,
      unit: unitRaw,
      source: 'labeled'
    });
  }

  if (points.length === 0) return null;

  return {
    rawLine: line,
    points
  };
}

function parseUnlabeledLine(line: string): SerialParsedLine | null {
  const values = [...line.matchAll(NUMERIC_PATTERN)].map((match) => Number(match[0]));
  if (values.length === 0) return null;
  if (values.some((value) => !Number.isFinite(value))) return null;

  const residue = line.replace(NUMERIC_PATTERN, '').trim();
  if (residue.length > 0 && !UNLABELED_SEPARATORS_PATTERN.test(residue)) {
    return null;
  }

  return {
    rawLine: line,
    points: values.map((value, index) => {
      const key = `value_${index + 1}`;
      return {
        key,
        label: key,
        value,
        unit: null,
        source: 'unlabeled'
      };
    })
  };
}

export function parseSerialPlotLine(line: string): SerialParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  return parseLabeledLine(trimmed) ?? parseUnlabeledLine(trimmed);
}

function ensureSeries(state: MutablePlotState, point: SerialParsedPoint): void {
  if (state.seriesByKey[point.key]) return;

  state.seriesOrder.push(point.key);
  state.seriesByKey[point.key] = {
    key: point.key,
    label: point.label,
    unit: point.unit,
    source: point.source
  };
  state.seriesValues[point.key] = Array.from({ length: state.samplesX.length - 1 }, () => null);
}

function trimToWindow(state: MutablePlotState): void {
  const overflow = state.samplesX.length - state.maxSamples;
  if (overflow <= 0) return;

  state.samplesX.splice(0, overflow);
  for (const key of state.seriesOrder) {
    state.seriesValues[key]?.splice(0, overflow);
  }
}

function appendParsedLine(state: MutablePlotState, parsed: SerialParsedLine): void {
  state.samplesX.push(state.nextSampleIndex);
  state.nextSampleIndex += 1;

  for (const key of state.seriesOrder) {
    state.seriesValues[key]?.push(null);
  }

  const sampleIndex = state.samplesX.length - 1;
  for (const point of parsed.points) {
    ensureSeries(state, point);
    const targetSeries = state.seriesValues[point.key];
    if (!targetSeries) continue;
    targetSeries[sampleIndex] = point.value;
  }

  trimToWindow(state);
}

function splitIntoLines(text: string): string[] {
  return text
    .split(LINE_SPLIT_PATTERN)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toSerializableState(state: MutablePlotState): SerialPlotState {
  const seriesByKey: Record<string, SerialPlotSeries> = {};
  const seriesValues: Record<string, Array<number | null>> = {};

  for (const key of state.seriesOrder) {
    const series = state.seriesByKey[key];
    if (!series) continue;

    seriesByKey[key] = { ...series };
    seriesValues[key] = [...(state.seriesValues[key] ?? [])];
  }

  return {
    maxSamples: state.maxSamples,
    parsedCount: state.parsedCount,
    ignoredCount: state.ignoredCount,
    samplesX: [...state.samplesX],
    seriesOrder: [...state.seriesOrder],
    seriesByKey,
    seriesValues
  };
}

export function createSerialPlotAccumulator(maxSamples = DEFAULT_MAX_SAMPLES): SerialPlotAccumulator {
  const safeWindow = Number.isFinite(maxSamples) && maxSamples > 0 ? Math.floor(maxSamples) : DEFAULT_MAX_SAMPLES;
  let state = createMutableState(safeWindow);

  function ingestLine(line: string): void {
    const parsed = parseSerialPlotLine(line);
    if (!parsed) {
      state.ignoredCount += 1;
      return;
    }

    state.parsedCount += 1;
    appendParsedLine(state, parsed);
  }

  function ingestText(text: string): void {
    for (const line of splitIntoLines(text)) {
      ingestLine(line);
    }
  }

  function ingestEntry(entry: SerialLogEntry): void {
    if (entry.direction !== 'rx') return;
    ingestText(entry.text);
  }

  return {
    reset() {
      state = createMutableState(safeWindow);
    },
    ingestEntry,
    ingestText,
    ingestLine,
    getState() {
      return toSerializableState(state);
    }
  };
}

export function buildSerialPlotStateFromEntries(entries: SerialLogEntry[], maxSamples = DEFAULT_MAX_SAMPLES): SerialPlotState {
  const accumulator = createSerialPlotAccumulator(maxSamples);
  for (const entry of entries) {
    accumulator.ingestEntry(entry);
  }
  return accumulator.getState();
}
