/**
 * Seeds default categories on first launch.
 * Only runs if the categories table is empty.
 */
import { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/constants';

export async function seedDefaultData(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM categories;`
  );
  if (row && row.count > 0) return; // already seeded

  const all = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: 'expense' as const })),
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c, type: 'income' as const })),
  ];

  for (const cat of all) {
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, color, type, is_default) VALUES (?, ?, ?, ?, ?, 1);`,
      [cat.id, cat.name, cat.icon, cat.color, cat.type]
    );
  }
}
