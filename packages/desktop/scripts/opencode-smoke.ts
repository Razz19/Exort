// Opt-in integration test; uses verified downloads and disposable runtime data.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { OpenCode } from '@opencode/client';
import { createOpenCodeUpdater } from '../src/main/updater/openCodeUpdater.js';
import { resolveManagedOpenCodeBinary } from '../src/main/agent/openCodeBinary.js';
import { shutdownOpenCode } from '../src/main/agent/openCode.js';
import { ensureOpenCodeIsolation } from '../src/main/agent/openCodeIsolation.js';
import { startOpenCodeSidecar } from '../src/main/agent/openCodeSidecar.js';
import { waitForExortPlugin } from '../src/main/agent/v2Readiness.js';
import { createV2Adapter } from '../src/main/agent/v2Adapter.js';

const root = await mkdtemp(path.join(os.tmpdir(), 'exort-v2-smoke-'));
process.env.EXORT_OPENCODE_RUNTIME_DIR = root;
let sidecar: Awaited<ReturnType<typeof startOpenCodeSidecar>> | undefined;
try {
  const updater = createOpenCodeUpdater();
  const installed = await updater.installOpenCodeUpdate();
  assert.equal(installed.ok, true, installed.error);
  assert.equal(installed.state?.currentVersion, '2.0.14');
  await shutdownOpenCode();
  const binary = await resolveManagedOpenCodeBinary();
  const isolation = await ensureOpenCodeIsolation();
  const assets = path.resolve(import.meta.dirname, '../out/main/opencode-config');
  const configDir = path.join(isolation.runtimeConfigRoot, 'opencode');
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, 'opencode.json'), JSON.stringify({ update: 'disable', plugins: [path.join(assets, 'plugins/exort')] }));
  const workspace = path.join(root, 'workspace'); await mkdir(workspace);
  sidecar = await startOpenCodeSidecar({ binaryPath: binary.binaryPath, envOverrides: isolation.envOverrides, timeoutMs: 60000 });
  const unauthorized = await fetch(sidecar.url + '/api/info');
  assert.equal(unauthorized.status, 401, 'sidecar requires authentication');
  const native = OpenCode.make({ baseUrl: sidecar.url, headers: sidecar.headers });
  await waitForExortPlugin(native, workspace);
  const plugins = await native.plugin.list({ location: { directory: workspace } });
  assert.equal(plugins.data.find(p => p.id === 'exort.embedded')?.state.status, 'active');
  assert.equal((await native.migration.v1.status()).status, 'completed');
  const client = createV2Adapter(native);
  const session = await native.session.create({ location: { directory: workspace } });
  // Exercise the actual packaged tools without requiring hardware or installed board cores.
  const plugin = (await import(pathToFileURL(path.join(assets, 'plugins/exort/index.ts')).href)).default;
  const tools: Array<{ name: string; execute: (args: unknown, context: unknown) => Promise<{ content: string }> }> = [];
  await plugin.setup({ tool: { transform: async (fn: (editor: unknown) => void) => fn({ add: (tool: typeof tools[number]) => tools.push(tool) }) }, session: native.session });
  assert.deepEqual(tools.map(t => t.name).sort(), ['arduinoCompile', 'platformioCompile']);
  for (const tool of tools) {
    const result = await tool.execute({}, { sessionID: session.id, signal: AbortSignal.timeout(15000) });
    assert.ok(JSON.parse(result.content).status, `${tool.name} returns a structured result`);
  }
  if (process.argv.includes('--prompt')) {
    const signal = AbortSignal.timeout(120000);
    const subscription = await client.event.subscribe({ directory: workspace, sessionID: session.id }, { signal }) as { stream: AsyncIterable<any>; controller: AbortController };
    const consuming = (async () => {
      for await (const e of subscription.stream) {
        if (e.type === 'session.error') throw new Error(e.properties.error?.message ?? 'Free-tier prompt failed');
        if (e.type === 'session.idle') return;
      }
      throw new Error('Stream ended without completion');
    })();
    void consuming.catch(() => {});
    try {
      await client.session.prompt({ sessionID: session.id, directory: workspace, model: { providerID: 'opencode', modelID: 'big-pickle' }, parts: [{ type: 'text', text: 'Reply with exactly EXORT_V2_OK. Do not use tools.' }] }, { signal });
      await consuming;
      const history = await native.message.list({ sessionID: session.id });
      assert.ok(history.data.some(m => m.type === 'assistant' && m.content.some(p => p.type === 'text' && p.text.includes('EXORT_V2_OK'))));
    } finally { subscription.controller.abort(); }
  }
  console.log('PASS: verified fresh install, activation, authenticated API, migration readiness, packaged plugin and both compile tool entrypoints' + (process.argv.includes('--prompt') ? ', free-tier prompt and history.' : '.'));
} finally { await sidecar?.close(); await shutdownOpenCode(); await rm(root, { recursive: true, force: true }); }
