type RawEnv = Record<string, unknown>;

export interface AppEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_PRIVATE_KEY?: string;
  JWT_PUBLIC_KEY?: string;
  JWT_ACCESS_TTL_SEC: number;
  JWT_REFRESH_TTL_SEC: number;
  TOKEN_HASH_SECRET: string;
  PAYMENT_WEBHOOK_SECRET: string;
  VNPAY_TMN_CODE?: string;
  VNPAY_HASH_SECRET?: string;
  VNPAY_PAYMENT_URL?: string;
  VNPAY_RETURN_URL?: string;
  RESERVATION_TTL_MINUTES: number;
  RESET_PASSWORD_TTL_MINUTES: number;
  EMAIL_VERIFICATION_TTL_HOURS: number;
  APP_ORIGINS: string;
}

function readString(env: RawEnv, key: keyof AppEnv, fallback?: string) {
  const value = env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing environment variable ${key}`);
}

function readOptionalString(env: RawEnv, key: keyof AppEnv) {
  const value = env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

function readInt(env: RawEnv, key: keyof AppEnv, fallback?: number) {
  const raw = env[key];
  if (raw === undefined || raw === null || raw === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing environment variable ${key}`);
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${key} must be a positive number`);
  }

  return value;
}

function assertMinLength(name: keyof AppEnv, value: string, length: number) {
  if (value.length < length) {
    throw new Error(`Environment variable ${name} must be at least ${length} characters`);
  }
}

export function validateEnv(env: RawEnv): AppEnv {
  const nodeEnv = readString(env, 'NODE_ENV', 'development');
  const jwtSecret = readOptionalString(env, 'JWT_SECRET');
  const jwtPrivateKey = readOptionalString(env, 'JWT_PRIVATE_KEY');
  const jwtPublicKey = readOptionalString(env, 'JWT_PUBLIC_KEY');

  if ((jwtPrivateKey && !jwtPublicKey) || (!jwtPrivateKey && jwtPublicKey)) {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be provided together');
  }

  if (!jwtSecret && !(jwtPrivateKey && jwtPublicKey)) {
    throw new Error('Either JWT_SECRET or both JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required');
  }

  if (nodeEnv === 'production' && !(jwtPrivateKey && jwtPublicKey)) {
    throw new Error('Production requires JWT_PRIVATE_KEY and JWT_PUBLIC_KEY for RS256 signing');
  }

  const vnpayValues = [
    readOptionalString(env, 'VNPAY_TMN_CODE'),
    readOptionalString(env, 'VNPAY_HASH_SECRET'),
    readOptionalString(env, 'VNPAY_PAYMENT_URL'),
    readOptionalString(env, 'VNPAY_RETURN_URL'),
  ];
  const hasAnyVnpayConfig = vnpayValues.some(Boolean);
  const hasAllVnpayConfig = vnpayValues.every(Boolean);
  if (hasAnyVnpayConfig && !hasAllVnpayConfig) {
    throw new Error(
      'VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_PAYMENT_URL, and VNPAY_RETURN_URL must be provided together',
    );
  }

  const validated: AppEnv = {
    NODE_ENV: nodeEnv,
    PORT: readInt(env, 'PORT', 4000),
    DATABASE_URL: readString(env, 'DATABASE_URL'),
    JWT_SECRET: jwtSecret ?? '',
    JWT_PRIVATE_KEY: jwtPrivateKey,
    JWT_PUBLIC_KEY: jwtPublicKey,
    JWT_ACCESS_TTL_SEC: readInt(env, 'JWT_ACCESS_TTL_SEC', 3600),
    JWT_REFRESH_TTL_SEC: readInt(env, 'JWT_REFRESH_TTL_SEC', 604800),
    TOKEN_HASH_SECRET: readString(env, 'TOKEN_HASH_SECRET'),
    PAYMENT_WEBHOOK_SECRET: readString(env, 'PAYMENT_WEBHOOK_SECRET'),
    VNPAY_TMN_CODE: vnpayValues[0],
    VNPAY_HASH_SECRET: vnpayValues[1],
    VNPAY_PAYMENT_URL: vnpayValues[2],
    VNPAY_RETURN_URL: vnpayValues[3],
    RESERVATION_TTL_MINUTES: readInt(env, 'RESERVATION_TTL_MINUTES', 15),
    RESET_PASSWORD_TTL_MINUTES: readInt(env, 'RESET_PASSWORD_TTL_MINUTES', 30),
    EMAIL_VERIFICATION_TTL_HOURS: readInt(env, 'EMAIL_VERIFICATION_TTL_HOURS', 24),
    APP_ORIGINS: readString(env, 'APP_ORIGINS', 'http://localhost:3000'),
  };

  if (validated.JWT_SECRET) {
    assertMinLength('JWT_SECRET', validated.JWT_SECRET, 24);
  }
  assertMinLength('TOKEN_HASH_SECRET', validated.TOKEN_HASH_SECRET, 24);
  assertMinLength('PAYMENT_WEBHOOK_SECRET', validated.PAYMENT_WEBHOOK_SECRET, 24);

  return validated;
}
