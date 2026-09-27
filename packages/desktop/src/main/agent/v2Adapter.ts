import { waitForExortPlugin } from './v2Readiness.js';
import type { OpenCodeClient as NativeClient, OpenCodeEvent, FormInfo, SessionMessageInfo, SessionInfo, PermissionRequest } from '@opencode/client';
import type { OpenCodeClient } from './openCode.js';
import { withRuntimeCall } from './runtimeAccess.js';

type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v && typeof v === 'object' ? v as RecordValue : {};
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const location = (v: unknown) => ({ directory: str(record(v).directory) || undefined });
const session = (s: SessionInfo) => ({ ...s, directory: s.location.directory });
export function legacyPermission(p: PermissionRequest) {
  return { ...p, title: p.message || `${p.action}: ${p.resources.join(', ')}`, command: p.resources.join(', '), tool: { callID: p.source?.id } };
}
export function legacyForm(form: FormInfo) {
  return { id: form.id, sessionID: form.sessionID, questions: form.fields.filter(f => !('hidden' in f && f.hidden)).map(f => ({
    header: f.title || form.title, question: f.description || f.title || form.title,
    options: 'options' in f ? f.options?.map(o => ({ label: o.label, description: o.description || '' })) : [],
    multiple: f.type === 'multiselect', custom: 'custom' in f ? f.custom !== false : true
  })) };
}
export function legacyMessage(message: SessionMessageInfo, sessionID: string) {
  const parts: RecordValue[] = [];
  if (message.type === 'user') {
    parts.push({ type: 'text', text: message.text });
    for (const file of message.files ?? []) parts.push({ type: 'file', url: file.source.type === 'uri' ? file.source.uri : 'data:' + file.mime + ';base64,' + file.data, filename: file.name, mime: file.mime, source: file.source });
  }
  if (message.type === 'assistant') {
    message.content.forEach((part, ordinal) => {
      if (part.type === 'tool') parts.push({ ...part, callID: part.id, tool: part.name, state: {
        ...part.state, output: 'content' in part.state ? textContent(part.state.content) : undefined,
        error: 'error' in part.state ? part.state.error.message : undefined
      } });
      else parts.push({ ...part, id: `${message.id}:${ordinal}`, sessionID, messageID: message.id });
    });
  }
  return { info: { ...message, role: message.type, sessionID }, parts };
}
function textContent(content: unknown): string {
  return array(content).map(c => str(record(c).text)).filter(Boolean).join('\n');
}

function legacyAnswers(form: FormInfo | undefined, answer: RecordValue): string[][] {
  if (!form) return Object.values(answer).map(a => Array.isArray(a) ? a.map(String) : [String(a)]);
  return form.fields.filter(f => !('hidden' in f && f.hidden)).map(field => {
    const value = answer[field.key];
    const values = Array.isArray(value) ? value.map(String) : value === undefined ? [] : [String(value)];
    const choices = 'options' in field ? field.options : undefined;
    return values.map(v => choices?.find(choice => choice.value === v)?.label ?? v);
  });
}

