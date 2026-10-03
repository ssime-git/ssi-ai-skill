import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../scripts/lib/state.mjs';
import { renderBlock, parseBlock, mergeComment, stateHash } from '../../scripts/lib/remote.mjs';
import { makeGh, findPr, readRemoteState, upsertStateComment, createIssue, closedPrNumbers } from '../../scripts/lib/github.mjs';
import { makeGhStub } from '../helpers/gh.mjs';

test('the block roundtrips and survives quotes, newlines and angle brackets', () => {
  const s = { ...newState('say "hi" <b>\nnext --> line'), phase: 3 };
  const block = renderBlock(s, 'hdr');
  assert.equal(parseBlock(block).goal, 'say "hi" <b>\nnext --> line');
  assert.equal(block.match(/-->/g).length, 3);
});

test('parseBlock returns null for text without a block', () => {
  assert.equal(parseBlock('just a human comment'), null);
  assert.equal(parseBlock(undefined), null);
});

test('mergeComment keeps human text, replaces the block, re-adds a deleted block', () => {
  const a = renderBlock(newState('g'), 'old');
  const b = renderBlock(newState('g'), 'new');
  assert.equal(mergeComment(null, b), b);
  const edited = `hello human\n\n${a}\n\nthanks`;
  const merged = mergeComment(edited, b);
  assert.match(merged, /hello human/);
  assert.match(merged, /thanks/);
  assert.match(merged, /new/);
  assert.doesNotMatch(merged, /old/);
  assert.match(mergeComment('human only', b), /^human only\n\n<!-- ssi:begin -->/);
});

test('stateHash ignores bookkeeping fields but sees real changes', () => {
  const s = newState('g');
  const h = stateHash(s);
  assert.equal(stateHash({ ...s, synced: 'x', updated_at: 'later' }), h);
  assert.notEqual(stateHash({ ...s, phase: 4 }), h);
});

test('findPr returns the first match or null', () => {
  const gh = makeGhStub();
  assert.equal(findPr(gh, 'ssi/x'), null);
  gh.openPr(7, 'ssi/x');
  assert.equal(findPr(gh, 'ssi/x').number, 7);
});

test('upsertStateComment creates, then patches only on change', () => {
  const gh = makeGhStub();
  const s = newState('g');
  const write = (header) => upsertStateComment(gh, 7, (existing) => mergeComment(existing, renderBlock(s, header)));
  assert.equal(write('one').changed, true);
  assert.equal(gh.s.comments.length, 1);
  assert.equal(write('one').changed, false);
  assert.equal(write('two').changed, true);
  assert.equal(gh.s.comments.length, 1);
  assert.equal(readRemoteState(gh, 7).state.run_id, s.run_id);
});

test('createIssue is idempotent by key', () => {
  const gh = makeGhStub();
  const first = createIssue(gh, { title: 't', body: 'b', key: 'ssi:r1:issue' });
  const again = createIssue(gh, { title: 't', body: 'b', key: 'ssi:r1:issue' });
  assert.deepEqual([first.created, again.created], [true, false]);
  assert.equal(first.number, again.number);
  assert.equal(gh.s.issues.length, 1);
});

test('closedPrNumbers lists numbers and makeGh is a function factory', () => {
  const gh = makeGhStub();
  assert.deepEqual(closedPrNumbers(gh), []);
  assert.equal(typeof makeGh('.'), 'function');
});
