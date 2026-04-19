export type ToolContext = {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string;
  worktree: string;
  abort: AbortSignal;
  metadata: (input: { title?: string; metadata?: Record<string, unknown> }) => void;
  ask: (input: {
    permission: string;
    patterns: string[];
    always: string[];
    metadata: Record<string, unknown>;
  }) => Promise<void>;
  [key: string]: unknown;
};
