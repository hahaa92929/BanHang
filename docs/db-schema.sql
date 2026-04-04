CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id VARCHAR(64) PRIMARY KEY,
  sku VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  price BIGINT NOT NULL,
  stock INT NOT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE carts (
  user_id VARCHAR(32) PRIMARY KEY REFERENCES users(id)
);

CREATE TABLE cart_items (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES users(id),
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price BIGINT NOT NULL
);

CREATE TABLE orders (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  shipping_status VARCHAR(20) NOT NULL,
  address_json JSONB NOT NULL,
  notes TEXT,
  subtotal BIGINT NOT NULL,
  shipping_fee BIGINT NOT NULL,
  total BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL REFERENCES orders(id),
  product_id VARCHAR(64) NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price BIGINT NOT NULL
);
