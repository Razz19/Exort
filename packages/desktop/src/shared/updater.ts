export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export type UpdaterState = {
  enabled: boolean;
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  checkedAt: string | null;
  progressPercent: number | null;
  bytesPerSecond: number | null;
  transferred: number | null;
  total: number | null;
  message: string | null;
  error: string | null;
};

export type UpdaterEvent = {
  state: UpdaterState;
};

