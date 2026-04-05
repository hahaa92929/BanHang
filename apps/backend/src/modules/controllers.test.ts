import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthController } from './auth/auth.controller';
import { CartController } from './cart/cart.controller';
import { InventoryController } from './inventory/inventory.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { OrdersController } from './orders/orders.controller';
import { PaymentsController } from './payments/payments.controller';
import { ProductsController } from './products/products.controller';
import { ReportingController } from './reporting/reporting.controller';
import { ShippingController } from './shipping/shipping.controller';
import { WishlistController } from './wishlist/wishlist.controller';

test('AuthController forwards request metadata and session actions', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const cookieCalls: Array<{ method: 'cookie' | 'clearCookie'; args: unknown[] }> = [];
  const service = {
    createGuestSession: (...args: unknown[]) => {
      calls.push({ method: 'createGuestSession', args });
      return {
        accessToken: 'guest-access',
        refreshToken: 'guest-refresh-token-1234567890123456789012345678901234567890',
        csrfToken: 'guest-csrf',
        user: { id: 'u-guest', role: 'guest' },
      };
    },
    login: (...args: unknown[]) => {
      calls.push({ method: 'login', args });
      return {
        accessToken: 'access',
        refreshToken: 'refresh-token-1234567890123456789012345678901234567890',
        csrfToken: 'csrf-token',
      };
    },
    socialLogin: (...args: unknown[]) => {
      calls.push({ method: 'socialLogin', args });
      return {
        accessToken: 'social-access',
        refreshToken: 'social-refresh-token-1234567890123456789012345678901234567890',
        csrfToken: 'social-csrf',
      };
    },
    register: (...args: unknown[]) => {
      calls.push({ method: 'register', args });
      return {
        refreshToken: 'register-refresh-token-1234567890123456789012345678901234567890',
        csrfToken: 'register-csrf',
        user: { id: 'u-1' },
      };
    },
    refresh: (...args: unknown[]) => {
      calls.push({ method: 'refresh', args });
      return {
        accessToken: 'next',
        refreshToken: 'next-refresh-token-1234567890123456789012345678901234567890',
        csrfToken: 'next-csrf',
      };
    },
    forgotPassword: (...args: unknown[]) => {
      calls.push({ method: 'forgotPassword', args });
      return { success: true };
    },
    resetPassword: (...args: unknown[]) => {
      calls.push({ method: 'resetPassword', args });
      return { success: true };
    },
    verifyEmail: (...args: unknown[]) => {
      calls.push({ method: 'verifyEmail', args });
      return { success: true };
    },
    requestEmailVerification: (...args: unknown[]) => {
      calls.push({ method: 'requestEmailVerification', args });
      return { success: true };
    },
    enableTwoFactor: (...args: unknown[]) => {
      calls.push({ method: 'enableTwoFactor', args });
      return { success: true, enabled: false };
    },
    verifyTwoFactor: (...args: unknown[]) => {
      calls.push({ method: 'verifyTwoFactor', args });
      return { success: true, enabled: true };
    },
    listApiKeys: (...args: unknown[]) => {
      calls.push({ method: 'listApiKeys', args });
      return { data: [] };
    },
    createApiKey: (...args: unknown[]) => {
      calls.push({ method: 'createApiKey', args });
      return { id: 'ak-1', token: 'bhk_token' };
    },
    revokeApiKey: (...args: unknown[]) => {
      calls.push({ method: 'revokeApiKey', args });
      return { success: true };
    },
    me: (...args: unknown[]) => {
      calls.push({ method: 'me', args });
      return { id: 'u-1' };
    },
    listSessions: (...args: unknown[]) => {
      calls.push({ method: 'listSessions', args });
      return { data: [] };
    },
    revokeSession: (...args: unknown[]) => {
      calls.push({ method: 'revokeSession', args });
      return { success: true };
    },
    logout: (...args: unknown[]) => {
      calls.push({ method: 'logout', args });
      return { success: true };
    },
    getRefreshCookieMaxAgeMs: () => 604800000,
  };
  const controller = new AuthController(service as any);
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'agent' },
    user: { sub: 'u-1' },
  } as any;
  const response = {
    cookie: (...args: unknown[]) => {
      cookieCalls.push({ method: 'cookie', args });
    },
    clearCookie: (...args: unknown[]) => {
      cookieCalls.push({ method: 'clearCookie', args });
    },
  } as any;

  assert.deepEqual(await controller.guest(request, response), {
    accessToken: 'guest-access',
    refreshToken: 'guest-refresh-token-1234567890123456789012345678901234567890',
    csrfToken: 'guest-csrf',
    user: { id: 'u-guest', role: 'guest' },
  });
  assert.deepEqual(
    await controller.login(
      {
        email: 'user@example.com',
        password: 'secret123',
        otp: '123456',
        guestAccessToken: 'guest-token',
      } as any,
      request,
      response,
    ),
    {
      accessToken: 'access',
      refreshToken: 'refresh-token-1234567890123456789012345678901234567890',
      csrfToken: 'csrf-token',
    },
  );
  assert.deepEqual(
    await controller.socialLogin(
      'google',
      {
        providerUserId: 'google-user-1',
        email: 'user@example.com',
        fullName: 'User',
        phone: '0900',
        guestAccessToken: 'guest-token',
      } as any,
      request,
      response,
    ),
    {
      accessToken: 'social-access',
      refreshToken: 'social-refresh-token-1234567890123456789012345678901234567890',
      csrfToken: 'social-csrf',
    },
  );
  assert.deepEqual(
    await controller.register(
      {
        email: 'user@example.com',
        password: 'secret123',
        fullName: 'User',
        phone: '0900',
        guestAccessToken: 'guest-token',
      } as any,
      request,
      response,
    ),
    {
      refreshToken: 'register-refresh-token-1234567890123456789012345678901234567890',
      csrfToken: 'register-csrf',
      user: { id: 'u-1' },
    },
  );
  assert.deepEqual(
    await controller.refresh({ refreshToken: 'refresh-token' } as any, request, response),
    {
      accessToken: 'next',
      refreshToken: 'next-refresh-token-1234567890123456789012345678901234567890',
      csrfToken: 'next-csrf',
    },
  );
  assert.deepEqual(controller.forgotPassword({ email: 'user@example.com' } as any), {
    success: true,
  });
  assert.deepEqual(
    controller.resetPassword({ token: 'reset-token', password: 'new-secret' } as any),
    { success: true },
  );
  assert.deepEqual(controller.verifyEmail({ token: 'verify-token' } as any), { success: true });
  assert.deepEqual(controller.requestEmailVerification(request), { success: true });
  assert.deepEqual(controller.enableTwoFactor(request), { success: true, enabled: false });
  assert.deepEqual(controller.verifyTwoFactor(request, { code: '123456' } as any), {
    success: true,
    enabled: true,
  });
  assert.deepEqual(controller.apiKeys(request), { data: [] });
  assert.deepEqual(
    controller.createApiKey(
      request,
      { name: 'Reporting Bot', permissions: ['reporting.read'], expiresAt: '2099-01-01T00:00:00.000Z' } as any,
    ),
    { id: 'ak-1', token: 'bhk_token' },
  );
  assert.deepEqual(controller.revokeApiKey(request, 'ak-1'), { success: true });
  assert.deepEqual(controller.me(request), { id: 'u-1' });
  assert.deepEqual(controller.sessions(request), { data: [] });
  assert.deepEqual(controller.revokeSession(request, 'sess-1'), { success: true });
  assert.deepEqual(await controller.logout(request, { refreshToken: 'refresh-token' } as any, response), {
    success: true,
  });

  assert.deepEqual(calls, [
    {
      method: 'createGuestSession',
      args: [{ ipAddress: '127.0.0.1', userAgent: 'agent' }],
    },
    {
      method: 'login',
      args: [
        'user@example.com',
        'secret123',
        '123456',
        { ipAddress: '127.0.0.1', userAgent: 'agent' },
        'guest-token',
      ],
    },
    {
      method: 'socialLogin',
      args: [
        'google',
        'google-user-1',
        'user@example.com',
        'User',
        '0900',
        { ipAddress: '127.0.0.1', userAgent: 'agent' },
        'guest-token',
      ],
    },
    {
      method: 'register',
      args: [
        'user@example.com',
        'secret123',
        'User',
        '0900',
        { ipAddress: '127.0.0.1', userAgent: 'agent' },
        'guest-token',
      ],
    },
    {
      method: 'refresh',
      args: [
        'refresh-token',
        { ipAddress: '127.0.0.1', userAgent: 'agent' },
        { requireCsrf: false, csrfToken: undefined },
      ],
    },
    {
      method: 'forgotPassword',
      args: ['user@example.com'],
    },
    {
      method: 'resetPassword',
      args: ['reset-token', 'new-secret'],
    },
    {
      method: 'verifyEmail',
      args: ['verify-token'],
    },
    {
      method: 'requestEmailVerification',
      args: ['u-1'],
    },
    {
      method: 'enableTwoFactor',
      args: ['u-1'],
    },
    {
      method: 'verifyTwoFactor',
      args: ['u-1', '123456'],
    },
    {
      method: 'listApiKeys',
      args: ['u-1'],
    },
    {
      method: 'createApiKey',
      args: ['u-1', 'Reporting Bot', ['reporting.read'], '2099-01-01T00:00:00.000Z'],
    },
    {
      method: 'revokeApiKey',
      args: ['ak-1', 'u-1'],
    },
    {
      method: 'me',
      args: ['u-1'],
    },
    {
      method: 'listSessions',
      args: ['u-1'],
    },
    {
      method: 'revokeSession',
      args: ['sess-1', 'u-1'],
    },
    {
      method: 'logout',
      args: ['refresh-token', 'u-1', { requireCsrf: false, csrfToken: undefined }],
    },
  ]);

  assert.equal(
    cookieCalls.filter((entry) => entry.method === 'cookie').length,
    10,
  );
  assert.equal(
    cookieCalls.filter((entry) => entry.method === 'clearCookie').length,
    2,
  );
});

