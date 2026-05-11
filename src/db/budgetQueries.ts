import { SQLiteDatabase } from 'expo-sqlite';
import type { Budget } from '@/types';

function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    amount: row.amount as number,
    period: row.period as 'monthly' | 'weekly',
    month: row.month as number,
    year: row.year as number,
    createdAt: row.created_at as string,
  };
}

export async function getBudgetsByMonth(
  db: SQLiteDatabase,
  year: number,
  month: number
): Promise<Budget[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM budgets WHERE year = ? AND month = ? ORDER BY created_at ASC;`,
    [year, month]
  );
  return rows.map(rowToBudget);
}

export async function insertBudget(db: SQLiteDatabase, budget: Budget): Promise<void> {
  await db.runAsync(
    `INSERT INTO budgets (id, category_id, amount, period, month, year, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      budget.id,
      budget.categoryId,
      budget.amount,
      budget.period,
      budget.month,
      budget.year,
      budget.createdAt,
    ]
  );
}

export async function deleteBudget(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM budgets WHERE id = ?;`, [id]);
}

export async function getBudgetByCategoryAndMonth(
  db: SQLiteDatabase,
  categoryId: string,
  year: number,
  month: number
): Promise<Budget | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM budgets WHERE category_id = ? AND year = ? AND month = ? LIMIT 1;`,
    [categoryId, year, month]
  );
  return row ? rowToBudget(row) : null;
}

export async function updateBudget(
  db: SQLiteDatabase,
  id: string,
  amount: number,
  period: 'monthly' | 'weekly'
): Promise<void> {
  await db.runAsync(
    `UPDATE budgets SET amount = ?, period = ? WHERE id = ?;`,
    [amount, period, id]
  );
}

export async function upsertBudget(db: SQLiteDatabase, budget: Budget): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO budgets (id, category_id, amount, period, month, year, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      budget.id,
      budget.categoryId,
      budget.amount,
      budget.period,
      budget.month,
      budget.year,
      budget.createdAt,
    ]
  );
}
