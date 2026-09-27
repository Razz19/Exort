import test from 'node:test';
import assert from 'node:assert/strict';
import type { OpenCodeClient, OpenCodeEvent, SessionMessageInfo, FormInfo, PermissionRequest } from '@opencode/client';
import { V2EventAdapter, createV2Adapter, legacyMessage, legacyForm } from '../v2Adapter.js';

const event = (type: string, data: object, id = type): OpenCodeEvent => ({ id, type, created: 1, data: { sessionID: 's', ...data } } as OpenCodeEvent);
const assistant = (text: string): SessionMessageInfo => ({ id: 'm', type: 'assistant', time: { created: 1 }, agent: 'build', model: { id: 'model', providerID: 'p' }, content: [{ type: 'text', text }] });
const form: FormInfo = { id: 'f', sessionID: 's', title: 'Choose', fields: [{ type: 'string', key: 'board', title: 'Board', options: [{ label: 'Uno', value: 'uno' }] }] } as FormInfo;
const permission = { id: 'p', sessionID: 's', action: 'shell', resources: ['build'], source: { type: 'tool', id: 'tool1', messageID: 'm' } } as PermissionRequest;
function fixture(overrides: Record<string, unknown> = {}) {
  return { plugin: { list: async () => ({ data: [{ id: 'exort.embedded', state: { status: 'active' } }] }) }, ...overrides } as unknown as OpenCodeClient;
}
test('v2 deltas, end events and reconnect snapshots do not duplicate text', () => {
  const adapter = new V2EventAdapter('s');
  const first = event('session.text.delta', { assistantMessageID: 'm', ordinal: 0, delta: 'Hello' });
  assert.equal(adapter.event(first).length, 1);
  assert.equal(adapter.event(first).length, 0);
  assert.equal(adapter.event(event('session.text.ended', { assistantMessageID: 'm', ordinal: 0, text: 'Hello' })).length, 0);
  adapter.snapshotOnly = true;
  const recovered = adapter.snapshot([assistant('Hello world')]);
  assert.equal((recovered[1]!.properties as { delta: string }).delta, ' world');
  assert.equal(adapter.event(event('session.text.delta', { assistantMessageID: 'm', ordinal: 0, delta: ' world' }, 'queued')).length, 0);
  assert.equal(adapter.snapshot([assistant('Hello world')]).length, 1); // metadata only
  assert.equal(adapter.event(event('session.execution.succeeded', {}))[0]!.type, 'session.idle');
});
test('baseline history is excluded, reasoning is separate, and tools are deduplicated', () => {
  const adapter = new V2EventAdapter('s', [assistant('old')]);
  assert.equal(adapter.snapshot([assistant('old')]).length, 0);
  const reasoning = adapter.event(event('session.reasoning.delta', { assistantMessageID: 'new', ordinal: 0, delta: 'Thinking' }));
  assert.equal(((reasoning[0]!.properties as { part: { type: string } }).part.type), 'reasoning');
  adapter.event(event('session.tool.input.started', { id: 't', name: 'arduinoCompile' }));
  const result = adapter.event(event('session.tool.success', { id: 't', content: [{ type: 'text', text: 'ok' }] }));
  assert.equal((result[0]!.properties as { part: { tool: string } }).part.tool, 'arduinoCompile');
  assert.equal(adapter.event(event('session.tool.success', { id: 't' }, 'duplicate-result')).length, 0);
});
test('recovery clears interrupts resolved while disconnected', () => {
  const adapter = new V2EventAdapter('s');
  adapter.event(event('permission.asked', permission));
  adapter.event(event('form.created', { form }));
  assert.deepEqual(adapter.interrupts([], []).map(e => e.type), ['permission.replied', 'question.rejected']);
});
test('history files and tool failures retain renderer-facing information', () => {
  const history = legacyMessage({ id: 'u', type: 'user', text: 'Look', time: { created: 1 }, files: [{ name: 'a.png', mime: 'image/png', data: 'YQ==', source: { type: 'inline' } }] } as SessionMessageInfo, 's');
  assert.equal(history.parts[1]!.url, 'data:image/png;base64,YQ==');
  assert.equal(legacyForm(form).questions[0]!.options?.[0]!.label, 'Uno');
});
test('prompt files, model variants and cancellation use v2 contracts', async () => {
  const calls: unknown[] = [];
  const adapter = createV2Adapter(fixture({ session: {
    switchAgent: async (a: unknown) => calls.push(a), switchModel: async (a: unknown) => calls.push(a),
    prompt: async (a: unknown) => calls.push(a), interrupt: async (a: unknown) => calls.push(a)
  } }));
  await adapter.session.prompt({ sessionID: 's', agent: 'plan', model: { providerID: 'p', modelID: 'm' }, variant: 'high', parts: [{ type: 'text', text: 'Look' }, { type: 'file', url: 'file:///tmp/a.png', filename: 'a.png' }] });
  await adapter.session.abort!({ sessionID: 's' });
  assert.deepEqual(calls, [{ sessionID: 's', agent: 'plan' }, { sessionID: 's', model: { providerID: 'p', id: 'm', variant: 'high' } }, { sessionID: 's', text: 'Look', files: [{ uri: 'file:///tmp/a.png', name: 'a.png' }] }, { sessionID: 's' }]);
});
test('permission and question replies use session IDs and option values', async () => {
  const calls: unknown[] = [];
  const adapter = createV2Adapter(fixture({
    permission: { request: { list: async () => ({ data: [permission] }) }, reply: async (a: unknown) => calls.push(a) },
    form: { list: async () => ({ data: [form] }) },
    session: { form: { reply: async (a: unknown) => calls.push(a), cancel: async (a: unknown) => calls.push(a) } }
  }));
  await adapter.permission!.reply!({ requestID: 'p', reply: 'once' });
  await adapter.question!.reply!({ requestID: 'f', answers: [['Uno']] });
  await adapter.question!.reject!({ requestID: 'f' });
  assert.deepEqual(calls, [{ sessionID: 's', requestID: 'p', decision: 'once', message: undefined }, { sessionID: 's', formID: 'f', answer: { board: 'uno' } }, { sessionID: 's', formID: 'f' }]);
});
test('provider API keys and OAuth use integration IDs and attempt IDs', async () => {
  const calls: unknown[] = [];
  const native = fixture({ provider: { list: async () => ({ data: [{ id: 'p', integrationID: 'i' }] }) }, integration: {
    get: async () => ({ data: { methods: [{ type: 'oauth', id: 'browser', label: 'Browser' }], connections: [] } }),
    connect: { key: async (a: unknown) => calls.push(a) },
    oauth: { connect: async (a: unknown) => { calls.push(a); return { data: { attemptID: 'attempt', mode: 'code', url: 'https://example.test', instructions: 'Sign in' } }; },
      complete: async (a: unknown) => calls.push(a), status: async () => ({ data: { status: 'complete' } }) }
  } });
  const adapter = createV2Adapter(native);
  await adapter.auth!.set!({ providerID: 'p', auth: { key: 'test-only-key' } });
  await adapter.provider!.oauth!.authorize!({ providerID: 'p', method: 0 });
  await adapter.provider!.oauth!.callback!({ providerID: 'p', code: 'test-code' });
  assert.deepEqual(calls[0], { integrationID: 'i', key: 'test-only-key' });
  assert.equal((calls[1] as { methodID: string }).methodID, 'browser');
  assert.equal((calls[2] as { attemptID: string }).attemptID, 'attempt');
});

test('a disconnected stream reconnects and recovers missed text before completing', async () => {
  let connections = 0, reads = 0;
  const client = createV2Adapter(fixture({
    message: { list: async () => ({ data: reads++ === 0 ? [] : [assistant('Hello world')], cursor: {} }) },
    permission: { list: async () => [] }, session: { form: { list: async () => [] }, active: async () => ({}) },
    event: { subscribe: () => (async function* () {
      const index = ++connections;
      yield { type: 'server.connected', id: 'connected-' + index, created: 1, data: {} } as OpenCodeEvent;
      if (index === 1) {
        yield event('session.text.delta', { assistantMessageID: 'm', ordinal: 0, delta: 'Hello' });
        throw new Error('connection dropped');
      }
    })() }
  }));
  const subscription = await client.event.subscribe({ sessionID: 's' }) as { stream: AsyncIterable<{ type: string; properties: { delta?: string } }>; controller: AbortController };
  let text = '', done = false;
  for await (const e of subscription.stream) {
    text += e.properties.delta ?? '';
    if (e.type === 'session.idle') { done = true; break; }
  }
  assert.equal(connections, 2); assert.equal(text, 'Hello world'); assert.equal(done, true);
  assert.equal(subscription.controller.signal.aborted, true);
});
