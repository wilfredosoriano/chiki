import { SQLiteDatabase } from 'expo-sqlite';
import type { Category } from '@/types';

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    type: row.type as 'income' | 'expense',
    isDefault: row.is_default === 1,
  };
}

export async function getAllCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM categories ORDER BY name ASC;`
  );
  return rows.map(rowToCategory);
}

export async function getCategoriesByType(
  db: SQLiteDatabase,
  type: 'income' | 'expense'
): Promise<Category[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM categories WHERE type = ? ORDER BY name ASC;`,
    [type]
  );
  return rows.map(rowToCategory);
}
