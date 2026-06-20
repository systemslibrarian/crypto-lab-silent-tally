/** Shared display helpers for the exhibits. */

/**
 * Abbreviate a large field element for display, keeping the leading and
 * trailing digits with an ellipsis in the middle (e.g. `123456…789012`).
 * Values short enough to show in full are returned unchanged.
 */
export function formatBigint(n: bigint, maxLen = 12): string {
  const s = n.toString();
  if (s.length <= maxLen) return s;
  const keep = Math.max(2, Math.floor((maxLen - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}
