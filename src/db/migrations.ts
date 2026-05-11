/**
 * Database migrations — runs once on first launch, or when version increases.
 * Add new migrations to the array; never edit existing ones.
 */
import { SQLiteDatabase } from 'expo-sqlite';

const MIGRATIONS: Array<{ version: number; sql: string; statements?: string[] }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id          TEXT PRIMARY KEY NOT NULL,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('cash','debit','savings','investment')),
        balance     REAL NOT NULL DEFAULT 0,
        currency    TEXT NOT NULL DEFAULT 'PHP',
        color       TEXT NOT NULL DEFAULT '#5F6266',
        icon        TEXT NOT NULL DEFAULT 'wallet',
        include_in_net_worth INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY NOT NULL,
        name        TEXT NOT NULL,
        icon        TEXT NOT NULL,
        color       TEXT NOT NULL,
        type        TEXT NOT NULL CHECK(type IN ('income','expense')),
        is_default  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY NOT NULL,
        account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        to_account_id   TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        type            TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
        amount          REAL NOT NULL,
        category_id     TEXT NOT NULL REFERENCES categories(id),
        note            TEXT,
        tags            TEXT,
        date            TEXT NOT NULL,
        is_recurring    INTEGER NOT NULL DEFAULT 0,
        recurring_id    TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

      CREATE TABLE IF NOT EXISTS budgets (
        id          TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        amount      REAL NOT NULL,
        period      TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly','weekly')),
        month       INTEGER NOT NULL,
        year        INTEGER NOT NULL,
        created_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id             TEXT PRIMARY KEY NOT NULL,
        name           TEXT NOT NULL,
        target_amount  REAL NOT NULL,
        current_amount REAL NOT NULL DEFAULT 0,
        target_date    TEXT,
        color          TEXT NOT NULL DEFAULT '#10B981',
        icon           TEXT NOT NULL DEFAULT 'piggy-bank',
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id            TEXT PRIMARY KEY NOT NULL,
        account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type          TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
        amount        REAL NOT NULL,
        category_id   TEXT NOT NULL REFERENCES categories(id),
        note          TEXT,
        frequency     TEXT NOT NULL CHECK(frequency IN ('daily','weekly','biweekly','monthly','yearly')),
        next_due_date TEXT NOT NULL,
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS db_meta (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `__multi__`,
    statements: [
      `ALTER TABLE accounts ADD COLUMN bank_id TEXT;`,
      `ALTER TABLE accounts ADD COLUMN masked_card_number TEXT;`,
      `ALTER TABLE accounts ADD COLUMN interest_rate_pa REAL;`,
    ],
  },
  {
    // The original DB was created with account types ('cash','bank','credit','savings','investment').
    // The app now uses 'debit' instead of 'bank'/'credit'. SQLite cannot ALTER a CHECK constraint
    // in-place, so we recreate the table with the correct constraint and migrate existing rows.
    version: 3,
    sql: `__multi__`,
    statements: [
      // 1. New table with correct type constraint
      `CREATE TABLE IF NOT EXISTS accounts_v3 (
         id                   TEXT PRIMARY KEY NOT NULL,
         name                 TEXT NOT NULL,
         type                 TEXT NOT NULL CHECK(type IN ('cash','debit','savings','investment')),
         balance              REAL NOT NULL DEFAULT 0,
         currency             TEXT NOT NULL DEFAULT 'PHP',
         color                TEXT NOT NULL DEFAULT '#5F6266',
         icon                 TEXT NOT NULL DEFAULT 'wallet',
         include_in_net_worth INTEGER NOT NULL DEFAULT 1,
         bank_id              TEXT,
         masked_card_number   TEXT,
         interest_rate_pa     REAL,
         created_at           TEXT NOT NULL,
         updated_at           TEXT NOT NULL
       )`,
      // 2. Copy rows, mapping legacy 'bank'/'credit' → 'debit'
      `INSERT INTO accounts_v3 (id, name, type, balance, currency, color, icon, include_in_net_worth, bank_id, masked_card_number, interest_rate_pa, created_at, updated_at)
       SELECT
         id, name,
         CASE type WHEN 'bank' THEN 'debit' WHEN 'credit' THEN 'debit' ELSE type END,
         balance, currency, color, icon, include_in_net_worth,
         bank_id, masked_card_number, interest_rate_pa,
         created_at, updated_at
       FROM accounts`,
      // 3. Swap tables
      `DROP TABLE accounts`,
      `ALTER TABLE accounts_v3 RENAME TO accounts`,
    ],
  },
  {
    version: 4,
    sql: '__multi__',
    statements: ['ALTER TABLE accounts ADD COLUMN last_interest_date TEXT;'],
  },
  {
    version: 6,
    sql: '__multi__',
    statements: [
      `ALTER TABLE accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
      // Backfill existing rows so their order matches creation order
      `UPDATE accounts SET sort_order = rowid;`,
    ],
  },
  {
    version: 7,
    sql: '__multi__',
    statements: [
      `ALTER TABLE loans ADD COLUMN total_payable REAL;`,
    ],
  },
  {
    version: 9,
    sql: '__multi__',
    statements: [
      `INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES ('cat_loan_payment', '🏦 Loan Payment', 'expense', 'credit-card', '#EF4444');`,
      `INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES ('cat_savings', '🐷 Savings', 'expense', 'wallet', '#10B981');`,
    ],
  },
  {
    version: 8,
    sql: '__multi__',
    statements: [
      `UPDATE categories SET name = '🍽️ Food & Dining'  WHERE id = 'cat_food';`,
      `UPDATE categories SET name = '🚌 Transportation'  WHERE id = 'cat_transport';`,
      `UPDATE categories SET name = '🏠 Housing & Rent'  WHERE id = 'cat_housing';`,
      `UPDATE categories SET name = '💊 Health'          WHERE id = 'cat_health';`,
      `UPDATE categories SET name = '🛍️ Shopping'        WHERE id = 'cat_shopping';`,
      `UPDATE categories SET name = '🎬 Entertainment'   WHERE id = 'cat_entertainment';`,
      `UPDATE categories SET name = '📚 Education'       WHERE id = 'cat_education';`,
      `UPDATE categories SET name = '📦 Other'           WHERE id = 'cat_other';`,
      `UPDATE categories SET name = '💼 Salary'          WHERE id = 'cat_salary';`,
      `UPDATE categories SET name = '💻 Freelance'       WHERE id = 'cat_freelance';`,
      `UPDATE categories SET name = '📈 Investment'      WHERE id = 'cat_investment';`,
      `UPDATE categories SET name = '🎁 Gift'            WHERE id = 'cat_gift';`,
      `UPDATE categories SET name = '💰 Other Income'    WHERE id = 'cat_other_income';`,
    ],
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS loans (
        id                TEXT PRIMARY KEY NOT NULL,
        name              TEXT NOT NULL,
        lender            TEXT,
        principal_amount  REAL NOT NULL,
        remaining_balance REAL NOT NULL,
        interest_rate_pa  REAL,
        monthly_payment   REAL NOT NULL,
        due_day_of_month  INTEGER NOT NULL DEFAULT 1,
        is_recurring      INTEGER NOT NULL DEFAULT 1,
        start_date        TEXT NOT NULL,
        end_date          TEXT,
        color             TEXT NOT NULL DEFAULT '#EF4444',
        is_active         INTEGER NOT NULL DEFAULT 1,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
      );
    `,
  },
];

/** Split a multi-statement SQL string into individual runnable statements. */
function splitSQL(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Ensure meta table exists before we query the version
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS db_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`
  );

  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM db_meta WHERE key = 'schema_version';`
  );
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    // Always run individual statements — split multi-statement SQL automatically.
    // This prevents a partial failure leaving the schema in an unknown state.
    const stmts = migration.statements ?? splitSQL(migration.sql);

    for (const stmt of stmts) {
      try {
        await db.execAsync(stmt);
      } catch (e: unknown) {
        // ALTER TABLE ADD COLUMN fails if the column already exists (SQLite has
        // no IF NOT EXISTS for ALTER TABLE). Ignore that specific error so a
        // failed-mid-way migration can be safely retried.
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('duplicate column name')) continue;
        throw e; // re-throw anything else so it is visible
      }
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO db_meta (key, value) VALUES ('schema_version', ?);`,
      [migration.version.toString()]
    );
  }
}
