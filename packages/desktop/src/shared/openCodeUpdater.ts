export type OpenCodeUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'waiting-for-idle' | 'installing' | 'updated' | 'up-to-date' | 'error' | 'external';
export type OpenCodeUpdateState = {
  status: OpenCodeUpdateStatus;
  currentVersion: string | null;
  latestVersion: string | null;
  progressPercent?: number;
  checkedAt?: string;
  message?: string;
  error?: string;
  background?: boolean;
  automaticChecks: boolean;
};
export type OpenCodeUpdateResponse = { ok: boolean; state?: OpenCodeUpdateState; error?: string };
