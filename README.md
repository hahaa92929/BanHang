# BanHang Monorepo

Monorepo theo stack trong runbook:
- Frontend: Next.js App Router
- Backend: NestJS modular monolith
- Database: Prisma + PostgreSQL

## Backend scope da implement
- Versioned API base path: `/api/v1`
- Security baseline: bcrypt password hashing, helmet, rate limit, env validation, hashed refresh token storage, account lockout, refresh cookie + CSRF support, RS256 requirement in production
- Auth: guest session, login, register, social login, guest cart merge on login/register/social, TOTP 2FA enable/verify, API key management, refresh, me, logout, session list/revoke, forgot password, reset password, request email verification, verify email
- Catalog: category tree, brand list, product listing/filtering, product detail by id/slug, admin CRUD, bulk import/export, product media, product reviews, product variants with warehouse stock breakdown
- Cart: add/update/remove item, clear, merge anonymous cart payload, apply/remove coupon, save for later, variant-aware cart lines
- Wishlist: list, add, remove saved products
- Orders: reservation, checkout, order list/detail, cancel, return request, invoice, tracking, admin status flow with variant-aware reservation and order items
- Payments: method list, initiate payment, payment status, refund, idempotent webhook handling, VNPay signed checkout URL integration
- Extra modules: inventory with warehouse-level adjustments, transfers, and low-stock checks, shipping, notifications, reporting breakdowns
- Delivery: generated Prisma migration SQL, OpenAPI spec, structured request logging, backend test suite

## Demo accounts
- Admin: `admin@banhang.local` / `admin12345`
- Customer: `customer@banhang.local` / `customer12345`

## Required environment variables
Root `.env.example` and `apps/backend/.env.example` da duoc cap nhat. Cac bien backend quan trong:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `TOKEN_HASH_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`
- `VNPAY_PAYMENT_URL`
- `VNPAY_RETURN_URL`
- `JWT_ACCESS_TTL_SEC`
- `JWT_REFRESH_TTL_SEC`
- `RESERVATION_TTL_MINUTES`
- `RESET_PASSWORD_TTL_MINUTES`
- `EMAIL_VERIFICATION_TTL_HOURS`
- `APP_ORIGINS`
- `PORT`

Frontend dung:
- `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`

## Local run
1. `npm install`
2. `Copy-Item .env.example .env`
3. `Copy-Item apps\\backend\\.env.example apps\\backend\\.env`
4. Khoi dong Postgres: `docker compose up -d`
5. Generate Prisma client: `npm run db:generate`
6. Apply migration: `npm run db:migrate`
7. Seed data: `npm run db:seed`
8. Chay backend: `npm run dev:backend`
9. Chay frontend: `npm run dev:frontend`
10. Frontend mac dinh tai `http://localhost:3000`
11. Health check backend: `http://localhost:4000/api/v1/health`

## Useful scripts
- `npm run build`
- `npm run test:backend`
- `npm run test:backend:coverage`
- `npm run typecheck:backend`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:migrate:deploy`
- `npm run db:seed`
- `npm run e2e:install`
- `npm run e2e:prepare`
- `npm run e2e`
- `npm run perf:smoke`

## Backend API overview
Auth:
- `POST /api/v1/auth/guest`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/social/:provider`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/request-email-verification`
- `POST /api/v1/auth/2fa/enable`
- `POST /api/v1/auth/2fa/verify`
- `GET /api/v1/auth/api-keys`
- `POST /api/v1/auth/api-keys`
- `DELETE /api/v1/auth/api-keys/:id`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:id`
- `POST /api/v1/auth/logout`

Catalog:
- `GET /api/v1/products`
- `GET /api/v1/products/categories`
- `GET /api/v1/products/brands`
- `GET /api/v1/products/export`
- `GET /api/v1/products/:idOrSlug`
- `POST /api/v1/products/categories`
- `POST /api/v1/products/brands`
- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `POST /api/v1/products/import`
- `POST /api/v1/products/:id/media`
- `GET /api/v1/products/:idOrSlug/reviews`
- `GET /api/v1/products/:idOrSlug/reviews/moderation`
- `POST /api/v1/products/:idOrSlug/reviews`
- `POST /api/v1/products/:idOrSlug/reviews/:reviewId/helpful`
- `PATCH /api/v1/products/:idOrSlug/reviews/:reviewId/reply`
- `PATCH /api/v1/products/:idOrSlug/reviews/:reviewId/status`

