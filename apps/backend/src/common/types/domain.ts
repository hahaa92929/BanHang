export type UserRole = 'admin' | 'customer';

export type ProductSort = 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';

export type OrderStatus = 'created' | 'confirmed' | 'shipping' | 'completed';
export type PaymentMethod = 'cod' | 'vnpay' | 'momo';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed';
export type ShippingMethod = 'standard' | 'express';
export type ShippingStatus = 'pending' | 'packed' | 'in_transit' | 'delivered';

export interface JwtUserPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface ProductEntity {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  rating: number;
  tags: string[];
  createdAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Address {
  receiverName: string;
  phone: string;
  line1: string;
  district: string;
  city: string;
  country: string;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  at: string;
  by: string;
}

export interface OrderEntity {
  id: string;
  userId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingMethod: ShippingMethod;
  shippingStatus: ShippingStatus;
  address: Address;
  notes: string;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  statusHistory: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface RefreshSession {
  token: string;
  userId: string;
  expiresAt: number;
}