test('CartController forwards cart mutations to service', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    getCart: (...args: unknown[]) => {
      calls.push({ method: 'getCart', args });
      return { items: [] };
    },
    addItem: (...args: unknown[]) => {
      calls.push({ method: 'addItem', args });
      return { totalItems: 1 };
    },
    setQuantity: (...args: unknown[]) => {
      calls.push({ method: 'setQuantity', args });
      return { totalItems: 2 };
    },
    removeItem: (...args: unknown[]) => {
      calls.push({ method: 'removeItem', args });
      return { items: [] };
    },
    merge: (...args: unknown[]) => {
      calls.push({ method: 'merge', args });
      return { items: [] };
    },
    applyCoupon: (...args: unknown[]) => {
      calls.push({ method: 'applyCoupon', args });
      return { coupon: { code: 'SAVE10' } };
    },
    removeCoupon: (...args: unknown[]) => {
      calls.push({ method: 'removeCoupon', args });
      return { coupon: null };
    },
    saveForLater: (...args: unknown[]) => {
      calls.push({ method: 'saveForLater', args });
      return { items: [] };
    },
    clear: (...args: unknown[]) => {
      calls.push({ method: 'clear', args });
      return { items: [] };
    },
  };
  const controller = new CartController(service as any);
  const request = { user: { sub: 'u-1' } } as any;

  assert.deepEqual(controller.getCart(request), { items: [] });
  assert.deepEqual(controller.addItem(request, { productId: 'p-1', variantId: 'pv-1', quantity: 1 } as any), {
    totalItems: 1,
  });
  assert.deepEqual(
    controller.updateQuantity(request, 'p-1', { quantity: 2 } as any, 'pv-1'),
    { totalItems: 2 },
  );
  assert.deepEqual(controller.remove(request, 'p-1', 'pv-1'), { items: [] });
  assert.deepEqual(
    controller.merge(request, { items: [{ productId: 'p-2', variantId: 'pv-2', quantity: 1 }] } as any),
    { items: [] },
  );
  assert.deepEqual(controller.applyCoupon(request, { code: 'SAVE10' } as any), {
    coupon: { code: 'SAVE10' },
  });
  assert.deepEqual(controller.removeCoupon(request), { coupon: null });
  assert.deepEqual(controller.saveForLater(request, 'p-1', 'pv-1'), { items: [] });
  assert.deepEqual(controller.clear(request), { items: [] });

  assert.deepEqual(calls, [
    { method: 'getCart', args: ['u-1'] },
    { method: 'addItem', args: ['u-1', 'p-1', 1, 'pv-1'] },
    { method: 'setQuantity', args: ['u-1', 'p-1', 2, 'pv-1'] },
    { method: 'removeItem', args: ['u-1', 'p-1', 'pv-1'] },
    { method: 'merge', args: ['u-1', [{ productId: 'p-2', variantId: 'pv-2', quantity: 1 }]] },
    { method: 'applyCoupon', args: ['u-1', 'SAVE10'] },
    { method: 'removeCoupon', args: ['u-1'] },
    { method: 'saveForLater', args: ['u-1', 'p-1', 'pv-1'] },
    { method: 'clear', args: ['u-1'] },
  ]);
});

