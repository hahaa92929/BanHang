import { createHash, randomBytes } from 'node:crypto';

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function comparePassword(rawPassword: string, passwordHash: string): boolean {
  return hashPassword(rawPassword) === passwordHash;
}

export function generateId(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex')}`;
}

export function generateToken(size = 32): string {
  return randomBytes(size).toString('hex');
}
