const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Required for PostgreSQL / Supabase.
// Example: postgresql://postgres:PASSWORD@HOST:5432/postgres
const DATABASE_URL = process.env.DATABASE_URL;

// Change these before deploying. Prefer environment variables in production.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-123";
const ADMIN_MANAGER_PASSWORD = process.env.ADMIN_MANAGER_PASSWORD || "change-manager-password-456";
const SESSION_SECRET = process.env.SESSION_SECRET || "replace-this-session-secret";

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it to your PostgreSQL/Supabase connection string.");
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL !== "false";
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

const PRICES = Object.freeze({
  raspberry: 1.00,
  strawberry: 1.00,
  chocolate: 1.50
});

function addPricing(order) {
  return {
    ...order,
    prices: PRICES,
    line_totals: {
      raspberry: order.raspberry_qty * PRICES.raspberry,
      strawberry: order.strawberry_qty * PRICES.strawberry,
      chocolate: order.chocolate_qty * PRICES.chocolate
    },
    total: (
      order.raspberry_qty * PRICES.raspberry +
      order.strawberry_qty * PRICES.strawberry +
      order.chocolate_qty * PRICES.chocolate
    )
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  const calculated = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, "hex");
  return calculated.length === expected.length && crypto.timingSafeEqual(calculated, expected);
}