test('InventoryController forwards warehouse stock operations', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    adjust: (...args: unknown[]) => {
      calls.push({ method: 'adjust', args });
      return { sku: 'SKU-1-BLACK' };
    },
    transfer: (...args: unknown[]) => {
      calls.push({ method: 'transfer', args });
      return { sku: 'SKU-1-BLACK' };
    },
    movements: (...args: unknown[]) => {
      calls.push({ method: 'movements', args });
      return { data: [] };
    },
    lowStock: (...args: unknown[]) => {
      calls.push({ method: 'lowStock', args });
      return { data: [] };
    },
    checkStock: (...args: unknown[]) => {
      calls.push({ method: 'checkStock', args });
      return { sku: 'SKU-1-BLACK' };
    },
  };
  const controller = new InventoryController(service as any);
  const request = { user: { sub: 'u-admin' } } as any;

  assert.deepEqual(
    controller.adjust(
      request,
      { productId: 'p-1', variantId: 'pv-1', warehouseCode: 'MAIN', quantity: 3, note: 'Restock' } as any,
    ),
    { sku: 'SKU-1-BLACK' },
  );
  assert.deepEqual(
    controller.transfer(
      request,
      {
        productId: 'p-1',
        variantId: 'pv-1',
        fromWarehouseCode: 'MAIN',
        toWarehouseCode: 'HN',
        quantity: 2,
        note: 'Rebalance',
      } as any,
    ),
    { sku: 'SKU-1-BLACK' },
  );
  assert.deepEqual(controller.movements(), { data: [] });
  assert.deepEqual(controller.lowStock(), { data: [] });
  assert.deepEqual(controller.check('SKU-1-BLACK'), { sku: 'SKU-1-BLACK' });

  assert.deepEqual(calls, [
    { method: 'adjust', args: ['p-1', 3, 'u-admin', 'Restock', 'pv-1', 'MAIN'] },
    { method: 'transfer', args: ['p-1', 2, 'u-admin', 'MAIN', 'HN', 'Rebalance', 'pv-1'] },
    { method: 'movements', args: [] },
    { method: 'lowStock', args: [] },
    { method: 'checkStock', args: ['SKU-1-BLACK'] },
  ]);
});

