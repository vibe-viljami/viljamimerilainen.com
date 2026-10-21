import test from 'node:test';
import assert from 'node:assert/strict';
import { entranceSplats } from '../src/entrance.js';

test('entrance begins clean, staggers the wisps and ends', () => {
  assert.deepEqual(entranceSplats(0, 1 / 60), []);
  assert.deepEqual(entranceSplats(0.1, 1 / 60), []);
  assert.equal(entranceSplats(0.2, 1 / 60).length, 1);
  assert.equal(entranceSplats(0.5, 1 / 60).length, 2);
  assert.equal(entranceSplats(2, 1 / 60).length, 2);
  assert.deepEqual(entranceSplats(4, 1 / 60), []);
});

test('entrance ink is subtle and frame-rate independent', () => {
  const slow = entranceSplats(2, 1 / 30);
  const fast = entranceSplats(2, 1 / 60);
  for (let i = 0; i < fast.length; i++) {
    assert.ok(fast[i][4] > 0 && fast[i][4] <= 0.008);
    assert.equal(slow[i][4], fast[i][4] * 2);
    assert.equal(slow[i][3], fast[i][3] * 2);
  }
});
