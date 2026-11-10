import test from 'node:test';
import assert from 'node:assert/strict';
import { session } from '../helpers/session.mjs';

test('next carries the model tier of the step; refuse stops and feedback is listed', () => {
  const { tracer } = session();
  tracer('start', 'Add a retry to the fetch helper', '--target', 'local');
  const next = tracer('next', '--compact').json;
  assert.equal(next.action.kind, 'analyze');
  assert.equal(next.action.model.tier, 'fast');
  assert.match(next.action.instructions, /Model for this step: fast/);

  const refused = tracer('refuse', '--why', 'asks to deploy to production');
  assert.equal(refused.code, 0);
  assert.equal(tracer('next', '--compact').json.stop.code, 'STOP_REFUSED');
  tracer('answer', 'A. just prepare the change locally');
  assert.equal(tracer('next', '--compact').json.stop, undefined);

  tracer('feedback', 'add', '--title', 'Empty state has no message', '--role', 'ux', '--severity', 'medium', '--source', 'reviewer');
  const list = tracer('feedback').json;
  assert.ok(list.open >= 1);
  const id = list.feedback.find((f) => f.role === 'ux').id;
  assert.equal(tracer('feedback', 'resolve', '--id', String(id), '--status', 'rejected').code, 1);
  assert.equal(tracer('feedback', 'resolve', '--id', String(id), '--status', 'fixed', '--note', 'added message').code, 0);
});
