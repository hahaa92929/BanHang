# BanHang - Next.js + NestJS

Monorepo theo stack trong runbook:
- Frontend: Next.js (App Router)
- Backend: NestJS
- Persistence: Prisma + PostgreSQL

## Da code trong ban nay
- Auth: login, register, refresh token, me, logout
- Product catalog: search, category, min/max price, in-stock, sort, paging
- Cart: add item, update quantity, remove item, clear cart
- Checkout: 3-step payload (shipping + payment + confirm)
- Orders: list, detail, status flow 4 buoc (`created -> confirmed -> shipping -> completed`)
- Admin permission: chi admin duoc cap nhat trang thai don hang
- Prisma schema + seed du lieu mau

## Tai khoan demo
- Admin: `admin@banhang.local` / `admin123`
- Customer: `customer@banhang.local` / `customer123`

## Chay local
1. `npm install`
2. `copy .env.example .env`
3. Start Postgres: `docker compose up -d`
4. Generate Prisma client: `npm run db:generate`
5. Migrate schema: `npm run db:migrate`
6. Seed data: `npm run db:seed`
7. Backend: `npm run dev:backend` (port 4000)
8. Frontend: `npm run dev:frontend` (port 3000)
9. Mo `http://localhost:3000`

## Scripts
- `npm run build`: build ca frontend + backend
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
- `GET /api/orders/:id`
- `POST /api/orders/checkout`
- `PATCH /api/orders/:id/status` (admin)

## Note
- Runbook tong the nam tai `docs/runbook.md`.
- OpenAPI tai `docs/openapi.yaml`.
- Buoc tiep theo nen lam: payment webhook/idempotency, inventory reservation, integration test.
