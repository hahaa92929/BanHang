# BanHang Monorepo

Monorepo theo stack trong runbook:
- Frontend: Next.js App Router
- Backend: NestJS modular monolith
- Database: Prisma + PostgreSQL

## Backend scope da implement
- Versioned API base path: `/api/v1`
- Security baseline: bcrypt password hashing, helmet, rate limit, env validation, hashed refresh token storage, account lockout
- Auth: login, register, refresh, me, logout, session list/revoke, forgot password, reset password, request email verification, verify email
- Catalog: category tree, brand list, product listing/filtering, product detail by id/slug, admin CRUD, bulk import/export, product media
- Cart: add/update/remove item, clear, merge anonymous cart payload, apply/remove coupon, save for later
- Orders: reservation, checkout, order list/detail, cancel, return request, invoice, tracking, admin status flow
- Payments: method list, initiate payment, payment status, refund, idempotent webhook handling
- Extra modules: inventory, shipping, notifications, reporting
- Delivery: generated Prisma migration SQL, OpenAPI spec, structured request logging, backend test suite

## Demo accounts
- Admin: `admin@banhang.local` / `admin12345`
- Customer: `customer@banhang.local` / `customer12345`

## Required environment variables
Root `.env.example` and `apps/backend/.env.example` da duoc cap nhat. Cac bien backend quan trong:
- `DATABASE_URL`
- `JWT_SECRET`
- `TOKEN_HASH_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
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
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/request-email-verification`
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
- `GET /api/v1/orders/reservations/current`
- `POST /api/v1/orders/reservations`
- `POST /api/v1/orders/reservations/:id/cancel`
- `POST /api/v1/orders/checkout`

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
- `GET /api/v1/inventory/movements/list`
- `GET /api/v1/inventory/low-stock/list`
- `GET /api/v1/inventory/:sku`
- `POST /api/v1/shipping/calculate`
- `POST /api/v1/shipping/create`
- `GET /api/v1/shipping/zones/list`
- `GET /api/v1/shipping/:id/tracking`
- `POST /api/v1/shipping/:id/label`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read/all`
- `GET /api/v1/reporting/summary`

## Docs
- Runbook: `docs/runbook.md`
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
