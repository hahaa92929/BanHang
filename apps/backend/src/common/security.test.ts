import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePassword, generateId, generateToken, hashPassword } from './security';

test('security.hashPassword is deterministic for same input', () => {
  const h1 = hashPassword('hello123');
  const h2 = hashPassword('hello123');
  const h3 = hashPassword('hello124');

  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('security.comparePassword validates raw password against hash', () => {
  const hash = hashPassword('my-secret');
  assert.equal(comparePassword('my-secret', hash), true);
  assert.equal(comparePassword('wrong-secret', hash), false);
});

test('security.generateId and generateToken create expected formats', () => {
  const id = generateId('ord');
  const token = generateToken(16);

  assert.match(id, /^ord-[a-f0-9]{8}$/);
  assert.equal(token.length, 32);
  assert.match(token, /^[a-f0-9]+$/);
});
