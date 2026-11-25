/**
 * Query whitelist filtering (privacy gate).
 * - Keys NOT in the whitelist are always dropped (phone numbers etc. never enter tracking).
 * - Whitelisted keys with empty values are omitted from the result.
 * - Values are URI-decoded when possible (official recommendation for page path params).
 */
export const DEFAULT_WHITELIST = ["id", "from"];

export function filterQuery(
  query: Record<string, string | undefined> | undefined | null,
  whitelist: string[] = DEFAULT_WHITELIST,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!query) return out;
  for (const key of whitelist) {
    const raw = query[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw);
    if (value === "") continue; // whitelisted key with empty value: omitted
    out[key] = safeDecode(value);
  }
  return out;
}

/** Parse "?a=1&b=2" out of a share path and apply the same whitelist rules. */
export function parsePathQuery(
  path: string | undefined | null,
  whitelist: string[] = DEFAULT_WHITELIST,
): Record<string, string> {
  if (!path) return {};
  const idx = path.indexOf("?");
  if (idx < 0) return {};
  const qs = path.slice(idx + 1);
  const parts: Record<string, string> = {};
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq < 0 ? pair : pair.slice(0, eq);
    const v = eq < 0 ? "" : pair.slice(eq + 1);
    parts[k] = v;
  }
  return filterQuery(parts, whitelist);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // malformed encoding: keep raw value, never throw
  }
}
