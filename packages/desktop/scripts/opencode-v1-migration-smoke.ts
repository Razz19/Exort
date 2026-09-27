// Explicit, opt-in test. All database/config mutations use a temporary root.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:net';
import { isolatedOpenCodeEnv, readOpenCodeBinaryVersion } from '../src/main/agent/openCodeProbe.js';
import { getOpenCodeRuntime, shutdownOpenCode } from '../src/main/agent/openCode.js';

const [v1, v2] = process.argv.slice(2);
if (!v1 || !v2) throw new Error('Pass paths to verified OpenCode 1.15.7 and 2.0.14 binaries.');
assert.equal(await readOpenCodeBinaryVersion(v1), '1.15.7');
assert.equal(await readOpenCodeBinaryVersion(v2), '2.0.14');
const root = await mkdtemp(path.join(os.tmpdir(), 'exort-v1-migration-smoke-'));
const workspace = path.join(root, 'workspace'); await mkdir(workspace);
process.env.EXORT_OPENCODE_RUNTIME_DIR = root;
const port = await new Promise<number>((resolve, reject) => {
  const server = createServer(); server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = (server.address() as { port: number }).port; server.close(() => resolve(port)); });
});
const env = isolatedOpenCodeEnv(path.join(root, 'isolation'));
// v1 Windows paths match the existing Exort isolation layout.
if (process.platform === 'win32') { env.XDG_CONFIG_HOME = env.APPDATA; env.XDG_DATA_HOME = env.LOCALAPPDATA; env.XDG_STATE_HOME = env.LOCALAPPDATA; }
const old = spawn(v1, ['serve', '--hostname=127.0.0.1', `--port=${port}`], { env, cwd: workspace, stdio: 'ignore' });
const exited = new Promise<void>(resolve => old.once('exit', () => resolve()));
async function request(route: string, method = 'GET', body?: unknown) {
  const result = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { 'Content-Type': 'application/json', 'x-opencode-directory': workspace }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  assert.ok(result.ok, `v1 ${route}: ${result.status}`);
  return result.json() as Promise<any>;
}
try {
  let ready = false;
  for (let i = 0; i < 120; i++) { try { await request('/global/health'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  assert.ok(ready, 'v1 readiness');
  const session = await request('/session', 'POST', { title: 'Exort migration fixture' });
  await request(`/session/${session.id}/message`, 'POST', { noReply: true, parts: [{ type: 'text', text: 'Preserve this migration fixture history.' }] });
  await request('/auth/openai', 'PUT', { type: 'api', key: 'exort-test-only-not-a-real-key' });
  old.kill(); await exited;
  const install = path.join(root, 'managed/2.0.14', `${process.platform}-${process.arch}`);
  await mkdir(install, { recursive: true }); await copyFile(v2, path.join(install, process.platform === 'win32' ? 'opencode.exe' : 'opencode'));
  const runtime = await getOpenCodeRuntime();
  const migrated = await runtime.native.session.get({ sessionID: session.id });
  assert.equal(migrated.id, session.id, 'session association preserved');
  const history = await runtime.native.message.list({ sessionID: session.id });
  assert.ok(history.data.some(m => m.type === 'user' && m.text === 'Preserve this migration fixture history.'));
  await runtime.client.provider!.list!({ directory: workspace });
  const integration = await runtime.native.integration.get({ integrationID: 'openai', location: { directory: workspace } });
  assert.ok(integration.data.connections.some(c => c.type === 'credential'), 'provider connection preserved');
  assert.ok(existsSync(path.join(root, 'backups/before-v2/isolation')));
  assert.ok(JSON.parse(await readFile(path.join(root, 'v2-migration-completed.json'), 'utf8')).completedAt);
  console.log('PASS: v1 session ID, history, provider connection, backup, and migration completion.');
} finally {
  old.kill(); await shutdownOpenCode();
  await rm(root, { recursive: true, force: true });
}
