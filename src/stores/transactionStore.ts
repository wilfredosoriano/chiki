/**
 * Transaction store — in-memory state for transactions.
 */
import { create } from 'zustand';
import type { Transaction } from '@/types';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;

  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  purgeByAccount: (accountId: string) => void;

  getByAccount: (accountId: string) => Transaction[];
  getByCategory: (categoryId: string) => Transaction[];
  getByDateRange: (from: string, to: string) => Transaction[];
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: true,

  setTransactions: (transactions) => set({ transactions, isLoading: false }),

  addTransaction: (transaction) =>
    set((state) => ({ transactions: [transaction, ...state.transactions] })),

  updateTransaction: (id, patch) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
      ),
    })),

  deleteTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    })),

  purgeByAccount: (accountId) =>
    set((state) => ({
      transactions: state.transactions.filter(
        (t) => t.accountId !== accountId && t.toAccountId !== accountId
      ),
    })),

  getByAccount: (accountId) =>
    get().transactions.filter((t) => t.accountId === accountId),

  getByCategory: (categoryId) =>
    get().transactions.filter((t) => t.categoryId === categoryId),

  getByDateRange: (from, to) =>
    get().transactions.filter((t) => t.date >= from && t.date <= to),
}));
