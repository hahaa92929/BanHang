# Architecture Document

Tai lieu nay mo ta kien truc microservices muc tieu cho du an `BanHang`, dong thoi chi ra cach no map voi code hien tai trong repo.

## Current State

Repo hien tai dang chay theo mo hinh `NestJS modular monolith`:

- Frontend: `apps/frontend` (Next.js)
- Backend: `apps/backend` (1 NestJS app, nhieu domain module)
- Database: PostgreSQL qua Prisma
- Search/Cache/Event bus moi o muc logical architecture, chua tach thanh he thong production doc lap day du

## Module To Service Mapping

| Logical service | Current module |
|:--|:--|
| Auth Service | `auth` |
| Account Service | `account` |
| Catalog Service | `products` |
| Search Service | `search` |
| Cart Service | `cart` |
| Wishlist Service | `wishlist` |
| Order Service | `orders` |
| Payment Service | `payments` |
| Inventory Service | `inventory` |
| Shipping Service | `shipping` |
| Notification Service | `notifications` |
| Reporting Service | `reporting` |

## Microservices Architecture

```mermaid
flowchart TB
  subgraph Edge["Edge / Experience Layer"]
    U[Users]
    CDN[CDN / WAF\nCloudflare]
    LB[Load Balancer / Ingress]
    FE[Next.js Frontend\napps/frontend]
    U --> CDN --> LB --> FE
  end

  FE --> GW[API Gateway / BFF\n/api/v1]

  subgraph Services["Backend Domain Services"]
    AUTH[Auth Service\nauth]
    ACCOUNT[Account Service\naccount]
    CATALOG[Catalog Service\nproducts]
    SEARCH[Search Service\nsearch]
    CART[Cart Service\ncart]
    WISHLIST[Wishlist Service\nwishlist]
    ORDER[Order Service\norders]
    PAYMENT[Payment Service\npayments]
    INVENTORY[Inventory Service\ninventory]
    SHIPPING[Shipping Service\nshipping]
    NOTIFY[Notification Service\nnotifications]
    REPORT[Reporting Service\nreporting]
  end

  GW --> AUTH
  GW --> ACCOUNT
  GW --> CATALOG
  GW --> SEARCH
  GW --> CART
  GW --> WISHLIST
  GW --> ORDER
  GW --> PAYMENT
  GW --> INVENTORY
  GW --> SHIPPING
  GW --> NOTIFY
  GW --> REPORT

  CART --> CATALOG
  CART --> INVENTORY
  WISHLIST --> CATALOG
  ORDER --> CART
  ORDER --> INVENTORY
  ORDER --> PAYMENT
  ORDER --> SHIPPING
  ORDER --> NOTIFY
  ORDER --> REPORT
  PAYMENT --> NOTIFY
  PAYMENT --> REPORT
  SHIPPING --> NOTIFY
  CATALOG --> SEARCH
  CATALOG --> REPORT

  subgraph Data["Data / Platform Layer"]
    PG[(PostgreSQL)]
    REDIS[(Redis)]
    ES[(Elasticsearch / OpenSearch)]
    MQ[(RabbitMQ / Kafka)]
    S3[(S3 / MinIO)]
  end

  AUTH <--> PG
  ACCOUNT <--> PG
  CATALOG <--> PG
  SEARCH <--> PG
  CART <--> PG
  WISHLIST <--> PG
  ORDER <--> PG
  PAYMENT <--> PG
  INVENTORY <--> PG
  SHIPPING <--> PG
  NOTIFY <--> PG
  REPORT <--> PG

  AUTH <--> REDIS
  CART <--> REDIS
  CATALOG <--> REDIS
  SEARCH <--> ES
  CATALOG <--> S3

  CATALOG --> MQ
  ORDER --> MQ
  PAYMENT --> MQ
  INVENTORY --> MQ
  SHIPPING --> MQ
  NOTIFY --> MQ
  REPORT --> MQ

  subgraph External["External Integrations"]
    PGW[Payment Gateways\nVNPay / Stripe / MoMo / ZaloPay]
    CARRIER[Shipping Providers\nGHN / GHTK / Viettel Post]
    COMM[Email / SMS / Push]
    BI[BI / Admin / Webhooks]
  end

  PAYMENT <--> PGW
  SHIPPING <--> CARRIER
  NOTIFY <--> COMM
  REPORT --> BI
```

## Checkout Event Flow

```mermaid
sequenceDiagram
  actor User
  participant FE as Next.js Frontend
  participant GW as API Gateway
  participant Auth as Auth Service
  participant Cart as Cart Service
  participant Order as Order Service
  participant Inv as Inventory Service
  participant Pay as Payment Service
  participant Ship as Shipping Service
  participant Notify as Notification Service
  participant Report as Reporting Service

  User->>FE: Add item / checkout
  FE->>GW: Auth + cart API calls
  GW->>Auth: Verify access token / guest token
  GW->>Cart: Read cart
  FE->>GW: POST /orders/reserve
  GW->>Order: Create reservation
  Order->>Inv: Reserve stock by variant / warehouse
  Inv-->>Order: Reservation allocations
  Order-->>FE: reservationId + expiresAt

  FE->>GW: POST /orders/checkout
  GW->>Order: Checkout reservation
  Order->>Pay: Initiate payment or mark COD pending
  Order->>Ship: Create shipment / tracking
  Order->>Notify: Send order created notification
  Order->>Report: Publish order.created

  alt Online payment
    Pay->>User: Redirect to payment gateway
    Pay-->>Order: payment.authorized / payment.paid
    Order->>Notify: Payment update
    Order->>Report: Publish payment event
  else COD
    Order-->>FE: Order created
  end
```

## Recommended Deployment View

- `Frontend`: Next.js app behind CDN + Load Balancer
- `Gateway`: API gateway or BFF layer for auth, rate limit, routing, aggregation
- `Core services`: Auth, Catalog, Cart, Order, Payment, Inventory, Shipping, Notification, Reporting
- `Support services`: Search, Account, Wishlist
- `Data`: PostgreSQL as source of truth, Redis for session/cache/rate-limit, Elasticsearch for search, object storage for media
- `Async backbone`: RabbitMQ or Kafka for domain events such as `product.updated`, `order.created`, `payment.paid`, `shipment.updated`

## Important Note For This Repo

Code hien tai chua deploy theo microservices that su. No dang la `modular monolith` de tang toc do phat trien:

- 1 backend app NestJS
- 1 PostgreSQL
- module boundaries da du roi de tach service sau nay
- search / cache / queue / provider integrations moi o muc `target architecture` hoac `thin integration`

Noi cach khac: so do tren la `kien truc muc tieu hop ly nhat` cho du an nay, duoc suy ra tu runbook va current module structure.
