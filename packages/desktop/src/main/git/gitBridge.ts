import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { withRuntimePathEnv } from '../runtimeEnv.js';
import type {
  GitBranchInfo,
  GitChangeStatus,
  GitFileChange,
  GitRepoStatus
} from '../../shared/git.js';

type CommandRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  aborted: boolean;
};

type GitEnvelope<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Per-file change parsed from `git status --porcelain=v1 -b -z`, before line counts are merged. */
type ParsedStatusEntry = {
  path: string;
  oldPath?: string;
  status: GitChangeStatus;
  staged: boolean;
};

type ParsedStatus = {
  branch: string | null;
  ahead: number;
  behind: number;
  entries: ParsedStatusEntry[];
};

function asNonBlankString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function runGit(args: string[], cwd: string, signal?: AbortSignal): Promise<CommandRunResult> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd,
      env: withRuntimePathEnv(),
      signal
    });
    let stdout = '';
    let stderr = '';
    let done = false;

    const settle = (result: CommandRunResult) => {
      if (done) return;
      done = true;
      resolve(result);
    };

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.once('error', (error) => {
      const err = error as NodeJS.ErrnoException;
      const wasAborted = signal?.aborted === true || err.name === 'AbortError' || err.code === 'ABORT_ERR';
      const message = wasAborted
        ? 'Command was aborted.'
        : err.code === 'ENOENT'
          ? 'Git is not installed or could not be found on your PATH.'
          : error instanceof Error
            ? error.message
            : String(error);
      settle({ exitCode: null, stdout, stderr, error: message, aborted: wasAborted });
    });

    proc.once('close', (exitCode, closeSignal) => {
      settle({
        exitCode,
        stdout,
        stderr,
        aborted: signal?.aborted === true || closeSignal != null
      });
    });
  });
}

function failureMessage(result: CommandRunResult, fallback: string): string {
  if (result.error) return result.error;
  const stderr = result.stderr.trim();
  if (stderr.length > 0) return stderr;
  const stdout = result.stdout.trim();
  if (stdout.length > 0) return stdout;
  return fallback;
}

/** Resolve the repository top-level for a path, or null if it is not inside a work tree. */
async function resolveRepoRoot(rootPath: string): Promise<string | null> {
  const result = await runGit(['rev-parse', '--show-toplevel'], rootPath);
  if (result.exitCode !== 0) return null;
  return asNonBlankString(result.stdout);
}

function mapStatusCode(index: string, worktree: string): GitChangeStatus {
  if (index === '?' && worktree === '?') return 'untracked';
  if (index === 'U' || worktree === 'U' || (index === 'A' && worktree === 'A') || (index === 'D' && worktree === 'D')) {
    return 'conflicted';
  }
  if (index === 'R' || worktree === 'R') return 'renamed';
  if (index === 'A' || worktree === 'A') return 'added';
  if (index === 'D' || worktree === 'D') return 'deleted';
  return 'modified';
}

/**
 * Parse `git status --porcelain=v1 -b -z` output. Records are NUL-separated; the first record is the
 * branch header and renames/copies consume an extra record for the original path.
 */
export function parsePorcelainStatus(output: string): ParsedStatus {
  const records = output.split('\0');
  const result: ParsedStatus = { branch: null, ahead: 0, behind: 0, entries: [] };

  let index = 0;
  for (; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || record.length === 0) continue;

    if (record.startsWith('##')) {
      const header = record.slice(2).trim();
      const aheadMatch = header.match(/ahead (\d+)/);
      const behindMatch = header.match(/behind (\d+)/);
      if (aheadMatch?.[1]) result.ahead = Number.parseInt(aheadMatch[1], 10);
      if (behindMatch?.[1]) result.behind = Number.parseInt(behindMatch[1], 10);

      let branchPart = header.split(/\s+\[/)[0] ?? '';
      branchPart = branchPart.split('...')[0]?.trim() ?? '';
      result.branch = branchPart.length > 0 && branchPart !== 'HEAD (no branch)' ? branchPart : null;
      continue;
    }

    const indexCode = record[0] ?? ' ';
    const worktreeCode = record[1] ?? ' ';
    const entryPath = record.slice(3);
    const status = mapStatusCode(indexCode, worktreeCode);

    if (status === 'renamed') {
      // Rename/copy: the original path is the next NUL-separated record.
      const oldPath = records[index + 1];
      index += 1;
      result.entries.push({
        path: entryPath,
        oldPath: oldPath && oldPath.length > 0 ? oldPath : undefined,
        status,
        staged: indexCode !== ' ' && indexCode !== '?'
      });
      continue;
    }

    result.entries.push({
      path: entryPath,
      status,
      staged: indexCode !== ' ' && indexCode !== '?'
    });
  }

  return result;
}