test('NotificationsController forwards inbox preferences and template actions', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    list: (...args: unknown[]) => {
      calls.push({ method: 'list', args });
      return { data: [] };
    },
    markRead: (...args: unknown[]) => {
      calls.push({ method: 'markRead', args });
      return { success: true };
    },
    trackClick: (...args: unknown[]) => {
      calls.push({ method: 'trackClick', args });
      return { success: true };
    },
    markAllRead: (...args: unknown[]) => {
      calls.push({ method: 'markAllRead', args });
      return { success: true };
    },
    getPreferences: (...args: unknown[]) => {
      calls.push({ method: 'getPreferences', args });
      return { orderInApp: true };
    },
    updatePreferences: (...args: unknown[]) => {
      calls.push({ method: 'updatePreferences', args });
      return { promotionEmail: true };
    },
    unsubscribe: (...args: unknown[]) => {
      calls.push({ method: 'unsubscribe', args });
      return { marketingOptIn: false };
    },
    listTemplates: (...args: unknown[]) => {
      calls.push({ method: 'listTemplates', args });
      return { data: [] };
    },
    createTemplate: (...args: unknown[]) => {
      calls.push({ method: 'createTemplate', args });
      return { id: 'tpl-1' };
    },
    updateTemplate: (...args: unknown[]) => {
      calls.push({ method: 'updateTemplate', args });
      return { id: 'tpl-1' };
    },
    previewTemplate: (...args: unknown[]) => {
      calls.push({ method: 'previewTemplate', args });
      return { title: 'Preview' };
    },
    createBatch: (...args: unknown[]) => {
      calls.push({ method: 'createBatch', args });
      return { created: 1 };
    },
    dispatchScheduled: (...args: unknown[]) => {
      calls.push({ method: 'dispatchScheduled', args });
      return { processed: 1 };
    },
  };
  const controller = new NotificationsController(service as any);
  const request = { user: { sub: 'u-1' } } as any;
  const listQuery = { unreadOnly: true, page: 1 } as any;
  const preferencesBody = { promotionEmail: true } as any;
  const unsubscribeBody = { type: 'promotion', channel: 'email' } as any;
  const templateBody = {
    key: 'order.shipped',
    channel: 'email',
    titleTemplate: 'Hi {{name}}',
    contentTemplate: 'Order {{order}} shipped',
  } as any;
  const updateTemplateBody = { isActive: false } as any;
  const previewBody = { data: { name: 'User' } } as any;
  const batchBody = {
    userIds: ['u-1'],
    type: 'promotion',
    channel: 'email',
    title: 'Sale',
    content: 'Weekend sale',
  } as any;
  const dispatchBody = { limit: 10 } as any;

  assert.deepEqual(controller.list(request, listQuery), { data: [] });
  assert.deepEqual(controller.markRead(request, 'n-1'), { success: true });
  assert.deepEqual(controller.trackClick(request, 'n-1'), { success: true });
  assert.deepEqual(controller.markAllRead(request), { success: true });
  assert.deepEqual(controller.preferences(request), { orderInApp: true });
  assert.deepEqual(controller.updatePreferences(request, preferencesBody), { promotionEmail: true });
  assert.deepEqual(controller.unsubscribe(request, unsubscribeBody), { marketingOptIn: false });
  assert.deepEqual(controller.templates('email'), { data: [] });
  assert.deepEqual(controller.createTemplate(templateBody), { id: 'tpl-1' });
  assert.deepEqual(controller.updateTemplate('tpl-1', updateTemplateBody), { id: 'tpl-1' });
  assert.deepEqual(controller.previewTemplate('tpl-1', previewBody), { title: 'Preview' });
  assert.deepEqual(controller.createBatch(batchBody), { created: 1 });
  assert.deepEqual(controller.dispatch(dispatchBody), { processed: 1 });

  assert.deepEqual(calls, [
    { method: 'list', args: ['u-1', listQuery] },
    { method: 'markRead', args: ['u-1', 'n-1'] },
    { method: 'trackClick', args: ['u-1', 'n-1'] },
    { method: 'markAllRead', args: ['u-1'] },
    { method: 'getPreferences', args: ['u-1'] },
    { method: 'updatePreferences', args: ['u-1', preferencesBody] },
    { method: 'unsubscribe', args: ['u-1', unsubscribeBody] },
    { method: 'listTemplates', args: ['email'] },
    { method: 'createTemplate', args: [templateBody] },
    { method: 'updateTemplate', args: ['tpl-1', updateTemplateBody] },
    { method: 'previewTemplate', args: ['tpl-1', { name: 'User' }] },
    { method: 'createBatch', args: [batchBody] },
    { method: 'dispatchScheduled', args: [dispatchBody] },
  ]);
});

