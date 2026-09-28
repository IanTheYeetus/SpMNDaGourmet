# Minits Order App — PostgreSQL / Supabase Edition

A full-stack ordering system for Raspberry, Strawberry and Chocolate Minits.

## Features

- Customer ordering page
- Required class selection
- Unique order lookup code
- Public order tracking page
- Prices and totals on ordering, tracking and admin pages
- Normal admin accounts with username + password
- Separate password-only admin-account manager
- Create, reset and delete normal admin accounts
- PostgreSQL database storage, compatible with Supabase

## Prices

- Raspberry: €1.00
- Strawberry: €1.00
- Chocolate: €1.50

## 1. Create a Supabase database

Create a Supabase project and get a PostgreSQL connection string from the project's database/connect settings.

The app expects it in this environment variable:

```text
DATABASE_URL=postgresql://...
```

The server automatically runs `schema.sql` at startup, so the required tables and indexes are created if they do not already exist. You can also paste `schema.sql` into the Supabase SQL Editor and run it manually.

## 2. Set environment variables

Required:

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres
```

Recommended:

```text
DATABASE_SSL=true
ADMIN_PASSWORD=your-initial-admin-password
ADMIN_MANAGER_PASSWORD=your-very-strong-manager-password
SESSION_SECRET=a-long-random-secret
NODE_ENV=production
```

`ADMIN_PASSWORD` is only used to create the first `admin` account when the `admin_accounts` table is empty.

`ADMIN_MANAGER_PASSWORD` is the password-only credential for `/admin-accounts.html`.

For a local PostgreSQL server that does not use TLS, set:

```text
DATABASE_SSL=false
```

## 3. Run locally

Install Node.js 18+, then:

```bash
npm install
npm start
```

The app will stop with a clear error if `DATABASE_URL` is missing.

Pages:

- Order: http://localhost:3000/
- Lookup: http://localhost:3000/lookup.html
- Admin: http://localhost:3000/admin.html
- Admin account manager: http://localhost:3000/admin-accounts.html

## Fresh-database admin access

When the database contains no normal admin accounts, startup automatically creates:

- Username: `admin`
- Password: the current `ADMIN_PASSWORD` value

After that account exists, changing `ADMIN_PASSWORD` does not reset its password. Use the admin-account manager page to reset normal admin passwords.

## Deploying the Node.js app

You can deploy the Node.js part on a hosting service that supports environment variables and outbound PostgreSQL connections.

Set at least:

```text
DATABASE_URL
ADMIN_PASSWORD
ADMIN_MANAGER_PASSWORD
SESSION_SECRET
NODE_ENV=production
```

Start command:

```text
npm start
```

Because the orders and admin accounts live in PostgreSQL, the web host itself does not need persistent disk storage.

## Security notes

- Normal admin passwords are hashed with Node's built-in `scrypt` before storage.
- The special account-manager password stays server-side.
- SQL values use PostgreSQL parameterized queries (`$1`, `$2`, etc.).
- Production session cookies are marked `secure` when `NODE_ENV=production`.
- For a public production deployment, add login rate limiting.
- The built-in Express memory session store is acceptable for small/testing deployments but is not ideal for multiple server instances. A PostgreSQL-backed session store can be added later if needed.
