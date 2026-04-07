import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountController } from './account/account.controller';
import { AuthController } from './auth/auth.controller';
import { CartController } from './cart/cart.controller';
import { CompareController } from './compare/compare.controller';
import { ContentController } from './content/content.controller';
import { InventoryController } from './inventory/inventory.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { OrdersController } from './orders/orders.controller';
import { PaymentsController } from './payments/payments.controller';
import { ProductsController } from './products/products.controller';
import { ReportingController } from './reporting/reporting.controller';
import { SearchController } from './search/search.controller';
import { ShippingController } from './shipping/shipping.controller';
import { StoresController } from './stores/stores.controller';
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
        referralCode: 'REF999',
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
        referralCode: 'REF999',
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
        'REF999',
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
        'REF999',
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

test('AccountController forwards dashboard orders loyalty profile address and export actions', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    dashboard: (...args: unknown[]) => {
      calls.push({ method: 'dashboard', args });
      return { totalOrders: 2 };
    },
    listOrders: (...args: unknown[]) => {
      calls.push({ method: 'listOrders', args });
      return { total: 1, data: [] };
    },
    reorder: (...args: unknown[]) => {
      calls.push({ method: 'reorder', args });
      return { success: true, addedItems: 1 };
    },
    loyalty: (...args: unknown[]) => {
      calls.push({ method: 'loyalty', args });
      return { pointsBalance: 1500 };
    },
    redeemLoyalty: (...args: unknown[]) => {
      calls.push({ method: 'redeemLoyalty', args });
      return { success: true, redemption: { pointsSpent: 500 } };
    },
    referral: (...args: unknown[]) => {
      calls.push({ method: 'referral', args });
      return { referralCode: 'REF999' };
    },
    regenerateReferralCode: (...args: unknown[]) => {
      calls.push({ method: 'regenerateReferralCode', args });
      return { referralCode: 'REFNEW1' };
    },
    profile: (...args: unknown[]) => {
      calls.push({ method: 'profile', args });
      return { id: 'u-1' };
    },
    updateProfile: (...args: unknown[]) => {
      calls.push({ method: 'updateProfile', args });
      return { fullName: 'Updated' };
    },
    listAddresses: (...args: unknown[]) => {
      calls.push({ method: 'listAddresses', args });
      return { total: 1, data: [] };
    },
    createAddress: (...args: unknown[]) => {
      calls.push({ method: 'createAddress', args });
      return { total: 2, data: [] };
    },
    updateAddress: (...args: unknown[]) => {
      calls.push({ method: 'updateAddress', args });
      return { total: 2, data: [] };
    },
    setDefaultAddress: (...args: unknown[]) => {
      calls.push({ method: 'setDefaultAddress', args });
      return { total: 2, data: [] };
    },
    deleteAddress: (...args: unknown[]) => {
      calls.push({ method: 'deleteAddress', args });
      return { total: 1, data: [] };
    },
    exportData: (...args: unknown[]) => {
      calls.push({ method: 'exportData', args });
      return { exportedAt: '2026-04-05T00:00:00.000Z' };
    },
    deleteAccount: (...args: unknown[]) => {
      calls.push({ method: 'deleteAccount', args });
      return { success: true };
    },
  };
  const controller = new AccountController(service as any);
  const request = { user: { sub: 'u-1' } } as any;
  const profileBody = { fullName: 'Updated' } as any;
  const addressBody = {
    fullName: 'Nguyen Van A',
    phone: '0909000000',
    district: 'District 1',
    addressLine: '123 Nguyen Hue',
  } as any;
  const updateAddressBody = { label: 'Office' } as any;
  const deleteBody = { password: 'secret123', reason: 'privacy_request' } as any;
  const redeemBody = { points: 500 } as any;
  const ordersQuery = { status: 'completed', page: 1, limit: 5 } as any;

  assert.deepEqual(controller.dashboard(request), { totalOrders: 2 });
  assert.deepEqual(controller.orders(request, ordersQuery), { total: 1, data: [] });
  assert.deepEqual(controller.reorder(request, 'ord-1'), { success: true, addedItems: 1 });
  assert.deepEqual(controller.loyalty(request), { pointsBalance: 1500 });
  assert.deepEqual(controller.redeemLoyalty(request, redeemBody), { success: true, redemption: { pointsSpent: 500 } });
  assert.deepEqual(controller.referral(request), { referralCode: 'REF999' });
  assert.deepEqual(controller.regenerateReferralCode(request), { referralCode: 'REFNEW1' });
  assert.deepEqual(controller.profile(request), { id: 'u-1' });
  assert.deepEqual(controller.updateProfile(request, profileBody), { fullName: 'Updated' });
  assert.deepEqual(controller.addresses(request), { total: 1, data: [] });
  assert.deepEqual(controller.createAddress(request, addressBody), { total: 2, data: [] });
  assert.deepEqual(controller.updateAddress(request, 'addr-1', updateAddressBody), {
    total: 2,
    data: [],
  });
  assert.deepEqual(controller.setDefaultAddress(request, 'addr-1'), { total: 2, data: [] });
  assert.deepEqual(controller.deleteAddress(request, 'addr-1'), { total: 1, data: [] });
  assert.deepEqual(controller.exportData(request), { exportedAt: '2026-04-05T00:00:00.000Z' });
  assert.deepEqual(controller.deleteAccount(request, deleteBody), { success: true });

  assert.deepEqual(calls, [
    { method: 'dashboard', args: ['u-1'] },
    { method: 'listOrders', args: ['u-1', ordersQuery] },
    { method: 'reorder', args: ['u-1', 'ord-1'] },
    { method: 'loyalty', args: ['u-1'] },
    { method: 'redeemLoyalty', args: ['u-1', redeemBody] },
    { method: 'referral', args: ['u-1'] },
    { method: 'regenerateReferralCode', args: ['u-1'] },
    { method: 'profile', args: ['u-1'] },
    { method: 'updateProfile', args: ['u-1', profileBody] },
    { method: 'listAddresses', args: ['u-1'] },
    { method: 'createAddress', args: ['u-1', addressBody] },
    { method: 'updateAddress', args: ['u-1', 'addr-1', updateAddressBody] },
    { method: 'setDefaultAddress', args: ['u-1', 'addr-1'] },
    { method: 'deleteAddress', args: ['u-1', 'addr-1'] },
    { method: 'exportData', args: ['u-1'] },
    { method: 'deleteAccount', args: ['u-1', deleteBody] },
  ]);
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