function safeEqualText(input, expectedText) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(expectedText));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM admin_accounts");
  if (countResult.rows[0].count === 0) {
    const { hash, salt } = hashPassword(ADMIN_PASSWORD);
    await pool.query(
      `INSERT INTO admin_accounts (username, password_hash, password_salt)
       VALUES ($1, $2, $3)`,
      ["admin", hash, salt]
    );
    console.log("Created initial admin account with username: admin");
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function generateOrderCode() {
  return "MNT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

function requireAccountManager(req, res, next) {
  if (req.session && req.session.isAccountManager) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

app.post("/api/orders", async (req, res) => {
  const customerName = String(req.body.customerName || "").trim();
  const className = String(req.body.className || "").trim();
  const raspberry = Number.parseInt(req.body.raspberry, 10) || 0;
  const strawberry = Number.parseInt(req.body.strawberry, 10) || 0;
  const chocolate = Number.parseInt(req.body.chocolate, 10) || 0;

  if (!customerName) return res.status(400).json({ error: "Customer name is required." });

  const allowedClasses = [
    "5.A", "5.B", "5.C",
    "Prima A", "Prima B", "Prima C",
    "Sekunda A", "Sekunda B", "Sekunda C",
    "Tercia A", "Tercia B", "Tercia C",
    "Kvarta A", "Kvarta B", "Kvarta C",
    "Kvinta A", "Kvinta B", "Kvinta C",
    "Sexta A", "Sexta B", "Sexta C",
    "Septima A", "Septima B", "Septima C",
    "Oktava A", "Oktava B",
    "Katedra"
  ];

  if (!allowedClasses.includes(className)) {
    return res.status(400).json({ error: "Please select a valid class." });
  }

  if ([raspberry, strawberry, chocolate].some(qty => qty < 0)) {
    return res.status(400).json({ error: "Quantities cannot be negative." });
  }

  if (raspberry + strawberry + chocolate < 1) {
    return res.status(400).json({ error: "Please order at least one item." });
  }

  try {
    for (let i = 0; i < 10; i++) {
      const code = generateOrderCode();
      try {
        const result = await pool.query(
          `INSERT INTO orders (
             order_code, customer_name, class_name,
             raspberry_qty, strawberry_qty, chocolate_qty
           ) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [code, customerName, className, raspberry, strawberry, chocolate]
        );

        return res.status(201).json({ order: addPricing(result.rows[0]) });
      } catch (error) {
        if (error.code !== "23505") throw error;
      }
    }

    return res.status(500).json({ error: "Could not generate a unique order code." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not save the order." });
  }
});

app.get("/api/orders/code/:code", async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();

  try {
    const result = await pool.query(
      `SELECT order_code, customer_name, class_name, raspberry_qty, strawberry_qty,
              chocolate_qty, status, created_at
       FROM orders
       WHERE order_code = $1`,
      [code]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Order not found." });
    return res.json({ order: addPricing(result.rows[0]) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not look up the order." });
  }
});

// ---------- Normal admin login: username + password ----------
app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  try {
    const result = await pool.query(
      `SELECT id, username, password_hash, password_salt
       FROM admin_accounts
       WHERE LOWER(username) = LOWER($1)`,
      [username]
    );
    const account = result.rows[0];

    if (!account || !verifyPassword(password, account.password_hash, account.password_salt)) {
      return res.status(401).json({ error: "Incorrect username or password." });
    }

    req.session.isAdmin = true;
    req.session.adminId = account.id;
    req.session.adminUsername = account.username;
    return res.json({ ok: true, username: account.username });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not log in." });
  }
});

app.post("/api/admin/logout", (req, res) => {
  req.session.isAdmin = false;
  delete req.session.adminId;
  delete req.session.adminUsername;
  res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => {
  res.json({
    isAdmin: Boolean(req.session && req.session.isAdmin),
    username: req.session && req.session.adminUsername ? req.session.adminUsername : null
  });
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM orders
      ORDER BY created_at DESC, id DESC
    `);
    return res.json({ orders: result.rows.map(addPricing) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load orders." });
  }
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const status = String(req.body.status || "").trim();
  const allowedStatuses = ["Received", "Preparing", "Ready", "Completed", "Cancelled"];

  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid status." });

  try {
    const result = await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Order not found." });
    return res.json({ order: addPricing(result.rows[0]) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not update order." });
  }
});

app.delete("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  try {
    const result = await pool.query("DELETE FROM orders WHERE id = $1 RETURNING id", [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Order not found." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete order." });
  }
});

// ---------- Account manager: special password only, no username ----------
app.post("/api/admin-manager/login", (req, res) => {
  const password = String(req.body.password || "");
  if (!safeEqualText(password, ADMIN_MANAGER_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect account-manager password." });
  }

  req.session.isAccountManager = true;
  res.json({ ok: true });
});

app.post("/api/admin-manager/logout", (req, res) => {
  req.session.isAccountManager = false;
  res.json({ ok: true });
});

app.get("/api/admin-manager/session", (req, res) => {
  res.json({ isAccountManager: Boolean(req.session && req.session.isAccountManager) });
});

app.get("/api/admin-manager/accounts", requireAccountManager, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, created_at
      FROM admin_accounts
      ORDER BY LOWER(username) ASC
    `);
    return res.json({ accounts: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not load admin accounts." });
  }
});

app.post("/api/admin-manager/accounts", requireAccountManager, async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    return res.status(400).json({
      error: "Username must be 3-32 characters and use only letters, numbers, dots, underscores, or hyphens."
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { hash, salt } = hashPassword(password);

  try {
    const result = await pool.query(
      `INSERT INTO admin_accounts (username, password_hash, password_salt)
       VALUES ($1, $2, $3)
       RETURNING id, username, created_at`,
      [username, hash, salt]
    );
    return res.status(201).json({ account: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "That username already exists." });
    }
    console.error(error);
    return res.status(500).json({ error: "Could not create admin account." });
  }
});

app.patch("/api/admin-manager/accounts/:id/password", requireAccountManager, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const password = String(req.body.password || "");

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { hash, salt } = hashPassword(password);

  try {
    const result = await pool.query(
      `UPDATE admin_accounts
       SET password_hash = $1, password_salt = $2
       WHERE id = $3
       RETURNING id`,
      [hash, salt, id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Admin account not found." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not reset password." });
  }
});

app.delete("/api/admin-manager/accounts/:id", requireAccountManager, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  try {
    const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM admin_accounts");
    if (countResult.rows[0].count <= 1) {
      return res.status(400).json({ error: "You must keep at least one normal admin account." });
    }

    const result = await pool.query(
      "DELETE FROM admin_accounts WHERE id = $1 RETURNING id",
      [id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Admin account not found." });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete admin account." });
  }
});

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Minits app running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to initialize PostgreSQL database:", error);
    process.exit(1);
  }
}

start();
