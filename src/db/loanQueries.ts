import { SQLiteDatabase } from 'expo-sqlite';
import type { Loan } from '@/types';

function rowToLoan(row: Record<string, unknown>): Loan {
  return {
    id: row.id as string,
    name: row.name as string,
    lender: (row.lender as string | null) ?? undefined,
    principalAmount: row.principal_amount as number,
    remainingBalance: row.remaining_balance as number,
    totalPayable: (row.total_payable as number | null) ?? undefined,
    interestRatePA: (row.interest_rate_pa as number | null) ?? undefined,
    monthlyPayment: row.monthly_payment as number,
    dueDayOfMonth: row.due_day_of_month as number,
    isRecurring: row.is_recurring === 1,
    startDate: row.start_date as string,
    endDate: (row.end_date as string | null) ?? undefined,
    color: row.color as string,
    isActive: row.is_active === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllLoans(db: SQLiteDatabase): Promise<Loan[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM loans ORDER BY is_active DESC, created_at DESC;`
  );
  return rows.map(rowToLoan);
}

export async function getActiveLoans(db: SQLiteDatabase): Promise<Loan[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM loans WHERE is_active = 1 ORDER BY due_day_of_month ASC;`
  );
  return rows.map(rowToLoan);
}

export async function insertLoan(db: SQLiteDatabase, loan: Loan): Promise<void> {
  await db.runAsync(
    `INSERT INTO loans
       (id, name, lender, principal_amount, remaining_balance, total_payable,
        interest_rate_pa, monthly_payment, due_day_of_month, is_recurring,
        start_date, end_date, color, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
    [
      loan.id, loan.name, loan.lender ?? null, loan.principalAmount,
      loan.remainingBalance, loan.totalPayable ?? null,
      loan.interestRatePA ?? null, loan.monthlyPayment,
      loan.dueDayOfMonth, loan.isRecurring ? 1 : 0, loan.startDate,
      loan.endDate ?? null, loan.color, loan.createdAt, loan.updatedAt,
    ]
  );
}

export async function updateLoanBalance(
  db: SQLiteDatabase,
  id: string,
  remainingBalance: number
): Promise<void> {
  const now = new Date().toISOString();
  const isActive = remainingBalance > 0 ? 1 : 0;
  await db.runAsync(
    `UPDATE loans SET remaining_balance = ?, is_active = ?, updated_at = ? WHERE id = ?;`,
    [remainingBalance, isActive, now, id]
  );
}

export async function updateLoan(db: SQLiteDatabase, loan: Loan): Promise<void> {
  const now = new Date().toISOString();
  const isActive = loan.remainingBalance > 0 ? 1 : 0;
  await db.runAsync(
    `UPDATE loans SET
       name = ?, lender = ?, principal_amount = ?, remaining_balance = ?,
       total_payable = ?, interest_rate_pa = ?, monthly_payment = ?,
       due_day_of_month = ?, is_recurring = ?, start_date = ?, end_date = ?,
       color = ?, is_active = ?, updated_at = ?
     WHERE id = ?;`,
    [
      loan.name, loan.lender ?? null, loan.principalAmount, loan.remainingBalance,
      loan.totalPayable ?? null, loan.interestRatePA ?? null, loan.monthlyPayment,
      loan.dueDayOfMonth, loan.isRecurring ? 1 : 0, loan.startDate,
      loan.endDate ?? null, loan.color, isActive, now, loan.id,
    ]
  );
}

export async function getLoanById(db: SQLiteDatabase, id: string): Promise<Loan | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM loans WHERE id = ?;`, [id]
  );
  return row ? rowToLoan(row) : null;
}

export async function deleteLoan(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM loans WHERE id = ?;`, [id]);
}
