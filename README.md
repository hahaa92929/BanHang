# BanHang - Next.js + NestJS

Monorepo theo stack trong runbook:
- Frontend: Next.js (App Router)
- Backend: NestJS
- Persistence: Prisma + PostgreSQL

## Da code trong ban nay
- Auth: login, register, refresh token, me, logout
- Product catalog: search, category, min/max price, in-stock, sort, paging
- Cart: add item, update quantity, remove item, clear cart
- Inventory reservation: reserve/cancel/release-expired de tranh oversell truoc checkout
- Checkout: checkout tu reservation (shipping + payment + confirm)
- Orders: list, detail, status flow 4 buoc (`created -> confirmed -> shipping -> completed`)
- Admin permission: chi admin duoc cap nhat trang thai don hang
- Prisma schema + seed du lieu mau

## Tai khoan demo
- Admin: `admin@banhang.local` / `admin123`
- Customer: `customer@banhang.local` / `customer123`

## Chay local
1. `npm install`
2. `copy .env.example .env`
3. `copy apps\\backend\\.env.example apps\\backend\\.env`
4. Start Postgres: `docker compose up -d`
5. Generate Prisma client: `npm run db:generate`
6. Migrate schema: `npm run db:migrate`
7. Seed data: `npm run db:seed`
8. Backend: `npm run dev:backend` (port 4000)
9. Frontend: `npm run dev:frontend` (port 3000)
10. Mo `http://localhost:3000`

Neu gap loi `Access is denied` khi `docker compose up -d`, mo Docker Desktop/terminal voi quyen Administrator roi chay lai.

## Scripts
- `npm run build`: build ca frontend + backend
- `npm run test:backend`: chay unit test backend
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`

## API nhanh
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/products`
- `GET /api/products/categories`
- `GET /api/products/:id`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:productId`
- `DELETE /api/cart/items/:productId`
- `DELETE /api/cart/clear`
- `GET /api/orders`
- `GET /api/orders/reservations/current`
- `POST /api/orders/reservations`
- `POST /api/orders/reservations/:id/cancel`
- `POST /api/orders/reservations/release-expired` (admin)
- `GET /api/orders/:id`
- `POST /api/orders/checkout`
- `PATCH /api/orders/:id/status` (admin)
- `POST /api/payments/webhook` (HMAC signature + idempotency)

## Note
- Runbook tong the nam tai `docs/runbook.md`.
- OpenAPI tai `docs/openapi.yaml`.
- Payment webhook can header `x-webhook-signature` = `HMAC_SHA256(JSON body, PAYMENT_WEBHOOK_SECRET)`.
- Buoc tiep theo nen lam: integration test, observability (log + metrics), payment reconciliation jobs.
