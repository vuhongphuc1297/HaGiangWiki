import assert from 'node:assert/strict';
import test from 'node:test';
import { attachReturnSync } from '../src/context/returnSync.ts';

function fixture(initialVisibility = 'visible') {
  const document = Object.assign(new EventTarget(), { visibilityState: initialVisibility });
  const window = new EventTarget();
  let time = 0;
  let refreshes = 0;
  const detach = attachReturnSync({ document, window, now: () => time, refresh: () => { refreshes++; } });
  return {
    document, window, detach,
    get refreshes() { return refreshes; },
    advance(milliseconds: number) { time += milliseconds; },
    visibility(state: string) { document.visibilityState = state; document.dispatchEvent(new Event('visibilitychange')); },
    focus() { window.dispatchEvent(new Event('focus')); },
    blur() { window.dispatchEvent(new Event('blur')); },
  };
}

test('initial visibility and ordinary focus never trigger redundant requests', () => {
  const app = fixture();
  app.focus(); app.visibility('visible'); app.focus();
  assert.equal(app.refreshes, 0);
  app.detach();
});

test('a quick app switch under 30 seconds does not refresh', () => {
  const app = fixture();
  app.visibility('hidden'); app.advance(29_999); app.visibility('visible'); app.focus();
  assert.equal(app.refreshes, 0);
  app.detach();
});

test('return after 30 seconds refreshes once for visibility then focus', () => {
  const app = fixture();
  app.blur(); app.visibility('hidden'); app.advance(30_000); app.visibility('visible'); app.focus();
  assert.equal(app.refreshes, 1);
  app.detach();
});

test('focus received while still hidden waits for visibility without dropping the away interval', () => {
  const app = fixture();
  app.visibility('hidden'); app.advance(31_000); app.focus();
  assert.equal(app.refreshes, 0);
  app.visibility('visible'); app.focus();
  assert.equal(app.refreshes, 1);
  app.detach();
});

test('desktop blur/focus works without a visibility change', () => {
  const app = fixture();
  app.blur(); app.advance(31_000); app.focus(); app.focus();
  assert.equal(app.refreshes, 1);
  app.detach();
});

test('a later hidden event does not reset the start of a longer blur interval', () => {
  const app = fixture();
  app.blur(); app.advance(20_000); app.visibility('hidden'); app.advance(15_000); app.visibility('visible');
  assert.equal(app.refreshes, 1);
  app.detach();
});

test('each separate long app switch can refresh again', () => {
  const app = fixture();
  for (let index = 0; index < 3; index++) {
    app.visibility('hidden'); app.advance(31_000); app.visibility('visible'); app.focus();
  }
  assert.equal(app.refreshes, 3);
  app.detach();
});

test('an app mounted while hidden measures the interval until first return', () => {
  const app = fixture('hidden');
  app.advance(31_000); app.visibility('visible');
  assert.equal(app.refreshes, 1);
  app.detach();
});

test('unmount cleanup removes every focus and visibility listener', () => {
  const app = fixture();
  app.visibility('hidden'); app.detach(); app.advance(31_000); app.visibility('visible'); app.focus(); app.blur();
  assert.equal(app.refreshes, 0);
});
