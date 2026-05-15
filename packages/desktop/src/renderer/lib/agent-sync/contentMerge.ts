export function mergeAssistantContent(current: string, incoming: string): string {
  if (!incoming) return current;
  if (!current) return incoming;

  if (incoming === current) return current;

  // Snapshot-style update that extends existing text.
  if (incoming.startsWith(current)) {
    return incoming;
  }

  // If incoming already contains the current content, prefer it as a richer snapshot.
  if (incoming.includes(current)) {
    return incoming;
  }

  // Default to append for delta streaming chunks.
  return current + incoming;
}
