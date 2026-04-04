import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hashPassword } from '../../common/security';
import { AuthService } from './auth.service';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  createdAt: Date;
};

type SessionRecord = {
  token: string;
  userId: string;
  expiresAt: Date;
};

function createAuthMock() {
  const users = new Map<string, UserRecord>();
  const usersByEmail = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();

  function addUser(user: UserRecord) {
    users.set(user.id, user);
    usersByEmail.set(user.email, user);
  }

  const prisma = {
    user: {
      findUnique: async (args: { where: { email?: string; id?: string }; select?: { id: true } }) => {
        if (args.where.email) {
          const user = usersByEmail.get(args.where.email) ?? null;
          if (!user) return null;
          if (args.select?.id) return { id: user.id };
          return user;
        }

        if (args.where.id) {
          return users.get(args.where.id) ?? null;
        }

        return null;
      },
      create: async (args: {
        data: { email: string; passwordHash: string; fullName: string; role: UserRole };
      }) => {
        const user: UserRecord = {
          id: `u-${users.size + 1}`,
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          fullName: args.data.fullName,
          role: args.data.role,
          createdAt: new Date(),
        };

        addUser(user);
        return user;
      },
    },
    refreshSession: {
      create: async (args: { data: SessionRecord }) => {
        sessions.set(args.data.token, args.data);
        return args.data;
      },
      deleteMany: async (args: { where: { token?: string; userId?: string; expiresAt?: { lt: Date } } }) => {
        let count = 0;

        if (args.where.token) {
          if (sessions.delete(args.where.token)) count += 1;
          return { count };
        }

        if (args.where.userId) {
          for (const [token, session] of sessions.entries()) {
            if (session.userId === args.where.userId) {
              sessions.delete(token);
              count += 1;
            }
          }
          return { count };
        }

        if (args.where.expiresAt?.lt) {
          for (const [token, session] of sessions.entries()) {
            if (session.expiresAt < args.where.expiresAt.lt) {
              sessions.delete(token);
              count += 1;
            }
          }
          return { count };
        }

        return { count };
      },
      findUnique: async (args: { where: { token: string } }) => sessions.get(args.where.token) ?? null,
      delete: async (args: { where: { token: string } }) => {
        const found = sessions.get(args.where.token);
        if (!found) throw new Error('session not found');
        sessions.delete(args.where.token);
        return found;
      },
    },
  };

  return {
    prisma,
    users,
    usersByEmail,
    sessions,
    addUser,
  };
}

test('auth.login returns access and refresh tokens for valid credentials', async () => {
  const mock = createAuthMock();

  mock.addUser({
    id: 'u-admin',
    email: 'admin@banhang.local',
    passwordHash: hashPassword('admin123'),
    fullName: 'Admin Demo',
    role: 'admin',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  });

  const service = new AuthService(mock.prisma as never);
  const result = await service.login('admin@banhang.local', 'admin123');

  assert.ok(result.accessToken.length > 20);
  assert.ok(result.refreshToken.length > 20);
  assert.equal(result.user.email, 'admin@banhang.local');
  assert.equal(result.user.role, 'admin');
  assert.equal(mock.sessions.size, 1);
});

test('auth.login throws UnauthorizedException for invalid password', async () => {
  const mock = createAuthMock();

  mock.addUser({
    id: 'u-admin',
    email: 'admin@banhang.local',
    passwordHash: hashPassword('admin123'),
    fullName: 'Admin Demo',
    role: 'admin',
    createdAt: new Date(),
  });

  const service = new AuthService(mock.prisma as never);

  await assert.rejects(
    async () => service.login('admin@banhang.local', 'wrong-password'),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth.register normalizes email and stores hashed password', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);

  const result = await service.register('USER@Example.com', 'hello123', 'User Demo');

  assert.equal(result.user.email, 'user@example.com');
  assert.equal(result.user.role, 'customer');

  const storedUser = mock.usersByEmail.get('user@example.com');
  assert.ok(storedUser);
  assert.notEqual(storedUser?.passwordHash, 'hello123');
  assert.equal(storedUser?.passwordHash, hashPassword('hello123'));
});

test('auth.register throws BadRequestException when email already exists', async () => {
  const mock = createAuthMock();

  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: hashPassword('abc12345'),
    fullName: 'Existing User',
    role: 'customer',
    createdAt: new Date(),
  });

  const service = new AuthService(mock.prisma as never);

  await assert.rejects(
    async () => service.register('user@example.com', 'newpass123', 'New User'),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('auth.refresh rotates refresh token and invalidates old token', async () => {
  const mock = createAuthMock();

  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: hashPassword('abc12345'),
    fullName: 'User Demo',
    role: 'customer',
    createdAt: new Date(),
  });

  mock.sessions.set('old-refresh', {
    token: 'old-refresh',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 60_000),
  });

  const service = new AuthService(mock.prisma as never);
  const result = await service.refresh('old-refresh');

  assert.ok(result.refreshToken.length > 20);
  assert.notEqual(result.refreshToken, 'old-refresh');
  assert.equal(mock.sessions.has('old-refresh'), false);
  assert.equal(mock.sessions.size, 1);
});

test('auth.refresh throws UnauthorizedException when token expired', async () => {
  const mock = createAuthMock();

  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: hashPassword('abc12345'),
    fullName: 'User Demo',
    role: 'customer',
    createdAt: new Date(),
  });

  mock.sessions.set('expired-refresh', {
    token: 'expired-refresh',
    userId: 'u-1',
    expiresAt: new Date(Date.now() - 1_000),
  });

  const service = new AuthService(mock.prisma as never);

  await assert.rejects(
    async () => service.refresh('expired-refresh'),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth.logout by refresh token removes only that token', async () => {
  const mock = createAuthMock();

  mock.sessions.set('token-1', {
    token: 'token-1',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 10_000),
  });

  mock.sessions.set('token-2', {
    token: 'token-2',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 10_000),
  });

  const service = new AuthService(mock.prisma as never);
  const result = await service.logout('token-1');

  assert.equal(result.success, true);
  assert.equal(mock.sessions.has('token-1'), false);
  assert.equal(mock.sessions.has('token-2'), true);
});

test('auth.me returns public profile for existing user', async () => {
  const mock = createAuthMock();

  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: hashPassword('abc12345'),
    fullName: 'User Demo',
    role: 'customer',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  });

  const service = new AuthService(mock.prisma as never);
  const profile = await service.me('u-1');

  assert.equal(profile.id, 'u-1');
  assert.equal(profile.email, 'user@example.com');
  assert.equal(profile.fullName, 'User Demo');
  assert.equal(profile.role, 'customer');
});

test('auth.me throws UnauthorizedException for unknown user', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);

  await assert.rejects(
    async () => service.me('missing-user'),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth.logout by userId removes all sessions of that user', async () => {
  const mock = createAuthMock();

  mock.sessions.set('token-a', {
    token: 'token-a',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 10_000),
  });
  mock.sessions.set('token-b', {
    token: 'token-b',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 10_000),
  });
  mock.sessions.set('token-c', {
    token: 'token-c',
    userId: 'u-2',
    expiresAt: new Date(Date.now() + 10_000),
  });

  const service = new AuthService(mock.prisma as never);
  await service.logout(undefined, 'u-1');

  assert.equal(mock.sessions.has('token-a'), false);
  assert.equal(mock.sessions.has('token-b'), false);
  assert.equal(mock.sessions.has('token-c'), true);
});
