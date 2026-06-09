export type GitChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted';

export type GitFileChange = {
  path: string;
  oldPath?: string;
  status: GitChangeStatus;
  additions: number;
  deletions: number;
  staged: boolean;
};

export type GitRepoStatus = {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  hasRemote: boolean;
  changes: GitFileChange[];
};

export type GitBranchInfo = {
  current: string | null;
  branches: string[];
};

export type GitFileDiff = {
  path: string;
  original: string;
  modified: string;
};
