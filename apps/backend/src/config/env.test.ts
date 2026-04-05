import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnv } from './env';

test('validateEnv requires RS256 key pair in production', () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/banhang?schema=public',
        JWT_SECRET: 'test-jwt-secret-12345678901234567890',
        TOKEN_HASH_SECRET: 'test-token-hash-secret-12345678901234567890',
        PAYMENT_WEBHOOK_SECRET: 'test-payment-webhook-secret-12345678901234567890',
        APP_ORIGINS: 'http://localhost:3000',
      }),
    /Production requires JWT_PRIVATE_KEY and JWT_PUBLIC_KEY/,
  );
});

test('validateEnv accepts HS256 outside production', () => {
  const env = validateEnv({
    NODE_ENV: 'test',
    PORT: '4000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/banhang?schema=public',
    JWT_SECRET: 'test-jwt-secret-12345678901234567890',
    TOKEN_HASH_SECRET: 'test-token-hash-secret-12345678901234567890',
    PAYMENT_WEBHOOK_SECRET: 'test-payment-webhook-secret-12345678901234567890',
    APP_ORIGINS: 'http://localhost:3000',
  });

  assert.equal(env.JWT_SECRET, 'test-jwt-secret-12345678901234567890');
});

test('validateEnv requires complete VNPay configuration when any VNPay env is set', () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: 'test',
        PORT: '4000',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/banhang?schema=public',
        JWT_SECRET: 'test-jwt-secret-12345678901234567890',
        TOKEN_HASH_SECRET: 'test-token-hash-secret-12345678901234567890',
        PAYMENT_WEBHOOK_SECRET: 'test-payment-webhook-secret-12345678901234567890',
        VNPAY_TMN_CODE: 'BANHANG01',
        APP_ORIGINS: 'http://localhost:3000',
      }),
    /must be provided together/,
  );
});
