import { SQLiteDatabase } from 'expo-sqlite';
import type { SavingsGoal } from '@/types';

function rowToGoal(row: Record<string, unknown>): SavingsGoal {
  return {
    id: row.id as string,
    name: row.name as string,
    targetAmount: row.target_amount as number,
    currentAmount: row.current_amount as number,
    targetDate: (row.target_date as string | null) ?? undefined,
    color: row.color as string,
    icon: row.icon as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllGoals(db: SQLiteDatabase): Promise<SavingsGoal[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM savings_goals ORDER BY created_at ASC;`
  );
  return rows.map(rowToGoal);
}

export async function insertGoal(db: SQLiteDatabase, goal: SavingsGoal): Promise<void> {
  await db.runAsync(
    `INSERT INTO savings_goals (id, name, target_amount, current_amount, target_date, color, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      goal.id,
      goal.name,
      goal.targetAmount,
      goal.currentAmount,
      goal.targetDate ?? null,
      goal.color,
      goal.icon,
      goal.createdAt,
      goal.updatedAt,
    ]
  );
}

export async function updateGoal(db: SQLiteDatabase, goal: SavingsGoal): Promise<void> {
  await db.runAsync(
    `UPDATE savings_goals SET name=?, target_amount=?, current_amount=?, target_date=?, color=?, icon=?, updated_at=?
     WHERE id=?;`,
    [
      goal.name,
      goal.targetAmount,
      goal.currentAmount,
      goal.targetDate ?? null,
      goal.color,
      goal.icon,
      goal.updatedAt,
      goal.id,
    ]
  );
}

export async function updateGoalAmount(
  db: SQLiteDatabase,
  id: string,
  amount: number
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE savings_goals SET current_amount=?, updated_at=? WHERE id=?;`,
    [amount, now, id]
  );
}

export async function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM savings_goals WHERE id=?;`, [id]);
}
