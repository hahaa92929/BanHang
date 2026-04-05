import { Permission, UserRole } from './types/domain';

export const ROLE_PRIORITY: Record<UserRole, number> = {
  guest: 0,
  customer: 1,
  staff: 2,
  manager: 3,
  admin: 4,
  super_admin: 5,
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  guest: ['catalog.read'],
  customer: ['catalog.read', 'cart.write', 'orders.read', 'notifications.read'],
  staff: [
    'catalog.read',
    'catalog.write',
    'orders.read',
    'orders.manage',
    'inventory.read',
    'inventory.manage',
    'shipping.manage',
    'notifications.read',
    'notifications.manage',
  ],
  manager: [
    'catalog.read',
    'catalog.write',
    'orders.read',
    'orders.manage',
    'payments.manage',
    'inventory.read',
    'inventory.manage',
    'shipping.manage',
    'notifications.read',
    'notifications.manage',
    'reporting.read',
  ],
  admin: [
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
  ],
  super_admin: [
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
  ],
};

export function hasRole(userRole: UserRole, requiredRole: UserRole) {
  return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[requiredRole];
}

export function hasPermission(userRole: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[userRole].includes(permission);
}
