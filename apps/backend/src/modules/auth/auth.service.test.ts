import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { hashPassword } from '../../common/security';
import { AuthService } from './auth.service';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  createdAt: Date;
};

type TokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

function createAuthMock() {
  const users = new Map<string, UserRecord>();
  const usersByEmail = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const passwordResetTokens = new Map<string, TokenRecord>();
  const emailVerificationTokens = new Map<string, TokenRecord>();
  let sequence = 1;

  function addUser(user: Partial<UserRecord> & Pick<UserRecord, 'id' | 'email' | 'passwordHash' | 'fullName' | 'role'>) {
    const record: UserRecord = {
      phone: user.phone ?? null,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      failedLoginAttempts: user.failedLoginAttempts ?? 0,
      lockedUntil: user.lockedUntil ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
      ...user,
    };

    users.set(record.id, record);
    usersByEmail.set(record.email, record);
    return record;
  }

  const tx = {
    user: {
      create: async (args: { data: { email: string; passwordHash: string; fullName: string; phone?: string; role: UserRole } }) => {
        const user = addUser({
          id: `u-${sequence++}`,
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          fullName: args.data.fullName,
          phone: args.data.phone ?? null,
          role: args.data.role,
        });
        return user;
      },
      update: async (args: { where: { id: string }; data: Partial<UserRecord> }) => {
        const user = users.get(args.where.id);
        if (!user) throw new Error('user not found');
        const updated = { ...user, ...args.data, updatedAt: new Date() };
        users.set(user.id, updated);
        usersByEmail.set(updated.email, updated);
        return updated;
      },
    },
    notification: {
      create: async () => ({ id: `n-${sequence++}` }),
    },
    emailVerificationToken: {
      create: async (args: { data: Omit<TokenRecord, 'id' | 'createdAt' | 'consumedAt'> }) => {
        const token: TokenRecord = {
          id: `evt-${sequence++}`,
          createdAt: new Date(),
          consumedAt: null,
          ...args.data,
        };
        emailVerificationTokens.set(token.id, token);
        return token;
      },
      update: async (args: { where: { id: string }; data: Partial<TokenRecord> }) => {
        const token = emailVerificationTokens.get(args.where.id);
        if (!token) throw new Error('token not found');
        const updated = { ...token, ...args.data };
        emailVerificationTokens.set(token.id, updated);
        return updated;
      },
      deleteMany: async (args: { where: { expiresAt?: { lt: Date } } }) => {
        let count = 0;
        for (const [id, token] of emailVerificationTokens.entries()) {
          if (args.where.expiresAt?.lt && token.expiresAt < args.where.expiresAt.lt) {
            emailVerificationTokens.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        [...emailVerificationTokens.values()].find((item) => item.tokenHash === args.where.tokenHash) ??
        null,
    },
    passwordResetToken: {
      create: async (args: { data: Omit<TokenRecord, 'id' | 'createdAt' | 'consumedAt'> }) => {
        const token: TokenRecord = {
          id: `prt-${sequence++}`,
          createdAt: new Date(),
          consumedAt: null,
          ...args.data,
        };
        passwordResetTokens.set(token.id, token);
        return token;
      },
      update: async (args: { where: { id: string }; data: Partial<TokenRecord> }) => {
        const token = passwordResetTokens.get(args.where.id);
        if (!token) throw new Error('token not found');
        const updated = { ...token, ...args.data };
        passwordResetTokens.set(token.id, updated);
        return updated;
      },
      deleteMany: async (args: { where: { expiresAt?: { lt: Date }; userId?: string } }) => {
        let count = 0;
        for (const [id, token] of passwordResetTokens.entries()) {
          const expired = args.where.expiresAt?.lt ? token.expiresAt < args.where.expiresAt.lt : true;
          const byUser = args.where.userId ? token.userId === args.where.userId : true;
          if (expired && byUser) {
            passwordResetTokens.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        [...passwordResetTokens.values()].find((item) => item.tokenHash === args.where.tokenHash) ??
        null,
    },
    refreshSession: {
      create: async (args: { data: Omit<SessionRecord, 'id' | 'createdAt'> }) => {
        const session: SessionRecord = {
          id: `s-${sequence++}`,
          createdAt: new Date(),
          ...args.data,
        };
        sessions.set(session.id, session);
        return session;
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        [...sessions.values()].find((item) => item.tokenHash === args.where.tokenHash) ?? null,
      findMany: async (args: { where: { userId: string } }) =>
        [...sessions.values()]
          .filter((item) => item.userId === args.where.userId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      delete: async (args: { where: { id: string } }) => {
        const session = sessions.get(args.where.id);
        if (!session) throw new Error('session not found');
        sessions.delete(args.where.id);
        return session;
      },
      deleteMany: async (args: { where: { id?: string; userId?: string; tokenHash?: string; expiresAt?: { lt: Date } } }) => {
        let count = 0;
        for (const [id, session] of sessions.entries()) {
          const byId = args.where.id ? session.id === args.where.id : true;
          const byUser = args.where.userId ? session.userId === args.where.userId : true;
          const byHash = args.where.tokenHash ? session.tokenHash === args.where.tokenHash : true;
          const byExpiry = args.where.expiresAt?.lt ? session.expiresAt < args.where.expiresAt.lt : true;
          if (byId && byUser && byHash && byExpiry) {
            sessions.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
  };

  const prisma = {
    user: {
      findUnique: async (args: { where: { email?: string; id?: string }; select?: { id: true } }) => {
        const user = args.where.id
          ? users.get(args.where.id) ?? null
          : args.where.email
            ? usersByEmail.get(args.where.email) ?? null
            : null;

        if (!user) return null;
        if (args.select?.id) return { id: user.id };
        return user;
      },
      update: tx.user.update,
    },
    refreshSession: tx.refreshSession,
    passwordResetToken: tx.passwordResetToken,
    emailVerificationToken: tx.emailVerificationToken,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return {
    prisma,
    users,
    sessions,
    passwordResetTokens,
    emailVerificationTokens,
    addUser,
  };
}

test('auth.register creates hashed customer account and returns verification debug token', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);

  const result = await service.register('USER@Example.com', 'hello1234', 'User Demo', '0900000000');

  assert.equal(result.user.email, 'user@example.com');
  assert.equal(result.user.role, 'customer');
  assert.ok(result.debug?.verificationToken);

  const storedUser = [...mock.users.values()].find((user) => user.email === 'user@example.com');
  assert.ok(storedUser);
  assert.notEqual(storedUser?.passwordHash, 'hello1234');
  assert.equal(mock.sessions.size, 1);
  assert.equal(mock.emailVerificationTokens.size, 1);
});

test('auth.login locks account after repeated failed attempts', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      async () => service.login('user@example.com', 'wrong-password'),
      (error: unknown) => error instanceof UnauthorizedException || error instanceof ForbiddenException,
    );
  }

  await assert.rejects(
    async () => service.login('user@example.com', 'hello1234'),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('auth.refresh rotates refresh token and invalidates old session', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  const firstLogin = await service.login('user@example.com', 'hello1234');

  const refreshed = await service.refresh(firstLogin.refreshToken);

  assert.ok(refreshed.refreshToken.length > 40);
  assert.notEqual(refreshed.refreshToken, firstLogin.refreshToken);
  assert.equal(mock.sessions.size, 1);
});

test('auth.forgotPassword and resetPassword rotate credentials and clear sessions', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  await service.login('user@example.com', 'hello1234');
  const forgot = await service.forgotPassword('user@example.com');

  assert.ok(forgot.debug?.resetToken);
  await service.resetPassword(forgot.debug!.resetToken, 'new-password-1234');

  await assert.rejects(
    async () => service.login('user@example.com', 'hello1234'),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  const relogin = await service.login('user@example.com', 'new-password-1234');
  assert.ok(relogin.accessToken.length > 20);
  assert.equal(mock.sessions.size, 1);
});

test('auth.verifyEmail marks email as verified', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);
  const result = await service.register('verify@example.com', 'hello1234', 'Verify Demo');

  await service.verifyEmail(result.debug!.verificationToken);

  const storedUser = [...mock.users.values()].find((user) => user.email === 'verify@example.com');
  assert.ok(storedUser?.emailVerifiedAt instanceof Date);
});

test('auth.requestEmailVerification issues a new token and handles verified or missing users', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'pending@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'Pending User',
    role: 'customer',
  });
  mock.addUser({
    id: 'u-2',
    email: 'verified@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'Verified User',
    role: 'customer',
    emailVerifiedAt: new Date(),
  });

  const service = new AuthService(mock.prisma as never);
  const issued = await service.requestEmailVerification('u-1');
  const alreadyVerified = await service.requestEmailVerification('u-2');

  assert.ok(issued.debug?.verificationToken);
  assert.equal(alreadyVerified.alreadyVerified, true);
  assert.equal(mock.emailVerificationTokens.size, 1);

  await assert.rejects(
    async () => service.requestEmailVerification('missing-user'),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth.session management and token verification work as expected', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  await service.login('user@example.com', 'hello1234', { userAgent: 'agent-1', ipAddress: '127.0.0.1' });
  await service.login('user@example.com', 'hello1234', { userAgent: 'agent-2', ipAddress: '127.0.0.2' });

  const sessions = await service.listSessions('u-1');
  assert.equal(sessions.data.length, 2);
  assert.equal(sessions.data[0].userAgent, 'agent-2');

  const revoked = await service.revokeSession(sessions.data[0].id, 'u-1');
  assert.equal(revoked.success, true);
  assert.equal(mock.sessions.size, 1);

  await service.logout(undefined, 'u-1');
  assert.equal(mock.sessions.size, 0);

  const validLogin = await service.login('user@example.com', 'hello1234');
  const payload = service.verifyAccessToken(validLogin.accessToken);
  assert.equal(payload.sub, 'u-1');

  const malformedToken = jwt.sign(
    { sub: 'u-1' },
    'test-jwt-secret-12345678901234567890',
    { expiresIn: 3600 },
  );

  await assert.rejects(
    async () => service.verifyEmail('invalid-token'),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  assert.throws(
    () => service.verifyAccessToken(malformedToken),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});
