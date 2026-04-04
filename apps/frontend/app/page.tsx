'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type UserRole = 'admin' | 'customer';
type ProductSort = 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
type PaymentMethod = 'cod' | 'vnpay' | 'momo';
type ShippingMethod = 'standard' | 'express';
type OrderStatus = 'created' | 'confirmed' | 'shipping' | 'completed';

type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
};

type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  rating: number;
};

type ProductListResponse = {
  data: Product[];
  categories: string[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Cart = {
  items: Array<{ productId: string; name: string; unitPrice: number; quantity: number }>;
  subtotal: number;
  totalItems: number;
};

type Order = {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  shippingMethod: ShippingMethod;
  shippingStatus: string;
  total: number;
  createdAt: string;
};

type OrdersResponse = {
  total: number;
  data: Order[];
};

type NoticeState = { type: 'ok' | 'error'; message: string } | null;

type FilterState = {
  q: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  sort: ProductSort;
  inStock: boolean;
  page: number;
  limit: number;
};

type CheckoutState = {
  receiverName: string;
  phone: string;
  line1: string;
  district: string;
  city: string;
  country: string;
  paymentMethod: PaymentMethod;
  shippingMethod: ShippingMethod;
  notes: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const AUTH_STORAGE_KEY = 'banhang.auth';

const INITIAL_FILTERS: FilterState = {
  q: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
  inStock: false,
  page: 1,
  limit: 6,
};

const INITIAL_CHECKOUT: CheckoutState = {
  receiverName: 'Khach Demo',
  phone: '0900000000',
  line1: '123 Nguyen Trai',
  district: 'Quan 1',
  city: 'Ho Chi Minh',
  country: 'Viet Nam',
  paymentMethod: 'cod',
  shippingMethod: 'standard',
  notes: '',
};

function toCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function nextOrderStatus(status: OrderStatus): 'confirmed' | 'shipping' | 'completed' | null {
  if (status === 'created') return 'confirmed';
  if (status === 'confirmed') return 'shipping';
  if (status === 'shipping') return 'completed';
  return null;
}

export default function HomePage() {
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@banhang.local');
  const [password, setPassword] = useState('admin123');
  const [fullName, setFullName] = useState('');

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [productsMeta, setProductsMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 6 });

  const [cart, setCart] = useState<Cart>({ items: [], subtotal: 0, totalItems: 0 });
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [checkout, setCheckout] = useState<CheckoutState>(INITIAL_CHECKOUT);

  const [orders, setOrders] = useState<Order[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState({ products: false, cart: false, orders: false });

  const isAuthenticated = Boolean(auth?.accessToken);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.accessToken) {
      headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    return headers;
  }, [auth?.accessToken]);

  function notify(type: 'ok' | 'error', message: string) {
    setNotice({ type, message });
  }

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API}${path}`, init);
    const raw = await response.text();
    const data = raw ? (JSON.parse(raw) as unknown) : null;

    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message: string }).message)
          : 'Request failed';
      throw new Error(message);
    }

    return data as T;
  }

  async function loadProducts(customFilters?: FilterState) {
    const active = customFilters ?? filters;
    setLoading((prev) => ({ ...prev, products: true }));

    try {
      const params = new URLSearchParams();
      if (active.q.trim()) params.set('q', active.q.trim());
      if (active.category) params.set('category', active.category);
      if (active.minPrice.trim()) params.set('minPrice', active.minPrice.trim());
      if (active.maxPrice.trim()) params.set('maxPrice', active.maxPrice.trim());
      if (active.sort) params.set('sort', active.sort);
      if (active.inStock) params.set('inStock', 'true');
      params.set('page', String(active.page));
      params.set('limit', String(active.limit));

      const result = await requestJson<ProductListResponse>(`/api/products?${params.toString()}`);

      setProducts(result.data);
      setCategories(result.categories);
      setProductsMeta({
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
      });
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to load products');
    } finally {
      setLoading((prev) => ({ ...prev, products: false }));
    }
  }

  async function loadCart() {
    if (!isAuthenticated) {
      setCart({ items: [], subtotal: 0, totalItems: 0 });
      return;
    }

    setLoading((prev) => ({ ...prev, cart: true }));

    try {
      const result = await requestJson<Cart>('/api/cart', { headers: authHeaders });
      setCart(result);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to load cart');
    } finally {
      setLoading((prev) => ({ ...prev, cart: false }));
    }
  }

  async function loadOrders() {
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }

    setLoading((prev) => ({ ...prev, orders: true }));

    try {
      const result = await requestJson<OrdersResponse>('/api/orders', { headers: authHeaders });
      setOrders(result.data);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading((prev) => ({ ...prev, orders: false }));
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : { email, password, fullName: fullName.trim() || 'New Customer' };

      const result = await requestJson<AuthPayload>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setAuth(result);
      notify('ok', mode === 'login' ? 'Login success' : 'Register success');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Authentication failed');
    }
  }

  async function refreshSession() {
    if (!auth?.refreshToken) return;

    try {
      const result = await requestJson<AuthPayload>('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });

      setAuth(result);
      notify('ok', 'Session refreshed');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Refresh failed');
    }
  }

  async function logout() {
    if (auth) {
      try {
        await requestJson<{ success: boolean }>('/api/auth/logout', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
      } catch {
        // Ignore logout API errors on client side
      }
    }

    setAuth(null);
    setOrders([]);
    setCart({ items: [], subtotal: 0, totalItems: 0 });
    notify('ok', 'Logged out');
  }

  async function addToCart(productId: string) {
    if (!isAuthenticated) {
      notify('error', 'Please login first');
      return;
    }

    try {
      const result = await requestJson<Cart>('/api/cart/items', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      setCart(result);
      notify('ok', 'Added to cart');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to add item');
    }
  }

  async function updateCartQuantity(productId: string, quantity: number) {
    if (!isAuthenticated) return;

    if (quantity <= 0) {
      await removeCartItem(productId);
      return;
    }

    try {
      const result = await requestJson<Cart>(`/api/cart/items/${productId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ quantity }),
      });

      setCart(result);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to update quantity');
    }
  }

  async function removeCartItem(productId: string) {
    if (!isAuthenticated) return;

    try {
      const result = await requestJson<Cart>(`/api/cart/items/${productId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      setCart(result);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to remove item');
    }
  }

  async function clearCart() {
    if (!isAuthenticated) return;

    try {
      const result = await requestJson<Cart>('/api/cart/clear', {
        method: 'DELETE',
        headers: authHeaders,
      });

      setCart(result);
      notify('ok', 'Cart cleared');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to clear cart');
    }
  }

  async function submitCheckout() {
    if (!isAuthenticated) {
      notify('error', 'Please login first');
      return;
    }

    try {
      await requestJson<Order>('/api/orders/checkout', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          address: {
            receiverName: checkout.receiverName,
            phone: checkout.phone,
            line1: checkout.line1,
            district: checkout.district,
            city: checkout.city,
            country: checkout.country,
          },
          paymentMethod: checkout.paymentMethod,
          shippingMethod: checkout.shippingMethod,
          notes: checkout.notes,
        }),
      });

      setCheckoutStep(1);
      setCheckout(INITIAL_CHECKOUT);
      notify('ok', 'Checkout success');
      await Promise.all([loadCart(), loadOrders(), loadProducts()]);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Checkout failed');
    }
  }

  async function advanceOrder(order: Order) {
    const target = nextOrderStatus(order.status);
    if (!target || !isAuthenticated || auth?.user.role !== 'admin') return;

    try {
      await requestJson<Order>(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: target }),
      });

      notify('ok', `Order ${order.id} moved to ${target}`);
      await loadOrders();
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Failed to update order');
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as AuthPayload;
      if (parsed.accessToken && parsed.refreshToken) {
        setAuth(parsed);
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void Promise.all([loadCart(), loadOrders()]);
    }
  }, [isAuthenticated]);

  return (
    <main className="page">
      <section className="hero">
        <h1>BanHang Platform</h1>
        <p>Next.js frontend + NestJS backend, structured toward sprint implementation.</p>
        {notice && <p className={`notice ${notice.type}`}>{notice.message}</p>}
      </section>

      <section className="panel auth-panel">
        <h2>Authentication</h2>
        <form className="auth-form" onSubmit={submitAuth}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'register' && (
            <input
              placeholder="Full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          )}
          <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
          <button
            type="button"
            className="alt"
            onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
          >
            Switch to {mode === 'login' ? 'register' : 'login'}
          </button>
          <button type="button" className="alt" onClick={refreshSession} disabled={!isAuthenticated}>
            Refresh token
          </button>
          <button type="button" className="danger" onClick={logout} disabled={!isAuthenticated}>
            Logout
          </button>
        </form>
        <p className="meta-line">
          Session: {isAuthenticated ? `${auth?.user.fullName} (${auth?.user.role})` : 'Not logged in'}
        </p>
      </section>

      <section className="grid">
        <div className="panel products">
          <div className="panel-head">
            <h2>Catalog</h2>
            <span>
              {productsMeta.total} products | page {productsMeta.page}/{productsMeta.totalPages}
            </span>
          </div>

          <div className="filters">
            <input
              placeholder="Search"
              value={filters.q}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, q: event.target.value, page: 1 }))
              }
            />
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, category: event.target.value, page: 1 }))
              }
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              placeholder="Min price"
              value={filters.minPrice}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, minPrice: event.target.value, page: 1 }))
              }
            />
            <input
              placeholder="Max price"
              value={filters.maxPrice}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, maxPrice: event.target.value, page: 1 }))
              }
            />
            <select
              value={filters.sort}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sort: event.target.value as ProductSort, page: 1 }))
              }
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price ascending</option>
              <option value="price_desc">Price descending</option>
              <option value="rating_desc">Rating descending</option>
            </select>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, inStock: event.target.checked, page: 1 }))
                }
              />
              In stock only
            </label>
            <button type="button" className="alt" onClick={() => void loadProducts()}>
              Apply
            </button>
          </div>

          <div className="card-grid">
            {products.map((product) => (
              <article key={product.id} className="product-card">
                <h3>{product.name}</h3>
                <p className="muted">{product.category}</p>
                <p>{product.description}</p>
                <p className="muted">SKU: {product.sku}</p>
                <p className="muted">Rating: {product.rating} | Stock: {product.stock}</p>
                <strong>{toCurrency(product.price)}</strong>
                <button
                  type="button"
                  onClick={() => void addToCart(product.id)}
                  disabled={!isAuthenticated || product.stock <= 0}
                >
                  Add to cart
                </button>
              </article>
            ))}
          </div>

          <div className="pagination">
            <button
              type="button"
              className="alt"
              disabled={productsMeta.page <= 1 || loading.products}
              onClick={() => {
                const next = { ...filters, page: filters.page - 1 };
                setFilters(next);
                void loadProducts(next);
              }}
            >
              Prev
            </button>
            <button
              type="button"
              className="alt"
              disabled={productsMeta.page >= productsMeta.totalPages || loading.products}
              onClick={() => {
                const next = { ...filters, page: filters.page + 1 };
                setFilters(next);
                void loadProducts(next);
              }}
            >
              Next
            </button>
          </div>
        </div>

        <aside className="panel cart-panel">
          <div className="panel-head">
            <h2>Cart</h2>
            <span>{cart.totalItems} items</span>
          </div>

          <div className="cart-list">
            {cart.items.map((item) => (
              <div key={item.productId} className="cart-item">
                <div>
                  <strong>{item.name}</strong>
                  <p>{toCurrency(item.unitPrice)}</p>
                </div>
                <div className="cart-actions">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      void updateCartQuantity(item.productId, Number(event.target.value))
                    }
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void removeCartItem(item.productId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!cart.items.length && <p className="muted">Cart is empty.</p>}
          </div>

          <p className="cart-total">Subtotal: {toCurrency(cart.subtotal)}</p>
          <button type="button" className="alt" onClick={() => void clearCart()} disabled={!cart.items.length}>
            Clear cart
          </button>

          <div className="checkout">
            <h3>Checkout (3 steps)</h3>
            <div className="step-tabs">
              <button
                type="button"
                className={checkoutStep === 1 ? 'active' : 'alt'}
                onClick={() => setCheckoutStep(1)}
              >
                Shipping
              </button>
              <button
                type="button"
                className={checkoutStep === 2 ? 'active' : 'alt'}
                onClick={() => setCheckoutStep(2)}
              >
                Payment
              </button>
              <button
                type="button"
                className={checkoutStep === 3 ? 'active' : 'alt'}
                onClick={() => setCheckoutStep(3)}
              >
                Confirm
              </button>
            </div>

            {checkoutStep === 1 && (
              <div className="checkout-grid">
                <input
                  placeholder="Receiver"
                  value={checkout.receiverName}
                  onChange={(event) =>
                    setCheckout((prev) => ({ ...prev, receiverName: event.target.value }))
                  }
                />
                <input
                  placeholder="Phone"
                  value={checkout.phone}
                  onChange={(event) => setCheckout((prev) => ({ ...prev, phone: event.target.value }))}
                />
                <input
                  placeholder="Address"
                  value={checkout.line1}
                  onChange={(event) => setCheckout((prev) => ({ ...prev, line1: event.target.value }))}
                />
                <input
                  placeholder="District"
                  value={checkout.district}
                  onChange={(event) =>
                    setCheckout((prev) => ({ ...prev, district: event.target.value }))
                  }
                />
                <input
                  placeholder="City"
                  value={checkout.city}
                  onChange={(event) => setCheckout((prev) => ({ ...prev, city: event.target.value }))}
                />
                <input
                  placeholder="Country"
                  value={checkout.country}
                  onChange={(event) =>
                    setCheckout((prev) => ({ ...prev, country: event.target.value }))
                  }
                />
              </div>
            )}

            {checkoutStep === 2 && (
              <div className="checkout-grid">
                <select
                  value={checkout.paymentMethod}
                  onChange={(event) =>
                    setCheckout((prev) => ({
                      ...prev,
                      paymentMethod: event.target.value as PaymentMethod,
                    }))
                  }
                >
                  <option value="cod">COD</option>
                  <option value="vnpay">VNPay</option>
                  <option value="momo">MoMo</option>
                </select>
                <select
                  value={checkout.shippingMethod}
                  onChange={(event) =>
                    setCheckout((prev) => ({
                      ...prev,
                      shippingMethod: event.target.value as ShippingMethod,
                    }))
                  }
                >
                  <option value="standard">Standard (30,000)</option>
                  <option value="express">Express (60,000)</option>
                </select>
                <input
                  placeholder="Notes"
                  value={checkout.notes}
                  onChange={(event) => setCheckout((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
            )}

            {checkoutStep === 3 && (
              <div className="checkout-summary">
                <p>Receiver: {checkout.receiverName}</p>
                <p>
                  Address: {checkout.line1}, {checkout.district}, {checkout.city}, {checkout.country}
                </p>
                <p>Payment: {checkout.paymentMethod}</p>
                <p>Shipping: {checkout.shippingMethod}</p>
                <p>Cart total: {toCurrency(cart.subtotal)}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void submitCheckout()}
              disabled={!cart.items.length || !isAuthenticated}
            >
              Submit checkout
            </button>
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Orders</h2>
          <button type="button" className="alt" onClick={() => void loadOrders()}>
            Reload orders
          </button>
        </div>

        {loading.orders && <p className="muted">Loading orders...</p>}

        <div className="order-list">
          {orders.map((order) => {
            const next = nextOrderStatus(order.status);
            return (
              <article key={order.id} className="order-card">
                <p>
                  <strong>{order.id}</strong>
                </p>
                <p>Status: {order.status}</p>
                <p>Payment: {order.paymentMethod} / {order.paymentStatus}</p>
                <p>Shipping: {order.shippingMethod} / {order.shippingStatus}</p>
                <p>Total: {toCurrency(order.total)}</p>
                <p>Created: {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                {auth?.user.role === 'admin' && next && (
                  <button type="button" onClick={() => void advanceOrder(order)}>
                    Move to {next}
                  </button>
                )}
              </article>
            );
          })}

          {!orders.length && <p className="muted">No orders yet.</p>}
        </div>
      </section>
    </main>
  );
}
