import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  getCommitFileDiff,
  listCommitHistory,
  parseCommitDetailsHeader,
  parseCommitFileChanges,
  parseCommitLog,
  parseNumstat,
  parsePorcelainStatus
} from './gitBridge.js';

test('parsePorcelainStatus reads the branch header and ahead/behind counts', () => {
  const output = ['## main...origin/main [ahead 2, behind 3]', ' M src/app.ts', ''].join('\0');
  const parsed = parsePorcelainStatus(output);
  assert.equal(parsed.branch, 'main');
  assert.equal(parsed.ahead, 2);
  assert.equal(parsed.behind, 3);
});

test('parsePorcelainStatus classifies added, modified, deleted and untracked entries', () => {
  const output = [
    '## main',
    'A  added.ts',
    ' M modified.ts',
    ' D deleted.ts',
    '?? untracked.ts',
    ''
  ].join('\0');
  const parsed = parsePorcelainStatus(output);

  const byPath = new Map(parsed.entries.map((entry) => [entry.path, entry]));
  assert.equal(byPath.get('added.ts')?.status, 'added');
  assert.equal(byPath.get('added.ts')?.staged, true);
  assert.equal(byPath.get('modified.ts')?.status, 'modified');
  assert.equal(byPath.get('modified.ts')?.staged, false);
  assert.equal(byPath.get('deleted.ts')?.status, 'deleted');
  assert.equal(byPath.get('untracked.ts')?.status, 'untracked');
  assert.equal(byPath.get('untracked.ts')?.staged, false);
});

test('parsePorcelainStatus consumes the original path of a rename', () => {
  const output = ['## main', 'R  new-name.ts', 'old-name.ts', ' M other.ts', ''].join('\0');
  const parsed = parsePorcelainStatus(output);

  assert.equal(parsed.entries.length, 2);
  const renamed = parsed.entries[0];
  assert.equal(renamed?.status, 'renamed');
  assert.equal(renamed?.path, 'new-name.ts');
  assert.equal(renamed?.oldPath, 'old-name.ts');
  assert.equal(parsed.entries[1]?.path, 'other.ts');
});

test('parsePorcelainStatus marks unmerged entries as conflicted', () => {
  const output = ['## main', 'UU conflict.ts', ''].join('\0');
  const parsed = parsePorcelainStatus(output);
  assert.equal(parsed.entries[0]?.status, 'conflicted');
});

test('parseNumstat sums additions and deletions by path', () => {
  const counts = parseNumstat('5\t2\tsrc/app.ts\n10\t0\tnew.ts\n');
  assert.deepEqual(counts.get('src/app.ts'), { additions: 5, deletions: 2 });
  assert.deepEqual(counts.get('new.ts'), { additions: 10, deletions: 0 });
});

test('parseNumstat treats binary markers as zero counts', () => {
  const counts = parseNumstat('-\t-\timage.png\n');
  assert.deepEqual(counts.get('image.png'), { additions: 0, deletions: 0 });
});

test('parseNumstat normalizes rename paths to the destination', () => {
  const counts = parseNumstat('1\t1\tsrc/{old.ts => new.ts}\n');
  assert.deepEqual(counts.get('src/new.ts'), { additions: 1, deletions: 1 });
});

test('parseCommitLog reads commit summaries', () => {
  const output = [
    ['abc123', 'abc123', 'Ada Lovelace', 'ada@example.com', '2026-06-10T10:00:00Z', 'Initial commit'].join('\x1f'),
    ['def456', 'def456', 'Grace Hopper', 'grace@example.com', '2026-06-10T11:00:00Z', 'Add serial UI'].join('\x1f'),
    ''
  ].join('\x1e');

  const commits = parseCommitLog(output);
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[0], {
    hash: 'abc123',
    shortHash: 'abc123',
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@example.com',
    date: '2026-06-10T10:00:00Z',
    subject: 'Initial commit'
  });
  assert.equal(commits[1]?.subject, 'Add serial UI');
});