test('ShippingController forwards carrier quotes shipment creation and tracking events', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    calculate: (...args: unknown[]) => {
      calls.push({ method: 'calculate', args });
      return { fee: 30_000, quotes: [] };
    },
    createShipment: (...args: unknown[]) => {
      calls.push({ method: 'createShipment', args });
      return { orderId: 'ord-1', trackingCode: 'SHIP-1' };
    },
    zones: (...args: unknown[]) => {
      calls.push({ method: 'zones', args });
      return { data: [] };
    },
    tracking: (...args: unknown[]) => {
      calls.push({ method: 'tracking', args });
      return { timeline: [] };
    },
    label: (...args: unknown[]) => {
      calls.push({ method: 'label', args });
      return { labelUrl: 'https://shipping.local/label.pdf' };
    },
    addTrackingEvent: (...args: unknown[]) => {
      calls.push({ method: 'addTrackingEvent', args });
      return { shippingStatus: 'in_transit' };
    },
  };
  const controller = new ShippingController(service as any);
  const calculateBody = {
    subtotal: 200_000,
    shippingMethod: 'express',
    province: 'Ho Chi Minh',
    district: 'District 1',
    weightGrams: 750,
    carrier: 'ghn',
  } as any;
  const createBody = { orderId: 'ord-1', carrier: 'ghn', serviceCode: 'GHN-EXP' } as any;
  const eventBody = { status: 'in_transit', location: 'HCM Hub' } as any;

  assert.deepEqual(controller.calculate(calculateBody), { fee: 30_000, quotes: [] });
  assert.deepEqual(controller.create(createBody), { orderId: 'ord-1', trackingCode: 'SHIP-1' });
  assert.deepEqual(controller.zones(), { data: [] });
  assert.deepEqual(controller.tracking('ord-1'), { timeline: [] });
  assert.deepEqual(controller.label('ord-1'), { labelUrl: 'https://shipping.local/label.pdf' });
  assert.deepEqual(controller.addTrackingEvent('ord-1', eventBody), { shippingStatus: 'in_transit' });

  assert.deepEqual(calls, [
    {
      method: 'calculate',
      args: [200_000, 'express', 'Ho Chi Minh', 'District 1', 750, 'ghn'],
    },
    { method: 'createShipment', args: ['ord-1', 'ghn', 'GHN-EXP'] },
    { method: 'zones', args: [] },
    { method: 'tracking', args: ['ord-1'] },
    { method: 'label', args: ['ord-1'] },
    { method: 'addTrackingEvent', args: ['ord-1', eventBody] },
  ]);
});

