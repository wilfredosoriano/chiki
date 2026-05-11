import { SQLiteDatabase } from 'expo-sqlite';
import type { Account } from '@/types';

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Account['type'],
    balance: row.balance as number,
    currency: row.currency as string,
    color: row.color as string,
    icon: row.icon as string,
    includeInNetWorth: row.include_in_net_worth === 1,
    bankId: (row.bank_id as string | null) ?? undefined,
    maskedCardNumber: (row.masked_card_number as string | null) ?? undefined,
    sortOrder: (row.sort_order as number | null) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC;`
  );
  return rows.map(rowToAccount);
}

/** Bulk-update sort_order for all accounts in one transaction. orderedIds[0] gets order 0. */
export async function updateAccountSortOrders(
  db: SQLiteDatabase,
  orderedIds: string[]
): Promise<void> {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(
        `UPDATE accounts SET sort_order = ?, updated_at = ? WHERE id = ?;`,
        [i, now, orderedIds[i]]
      );
    }
  });
}

export async function insertAccount(db: SQLiteDatabase, account: Account): Promise<void> {
  await db.runAsync(
    `INSERT INTO accounts
       (id, name, type, balance, currency, color, icon, include_in_net_worth,
        bank_id, masked_card_number, interest_rate_pa, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      account.id,
      account.name,
      account.type,
      account.balance,
      account.currency,
      account.color,
      account.icon,
      account.includeInNetWorth ? 1 : 0,
      account.bankId ?? null,
      account.maskedCardNumber ?? null,
      account.interestRatePA ?? null,
      account.createdAt,
      account.updatedAt,
    ]
  );
}

export async function updateAccount(db: SQLiteDatabase, account: Account): Promise<void> {
  await db.runAsync(
    `UPDATE accounts
     SET name=?, type=?, balance=?, currency=?, color=?, icon=?, include_in_net_worth=?,
         bank_id=?, masked_card_number=?, interest_rate_pa=?, updated_at=?
     WHERE id=?;`,
    [
      account.name,
      account.type,
      account.balance,
      account.currency,
      account.color,
      account.icon,
      account.includeInNetWorth ? 1 : 0,
      account.bankId ?? null,
      account.maskedCardNumber ?? null,
      account.interestRatePA ?? null,
      account.updatedAt,
      account.id,
    ]
  );
}

export async function deleteAccount(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM accounts WHERE id=?;`, [id]);
}

export async function updateAccountBalance(
  db: SQLiteDatabase,
  id: string,
  newBalance: number
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE accounts SET balance=?, updated_at=? WHERE id=?;`,
    [newBalance, now, id]
  );
}
