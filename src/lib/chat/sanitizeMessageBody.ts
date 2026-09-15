export function sanitizeMessageBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\0/g, "").trim();
  if (cleaned.length < 1 || cleaned.length > 2000) return null;
  return cleaned;
}
