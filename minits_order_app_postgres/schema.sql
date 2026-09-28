CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    raspberry_qty INTEGER NOT NULL DEFAULT 0 CHECK (raspberry_qty >= 0),
    strawberry_qty INTEGER NOT NULL DEFAULT 0 CHECK (strawberry_qty >= 0),
    chocolate_qty INTEGER NOT NULL DEFAULT 0 CHECK (chocolate_qty >= 0),
    status TEXT NOT NULL DEFAULT 'Received',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_code
ON orders(order_code);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_accounts (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Makes admin usernames unique without caring about upper/lowercase.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_username_lower
ON admin_accounts(LOWER(username));