Cart and checkout:
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/:productId`
- `DELETE /api/v1/cart/items/:productId`
- `POST /api/v1/cart/merge`
- `POST /api/v1/cart/coupon`
- `DELETE /api/v1/cart/coupon`
- `POST /api/v1/cart/save-for-later/:productId`
- `DELETE /api/v1/cart/clear`
- `GET /api/v1/wishlist`
- `POST /api/v1/wishlist/items`
- `DELETE /api/v1/wishlist/items/:productId`
- `GET /api/v1/orders/reservations/current`
- `POST /api/v1/orders/reservations`
- `POST /api/v1/orders/reservations/:id/cancel`
- `POST /api/v1/orders/checkout`

Customer account:
- `GET /api/v1/account/dashboard`
- `GET /api/v1/account/orders`
- `POST /api/v1/account/orders/:id/reorder`
- `GET /api/v1/account/loyalty`
- `GET /api/v1/account/profile`
- `PATCH /api/v1/account/profile`
- `GET /api/v1/account/addresses`
- `POST /api/v1/account/addresses`
- `PATCH /api/v1/account/addresses/:id`
- `POST /api/v1/account/addresses/:id/default`
- `DELETE /api/v1/account/addresses/:id`
- `GET /api/v1/account/export`
- `DELETE /api/v1/account`

Orders and payments:
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `GET /api/v1/orders/:id/invoice`
- `GET /api/v1/orders/:id/tracking`
- `POST /api/v1/orders/:id/cancel`
- `POST /api/v1/orders/:id/return`
- `PATCH /api/v1/orders/:id/status`
- `GET /api/v1/payments/methods`
- `POST /api/v1/payments`
- `GET /api/v1/payments/:id`
- `POST /api/v1/payments/:id/refund`
- `POST /api/v1/payments/webhook/:gateway`

Ops and admin:
- `POST /api/v1/inventory/adjust`
- `POST /api/v1/inventory/transfer`
- `GET /api/v1/inventory/movements/list`
- `GET /api/v1/inventory/low-stock/list`
- `GET /api/v1/inventory/:sku`
- `POST /api/v1/shipping/calculate`
- `POST /api/v1/shipping/create`
- `GET /api/v1/shipping/zones`
- `GET /api/v1/shipping/zones/list`
- `GET /api/v1/shipping/:id/tracking`
- `POST /api/v1/shipping/:id/label`
- `POST /api/v1/shipping/:id/events`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/click`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read/all`
- `GET /api/v1/notifications/preferences/current`
- `PATCH /api/v1/notifications/preferences/current`
- `POST /api/v1/notifications/preferences/unsubscribe`
- `GET /api/v1/notifications/templates/list`
- `POST /api/v1/notifications/templates`
- `PATCH /api/v1/notifications/templates/:id`
- `POST /api/v1/notifications/templates/:id/preview`
- `POST /api/v1/notifications/batch`
- `POST /api/v1/notifications/dispatch`
- `GET /api/v1/reporting/summary`
- `GET /api/v1/reporting/revenue`
- `GET /api/v1/reporting/top-products`
- `GET /api/v1/reporting/coupon-usage`
- `GET /api/v1/search`
- `GET /api/v1/search/suggestions`
- `GET /api/v1/search/trending`
- `GET /api/v1/search/recent`
- `DELETE /api/v1/search/recent`
- `GET /api/v1/search/analytics`

Catalog and inventory notes:
- `POST /api/v1/products` va `PATCH /api/v1/products/:id` co the nhan `variants[]` voi `warehouseStocks[]` de tao cap nhat ton kho theo warehouse.
- Review public query ho tro them `verifiedOnly=true` va `withMedia=true`; admin co moderation queue rieng va co the `publish/reject/pending` review.
- `POST /api/v1/cart/items` va `POST /api/v1/cart/merge` co the nhan them `variantId`; `PATCH/DELETE /api/v1/cart/items/:productId` va `POST /api/v1/cart/save-for-later/:productId` ho tro `?variantId=` khi cung product co nhieu dong cart.
- `POST /api/v1/inventory/adjust` nhan them `variantId` va `warehouseCode` de dieu chinh ton kho o dung bien the va kho.
- `POST /api/v1/inventory/transfer` chuyen ton kho `available` giua 2 warehouse cho cung product/variant ma khong doi tong stock aggregate.
- `GET /api/v1/inventory/:sku` ho tro parent product SKU hoac variant SKU de tra ve tong ton va breakdown theo warehouse.
- Reservation va order item gio luu `variantId` va `variant SKU`, nen checkout/cancel/release stock theo dung variant thay vi chi theo product aggregate.
- `POST /api/v1/shipping/calculate` ho tro them `carrier`, `district`, `weightGrams` va tra ve nhieu quote theo provider.
- `POST /api/v1/shipping/create` co the chon `carrier/serviceCode`; backend luu carrier, service code, label URL, va tao shipment tracking timeline theo order.
- `POST /api/v1/shipping/:id/events` cho phep staff/admin append tracking event de dong bo trang thai van chuyen va thong bao in-app.
- Notifications co them template CRUD, batch campaign, scheduled dispatch, va unsubscribe handling; notification duoc schedule se an khoi inbox cho toi khi den han dispatch.
- Account module co dashboard summary, order history filter/search, one-click reorder, loyalty summary, profile update, address book CRUD, data export, va `DELETE /api/v1/account` de anonymize tai khoan theo huong GDPR-style self-service.
- Search module co full-text query/facets, autocomplete, trending keywords, fuzzy typo suggestion, analytics zero-result, va recent search history cho customer da dang nhap.

Auth notes:
- `POST /api/v1/auth/guest` tao guest bearer token de guest dung cart, reservation, va checkout flow ma khong can dang ky.
- `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, va `POST /api/v1/auth/social/:provider` nhan them `guestAccessToken` de merge guest cart/wishlist/reservation/order context vao account that.
- `POST /api/v1/auth/login` nhan them `otp` khi account da bat 2FA.
- Auth payload gio tra them `csrfToken`; backend set refresh cookie + CSRF cookie cho flow refresh/logout qua cookie, va van giu body token de backward compatible.
- Access token dung `JWT_SECRET` theo HS256 o non-production, va production bat buoc dung RS256 khi ban cung cap ca `JWT_PRIVATE_KEY` va `JWT_PUBLIC_KEY`.
- `GET /api/v1/reporting/summary` chap nhan Bearer token hoac `x-api-key` cho integration read-only theo permission cua key.