test('OrdersController forwards reservation and order lifecycle actions', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    getCurrentReservation: (...args: unknown[]) => {
      calls.push({ method: 'getCurrentReservation', args });
      return { data: null };
    },
    createReservationFromCart: (...args: unknown[]) => {
      calls.push({ method: 'createReservationFromCart', args });
      return { id: 'res-1' };
    },
    cancelReservation: (...args: unknown[]) => {
      calls.push({ method: 'cancelReservation', args });
      return { success: true };
    },
    releaseExpiredReservations: (...args: unknown[]) => {
      calls.push({ method: 'releaseExpiredReservations', args });
      return { expiredCount: 0 };
    },
    list: (...args: unknown[]) => {
      calls.push({ method: 'list', args });
      return { total: 0, data: [] };
    },
    checkout: (...args: unknown[]) => {
      calls.push({ method: 'checkout', args });
      return { id: 'ord-1' };
    },
    getInvoice: (...args: unknown[]) => {
      calls.push({ method: 'getInvoice', args });
      return { invoiceNumber: 'INV-1' };
    },
    getTracking: (...args: unknown[]) => {
      calls.push({ method: 'getTracking', args });
      return { orderId: 'ord-1' };
    },
    cancelOrder: (...args: unknown[]) => {
      calls.push({ method: 'cancelOrder', args });
      return { status: 'canceled' };
    },
    requestReturn: (...args: unknown[]) => {
      calls.push({ method: 'requestReturn', args });
      return { status: 'returned' };
    },
    updateStatus: (...args: unknown[]) => {
      calls.push({ method: 'updateStatus', args });
      return { status: 'completed' };
    },
    getById: (...args: unknown[]) => {
      calls.push({ method: 'getById', args });
      return { id: 'ord-1' };
    },
  };
  const controller = new OrdersController(service as any);
  const request = { user: { sub: 'u-1', role: 'admin' } } as any;
  const checkoutBody = {
    reservationId: 'res-1',
    paymentMethod: 'cod',
    shippingMethod: 'standard',
    address: {
      receiverName: 'User',
      phone: '0900',
      province: 'HCM',
      district: '1',
      ward: 'Ben Nghe',
      addressLine: '123 Nguyen Trai',
      country: 'Viet Nam',
    },
  } as any;

  assert.deepEqual(controller.currentReservation(request), { data: null });
  assert.deepEqual(controller.reserve(request), { id: 'res-1' });
  assert.deepEqual(controller.cancelReservation(request, 'res-1'), { success: true });
  assert.deepEqual(controller.releaseExpired(request), { expiredCount: 0 });
  assert.deepEqual(controller.list(request), { total: 0, data: [] });
  assert.deepEqual(controller.createOrder(request, checkoutBody), { id: 'ord-1' });
  assert.deepEqual(controller.checkout(request, checkoutBody), { id: 'ord-1' });
  assert.deepEqual(controller.invoice(request, 'ord-1'), { invoiceNumber: 'INV-1' });
  assert.deepEqual(controller.tracking(request, 'ord-1'), { orderId: 'ord-1' });
  assert.deepEqual(controller.cancelOrder(request, 'ord-1'), { status: 'canceled' });
  assert.deepEqual(controller.requestReturn(request, 'ord-1'), { status: 'returned' });
  assert.deepEqual(controller.updateStatus(request, 'ord-1', { status: 'completed' } as any), {
    status: 'completed',
  });
  assert.deepEqual(controller.detail(request, 'ord-1'), { id: 'ord-1' });

  assert.deepEqual(calls, [
    { method: 'getCurrentReservation', args: ['u-1'] },
    { method: 'createReservationFromCart', args: ['u-1'] },
    { method: 'cancelReservation', args: ['res-1', 'u-1', 'admin'] },
    { method: 'releaseExpiredReservations', args: ['u-1'] },
    { method: 'list', args: ['u-1', 'admin'] },
    { method: 'checkout', args: ['u-1', checkoutBody] },
    { method: 'checkout', args: ['u-1', checkoutBody] },
    { method: 'getInvoice', args: ['ord-1', 'u-1', 'admin'] },
    { method: 'getTracking', args: ['ord-1', 'u-1', 'admin'] },
    { method: 'cancelOrder', args: ['ord-1', 'u-1', 'admin'] },
    { method: 'requestReturn', args: ['ord-1', 'u-1', 'admin'] },
    { method: 'updateStatus', args: ['ord-1', 'completed', 'u-1'] },
    { method: 'getById', args: ['ord-1', 'u-1', 'admin'] },
  ]);
});

test('PaymentsController forwards payment admin actions and webhooks', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    listMethods: (...args: unknown[]) => {
      calls.push({ method: 'listMethods', args });
      return { data: [] };
    },
    initiate: (...args: unknown[]) => {
      calls.push({ method: 'initiate', args });
      return { paymentId: 'pay-1' };
    },
    getStatus: (...args: unknown[]) => {
      calls.push({ method: 'getStatus', args });
      return { id: 'pay-1' };
    },
    refund: (...args: unknown[]) => {
      calls.push({ method: 'refund', args });
      return { status: 'refunded' };
    },
    processWebhook: (...args: unknown[]) => {
      calls.push({ method: 'processWebhook', args });
      return { processed: true };
    },
  };
  const controller = new PaymentsController(service as any);
  const initiateBody = { orderId: 'ord-1', method: 'vnpay' } as any;
  const refundBody = { amount: 50000, reason: 'customer_request' } as any;
  const webhookBody = { eventId: 'evt-1', type: 'payment.captured', payload: {} } as any;

  assert.deepEqual(controller.methods(), { data: [] });
  assert.deepEqual(controller.initiate(initiateBody), { paymentId: 'pay-1' });
  assert.deepEqual(controller.status('pay-1'), { id: 'pay-1' });
  assert.deepEqual(controller.refund('pay-1', refundBody), { status: 'refunded' });
  assert.deepEqual(controller.webhook('vnpay', 'signature', webhookBody), { processed: true });

  assert.deepEqual(calls, [
    { method: 'listMethods', args: [] },
    { method: 'initiate', args: [initiateBody] },
    { method: 'getStatus', args: ['pay-1'] },
    { method: 'refund', args: ['pay-1', refundBody] },
    { method: 'processWebhook', args: ['vnpay', 'signature', webhookBody] },
  ]);
});

