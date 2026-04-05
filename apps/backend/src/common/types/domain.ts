export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'customer'
  | 'guest';

export const PERMISSIONS = [
  'auth.manage',
  'catalog.read',
  'catalog.write',
  'cart.write',
  'orders.read',
  'orders.manage',
  'payments.manage',
  'inventory.read',
  'inventory.manage',
  'shipping.manage',
  'notifications.read',
  'notifications.manage',
  'reporting.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface JwtUserPayload {
  sub: string;
  role: UserRole;
  email: string;
  permissions?: Permission[];
  authType?: 'jwt' | 'api_key';
  apiKeyId?: string;
}
