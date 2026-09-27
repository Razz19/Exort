import type { OpenCodeClient } from '@opencode/client';

/** HTTP readiness precedes asynchronous location/plugin initialization in v2. */
export async function waitForExortPlugin(client: OpenCodeClient, directory?: string, signal = AbortSignal.timeout(30000)): Promise<void> {
  signal = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  while (!signal.aborted) {
    const { data } = await client.plugin.list({ location: { directory } }, { signal });
    const plugin = data.find(p => p.id === 'exort.embedded');
    if (plugin?.state.status === 'active') return;
    if (plugin?.state.status === 'failed') throw new Error('The Exort compile plugin failed to load. Reinstall the runtime from Requirements.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  signal.throwIfAborted();
}
