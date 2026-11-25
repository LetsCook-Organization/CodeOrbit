import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getFocusWrapIndex } from '../assets/js/components.js';

describe('getFocusWrapIndex', () => {
  test('wraps forward from the last control to the first', () => {
    assert.equal(getFocusWrapIndex(3, 2, false), 0);
  });

  test('wraps backward from the first control to the last', () => {
    assert.equal(getFocusWrapIndex(3, 0, true), 2);
  });

  test('lets the browser handle forward navigation inside the dialog', () => {
    assert.equal(getFocusWrapIndex(3, 0, false), null);
    assert.equal(getFocusWrapIndex(3, 1, false), null);
  });

  test('lets the browser handle backward navigation inside the dialog', () => {
    assert.equal(getFocusWrapIndex(3, 2, true), null);
    assert.equal(getFocusWrapIndex(3, 1, true), null);
  });

  test('returns escaped focus to the appropriate end of the dialog', () => {
    assert.equal(getFocusWrapIndex(3, -1, false), 0);
    assert.equal(getFocusWrapIndex(3, -1, true), 2);
  });

  test('keeps focus on the only control in both directions', () => {
    assert.equal(getFocusWrapIndex(1, 0, false), 0);
    assert.equal(getFocusWrapIndex(1, 0, true), 0);
  });

  test('signals that the dialog itself needs focus when no controls remain', () => {
    assert.equal(getFocusWrapIndex(0, -1, false), -1);
    assert.equal(getFocusWrapIndex(0, -1, true), -1);
  });

  test('uses the current number of controls after dynamic changes', () => {
    assert.equal(getFocusWrapIndex(5, 2, false), null);
    assert.equal(getFocusWrapIndex(3, 2, false), 0);
  });
});
