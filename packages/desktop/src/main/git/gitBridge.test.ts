import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNumstat, parsePorcelainStatus } from './gitBridge.js';

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
