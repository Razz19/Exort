import assert from 'node:assert/strict';
import test from 'node:test';

import { patchToOriginalModified } from './patchDiff.js';

test('patchToOriginalModified reconstructs both sides from a unified diff', () => {
  const patch = [
    'diff --git a/file.ts b/file.ts',
    'index 1111111..2222222 100644',
    '--- a/file.ts',
    '+++ b/file.ts',
    '@@ -1,3 +1,3 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 20;',
    ' const c = 3;'
  ].join('\n');

  const { original, modified } = patchToOriginalModified(patch);
  assert.equal(original, ['const a = 1;', 'const b = 2;', 'const c = 3;'].join('\n'));
  assert.equal(modified, ['const a = 1;', 'const b = 20;', 'const c = 3;'].join('\n'));
});

test('patchToOriginalModified handles pure additions (new file)', () => {
  const patch = ['@@ -0,0 +1,2 @@', '+line one', '+line two'].join('\n');
  const { original, modified } = patchToOriginalModified(patch);
  assert.equal(original, '');
  assert.equal(modified, ['line one', 'line two'].join('\n'));
});

test('patchToOriginalModified ignores no-newline markers', () => {
  const patch = ['@@ -1 +1 @@', '-old', '+new', '\\ No newline at end of file'].join('\n');
  const { original, modified } = patchToOriginalModified(patch);
  assert.equal(original, 'old');
  assert.equal(modified, 'new');
});

test('patchToOriginalModified returns empty sides for an empty patch', () => {
  const { original, modified } = patchToOriginalModified('');
  assert.equal(original, '');
  assert.equal(modified, '');
});