/** Translate v2 snapshots and events into Exort's existing event contract. */
export class V2EventAdapter {
  private texts = new Map<string, string>();
  private tools = new Map<string, string>();
  private results = new Set<string>();
  private seen = new Set<string>();
  private baseline = new Set<string>();
  snapshotOnly = false;
  private permissions = new Set<string>();
  private forms = new Set<string>();
  private users = new Set<string>();
  private formDetails = new Map<string, FormInfo>();
  pendingFormIds(): string[] { return [...this.forms]; }
  interrupts(permissions: PermissionRequest[], forms: FormInfo[]): RecordValue[] {
    const events: RecordValue[] = [];
    for (const id of this.permissions) if (!permissions.some(p => p.id === id)) events.push({ type: 'permission.replied', properties: { sessionID: this.sessionID, requestID: id, reply: 'resolved' } });
    for (const id of this.forms) if (!forms.some(f => f.id === id)) events.push({ type: 'question.rejected', properties: { sessionID: this.sessionID, requestID: id } });
    this.permissions = new Set(permissions.map(p => p.id));
    this.forms = new Set(forms.map(f => f.id));
    for (const form of forms) this.formDetails.set(form.id, form);
    for (const p of permissions) events.push({ type: 'permission.asked', properties: legacyPermission(p) });
    for (const f of forms) events.push({ type: 'question.asked', properties: legacyForm(f) });
    return events;
  }
  constructor(readonly sessionID: string, baseline: SessionMessageInfo[] = []) {
    for (const message of baseline) this.baseline.add(message.id);
  }
  private content(messageID: string, ordinal: number, kind: string, text: string, delta = false): RecordValue[] {
    if (this.baseline.has(messageID)) return [];
    const id = `${messageID}:${ordinal}`;
    const previous = this.texts.get(id) ?? '';
    const next = delta ? previous + text : text;
    // End events and reconnect snapshots are complete values, not additional tokens.
    const suffix = next.startsWith(previous) ? next.slice(previous.length) : '';
    this.texts.set(id, next);
    if (!suffix) return [];
    return [{ type: 'message.part.updated', properties: { sessionID: this.sessionID, delta: suffix,
      part: { id, messageID, sessionID: this.sessionID, type: kind, role: 'assistant' } } }];
  }
  snapshot(messages: SessionMessageInfo[]): RecordValue[] {
    const events: RecordValue[] = [];
    for (const message of messages) {
      if (this.baseline.has(message.id)) continue;
      if (message.type === 'user' && !this.users.has(message.id)) {
        this.users.add(message.id);
        events.push({ type: 'message.updated', properties: { sessionID: this.sessionID, info: { id: message.id, role: 'user', sessionID: this.sessionID } } });
      }
      if (message.type !== 'assistant') continue;
      events.push({ type: 'message.updated', properties: { sessionID: this.sessionID, info: { id: message.id, role: 'assistant', sessionID: this.sessionID, time: message.time, tokens: message.tokens } } });
      message.content.forEach((part, ordinal) => {
        if (part.type !== 'tool') events.push(...this.content(message.id, ordinal, part.type, part.text));
        else {
          this.tools.set(part.id, part.name);
          if (part.state.status === 'streaming') return;
          const resultKey = `${part.id}:${part.state.status}`;
          if (this.results.has(resultKey)) return;
          this.results.add(resultKey);
          events.push({ type: 'message.part.updated', properties: { sessionID: this.sessionID, part: {
            ...part, callID: part.id, tool: part.name, state: { ...part.state,
              output: 'content' in part.state ? textContent(part.state.content) : undefined,
              error: 'error' in part.state ? part.state.error.message : undefined
            }
          } } });
        }
      });
    }
    return events;
  }
  event(event: OpenCodeEvent): RecordValue[] {
    const d = record('data' in event ? event.data : undefined);
    const form = record(d.form);
    if (str(d.sessionID || form.sessionID) !== this.sessionID) return [];
    if (this.seen.has(event.id)) return [];
    this.seen.add(event.id);
    const type = event.type;
    const messageID = str(d.assistantMessageID);
    if (type === 'session.text.delta' || type === 'session.reasoning.delta') {
      if (this.snapshotOnly) return [];
      return this.content(messageID, Number(d.ordinal), type.includes('reasoning') ? 'reasoning' : 'text', str(d.delta), true);
    }
    if (type === 'session.text.ended' || type === 'session.reasoning.ended') {
      return this.content(messageID, Number(d.ordinal), type.includes('reasoning') ? 'reasoning' : 'text', str(d.text));
    }
    if (type === 'session.tool.input.started') { this.tools.set(str(d.id), str(d.name)); return []; }
    if (type === 'session.tool.called' || type === 'session.tool.success' || type === 'session.tool.failed') {
      const status = type.endsWith('called') ? 'running' : type.endsWith('success') ? 'completed' : 'error';
      const key = `${str(d.id)}:${status}`;
      if (this.results.has(key)) return [];
      this.results.add(key);
      return [{ type: 'message.part.updated', properties: { sessionID: this.sessionID, part: {
        type: 'tool', id: d.id, callID: d.id, tool: this.tools.get(str(d.id)) || 'tool',
        state: { status, input: d.input, output: textContent(d.content), error: record(d.error).message, metadata: d.metadata }
      } } }];
    }
    if (type === 'session.step.started' || type === 'session.step.ended') return [{ type: 'message.updated', properties: {
      sessionID: this.sessionID, info: { id: messageID, role: 'assistant', sessionID: this.sessionID, tokens: d.tokens }
    } }];
    if (type === 'session.execution.succeeded' || type === 'session.execution.interrupted') return [{ type: 'session.idle', properties: { sessionID: this.sessionID } }];
    if (type === 'session.execution.failed') return [{ type: 'session.error', properties: { ...d, error: d.error } }];
    if (type === 'session.idle' || type === 'session.status') return [{ type, properties: d }];
    if (type === 'permission.asked') this.permissions.add(str(d.id));
    if (type === 'permission.replied') this.permissions.delete(str(d.requestID));
    if (type === 'form.created') { this.forms.add(str(form.id)); this.formDetails.set(str(form.id), event.data.form as FormInfo); }
    if (type === 'form.replied' || type === 'form.cancelled') this.forms.delete(str(d.id));
    if (type === 'permission.replied') return [{ type, properties: d }];
    if (type === 'permission.asked') return [{ type, properties: legacyPermission(event.data as PermissionRequest) }];
    if (type === 'form.created') return [{ type: 'question.asked', properties: legacyForm(event.data.form as FormInfo) }];
    if (type === 'form.replied' || type === 'form.cancelled') return [{ type: type === 'form.replied' ? 'question.replied' : 'question.rejected', properties: {
      sessionID: this.sessionID, requestID: d.id, answers: legacyAnswers(this.formDetails.get(str(d.id)), record(d.answer))
    } }];
    return [];
  }
}

