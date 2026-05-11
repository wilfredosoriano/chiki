import { SQLiteDatabase } from 'expo-sqlite';
import type { Transaction } from '@/types';

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    toAccountId: (row.to_account_id as string | null) ?? undefined,
    type: row.type as Transaction['type'],
    amount: row.amount as number,
    categoryId: row.category_id as string,
    note: (row.note as string | null) ?? undefined,
    tags: row.tags ? (row.tags as string).split(',') : undefined,
    date: row.date as string,
    isRecurring: row.is_recurring === 1,
    recurringId: (row.recurring_id as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getTransactionsByMonth(
  db: SQLiteDatabase,
  year: number,
  month: number
): Promise<Transaction[]> {
  const pad = String(month).padStart(2, '0');
  const prefix = `${year}-${pad}`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC;`,
    [`${prefix}%`]
  );
  return rows.map(rowToTransaction);
}

export async function getRecentTransactions(
  db: SQLiteDatabase,
  limit = 20
): Promise<Transaction[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ?;`,
    [limit]
  );
  return rows.map(rowToTransaction);
}

export async function getTransactionsByAccount(
  db: SQLiteDatabase,
  accountId: string,
  limit = 50
): Promise<Transaction[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC LIMIT ?;`,
    [accountId, limit]
  );
  return rows.map(rowToTransaction);
}

export async function insertTransaction(
  db: SQLiteDatabase,
  t: Transaction
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions
       (id, account_id, to_account_id, type, amount, category_id, note, tags, date,
        is_recurring, recurring_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      t.id,
      t.accountId,
      t.toAccountId ?? null,
      t.type,
      t.amount,
      t.categoryId,
      t.note ?? null,
      t.tags ? t.tags.join(',') : null,
      t.date,
      t.isRecurring ? 1 : 0,
      t.recurringId ?? null,
      t.createdAt,
      t.updatedAt,
    ]
  );
}

export async function updateTransaction(
  db: SQLiteDatabase,
  t: Transaction
): Promise<void> {
  await db.runAsync(
    `UPDATE transactions SET account_id=?, to_account_id=?, type=?, amount=?,
       category_id=?, note=?, tags=?, date=?, is_recurring=?, recurring_id=?, updated_at=?
     WHERE id=?;`,
    [
      t.accountId,
      t.toAccountId ?? null,
      t.type,
      t.amount,
      t.categoryId,
      t.note ?? null,
      t.tags ? t.tags.join(',') : null,
      t.date,
      t.isRecurring ? 1 : 0,
      t.recurringId ?? null,
      t.updatedAt,
      t.id,
    ]
  );
}

export async function deleteTransaction(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(`DELETE FROM transactions WHERE id=?;`, [id]);
}

export async function getSpendingByCategory(
  db: SQLiteDatabase,
  year: number,
  month: number
): Promise<Array<{ categoryId: string; total: number }>> {
  const pad = String(month).padStart(2, '0');
  const rows = await db.getAllAsync<{ category_id: string; total: number }>(
    `SELECT category_id, SUM(amount) as total
     FROM transactions
     WHERE type = 'expense' AND date LIKE ?
     GROUP BY category_id;`,
    [`${year}-${pad}%`]
  );
  return rows.map((r) => ({ categoryId: r.category_id, total: r.total }));
}
