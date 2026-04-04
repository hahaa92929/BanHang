import { createHmac, randomBytes } from 'node:crypto';
import { hash, compare } from 'bcryptjs';

const PASSWORD_ROUNDS = 12;

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