Payments and reporting notes:
- `POST /api/v1/payments` co the nhan them `returnUrl`, `ipAddress`, `locale`; neu method la `vnpay` va env day du, backend tra signed VNPay checkout URL thay vi redirect placeholder.
- Reporting module ngoai `summary` da co them revenue by day, top products, va coupon usage breakdown cho dashboard/admin integrations.

## Docs
- Runbook: `docs/runbook.md`
- Architecture: `docs/architecture.md`
- OpenAPI: `docs/openapi.yaml`
- Generated SQL schema: `docs/db-schema.sql`

## CI
GitHub Actions hien tai chay:
- Prisma client generation
- Backend typecheck
- Backend unit + integration coverage gate (`lines >= 80%`, `branches >= 70%`)
- Monorepo build
- Playwright E2E voi PostgreSQL service
- Production dependency audit

## Verification
- Playwright dang cover guest browse, customer checkout, va admin order processing flow.
- Chay E2E local:
  1. `docker compose up -d`
  2. `npm run e2e:install`
  3. `npm run e2e:prepare`
  4. `npm run e2e`
- k6 smoke test mac dinh hit `http://127.0.0.1:4000/api/v1`. Neu muon doi target:
  - PowerShell: `$env:BASE_URL='http://127.0.0.1:4000/api/v1'; npm run perf:smoke`