test('parseCommitDetailsHeader reads body text', () => {
  const output = [
    'abc123',
    'abc123',
    'Ada Lovelace',
    'ada@example.com',
    '2026-06-10T10:00:00Z',
    'Initial commit',
    'Detailed body\nwith multiple lines'
  ].join('\x1f') + '\x1e';

  const details = parseCommitDetailsHeader(output);
  assert.equal(details?.hash, 'abc123');
  assert.equal(details?.subject, 'Initial commit');
  assert.equal(details?.body, 'Detailed body\nwith multiple lines');
});

test('parseCommitFileChanges combines name-status and numstat output', () => {
  const changes = parseCommitFileChanges(
    ['A\tnew.ts', 'M\tsrc/app.ts', 'D\told.ts', 'R100\tbefore.ts\tafter.ts', ''].join('\n'),
    ['10\t0\tnew.ts', '3\t2\tsrc/app.ts', '0\t5\told.ts', '1\t1\tafter.ts', ''].join('\n')
  );

  assert.deepEqual(changes, [
    { path: 'new.ts', status: 'added', additions: 10, deletions: 0 },
    { path: 'src/app.ts', status: 'modified', additions: 3, deletions: 2 },
    { path: 'old.ts', status: 'deleted', additions: 0, deletions: 5 },
    { path: 'after.ts', oldPath: 'before.ts', status: 'renamed', additions: 1, deletions: 1 }
  ]);
});

test('getCommitFileDiff returns empty sides for root adds and deletes', async (t) => {
  const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (gitVersion.status !== 0) {
    t.skip('git is not available');
    return;
  }

  const repo = await mkdtemp(path.join(tmpdir(), 'exort-git-history-'));
  t.after(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Exort Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Exort Test',
    GIT_COMMITTER_EMAIL: 'test@example.com'
  };
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, env: gitEnv, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };

  git('init');
  await writeFile(path.join(repo, 'a.txt'), 'line one\n', 'utf8');
  git('add', 'a.txt');
  git('commit', '-m', 'add file');
  const addHash = git('rev-parse', 'HEAD');

  const added = await getCommitFileDiff(repo, addHash, 'a.txt');
  assert.equal(added.ok, true);
  if (added.ok) {
    assert.equal(added.original, '');
    assert.equal(added.modified, 'line one\n');
  }

  await rm(path.join(repo, 'a.txt'));
  git('add', '-A');
  git('commit', '-m', 'delete file');
  const deleteHash = git('rev-parse', 'HEAD');

  const deleted = await getCommitFileDiff(repo, deleteHash, 'a.txt');
  assert.equal(deleted.ok, true);
  if (deleted.ok) {
    assert.equal(deleted.original, 'line one\n');
    assert.equal(deleted.modified, '');
  }
});

test('listCommitHistory scopes commits to the requested branch', async (t) => {
  const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (gitVersion.status !== 0) {
    t.skip('git is not available');
    return;
  }

  const repo = await mkdtemp(path.join(tmpdir(), 'exort-git-history-branch-'));
  t.after(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Exort Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Exort Test',
    GIT_COMMITTER_EMAIL: 'test@example.com'
  };
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: repo, env: gitEnv, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout.trim();
  };

  git('init');
  git('checkout', '-b', 'main');
  await writeFile(path.join(repo, 'shared.txt'), 'base\n', 'utf8');
  git('add', 'shared.txt');
  git('commit', '-m', 'base commit');

  git('checkout', '-b', 'feature');
  await writeFile(path.join(repo, 'feature.txt'), 'feature\n', 'utf8');
  git('add', 'feature.txt');
  git('commit', '-m', 'feature only');

  git('checkout', 'main');
  await writeFile(path.join(repo, 'main.txt'), 'main\n', 'utf8');
  git('add', 'main.txt');
  git('commit', '-m', 'main only');

  const mainHistory = await listCommitHistory(repo, 10, 'main');
  assert.equal(mainHistory.ok, true);
  if (mainHistory.ok) {
    const subjects = mainHistory.commits.map((commit) => commit.subject);
    assert.deepEqual(subjects, ['main only', 'base commit']);
  }

  const featureHistory = await listCommitHistory(repo, 10, 'feature');
  assert.equal(featureHistory.ok, true);
  if (featureHistory.ok) {
    const subjects = featureHistory.commits.map((commit) => commit.subject);
    assert.deepEqual(subjects, ['feature only', 'base commit']);
  }
});
