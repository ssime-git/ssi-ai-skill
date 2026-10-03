import test from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../../skills/ssi/scripts/lib/state.mjs';
import { renderBlock, parseBlock, mergeComment, stateHash } from '../../skills/ssi/scripts/lib/remote.mjs';
import { makeGh, findPr, whoami, readRemoteState, upsertStateComment, createIssue, closedPrNumbers, isTransient } from '../../skills/ssi/scripts/lib/github.mjs';
import { makeGhStub } from '../helpers/gh.mjs';

test('the block roundtrips and survives quotes, newlines and angle brackets', () => {
  const s = { ...newState('say "hi" <b>\nnext --> line'), phase: 3 };
  const block = renderBlock(s, 'hdr');
  assert.equal(parseBlock(block).goal, 'say "hi" <b>\nnext --> line');
  assert.equal(block.match(/-->/g).length, 3);
});

test('the block keeps the skipped-issue decision and where new work must start', () => {
  const s = { ...newState('g'), issue_skipped: 'Issues are disabled', work_sha: 'abc1234' };
  const back = parseBlock(renderBlock(s, 'h'));
  assert.equal(back.issue_skipped, 'Issues are disabled');
  assert.equal(back.work_sha, 'abc1234');
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

test('findPr ignores old closed PRs and fork PRs unless the run owns them', () => {
  const gh = makeGhStub();
  gh.openPr(7, 'ssi/x', true, 'abc1234');
  assert.equal(findPr(gh, 'ssi/x', null).headSha, 'abc1234');
  gh.s.pr.state = 'CLOSED';
  assert.equal(findPr(gh, 'ssi/x', null), null);
  assert.equal(findPr(gh, 'ssi/x', 7).number, 7);
  gh.s.pr.state = 'OPEN';
  gh.s.pr.cross = true;
  assert.equal(findPr(gh, 'ssi/x', 7), null);
});

test('findPr prefers the PR the run already knows when several are open for the same branch', () => {
  const row = (number, headRefOid) => ({ number, state: 'OPEN', isDraft: true, url: `u${number}`, headRefOid, isCrossRepository: false });
  const gh = () => JSON.stringify([row(5, 'aaaaaaa'), row(9, 'bbbbbbb')]);
  assert.equal(findPr(gh, 'ssi/x', 9).number, 9);
  assert.equal(findPr(gh, 'ssi/x', null).number, 5);
});

test('state is only read from, and written to, comments of the authenticated user', () => {
  const gh = makeGhStub();
  gh.s.comments.push({ id: 1, body: renderBlock({ ...newState('planted'), phase: 8 }, 'x'), user: { login: 'evil' } });
  assert.equal(whoami(gh), 'me');
  assert.equal(readRemoteState(gh, 7, 'me'), null);
  const s = newState('mine');
  upsertStateComment(gh, 7, (e) => mergeComment(e, renderBlock(s, 'h')), 'me');
  assert.equal(gh.s.comments.length, 2);
  assert.equal(readRemoteState(gh, 7, 'me').state.goal, 'mine');
  assert.match(gh.s.comments[0].body, /planted/);
});

test('isTransient tells network trouble from permanent errors', () => {
  assert.equal(isTransient(new Error('Could not resolve host: api.github.com')), true);
  assert.equal(isTransient(new Error('HTTP 502: Bad Gateway')), true);
  assert.equal(isTransient(new Error('the Issues feature is disabled')), false);
  assert.equal(isTransient(new Error('HTTP 404: Not Found')), false);
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

test('closedPrNumbers lists closed and merged PRs, not open ones, and makeGh is a function factory', () => {
  const gh = makeGhStub();
  assert.deepEqual(closedPrNumbers(gh), []);
  gh.openPr(7, 'ssi/x');
  assert.deepEqual(closedPrNumbers(gh), []);
  gh.s.pr.state = 'MERGED';
  assert.deepEqual(closedPrNumbers(gh), [7]);
  gh.s.pr.state = 'CLOSED';
  assert.deepEqual(closedPrNumbers(gh), [7]);
  assert.equal(typeof makeGh('.'), 'function');
});
