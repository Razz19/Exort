import { AsyncLocalStorage } from 'node:async_hooks';

const maintenance = new AsyncLocalStorage<boolean>();
let locked = false;
let calls = 0;
export function assertRuntimeAvailable(): void {
  if (locked && !maintenance.getStore()) throw new Error('OpenCode is being updated. Please retry in a moment.');
}
export function runtimeCallsInFlight(): number { return calls; }
export async function withRuntimeCall<T>(fn: () => Promise<T>): Promise<T> {
  assertRuntimeAvailable();
  calls++;
  try { return await fn(); } finally { calls--; }
}
export async function withRuntimeMaintenance<T>(fn: () => Promise<T>): Promise<T> {
  if (locked) throw new Error('An OpenCode runtime operation is already in progress.');
  locked = true;
  try {
    const deadline = Date.now() + 30_000;
    while (calls > 0) {
      if (Date.now() > deadline) throw new Error('OpenCode is still busy. Retry the update after the current operation finishes.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return await maintenance.run(true, fn);
  } finally { locked = false; }
}
