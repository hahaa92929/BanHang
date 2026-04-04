export type UserRole = 'admin' | 'customer';

export interface JwtUserPayload {
  sub: string;
  role: UserRole;
  email: string;
}
