import { createHmac, randomBytes } from 'node:crypto';
import { hash, compare } from 'bcryptjs';

const PASSWORD_ROUNDS = 12;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_ROUNDS);
}

export async function comparePassword(
  rawPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(rawPassword, passwordHash);
}

export function generateId(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

export function generateToken(size = 32): string {
  return randomBytes(size).toString('hex');
}

export function hashOpaqueToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function generateTotpSecret(size = 20): string {
  return encodeBase32(randomBytes(size));
}

export function generateTotpCode(secret: string, epochMs = Date.now(), stepSec = 30, digits = 6): string {
  return generateHotpCode(secret, Math.floor(epochMs / 1000 / stepSec), digits);
}

export function verifyTotpCode(
  secret: string,
  code: string,
  epochMs = Date.now(),
  window = 1,
  stepSec = 30,
  digits = 6,
): boolean {
  if (!/^\d+$/.test(code)) {
    return false;
  }

  const counter = Math.floor(epochMs / 1000 / stepSec);

  try {
    for (let offset = -window; offset <= window; offset += 1) {
      if (generateHotpCode(secret, counter + offset, digits) === code) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export function buildOtpAuthUrl(issuer: string, accountName: string, secret: string): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function generateHotpCode(secret: string, counter: number, digits: number) {
  if (counter < 0) {
    throw new Error('Counter must be non-negative');
  }

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

function encodeBase32(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(input: string) {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  const normalized = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 secret');
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}