test('CompareController forwards compare list operations', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    list: (...args: unknown[]) => {
      calls.push({ method: 'list', args });
      return { total: 2, data: [] };
    },
    addItem: (...args: unknown[]) => {
      calls.push({ method: 'addItem', args });
      return { total: 3, data: [] };
    },
    removeItem: (...args: unknown[]) => {
      calls.push({ method: 'removeItem', args });
      return { total: 2, data: [] };
    },
    clear: (...args: unknown[]) => {
      calls.push({ method: 'clear', args });
      return { total: 0, data: [] };
    },
  };
  const controller = new CompareController(service as any);
  const request = { user: { sub: 'u-1' } } as any;

  assert.deepEqual(controller.list(request), { total: 2, data: [] });
  assert.deepEqual(controller.addItem(request, { productId: 'p-3' } as any), { total: 3, data: [] });
  assert.deepEqual(controller.removeItem(request, 'p-3'), { total: 2, data: [] });
  assert.deepEqual(controller.clear(request), { total: 0, data: [] });

  assert.deepEqual(calls, [
    { method: 'list', args: ['u-1'] },
    { method: 'addItem', args: ['u-1', 'p-3'] },
    { method: 'removeItem', args: ['u-1', 'p-3'] },
    { method: 'clear', args: ['u-1'] },
  ]);
});

