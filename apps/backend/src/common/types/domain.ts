export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'customer'
  | 'guest';

export type Permission =
  | 'auth.manage'
  | 'catalog.read'
  | 'catalog.write'
  | 'cart.write'
  | 'orders.read'
  | 'orders.manage'
  | 'payments.manage'
  | 'inventory.read'
  | 'inventory.manage'
  | 'shipping.manage'
  | 'notifications.read'
  | 'reporting.read';

export interface JwtUserPayload {
  sub: string;
  role: UserRole;
  email: string;
}
