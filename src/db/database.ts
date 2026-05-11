/**
 * Database singleton — opens the SQLite database and runs migrations.
 * All data is stored locally on-device. No network required.
 */
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('chiki.db');
  await db.execAsync('PRAGMA journal_mode = WAL;'); // better write performance
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
