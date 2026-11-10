import test from 'node:test';
import assert from 'node:assert/strict';
import { reach } from '../helpers/session.mjs';

const MATRIX = {
  1: [1, 'STOP_ANALYSIS', 3], 2: [1, 'STOP_ANALYSIS', 3],
  3: [3, 'STOP_NO_REPRO', 3], 4: [4, 'STOP_PLAN', 3],
  5: [5, 'STOP_IMPLEMENT', 3], 6: [5, 'STOP_REVIEW', 2],
  7: [5, 'STOP_VISUAL', 2], 8: [5, 'STOP_CI', 2],
};
for (const [phase, [back, code, max]] of Object.entries(MATRIX)) {
  test(`repeated phase ${phase} failures stop with ${code}`, () => {
    const { tracer } = reach(Number(phase));
    for (let i = 1; i <= max; i++) {
      assert.equal(tracer('record', '--phase', phase, '--result', 'fail', '--note', 'fixture failure').code, 0);
      const next = tracer('next').json;
      if (i < max) assert.equal(next.phase, back);
      else assert.equal(next.stop.code, code);
    }
    assert.equal(tracer('answer', 'A. Try a different approach').code, 0);
    assert.equal(tracer('next').json.stop, null);
  });
}
