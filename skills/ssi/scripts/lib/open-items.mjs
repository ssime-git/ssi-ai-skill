// The "Open items" ledger lives in the PR body: one `- [ ]` line per skipped, unchecked or
// deferred point, in the order it must be handled. The engine reads it so a run cannot be
// declared done (or marked ready) while an item is still open. `- [x]` lines are closed
// (done with proof, or `waived by user: <reason>`).
const HEADING = /^\s{0,3}#{1,6}\s*open[\s_-]*items\b/i;
const ANY_HEADING = /^\s{0,3}#{1,6}\s+\S/;
const OPEN = /^\s*[-*+]\s+\[ \]\s*(.*)$/;

export function parseOpenItems(body) {
  if (typeof body !== 'string') return [];
  const items = [];
  let inside = false;
  let fence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (HEADING.test(line)) {
      inside = true;
      continue;
    }
    if (inside && ANY_HEADING.test(line)) inside = false;
    if (!inside) continue;
    const m = OPEN.exec(line);
    if (m) items.push(m[1].trim() || '(empty item)');
  }
  return items;
}
