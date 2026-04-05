import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthOrApiKeyGuard } from './auth-or-api-key.guard';
import { JwtGuard } from './jwt.guard';
import { PermissionsGuard } from './permissions.guard';

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as ExecutionContext;
}

test('JwtGuard accepts valid bearer tokens and attaches user payload', () => {
  const payload = { sub: 'u-1', role: 'customer', email: 'customer@example.com' };
  const guard = new JwtGuard({
    verifyAccessToken(token: string) {
      assert.equal(token, 'access-token');
      return payload;
    },
  } as any);
  const request = {
    headers: {
      authorization: 'Bearer access-token',
    },
  };

  const allowed = guard.canActivate(createContext(request));

  assert.equal(allowed, true);
  assert.deepEqual((request as any).user, payload);
});

test('JwtGuard rejects missing or invalid bearer tokens', () => {
  const guard = new JwtGuard({
    verifyAccessToken() {
      throw new Error('invalid');
    },
  } as any);

  assert.throws(
    () =>
      guard.canActivate(
        createContext({
          headers: {},
        }),
      ),
    /Missing Bearer token/,
  );

  assert.throws(
    () =>
      guard.canActivate(
        createContext({
          headers: {
            authorization: 'Bearer broken-token',
          },
        }),
      ),
    /Token invalid or expired/,
  );
});

test('AuthOrApiKeyGuard accepts x-api-key and attaches scoped payload', async () => {
  const payload = {
    sub: 'u-1',
    role: 'manager',
    email: 'manager@example.com',
    permissions: ['reporting.read'],
    authType: 'api_key',
    apiKeyId: 'ak-1',
  };
  const guard = new AuthOrApiKeyGuard({
    verifyAccessToken() {
      throw new Error('skip bearer');
    },
    async authenticateApiKey(token: string) {
      assert.equal(token, 'bhk_token');
      return payload;
    },
  } as any);
  const request = {
    headers: {
      'x-api-key': 'bhk_token',
    },
  };

  const allowed = await guard.canActivate(createContext(request));

  assert.equal(allowed, true);
  assert.deepEqual((request as any).user, payload);
});

test('PermissionsGuard allows missing permissions and authorized roles', () => {
  const reflector = {
    getAllAndOverride: () => undefined,
  } as Reflector;
  const noPermissionsGuard = new PermissionsGuard(reflector);

  assert.equal(
    noPermissionsGuard.canActivate(
      createContext({
        user: {
          role: 'guest',
        },
      }),
    ),
    true,
  );

  const adminReflector = {
    getAllAndOverride: () => ['catalog.write'],
  } as Reflector;
  const guard = new PermissionsGuard(adminReflector);

  assert.equal(
    guard.canActivate(
      createContext({
        user: {
          role: 'admin',
        },
      }),
    ),
    true,
  );

  assert.equal(
    guard.canActivate(
      createContext({
        user: {
          role: 'customer',
          permissions: ['catalog.write'],
        },
      }),
    ),
    true,
  );
});

test('PermissionsGuard rejects unauthorized and forbidden requests', () => {
  const reflector = {
    getAllAndOverride: () => ['catalog.write'],
  } as Reflector;
  const guard = new PermissionsGuard(reflector);

  assert.throws(
    () =>
      guard.canActivate(
        createContext({
          headers: {},
        }),
      ),
    /Unauthorized/,
  );

  assert.throws(
    () =>
      guard.canActivate(
        createContext({
          user: {
            role: 'customer',
          },
        }),
      ),
    /Missing permission: catalog.write/,
  );
});
