export function formatChatTime(iso: string): string {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
