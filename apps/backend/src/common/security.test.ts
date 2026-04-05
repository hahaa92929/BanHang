import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildOtpAuthUrl,
  comparePassword,
  generateId,
  generateToken,
  generateTotpCode,
  generateTotpSecret,
  hashOpaqueToken,
  hashPassword,
  verifyTotpCode,
} from './security';

test('security.hashPassword and comparePassword work with bcrypt', async () => {
  const password = 'hello1234';
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await comparePassword(password, hash), true);
  assert.equal(await comparePassword('wrong-password', hash), false);
});

test('security.generateId and generateToken create expected formats', () => {
  const id = generateId('ord');
  const token = generateToken(16);

  assert.match(id, /^ord-[a-f0-9]{8}$/);
  assert.equal(token.length, 32);
  assert.match(token, /^[a-f0-9]+$/);
});

test('security.hashOpaqueToken is deterministic for the same input', () => {
  const secret = 'test-token-hash-secret-12345678901234567890';
  const token = 'abc123';

  assert.equal(hashOpaqueToken(token, secret), hashOpaqueToken(token, secret));
  assert.notEqual(hashOpaqueToken(token, secret), hashOpaqueToken('different', secret));
});

test('security TOTP helpers generate valid codes and otpauth urls', () => {
  const secret = generateTotpSecret();
  const now = new Date('2026-04-05T00:00:00.000Z').getTime();
  const code = generateTotpCode(secret, now);
  const url = buildOtpAuthUrl('BanHang', 'user@example.com', secret);

  assert.match(secret, /^[A-Z2-7]+$/);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, code, now), true);
  assert.equal(verifyTotpCode(secret, code, now + 30_000), true);
  assert.equal(verifyTotpCode(secret, '000000', now), false);
  assert.match(url, /^otpauth:\/\/totp\/BanHang:user%40example\.com\?/);
});