test('ContentController forwards CMS page blog and promotion actions', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    listPages: (...args: unknown[]) => {
      calls.push({ method: 'listPages', args });
      return { total: 1, data: [] };
    },
    page: (...args: unknown[]) => {
      calls.push({ method: 'page', args });
      return { slug: 'about' };
    },
    createPage: (...args: unknown[]) => {
      calls.push({ method: 'createPage', args });
      return { id: 'pg-1' };
    },
    updatePage: (...args: unknown[]) => {
      calls.push({ method: 'updatePage', args });
      return { id: 'pg-1' };
    },
    listBlog: (...args: unknown[]) => {
      calls.push({ method: 'listBlog', args });
      return { total: 1, data: [] };
    },
    blog: (...args: unknown[]) => {
      calls.push({ method: 'blog', args });
      return { slug: 'iphone-guide' };
    },
    createBlogPost: (...args: unknown[]) => {
      calls.push({ method: 'createBlogPost', args });
      return { id: 'bp-1' };
    },
    updateBlogPost: (...args: unknown[]) => {
      calls.push({ method: 'updateBlogPost', args });
      return { id: 'bp-1' };
    },
    listPromotions: (...args: unknown[]) => {
      calls.push({ method: 'listPromotions', args });
      return { total: 1, data: [] };
    },
    subscribeNewsletter: (...args: unknown[]) => {
      calls.push({ method: 'subscribeNewsletter', args });
      return { success: true };
    },
    confirmNewsletter: (...args: unknown[]) => {
      calls.push({ method: 'confirmNewsletter', args });
      return { success: true };
    },
    unsubscribeNewsletter: (...args: unknown[]) => {
      calls.push({ method: 'unsubscribeNewsletter', args });
      return { success: true };
    },
    createPromotion: (...args: unknown[]) => {
      calls.push({ method: 'createPromotion', args });
      return { id: 'pm-1' };
    },
    updatePromotion: (...args: unknown[]) => {
      calls.push({ method: 'updatePromotion', args });
      return { id: 'pm-1' };
    },
  };
  const controller = new ContentController(service as any);
  const pagesQuery = { q: 'about', page: 1, limit: 10 } as any;
  const blogQuery = { tag: 'iphone', page: 1, limit: 10 } as any;
  const promotionsQuery = { placement: 'home_hero', page: 1, limit: 10 } as any;
  const pageBody = { title: 'About', content: 'Content body long enough.' } as any;
  const blogBody = { title: 'Guide', content: 'Blog content long enough.' } as any;
  const newsletterBody = { email: 'newsletter@example.com', fullName: 'Reader' } as any;
  const confirmNewsletterBody = { token: 'newsletter-token-1234567890' } as any;
  const unsubscribeNewsletterBody = { email: 'newsletter@example.com' } as any;
  const promotionBody = {
    name: 'Hero',
    kind: 'banner',
    placement: 'home_hero',
    title: 'Hero Title',
    startsAt: new Date('2099-01-01T00:00:00.000Z'),
  } as any;

  assert.deepEqual(controller.pages(pagesQuery), { total: 1, data: [] });
  assert.deepEqual(controller.page('about'), { slug: 'about' });
  assert.deepEqual(controller.createPage(pageBody), { id: 'pg-1' });
  assert.deepEqual(controller.updatePage('pg-1', pageBody), { id: 'pg-1' });
  assert.deepEqual(controller.blog(blogQuery), { total: 1, data: [] });
  assert.deepEqual(controller.blogDetail('iphone-guide'), { slug: 'iphone-guide' });
  assert.deepEqual(controller.createBlog(blogBody), { id: 'bp-1' });
  assert.deepEqual(controller.updateBlog('bp-1', blogBody), { id: 'bp-1' });
  assert.deepEqual(controller.promotions(promotionsQuery), { total: 1, data: [] });
  assert.deepEqual(controller.subscribeNewsletter(newsletterBody), { success: true });
  assert.deepEqual(controller.confirmNewsletter(confirmNewsletterBody), { success: true });
  assert.deepEqual(controller.unsubscribeNewsletter(unsubscribeNewsletterBody), { success: true });
  assert.deepEqual(controller.createPromotion(promotionBody), { id: 'pm-1' });
  assert.deepEqual(controller.updatePromotion('pm-1', promotionBody), { id: 'pm-1' });

  assert.deepEqual(calls, [
    { method: 'listPages', args: [pagesQuery] },
    { method: 'page', args: ['about'] },
    { method: 'createPage', args: [pageBody] },
    { method: 'updatePage', args: ['pg-1', pageBody] },
    { method: 'listBlog', args: [blogQuery] },
    { method: 'blog', args: ['iphone-guide'] },
    { method: 'createBlogPost', args: [blogBody] },
    { method: 'updateBlogPost', args: ['bp-1', blogBody] },
    { method: 'listPromotions', args: [promotionsQuery] },
    { method: 'subscribeNewsletter', args: [newsletterBody] },
    { method: 'confirmNewsletter', args: [confirmNewsletterBody] },
    { method: 'unsubscribeNewsletter', args: [unsubscribeNewsletterBody] },
    { method: 'createPromotion', args: [promotionBody] },
    { method: 'updatePromotion', args: ['pm-1', promotionBody] },
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
    listPushSubscriptions: (...args: unknown[]) => {
      calls.push({ method: 'listPushSubscriptions', args });
      return { data: [] };
    },
    savePushSubscription: (...args: unknown[]) => {
      calls.push({ method: 'savePushSubscription', args });
      return { data: { id: 'ps-1' } };
    },
    removePushSubscription: (...args: unknown[]) => {
      calls.push({ method: 'removePushSubscription', args });
      return { success: true };
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
    dispatchAbandonedCartReminders: (...args: unknown[]) => {
      calls.push({ method: 'dispatchAbandonedCartReminders', args });
      return { created: 1, skipped: 0 };
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
  const abandonedCartBody = { limit: 10, idleMinutes: 1440, channel: 'email' } as any;

  assert.deepEqual(controller.list(request, listQuery), { data: [] });
  assert.deepEqual(controller.markRead(request, 'n-1'), { success: true });
  assert.deepEqual(controller.trackClick(request, 'n-1'), { success: true });
  assert.deepEqual(controller.markAllRead(request), { success: true });
  assert.deepEqual(controller.preferences(request), { orderInApp: true });
  assert.deepEqual(controller.updatePreferences(request, preferencesBody), { promotionEmail: true });
  assert.deepEqual(controller.unsubscribe(request, unsubscribeBody), { marketingOptIn: false });
  assert.deepEqual(controller.pushSubscriptions(request), { data: [] });
  assert.deepEqual(
    controller.savePushSubscription(request, {
      endpoint: 'https://push.example.com/subscriptions/new',
      p256dh: 'new-p256dh-key',
      auth: 'new-auth-key',
      userAgent: 'Firefox',
    } as any),
    { data: { id: 'ps-1' } },
  );
  assert.deepEqual(controller.removePushSubscription(request, 'ps-1'), { success: true });
  assert.deepEqual(controller.templates('email'), { data: [] });
  assert.deepEqual(controller.createTemplate(templateBody), { id: 'tpl-1' });
  assert.deepEqual(controller.updateTemplate('tpl-1', updateTemplateBody), { id: 'tpl-1' });
  assert.deepEqual(controller.previewTemplate('tpl-1', previewBody), { title: 'Preview' });
  assert.deepEqual(controller.createBatch(batchBody), { created: 1 });
  assert.deepEqual(controller.dispatch(dispatchBody), { processed: 1 });
  assert.deepEqual(controller.dispatchAbandonedCart(abandonedCartBody), { created: 1, skipped: 0 });

  assert.deepEqual(calls, [
    { method: 'list', args: ['u-1', listQuery] },
    { method: 'markRead', args: ['u-1', 'n-1'] },
    { method: 'trackClick', args: ['u-1', 'n-1'] },
    { method: 'markAllRead', args: ['u-1'] },
    { method: 'getPreferences', args: ['u-1'] },
    { method: 'updatePreferences', args: ['u-1', preferencesBody] },
    { method: 'unsubscribe', args: ['u-1', unsubscribeBody] },
    { method: 'listPushSubscriptions', args: ['u-1'] },
    {
      method: 'savePushSubscription',
      args: [
        'u-1',
        {
          endpoint: 'https://push.example.com/subscriptions/new',
          p256dh: 'new-p256dh-key',
          auth: 'new-auth-key',
          userAgent: 'Firefox',
        },
      ],
    },
    { method: 'removePushSubscription', args: ['u-1', 'ps-1'] },
    { method: 'listTemplates', args: ['email'] },
    { method: 'createTemplate', args: [templateBody] },
    { method: 'updateTemplate', args: ['tpl-1', updateTemplateBody] },
    { method: 'previewTemplate', args: ['tpl-1', { name: 'User' }] },
    { method: 'createBatch', args: [batchBody] },
    { method: 'dispatchScheduled', args: [dispatchBody] },
    { method: 'dispatchAbandonedCartReminders', args: [abandonedCartBody] },
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
    listNotes: (...args: unknown[]) => {
      calls.push({ method: 'listNotes', args });
      return { total: 1, data: [] };
    },
    addNote: (...args: unknown[]) => {
      calls.push({ method: 'addNote', args });
      return { id: 'on-1' };
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
  assert.deepEqual(controller.notes(request, 'ord-1'), { total: 1, data: [] });
  assert.deepEqual(
    controller.addNote(request, 'ord-1', {
      visibility: 'customer',
      content: 'Please deliver after 5 PM.',
    } as any),
    { id: 'on-1' },
  );
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
    { method: 'listNotes', args: ['ord-1', 'u-1', 'admin'] },
    {
      method: 'addNote',
      args: [
        'ord-1',
        'u-1',
        'admin',
        {
          visibility: 'customer',
          content: 'Please deliver after 5 PM.',
        },
      ],
    },
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
    listSavedMethods: (...args: unknown[]) => {
      calls.push({ method: 'listSavedMethods', args });
      return { data: [] };
    },
    createSavedMethod: (...args: unknown[]) => {
      calls.push({ method: 'createSavedMethod', args });
      return { data: [] };
    },
    setDefaultSavedMethod: (...args: unknown[]) => {
      calls.push({ method: 'setDefaultSavedMethod', args });
      return { data: [] };
    },
    removeSavedMethod: (...args: unknown[]) => {
      calls.push({ method: 'removeSavedMethod', args });
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
  const request = { user: { sub: 'u-1' } } as any;
  const initiateBody = { orderId: 'ord-1', method: 'vnpay', savedPaymentMethodId: 'spm-1' } as any;
  const refundBody = { amount: 50000, reason: 'customer_request' } as any;
  const webhookBody = { eventId: 'evt-1', type: 'payment.captured', payload: {} } as any;
  const savedMethodBody = {
    method: 'stripe',
    gateway: 'stripe',
    label: 'Visa ending 4242',
    last4: '4242',
    tokenRef: 'tok_demo',
  } as any;

  assert.deepEqual(controller.methods(), { data: [] });
  assert.deepEqual(controller.savedMethods(request), { data: [] });
  assert.deepEqual(controller.createSavedMethod(request, savedMethodBody), { data: [] });
  assert.deepEqual(controller.setDefaultSavedMethod(request, 'spm-1'), { data: [] });
  assert.deepEqual(controller.removeSavedMethod(request, 'spm-1'), { data: [] });
  assert.deepEqual(controller.initiate(initiateBody), { paymentId: 'pay-1' });
  assert.deepEqual(controller.status('pay-1'), { id: 'pay-1' });
  assert.deepEqual(controller.refund('pay-1', refundBody), { status: 'refunded' });
  assert.deepEqual(controller.webhook('vnpay', 'signature', webhookBody), { processed: true });

  assert.deepEqual(calls, [
    { method: 'listMethods', args: [] },
    { method: 'listSavedMethods', args: ['u-1'] },
    { method: 'createSavedMethod', args: ['u-1', savedMethodBody] },
    { method: 'setDefaultSavedMethod', args: ['u-1', 'spm-1'] },
    { method: 'removeSavedMethod', args: ['u-1', 'spm-1'] },
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

test('SearchController forwards search suggestions trending and analytics', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    search: (...args: unknown[]) => {
      calls.push({ method: 'search', args });
      return { total: 1 };
    },
    suggestions: (...args: unknown[]) => {
      calls.push({ method: 'suggestions', args });
      return { products: [] };
    },
    trending: (...args: unknown[]) => {
      calls.push({ method: 'trending', args });
      return { data: [] };
    },
    recent: (...args: unknown[]) => {
      calls.push({ method: 'recent', args });
      return { data: [] };
    },
    clearRecent: (...args: unknown[]) => {
      calls.push({ method: 'clearRecent', args });
      return { deletedCount: 2 };
    },
    analytics: (...args: unknown[]) => {
      calls.push({ method: 'analytics', args });
      return { popularQueries: [] };
    },
  };
  const controller = new SearchController(service as any);
  const request = { user: { sub: 'u-1' } } as any;
  const searchQuery = { q: 'iphone', limit: 8 } as any;
  const suggestionQuery = { q: 'ip', limit: 5 } as any;
  const trendingQuery = { limit: 5, days: 7 } as any;
  const recentQuery = { limit: 6 } as any;
  const analyticsQuery = { limit: 10, days: 30, zeroOnly: true } as any;

  assert.deepEqual(controller.search(request, searchQuery), { total: 1 });
  assert.deepEqual(controller.suggestions(suggestionQuery), { products: [] });
  assert.deepEqual(controller.trending(trendingQuery), { data: [] });
  assert.deepEqual(controller.recent(request, recentQuery), { data: [] });
  assert.deepEqual(controller.clearRecent(request), { deletedCount: 2 });
  assert.deepEqual(controller.analytics(analyticsQuery), { popularQueries: [] });

  assert.deepEqual(calls, [
    { method: 'search', args: [searchQuery, 'u-1'] },
    { method: 'suggestions', args: ['ip', 5] },
    { method: 'trending', args: [5, 7] },
    { method: 'recent', args: ['u-1', 6] },
    { method: 'clearRecent', args: ['u-1'] },
    { method: 'analytics', args: [analyticsQuery] },
  ]);
});

test('StoresController forwards locator listing nearest detail and appointment actions', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    list: (...args: unknown[]) => {
      calls.push({ method: 'list', args });
      return { total: 1, data: [] };
    },
    nearest: (...args: unknown[]) => {
      calls.push({ method: 'nearest', args });
      return { total: 1, data: [] };
    },
    detail: (...args: unknown[]) => {
      calls.push({ method: 'detail', args });
      return { id: 's-1' };
    },
    createAppointment: (...args: unknown[]) => {
      calls.push({ method: 'createAppointment', args });
      return { id: 'sa-1' };
    },
  };
  const controller = new StoresController(service as any);
  const listQuery = { province: 'Ho Chi Minh', service: 'pickup', openNow: true } as any;
  const nearestQuery = { lat: 10.77, lng: 106.7, radiusKm: 15, limit: 5 } as any;
  const appointmentBody = {
    fullName: 'Nguyen Van A',
    phone: '0909000000',
    service: 'pickup',
    scheduledFor: new Date('2099-01-01T10:00:00.000Z'),
  } as any;

  assert.deepEqual(controller.list(listQuery), { total: 1, data: [] });
  assert.deepEqual(controller.nearest(nearestQuery), { total: 1, data: [] });
  assert.deepEqual(controller.detail('banhang-district-1'), { id: 's-1' });
  assert.deepEqual(controller.createAppointment('banhang-district-1', appointmentBody), { id: 'sa-1' });

  assert.deepEqual(calls, [
    { method: 'list', args: [listQuery] },
    { method: 'nearest', args: [nearestQuery] },
    { method: 'detail', args: ['banhang-district-1'] },
    { method: 'createAppointment', args: ['banhang-district-1', appointmentBody] },
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
    listPriceHistory: (...args: unknown[]) => {
      calls.push({ method: 'listPriceHistory', args });
      return { data: [] };
    },
    setPriceAlert: (...args: unknown[]) => {
      calls.push({ method: 'setPriceAlert', args });
      return { success: true };
    },
    removePriceAlert: (...args: unknown[]) => {
      calls.push({ method: 'removePriceAlert', args });
      return { success: true };
    },
    listQuestions: (...args: unknown[]) => {
      calls.push({ method: 'listQuestions', args });
      return { total: 1, data: [] };
    },
    createQuestion: (...args: unknown[]) => {
      calls.push({ method: 'createQuestion', args });
      return { id: 'q-1' };
    },
    upvoteQuestion: (...args: unknown[]) => {
      calls.push({ method: 'upvoteQuestion', args });
      return { success: true, applied: true, upvoteCount: 2 };
    },
    answerQuestion: (...args: unknown[]) => {
      calls.push({ method: 'answerQuestion', args });
      return { id: 'q-1', answer: 'Tra loi' };
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
  const priceHistoryQuery = { days: 30, limit: 20 } as any;
  const reviewBody = {
    rating: 5,
    content: 'Rat hai long voi san pham va toc do giao hang.',
  } as any;
  const priceAlertBody = { targetPrice: 19_500_000 } as any;
  const questionQuery = { q: 'esim', answeredOnly: true } as any;
  const questionBody = { question: 'May co eSIM khong?' } as any;
  const replyBody = { content: 'Cam on ban.' } as any;
  const answerBody = { answer: 'Co, may ho tro eSIM.' } as any;
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
  assert.deepEqual(controller.priceHistory('iphone-15', priceHistoryQuery), { data: [] });
  assert.deepEqual(
    controller.setPriceAlert({ user: { sub: 'u-1' } } as any, 'iphone-15', priceAlertBody),
    { success: true },
  );
  assert.deepEqual(controller.questions('iphone-15', questionQuery), { total: 1, data: [] });
  assert.deepEqual(controller.createQuestion({ user: { sub: 'u-1' } } as any, 'iphone-15', questionBody), {
    id: 'q-1',
  });
  assert.deepEqual(
    controller.upvoteQuestion({ user: { sub: 'u-2' } } as any, 'iphone-15', 'q-1'),
    { success: true, applied: true, upvoteCount: 2 },
  );
  assert.deepEqual(
    controller.answerQuestion({ user: { sub: 'u-admin' } } as any, 'iphone-15', 'q-1', answerBody),
    { id: 'q-1', answer: 'Tra loi' },
  );
  assert.deepEqual(controller.removePriceAlert({ user: { sub: 'u-1' } } as any, 'iphone-15'), {
    success: true,
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
    { method: 'listPriceHistory', args: ['iphone-15', priceHistoryQuery] },
    { method: 'setPriceAlert', args: ['u-1', 'iphone-15', priceAlertBody] },
    { method: 'listQuestions', args: ['iphone-15', questionQuery] },
    { method: 'createQuestion', args: ['u-1', 'iphone-15', questionBody] },
    { method: 'upvoteQuestion', args: ['u-2', 'iphone-15', 'q-1'] },
    { method: 'answerQuestion', args: ['u-admin', 'iphone-15', 'q-1', 'Co, may ho tro eSIM.'] },
    { method: 'removePriceAlert', args: ['u-1', 'iphone-15'] },
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
    moveToCart: (...args: unknown[]) => {
      calls.push({ method: 'moveToCart', args });
      return { success: true, movedProductId: 'p-1' };
    },
    getCurrentShare: (...args: unknown[]) => {
      calls.push({ method: 'getCurrentShare', args });
      return { share: null };
    },
    createShare: (...args: unknown[]) => {
      calls.push({ method: 'createShare', args });
      return { share: { token: 'share-token' } };
    },
    regenerateShare: (...args: unknown[]) => {
      calls.push({ method: 'regenerateShare', args });
      return { share: { token: 'share-token-2' } };
    },
    getSharedWishlist: (...args: unknown[]) => {
      calls.push({ method: 'getSharedWishlist', args });
      return { total: 1, data: [] };
    },
  };
  const controller = new WishlistController(service as any);
  const request = { user: { sub: 'u-1' } } as any;
  const shareBody = { title: 'Tech picks', expiresInDays: 7 } as any;

  assert.deepEqual(controller.list(request), { total: 1, data: [] });
  assert.deepEqual(controller.addItem(request, { productId: 'p-1' } as any), {
    total: 2,
    data: [],
  });
  assert.deepEqual(controller.removeItem(request, 'p-1'), {
    total: 1,
    data: [],
  });
  assert.deepEqual(controller.moveToCart(request, 'p-1'), {
    success: true,
    movedProductId: 'p-1',
  });
  assert.deepEqual(controller.currentShare(request), { share: null });
  assert.deepEqual(controller.createShare(request, shareBody), {
    share: { token: 'share-token' },
  });
  assert.deepEqual(controller.regenerateShare(request, shareBody), {
    share: { token: 'share-token-2' },
  });
  assert.deepEqual(controller.shared('share-token'), { total: 1, data: [] });

  assert.deepEqual(calls, [
    { method: 'list', args: ['u-1'] },
    { method: 'addItem', args: ['u-1', 'p-1'] },
    { method: 'removeItem', args: ['u-1', 'p-1'] },
    { method: 'moveToCart', args: ['u-1', 'p-1'] },
    { method: 'getCurrentShare', args: ['u-1'] },
    { method: 'createShare', args: ['u-1', shareBody] },
    { method: 'regenerateShare', args: ['u-1', shareBody] },
    { method: 'getSharedWishlist', args: ['share-token'] },
  ]);
});
