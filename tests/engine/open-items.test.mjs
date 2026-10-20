import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenItems } from '../../skills/ssi/scripts/lib/open-items.mjs';
import { actionFor } from '../../skills/ssi/scripts/lib/actions.mjs';

test('parseOpenItems: reads only unchecked lines under the Open items heading', () => {
  const b = [
    '## Summary', '- [ ] not a ledger line',
    '## Open items', '- [ ] re-run the migration test', '- [x] waived by user: out of scope', '* [ ] check the docs build',
    '## Deferred', '- [ ] other section',
  ].join('\n');
  assert.deepEqual(parseOpenItems(b), ['re-run the migration test', 'check the docs build']);
});

test('parseOpenItems: heading variants, fences, empty and missing bodies', () => {
  assert.deepEqual(parseOpenItems('### Open Items\n- [ ] a'), ['a']);
  assert.deepEqual(parseOpenItems('# open_items\n- [ ] a'), ['a']);
  assert.deepEqual(parseOpenItems('## Open items\n```\n- [ ] in a code fence\n```\n- [x] done'), []);
  assert.deepEqual(parseOpenItems('## Open items\n- [ ]'), ['(empty item)']);
  assert.deepEqual(parseOpenItems(null), []);
  assert.deepEqual(parseOpenItems(undefined), []);
  assert.deepEqual(parseOpenItems('## Open items\r\n- [ ] crlf\r\n'), ['crlf']);
});

const st = { evidence: {}, attempts: {} };
const cfg = { mandate: { ready: true }, ci: { watch: true } };
const f = (pr) => ({ dirty: false, prUnknown: false, pr, headSha: 'a', base: 'main' });
const act = (pr) => actionFor({ name: 'done', state: st, facts: f(pr), config: cfg });

test('actionFor: done is blocked while an open item remains, even if ready is mandated', () => {
  const a = act({ number: 1, isDraft: true, body: '## Open items\n- [ ] fix X\n- [ ] doc Y' });
  assert.equal(a.kind, 'close-open-items');
  assert.match(a.headline, /2 left/);
  assert.match(a.instructions, /fix X/);
});

test('actionFor: once every item is closed or waived, the run proceeds', () => {
  const closed = '## Open items\n- [x] fix X (test added)\n- [x] waived by user: not needed';
  assert.equal(act({ number: 1, isDraft: true, body: closed }).kind, 'mark-ready');
  assert.equal(act({ number: 1, isDraft: false, body: closed }).kind, 'done');
  assert.equal(act({ number: 1, isDraft: false, body: null }).kind, 'done');
});