/** Extract the resulting path from a numstat path field, handling `old => new` and `{old => new}`. */
function normalizeNumstatPath(pathPart: string): string {
  let value = pathPart.trim();
  const braceMatch = value.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (braceMatch) {
    value = `${braceMatch[1] ?? ''}${braceMatch[3] ?? ''}${braceMatch[4] ?? ''}`;
  } else if (value.includes(' => ')) {
    value = value.split(' => ')[1] ?? value;
  }
  return value.replace(/\/{2,}/g, '/');
}

/** Parse `git diff --numstat` output into a path -> { additions, deletions } map. */
export function parseNumstat(output: string): Map<string, { additions: number; deletions: number }> {
  const counts = new Map<string, { additions: number; deletions: number }>();

  for (const line of output.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const additions = parts[0] === '-' ? 0 : Number.parseInt(parts[0] ?? '0', 10) || 0;
    const deletions = parts[1] === '-' ? 0 : Number.parseInt(parts[1] ?? '0', 10) || 0;
    const key = normalizeNumstatPath(parts.slice(2).join('\t'));

    const existing = counts.get(key);
    if (existing) {
      existing.additions += additions;
      existing.deletions += deletions;
    } else {
      counts.set(key, { additions, deletions });
    }
  }

  return counts;
}

async function countUntrackedAdditions(repoRoot: string, relativePath: string): Promise<number> {
  try {
    const content = await fs.readFile(path.join(repoRoot, relativePath), 'utf8');
    if (content.length === 0) return 0;
    const newlineCount = (content.match(/\n/g) ?? []).length;
    return content.endsWith('\n') ? newlineCount : newlineCount + 1;
  } catch {
    return 0;
  }
}

export async function isGitRepository(rootPath: unknown): Promise<GitEnvelope<{ isRepo: boolean }>> {
  const root = asNonBlankString(rootPath);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };
  const repoRoot = await resolveRepoRoot(root);
  return { ok: true, isRepo: repoRoot !== null };
}

export async function getRepoStatus(rootPath: unknown): Promise<GitEnvelope<{ status: GitRepoStatus }>> {
  const root = asNonBlankString(rootPath);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) {
    return {
      ok: true,
      status: { isRepo: false, branch: null, ahead: 0, behind: 0, hasRemote: false, changes: [] }
    };
  }

  const statusResult = await runGit(
    ['status', '--porcelain=v1', '-b', '-z', '--untracked-files=all'],
    repoRoot
  );
  if (statusResult.exitCode !== 0) {
    return { ok: false, error: failureMessage(statusResult, 'Failed to read Git status.') };
  }

  const parsed = parsePorcelainStatus(statusResult.stdout);

  const [unstaged, staged, remotes] = await Promise.all([
    runGit(['diff', '--numstat'], repoRoot),
    runGit(['diff', '--numstat', '--cached'], repoRoot),
    runGit(['remote'], repoRoot)
  ]);

  const counts = parseNumstat(unstaged.stdout);
  for (const [key, value] of parseNumstat(staged.stdout)) {
    const existing = counts.get(key);
    if (existing) {
      existing.additions += value.additions;
      existing.deletions += value.deletions;
    } else {
      counts.set(key, value);
    }
  }

  const changes: GitFileChange[] = [];
  for (const entry of parsed.entries) {
    let additions = counts.get(entry.path)?.additions ?? 0;
    let deletions = counts.get(entry.path)?.deletions ?? 0;
    if (entry.status === 'untracked') {
      additions = await countUntrackedAdditions(repoRoot, entry.path);
      deletions = 0;
    }
    changes.push({
      path: entry.path,
      oldPath: entry.oldPath,
      status: entry.status,
      additions,
      deletions,
      staged: entry.staged
    });
  }

  return {
    ok: true,
    status: {
      isRepo: true,
      branch: parsed.branch,
      ahead: parsed.ahead,
      behind: parsed.behind,
      hasRemote: asNonBlankString(remotes.stdout) !== null,
      changes
    }
  };
}

export async function initRepository(rootPath: unknown): Promise<GitEnvelope<Record<never, never>>> {
  const root = asNonBlankString(rootPath);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };
  const result = await runGit(['init'], root);
  if (result.exitCode !== 0) {
    return { ok: false, error: failureMessage(result, 'Failed to initialize a Git repository.') };
  }
  return { ok: true };
}