export function createV2Adapter(native: NativeClient): OpenCodeClient {
  const submittedSessions = new Set<string>();
  const oauth = new Map<string, { attemptID: string; mode: string; directory?: string; expiresAt: number }>();
  const options = (v: unknown) => {
    const signal = record(v).signal as AbortSignal | undefined;
    return { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) };
  };
  const invoke = (fn: (a: RecordValue, o: unknown) => Promise<unknown>) => (a?: unknown, o?: unknown) => withRuntimeCall(() => fn(record(a), o));
  async function integration(providerID: string, directory?: string) {
    await waitForExortPlugin(native, directory);
    const providers = await native.provider.list({ location: { directory } }, options(undefined));
    return providers.data.find(p => p.id === providerID)?.integrationID || providerID;
  }
  async function forms(a: RecordValue) { return (await native.form.list({ location: location(a) }, options(undefined))).data; }
  async function findForm(a: RecordValue) {
    const form = (await forms(a)).find(f => f.id === a.requestID);
    if (!form) throw new Error('This question is no longer pending. Refresh the conversation.');
    return form;
  }
  const prompt = invoke(async (a, o) => {
    const sessionID = str(a.sessionID);
    await waitForExortPlugin(native, str(a.directory) || undefined, options(o).signal);
    if (a.agent) await native.session.switchAgent({ sessionID, agent: str(a.agent) }, options(o));
    const model = record(a.model);
    if (model.providerID && model.modelID) await native.session.switchModel({ sessionID, model: {
      providerID: str(model.providerID), id: str(model.modelID), variant: str(a.variant) || undefined
    } }, options(o));
    const parts = array(a.parts).map(record);
    const response = await native.session.prompt({ sessionID,
      text: parts.filter(p => p.type === 'text').map(p => str(p.text)).join('\n'),
      files: parts.filter(p => p.type === 'file').map(p => ({ uri: str(p.url), name: str(p.filename) || undefined }))
    }, options(o));
    submittedSessions.add(sessionID);
    return response;
  });
  return {
    hasPendingInteractions: () => [...oauth.values()].some(attempt => attempt.expiresAt > Date.now()),
    session: {
      create: invoke(async a => {
        await waitForExortPlugin(native, str(a.directory) || undefined);
        return native.session.create({ location: { directory: str(a.directory) } }, options(undefined));
      }),
      get: invoke(async a => session(await native.session.get({ sessionID: str(a.sessionID) }, options(undefined)))),
      list: invoke(async a => ({ data: (await native.session.list({ directory: str(a.directory), limit: 100, order: 'desc' }, options(undefined))).data.map(session) })),
      messages: invoke(async a => {
        const response = await native.message.list({ sessionID: str(a.sessionID), limit: typeof a.limit === 'number' ? a.limit : 100, order: 'desc' }, options(undefined));
        return { data: response.data.map(m => legacyMessage(m, str(a.sessionID))) };
      }),
      prompt, promptAsync: prompt,
      abort: invoke(async a => native.session.interrupt({ sessionID: str(a.sessionID) }, options(undefined))),
      diff: invoke(async a => native.session.diff({ sessionID: str(a.sessionID), from: str(a.messageID) || undefined }, options(undefined)))
    },
    permission: {
      list: invoke(async a => ({ data: (await native.permission.request.list({ location: location(a) }, options(undefined))).data.map(legacyPermission) })),
      reply: invoke(async a => {
        const requests = await native.permission.request.list({ location: location(a) }, options(undefined));
        const request = requests.data.find(p => p.id === a.requestID);
        if (!request) throw new Error('This permission request is no longer pending.');
        if (a.reply !== 'once' && a.reply !== 'always' && a.reply !== 'reject') throw new Error('Invalid permission reply.');
        return native.permission.reply({ sessionID: request.sessionID, requestID: request.id, decision: a.reply, message: str(a.message) || undefined }, options(undefined));
      })
    },
    question: {
      list: invoke(async a => ({ data: (await forms(a)).map(legacyForm) })),
      reject: invoke(async a => { const f = await findForm(a); return native.session.form.cancel({ sessionID: f.sessionID, formID: f.id }, options(undefined)); }),
      reply: invoke(async a => {
        const f = await findForm(a);
        const answer: Record<string, string | number | boolean | string[]> = {};
        f.fields.filter(field => !('hidden' in field && field.hidden)).forEach((field, i) => {
          const values = array(array(a.answers)[i]).map(str);
          const choices = 'options' in field ? field.options : undefined;
          const mapped = values.map(value => choices?.find(c => c.label === value)?.value ?? value);
          answer[field.key] = field.type === 'multiselect' ? mapped : field.type === 'boolean' ? mapped[0] === 'true' : field.type === 'integer' || field.type === 'number' ? Number(mapped[0]) : mapped[0] || '';
        });
        return native.session.form.reply({ sessionID: f.sessionID, formID: f.id, answer }, options(undefined));
      })
    },
    provider: {
      list: invoke(async a => {
        await waitForExortPlugin(native, str(a.directory) || undefined);
        const query = { location: location(a) };
        const [providers, models, integrations] = await Promise.all([native.provider.list(query, options(undefined)), native.model.list(query, options(undefined)), native.integration.list(query, options(undefined))]);
        const connected = providers.data.filter(p => p.activation === 'enabled' || integrations.data.some(i => i.id === (p.integrationID || p.id) && i.connections.length > 0)).map(p => p.id);
        return { data: { connected, default: {}, all: providers.data.map(p => ({ ...p, models: Object.fromEntries(models.data.filter(m => m.providerID === p.id).map(m => [m.id, {
          ...m, tool_call: m.capabilities.tools, reasoning: m.variants.some(v => /reason|think|high/i.test(v.id)),
          variants: Object.fromEntries(m.variants.map(v => [v.id, v]))
        }])) })) } };
      }),
      auth: invoke(async a => {
        await waitForExortPlugin(native, str(a.directory) || undefined);
        const query = { location: location(a) };
        const [providers, integrations] = await Promise.all([native.provider.list(query, options(undefined)), native.integration.list(query, options(undefined))]);
        return { data: Object.fromEntries(providers.data.map(p => [p.id, integrations.data.find(i => i.id === (p.integrationID || p.id))?.methods.filter(m => m.type === 'key' || m.type === 'oauth').map(m => ({ type: m.type === 'key' ? 'api' : 'oauth', label: m.label || 'API key' })) || []])) };
      }),
      oauth: {
        authorize: invoke(async a => {
          const integrationID = await integration(str(a.providerID), str(a.directory) || undefined);
          const info = await native.integration.get({ integrationID, location: location(a) }, options(undefined));
          const method = info.data.methods.filter(m => m.type === 'key' || m.type === 'oauth')[Number(a.method)];
          if (!method || method.type !== 'oauth') throw new Error('OAuth method is no longer available.');
          const previous = oauth.get(str(a.providerID));
          if (previous) await native.integration.oauth.cancel({ integrationID, attemptID: previous.attemptID, location: location(a) }, options(undefined));
          const { data } = await native.integration.oauth.connect({ integrationID, methodID: method.id, location: location(a) }, options(undefined));
          oauth.set(str(a.providerID), { attemptID: data.attemptID, mode: data.mode, directory: str(a.directory) || undefined, expiresAt: data.time?.expires ?? Date.now() + 10 * 60_000 });
          return { data: { url: data.url, method: data.mode, instructions: data.instructions } };
        }),
        callback: invoke(async a => {
          const pending = oauth.get(str(a.providerID));
          if (!pending) throw new Error('Start provider sign-in again; the previous attempt is no longer available.');
          const integrationID = await integration(str(a.providerID), pending.directory);
          const input = { integrationID, attemptID: pending.attemptID, location: { directory: pending.directory } };
          if (pending.mode === 'code') await native.integration.oauth.complete({ ...input, code: str(a.code) || undefined }, options(undefined));
          const deadline = Date.now() + 120000;
          while (Date.now() < deadline) {
            const { data } = await native.integration.oauth.status(input, options(undefined));
            if (data.status === 'complete') { oauth.delete(str(a.providerID)); return { data: true }; }
            if (data.status === 'expired' || data.status === 'failed') { oauth.delete(str(a.providerID)); throw new Error(data.status === 'failed' ? data.message : 'Sign-in expired. Please try again.'); }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          throw new Error('Provider sign-in is still pending. Finish signing in, then retry.');
        })
      }
    },
    auth: {
      set: invoke(async a => native.integration.connect.key({ integrationID: await integration(str(a.providerID)), key: str(record(a.auth).key) }, options(undefined))),
      remove: invoke(async a => {
        const integrationID = await integration(str(a.providerID));
        const info = await native.integration.get({ integrationID }, options(undefined));
        for (const connection of info.data.connections) if (connection.type === 'credential') await native.credential.remove({ credentialID: connection.id }, options(undefined));
      })
    },
    event: {
      subscribe: async (input, requestOptions) => {
        const a = record(input), sessionID = str(a.sessionID);
        submittedSessions.delete(sessionID);
        const controller = new AbortController();
        const signal = record(requestOptions).signal as AbortSignal | undefined;
        const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
        const baseline = await native.message.list({ sessionID, limit: 100, order: 'desc' }, { signal: AbortSignal.any([combined, AbortSignal.timeout(15000)]) });
        const adapter = new V2EventAdapter(sessionID, baseline.data);
        let iterator = native.event.subscribe({ signal: combined })[Symbol.asyncIterator]();
        // v2 subscriptions connect lazily. Wait for the server marker before submitting a prompt.
        const ready = iterator.next();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([ready.then(r => { if (r.done) throw new Error('OpenCode event stream closed before connecting.'); }), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('OpenCode event stream connection timed out.')); }, 15000); })]);
        } finally { if (timer) clearTimeout(timer); }
        async function refresh(): Promise<RecordValue[]> {
          const request = { signal: AbortSignal.any([combined, AbortSignal.timeout(15000)]) };
          const messages: SessionMessageInfo[] = [];
          let cursor: string | undefined;
          // Read back to the pre-turn boundary, including long multi-step turns.
          do {
            const page = await native.message.list({ sessionID, limit: 100, order: 'desc', cursor }, request);
            messages.push(...page.data);
            if (page.data.some(m => baseline.data.some(b => b.id === m.id))) break;
            cursor = page.cursor.next ?? undefined;
          } while (cursor);
          const [permissions, forms, active] = await Promise.all([
            native.permission.list({ sessionID }, request), native.session.form.list({ sessionID }, request), native.session.active(request)
          ]);
          const events = adapter.snapshot(messages.reverse());
          for (const id of adapter.pendingFormIds()) {
            if (forms.some(f => f.id === id)) continue;
            const detail = await native.session.form.get({ sessionID, formID: id }, request).catch(() => null);
            if (detail?.state.status === 'answered') events.push(...adapter.event({
              type: 'form.replied', id: `recovered-form-${id}`, created: Date.now(),
              data: { sessionID, id, answer: detail.state.answer }
            }));
          }
          events.push(...adapter.interrupts(permissions, forms));
          if (!active[sessionID] && !permissions.length && !forms.length) events.push({ type: 'session.idle', properties: { sessionID } });
          return events;
        }
        async function* stream() {
          let failures = 0;
          let pending: Promise<IteratorResult<OpenCodeEvent>> | undefined;
          try {
            while (!combined.aborted) {
              try {
                pending ??= iterator.next();
                let tick: ReturnType<typeof setTimeout> | undefined;
                const item = await Promise.race([pending, new Promise<undefined>(resolve => {
                  tick = setTimeout(() => resolve(undefined), adapter.snapshotOnly ? 1000 : 15000);
                })]).finally(() => { if (tick) clearTimeout(tick); });
                if (item) {
                  pending = undefined;
                  if (item.done) throw new Error('OpenCode event stream disconnected.');
                  if (item.value.type === 'session.inbox.delivered' && item.value.data.sessionID === sessionID) {
                    const page = await native.message.list({ sessionID, limit: 100, order: 'desc' }, { signal: AbortSignal.any([combined, AbortSignal.timeout(15000)]) });
                    // Only user IDs here; live assistant deltas may already be queued.
                    for (const e of adapter.snapshot(page.data.filter(m => m.type === 'user').reverse())) yield e;
                  } else if (adapter.snapshotOnly && (item.value.type === 'session.idle' || item.value.type === 'session.status' || item.value.type === 'session.execution.succeeded' || item.value.type === 'session.execution.interrupted')) {
                    for (const e of await refresh()) yield e;
                  } else for (const e of adapter.event(item.value)) yield e;
                } else if (submittedSessions.has(sessionID) || adapter.snapshotOnly) {
                  // A half-open socket may never signal disconnection. Snapshot polling
                  // also recovers completion in this case without duplicating queued deltas.
                  adapter.snapshotOnly = true;
                  for (const e of await refresh()) yield e;
                }
              } catch (error) {
                if (combined.aborted) return;
                if (++failures > 3) throw new Error('OpenCode connection was lost. Reload the conversation to recover the latest history.', { cause: error });
                await iterator.return?.();
                pending = undefined;
                await new Promise(resolve => setTimeout(resolve, failures * 500));
                // After a gap, deltas cannot safely be combined with snapshots. Reconnect
                // interrupts live and reconcile text from authoritative snapshots instead.
                adapter.snapshotOnly = true;
                iterator = native.event.subscribe({ signal: combined })[Symbol.asyncIterator]();
                const connect = iterator.next();
                let timeout: ReturnType<typeof setTimeout> | undefined;
                try {
                  const first = await Promise.race([connect, new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('OpenCode reconnect timed out.')); }, 15000); })]);
                  if (first.done) throw new Error('OpenCode reconnect failed.');
                } finally { if (timeout) clearTimeout(timeout); }
                for (const e of await refresh()) yield e;
              }
            }
          } finally { submittedSessions.delete(sessionID); controller.abort(); await iterator.return?.(); }
        }
        return { stream: stream(), controller };
      }
    }
  };
}