test('ReportingController forwards analytics queries', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    summary: (...args: unknown[]) => {
      calls.push({ method: 'summary', args });
      return { revenue: 0 };
    },
    revenue: (...args: unknown[]) => {
      calls.push({ method: 'revenue', args });
      return { data: [] };
    },
    topProducts: (...args: unknown[]) => {
      calls.push({ method: 'topProducts', args });
      return { data: [] };
    },
    couponUsage: (...args: unknown[]) => {
      calls.push({ method: 'couponUsage', args });
      return { data: [] };
    },
  };
  const controller = new ReportingController(service as any);

  assert.deepEqual(controller.summary(), { revenue: 0 });
  assert.deepEqual(controller.revenue('14'), { data: [] });
  assert.deepEqual(controller.topProducts('5'), { data: [] });
  assert.deepEqual(controller.couponUsage('8'), { data: [] });

  assert.deepEqual(calls, [
    { method: 'summary', args: [] },
    { method: 'revenue', args: [14] },
    { method: 'topProducts', args: [5] },
    { method: 'couponUsage', args: [8] },
  ]);
});

test('ProductsController forwards catalog queries and admin mutations', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    findAll: (...args: unknown[]) => {
      calls.push({ method: 'findAll', args });
      return { total: 1, data: [] };
    },
    exportProducts: (...args: unknown[]) => {
      calls.push({ method: 'exportProducts', args });
      return { filename: 'products.csv' };
    },
    listCategories: (...args: unknown[]) => {
      calls.push({ method: 'listCategories', args });
      return [{ id: 'c-1' }];
    },
    createCategory: (...args: unknown[]) => {
      calls.push({ method: 'createCategory', args });
      return { id: 'c-1' };
    },
    listBrands: (...args: unknown[]) => {
      calls.push({ method: 'listBrands', args });
      return [{ id: 'b-1' }];
    },
    createBrand: (...args: unknown[]) => {
      calls.push({ method: 'createBrand', args });
      return { id: 'b-1' };
    },
    createProduct: (...args: unknown[]) => {
      calls.push({ method: 'createProduct', args });
      return { id: 'p-1' };
    },
    updateProduct: (...args: unknown[]) => {
      calls.push({ method: 'updateProduct', args });
      return { id: 'p-1' };
    },
    archiveProduct: (...args: unknown[]) => {
      calls.push({ method: 'archiveProduct', args });
      return { status: 'archived' };
    },
    importProducts: (...args: unknown[]) => {
      calls.push({ method: 'importProducts', args });
      return { count: 1 };
    },
    addMedia: (...args: unknown[]) => {
      calls.push({ method: 'addMedia', args });
      return { id: 'pm-1' };
    },
    listReviews: (...args: unknown[]) => {
      calls.push({ method: 'listReviews', args });
      return { total: 1, data: [] };
    },
    listModerationReviews: (...args: unknown[]) => {
      calls.push({ method: 'listModerationReviews', args });
      return { total: 1, data: [] };
    },
    createReview: (...args: unknown[]) => {
      calls.push({ method: 'createReview', args });
      return { id: 'r-1' };
    },
    markReviewHelpful: (...args: unknown[]) => {
      calls.push({ method: 'markReviewHelpful', args });
      return { success: true, applied: true, helpfulCount: 4 };
    },
    replyReview: (...args: unknown[]) => {
      calls.push({ method: 'replyReview', args });
      return { id: 'r-1', adminReply: 'Thanks' };
    },
    moderateReview: (...args: unknown[]) => {
      calls.push({ method: 'moderateReview', args });
      return { id: 'r-1', status: 'published' };
    },
    findOne: (...args: unknown[]) => {
      calls.push({ method: 'findOne', args });
      return { id: 'p-1' };
    },
  };
  const controller = new ProductsController(service as any);
  const createProductBody = {
    sku: 'SKU-1',
    name: 'iPhone 15',
    price: 100,
    stock: 2,
  } as any;
  const updateProductBody = { name: 'Updated name' } as any;
  const createCategoryBody = { name: 'Phones' } as any;
  const createBrandBody = { name: 'Apple' } as any;
  const importBody = { items: [createProductBody] } as any;
  const mediaBody = { url: 'https://cdn.example.com/p-1.jpg' } as any;
  const reviewQuery = { rating: 5, sort: 'helpful' } as any;
  const moderationQuery = { status: 'pending', page: 1 } as any;
  const reviewBody = {
    rating: 5,
    content: 'Rat hai long voi san pham va toc do giao hang.',
  } as any;
  const replyBody = { content: 'Cam on ban.' } as any;
  const moderateBody = { status: 'published', adminReply: 'Da duyet.' } as any;

  assert.deepEqual(controller.findAll({ limit: 12 } as any), { total: 1, data: [] });
  assert.deepEqual(controller.exportProducts(), { filename: 'products.csv' });
  assert.deepEqual(await controller.categories(), { data: [{ id: 'c-1' }] });
  assert.deepEqual(controller.createCategory(createCategoryBody), { id: 'c-1' });
  assert.deepEqual(await controller.brands(), { data: [{ id: 'b-1' }] });
  assert.deepEqual(controller.createBrand(createBrandBody), { id: 'b-1' });
  assert.deepEqual(controller.create(createProductBody, {} as any), { id: 'p-1' });
  assert.deepEqual(controller.update('p-1', updateProductBody), { id: 'p-1' });
  assert.deepEqual(controller.archive('p-1'), { status: 'archived' });
  assert.deepEqual(controller.import(importBody), { count: 1 });
  assert.deepEqual(controller.addMedia('p-1', mediaBody), { id: 'pm-1' });
  assert.deepEqual(controller.reviews('iphone-15', reviewQuery), { total: 1, data: [] });
  assert.deepEqual(controller.moderationReviews('iphone-15', moderationQuery), { total: 1, data: [] });
  assert.deepEqual(controller.createReview({ user: { sub: 'u-1' } } as any, 'iphone-15', reviewBody), {
    id: 'r-1',
  });
  assert.deepEqual(
    controller.markHelpful({ user: { sub: 'u-2' } } as any, 'iphone-15', 'r-1'),
    { success: true, applied: true, helpfulCount: 4 },
  );
  assert.deepEqual(controller.replyReview('iphone-15', 'r-1', replyBody), {
    id: 'r-1',
    adminReply: 'Thanks',
  });
  assert.deepEqual(controller.moderateReview('iphone-15', 'r-1', moderateBody), {
    id: 'r-1',
    status: 'published',
  });
  assert.deepEqual(controller.findOne('iphone-15'), { id: 'p-1' });

  assert.deepEqual(calls, [
    { method: 'findAll', args: [{ limit: 12 }] },
    { method: 'exportProducts', args: [] },
    { method: 'listCategories', args: [] },
    { method: 'createCategory', args: [createCategoryBody] },
    { method: 'listBrands', args: [] },
    { method: 'createBrand', args: [createBrandBody] },
    { method: 'createProduct', args: [createProductBody] },
    { method: 'updateProduct', args: ['p-1', updateProductBody] },
    { method: 'archiveProduct', args: ['p-1'] },
    { method: 'importProducts', args: [importBody] },
    { method: 'addMedia', args: ['p-1', mediaBody] },
    { method: 'listReviews', args: ['iphone-15', reviewQuery] },
    { method: 'listModerationReviews', args: ['iphone-15', moderationQuery] },
    { method: 'createReview', args: ['u-1', 'iphone-15', reviewBody] },
    { method: 'markReviewHelpful', args: ['u-2', 'iphone-15', 'r-1'] },
    { method: 'replyReview', args: ['iphone-15', 'r-1', 'Cam on ban.'] },
    { method: 'moderateReview', args: ['iphone-15', 'r-1', moderateBody] },
    { method: 'findOne', args: ['iphone-15'] },
  ]);
});

test('WishlistController forwards wishlist operations', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    list: (...args: unknown[]) => {
      calls.push({ method: 'list', args });
      return { total: 1, data: [] };
    },
    addItem: (...args: unknown[]) => {
      calls.push({ method: 'addItem', args });
      return { total: 2, data: [] };
    },
    removeItem: (...args: unknown[]) => {
      calls.push({ method: 'removeItem', args });
      return { total: 1, data: [] };
    },
  };
  const controller = new WishlistController(service as any);
  const request = { user: { sub: 'u-1' } } as any;

  assert.deepEqual(controller.list(request), { total: 1, data: [] });
  assert.deepEqual(controller.addItem(request, { productId: 'p-1' } as any), {
    total: 2,
    data: [],
  });
  assert.deepEqual(controller.removeItem(request, 'p-1'), {
    total: 1,
    data: [],
  });

  assert.deepEqual(calls, [
    { method: 'list', args: ['u-1'] },
    { method: 'addItem', args: ['u-1', 'p-1'] },
    { method: 'removeItem', args: ['u-1', 'p-1'] },
  ]);
});
