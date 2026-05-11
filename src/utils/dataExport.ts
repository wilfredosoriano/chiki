/**
 * dataExport.ts — CSV export and JSON backup/restore utilities.
 *
 * Export CSV: all transactions with account name + category columns.
 * Backup:     full snapshot of accounts, transactions, goals, loans, budgets.
 * Restore:    wipe existing data, insert everything from the backup JSON.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';
import { getDatabase } from '@/db/database';
import { getAllAccounts } from '@/db/accountQueries';
import { getAllLoans } from '@/db/loanQueries';
import { getAllGoals } from '@/db/goalQueries';
import { insertAccount } from '@/db/accountQueries';
import { insertTransaction } from '@/db/transactionQueries';
import { upsertBudget } from '@/db/budgetQueries';
import { insertGoal } from '@/db/goalQueries';
import { insertLoan } from '@/db/loanQueries';
import type { Account, Transaction, Budget, SavingsGoal, Loan } from '@/types';

const BACKUP_VERSION = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeCSV(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    amount: row.amount as number,
    period: row.period as Budget['period'],
    month: row.month as number,
    year: row.year as number,
    createdAt: row.created_at as string,
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export async function exportTransactionsCSV(): Promise<void> {
  try {
    const db = await getDatabase();

    // Fetch all transactions (no limit)
    const txRows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM transactions ORDER BY date DESC, created_at DESC;'
    );
    const transactions = txRows.map(rowToTransaction);

    // Build account name lookup
    const accounts = await getAllAccounts(db);
    const accountMap: Record<string, string> = {};
    accounts.forEach((a) => { accountMap[a.id] = a.name; });

    // Fetch categories for lookup
    const catRows = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT id, name FROM categories;'
    );
    const categoryMap: Record<string, string> = {};
    catRows.forEach((c) => { categoryMap[c.id] = c.name; });

    // Build CSV
    const header = ['Date', 'Type', 'Amount', 'Account', 'Category', 'Note', 'Tags'].join(',');
    const dataRows = transactions.map((tx) => {
      return [
        escapeCSV(tx.date),
        escapeCSV(tx.type),
        escapeCSV(tx.amount),
        escapeCSV(accountMap[tx.accountId] ?? tx.accountId),
        escapeCSV(categoryMap[tx.categoryId] ?? tx.categoryId),
        escapeCSV(tx.note ?? ''),
        escapeCSV((tx.tags ?? []).join('; ')),
      ].join(',');
    });

    // Prepend UTF-8 BOM so Excel/Sheets correctly reads ₱ and Filipino chars
    const csv = '\uFEFF' + [header, ...dataRows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `chiki-transactions-${dateStr}.csv`;

    if (Platform.OS === 'android') {
      // Android: let user pick a folder (Downloads, Drive, etc.) via SAF
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(
        perm.directoryUri, fileName, 'text/csv'
      );
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      Alert.alert('Exported ✓', `Transactions saved to your chosen folder as ${fileName}`);
    } else {
      // iOS: write to cache then share to Files app
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Save Transactions CSV',
        UTI: 'public.comma-separated-values-text',
      });
    }
  } catch (e: unknown) {
    Alert.alert('Export Failed', e instanceof Error ? e.message : String(e));
  }
}

// ─── Backup ───────────────────────────────────────────────────────────────────

export async function createBackup(customName?: string): Promise<void> {
  try {
    const db = await getDatabase();

    const accounts = await getAllAccounts(db);
    const goals    = await getAllGoals(db);
    const loans    = await getAllLoans(db);

    const txRows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM transactions ORDER BY date DESC;'
    );
    const transactions = txRows.map(rowToTransaction);

    const budgetRows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM budgets;'
    );
    const budgets = budgetRows.map(rowToBudget);

    const backup = {
      version:      BACKUP_VERSION,
      exportedAt:   new Date().toISOString(),
      accounts,
      transactions,
      budgets,
      goals,
      loans,
    };

    const json = JSON.stringify(backup, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    // Use custom name if provided, sanitise it, then append .json
    const safeName = customName?.trim()
      ? customName.trim().replace(/[^a-zA-Z0-9._\- ]/g, '').replace(/\s+/g, '-')
      : `chiki-backup-${dateStr}`;
    const fileName = safeName.endsWith('.json') ? safeName : `${safeName}.json`;

    if (Platform.OS === 'android') {
      // Android: let user pick a folder via SAF
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(
        perm.directoryUri, fileName, 'application/json'
      );
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
      Alert.alert('Backup Saved ✓', `Backup saved to your chosen folder as ${fileName}`);
    } else {
      // iOS: write to cache then share to Files app
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Save Backup',
        UTI: 'public.json',
      });
    }
  } catch (e: unknown) {
    Alert.alert('Backup Failed', e instanceof Error ? e.message : String(e));
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export async function restoreBackup(
  onRestoreComplete: () => void
): Promise<void> {
  try {
    // Pick the backup file — use */* so Android shows all files including .json
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const uri = asset.uri;

    // Guard: must be a .json file
    const fileName = asset.name ?? '';
    if (!fileName.toLowerCase().endsWith('.json')) {
      Alert.alert(
        'Wrong File',
        `You selected "${fileName}".\n\nPlease select the Chiki backup file — it ends in .json (e.g. chiki-backup-2026-05-01.json), not the .csv export file.`
      );
      return;
    }

    // Use fetch() — handles both file:// and content:// URIs on Android
    let raw: string;
    try {
      const response = await fetch(uri);
      raw = await response.text();
    } catch {
      // Fallback to FileSystem for iOS file:// URIs
      raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
    }

    let backup: {
      version: number;
      accounts: Account[];
      transactions: Transaction[];
      budgets: Budget[];
      goals: SavingsGoal[];
      loans: Loan[];
    };

    try {
      backup = JSON.parse(raw);
    } catch {
      Alert.alert('Invalid File', 'The selected file is not a valid Chiki backup. Please select the correct .json backup file.');
      return;
    }

    if (!backup.version || !Array.isArray(backup.accounts)) {
      Alert.alert('Invalid Backup', 'This file does not appear to be a Chiki backup file.');
      return;
    }

    // Confirm restore
    Alert.alert(
      'Restore Backup',
      `This will replace all current data with the backup from ${backup.accounts.length} accounts and ${backup.transactions?.length ?? 0} transactions.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();

              // Wipe existing data
              for (const sql of [
                'DELETE FROM transactions;',
                'DELETE FROM budgets;',
                'DELETE FROM savings_goals;',
                'DELETE FROM loans;',
                'DELETE FROM accounts;',
              ]) {
                await db.execAsync(sql);
              }

              // Insert accounts first (FK parent)
              for (const account of backup.accounts ?? []) {
                await insertAccount(db, account);
              }

              // Insert transactions
              for (const tx of backup.transactions ?? []) {
                await insertTransaction(db, tx);
              }

              // Insert budgets
              for (const budget of backup.budgets ?? []) {
                await upsertBudget(db, budget);
              }

              // Insert goals
              for (const goal of backup.goals ?? []) {
                await insertGoal(db, goal);
              }

              // Insert loans
              for (const loan of backup.loans ?? []) {
                await insertLoan(db, loan);
              }

              Alert.alert('Restore Complete', 'Your data has been restored. Restart the app to see all changes.');
              onRestoreComplete();
            } catch (e: unknown) {
              Alert.alert('Restore Failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  } catch (e: unknown) {
    // User cancelled picker — don't show error
    if (String(e).includes('cancel') || String(e).includes('Cancel')) return;
    Alert.alert('Restore Failed', e instanceof Error ? e.message : String(e));
  }
}