export async function getFileDiff(
  rootPath: unknown,
  filePath: unknown
): Promise<GitEnvelope<{ original: string; modified: string }>> {
  const root = asNonBlankString(rootPath);
  const relativePath = asNonBlankString(filePath);
  if (!root || !relativePath) return { ok: false, error: 'A workspace folder and file path are required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) return { ok: false, error: 'This folder is not a Git repository.' };

  // Original content from HEAD (empty for added/untracked files or repos without commits).
  let original = '';
  const show = await runGit(['show', `HEAD:${relativePath}`], repoRoot);
  if (show.exitCode === 0) {
    original = show.stdout;
  }

  // Modified content from disk (empty for deleted files).
  let modified = '';
  try {
    modified = await fs.readFile(path.join(repoRoot, relativePath), 'utf8');
  } catch {
    modified = '';
  }

  return { ok: true, original, modified };
}

export async function commitAll(
  rootPath: unknown,
  message: unknown
): Promise<GitEnvelope<Record<never, never>>> {
  const root = asNonBlankString(rootPath);
  const commitMessage = asNonBlankString(message);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };
  if (!commitMessage) return { ok: false, error: 'A commit message is required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) return { ok: false, error: 'This folder is not a Git repository.' };

  const add = await runGit(['add', '-A'], repoRoot);
  if (add.exitCode !== 0) {
    return { ok: false, error: failureMessage(add, 'Failed to stage changes.') };
  }

  const commit = await runGit(['commit', '-m', commitMessage], repoRoot);
  if (commit.exitCode !== 0) {
    return { ok: false, error: failureMessage(commit, 'Failed to commit changes.') };
  }
  return { ok: true };
}

export async function listBranches(rootPath: unknown): Promise<GitEnvelope<{ branches: GitBranchInfo }>> {
  const root = asNonBlankString(rootPath);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) return { ok: false, error: 'This folder is not a Git repository.' };

  const list = await runGit(['branch', '--format=%(refname:short)'], repoRoot);
  if (list.exitCode !== 0) {
    return { ok: false, error: failureMessage(list, 'Failed to list branches.') };
  }

  const branches = list.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const currentResult = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  const current = currentResult.exitCode === 0 ? asNonBlankString(currentResult.stdout) : null;

  return { ok: true, branches: { current: current === 'HEAD' ? null : current, branches } };
}

export async function createBranch(
  rootPath: unknown,
  name: unknown
): Promise<GitEnvelope<Record<never, never>>> {
  const root = asNonBlankString(rootPath);
  const branchName = asNonBlankString(name);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };
  if (!branchName) return { ok: false, error: 'A branch name is required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) return { ok: false, error: 'This folder is not a Git repository.' };

  const result = await runGit(['checkout', '-b', branchName], repoRoot);
  if (result.exitCode !== 0) {
    return { ok: false, error: failureMessage(result, 'Failed to create branch.') };
  }
  return { ok: true };
}

export async function checkoutBranch(
  rootPath: unknown,
  name: unknown
): Promise<GitEnvelope<Record<never, never>>> {
  const root = asNonBlankString(rootPath);
  const branchName = asNonBlankString(name);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };
  if (!branchName) return { ok: false, error: 'A branch name is required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) return { ok: false, error: 'This folder is not a Git repository.' };

  const result = await runGit(['checkout', branchName], repoRoot);
  if (result.exitCode !== 0) {
    return { ok: false, error: failureMessage(result, 'Failed to switch branch.') };
  }
  return { ok: true };
}

async function runRemoteOp(
  rootPath: unknown,
  args: string[],
  fallback: string
): Promise<GitEnvelope<Record<never, never>>> {
  const root = asNonBlankString(rootPath);
  if (!root) return { ok: false, error: 'A workspace folder is required.' };

  const repoRoot = await resolveRepoRoot(root);
  if (!repoRoot) return { ok: false, error: 'This folder is not a Git repository.' };

  const result = await runGit(args, repoRoot);
  if (result.exitCode !== 0) {
    return { ok: false, error: failureMessage(result, fallback) };
  }
  return { ok: true };
}

export function push(rootPath: unknown): Promise<GitEnvelope<Record<never, never>>> {
  return runRemoteOp(rootPath, ['push'], 'Failed to push to the remote.');
}

export function pull(rootPath: unknown): Promise<GitEnvelope<Record<never, never>>> {
  return runRemoteOp(rootPath, ['pull'], 'Failed to pull from the remote.');
}

export function fetch(rootPath: unknown): Promise<GitEnvelope<Record<never, never>>> {
  return runRemoteOp(rootPath, ['fetch'], 'Failed to fetch from the remote.');
}
