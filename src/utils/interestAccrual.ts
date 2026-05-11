import { SQLiteDatabase } from 'expo-sqlite';
import { getAllAccounts } from '@/db/accountQueries';
import { updateAccountBalance } from '@/db/accountQueries';
import type { Account } from '@/types';

function daysBetween(a: string, b: string): number {
  const dateA = new Date(a);
  const dateB = new Date(b);
  const diffMs = dateB.getTime() - dateA.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function applyDailyInterest(
  db: SQLiteDatabase,
  setAccounts: (accounts: Account[]) => void
): Promise<void> {
  const accounts = await getAllAccounts(db);
  const today = todayString();

  for (const account of accounts) {
    const rate = account.interestRatePA;
    if (!rate || rate <= 0) continue;
    if (account.type !== 'savings' && account.type !== 'investment') continue;

    // Read last_interest_date from DB (not in Account type, query directly)
    const row = await db.getFirstAsync<{ last_interest_date: string | null }>(
      `SELECT last_interest_date FROM accounts WHERE id = ?;`,
      [account.id]
    );
    const lastDate = row?.last_interest_date ?? null;

    if (lastDate === today) continue;

    const days = lastDate ? daysBetween(lastDate, today) : 1;
    const newBalance = Math.round(account.balance * Math.pow(1 + rate / 100 / 365, days) * 100) / 100;

    await updateAccountBalance(db, account.id, newBalance);
    await db.runAsync(
      `UPDATE accounts SET last_interest_date = ? WHERE id = ?;`,
      [today, account.id]
    );
  }

  const freshAccounts = await getAllAccounts(db);
  setAccounts(freshAccounts);
}
