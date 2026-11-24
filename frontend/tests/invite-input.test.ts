import assert from 'node:assert/strict';
import test from 'node:test';
import { inviteTokenFromInput } from '../src/features/landing/inviteInput.ts';

const legacyToken = 'a1bc23de'.repeat(8);

test('accepts raw and linked six-character codes, including lower case and pasted whitespace', () => {
  assert.equal(inviteTokenFromInput(' HG8942 '), 'HG8942');
  assert.equal(inviteTokenFromInput('https://hagiangwiki.pages.dev/join/hg8942/?from=share#invite'), 'HG8942');
  assert.equal(inviteTokenFromInput('http://localhost:5173/join/%48G8942'), 'HG8942');
});

test('preserves compatibility with the generated 64-character invite tokens', () => {
  assert.equal(inviteTokenFromInput(legacyToken), legacyToken);
  assert.equal(inviteTokenFromInput(`https://hagiangwiki.pages.dev/join/${legacyToken}`), legacyToken);
});

test('rejects invalid codes, unsupported schemes, and URLs without a single invite path segment', () => {
  for (const input of ['', '12345', 'a1 bc2', 'a'.repeat(65), 'ftp://example.com/join/HG8942',
    'https://example.com/?token=HG8942', 'https://example.com/join/HG8942/other',
    'https://example.com/join/HG89%2F2', 'https://example.com/join/%malformed']) {
    assert.equal(inviteTokenFromInput(input), undefined);
  }
});
