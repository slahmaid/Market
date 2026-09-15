/** Escape `\`, `%`, `_` so user input is literal in Postgres ILIKE patterns. */
export function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
