export function mergeAssistantContent(current: string, incoming: string): string {
  if (!incoming) return current;
  if (!current) return incoming;

  if (incoming === current) return current;

  // Snapshot-style update that extends existing text.
  if (incoming.startsWith(current)) {
    return incoming;
  }

  // Older duplicate/slice that does not add information.
  if (current.startsWith(incoming) || current.includes(incoming)) {
    return current;
  }

  // If incoming already contains the current content, prefer it as a richer snapshot.
  if (incoming.includes(current)) {
    return incoming;
  }

  // Delta-style overlap: append only the non-overlapping suffix.
  const maxOverlap = Math.min(current.length, incoming.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (current.slice(-overlap) === incoming.slice(0, overlap)) {
      return current + incoming.slice(overlap);
    }
  }

  // Conservative fallback when no overlap exists.
  return current + incoming;
}
