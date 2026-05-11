/**
 * Account store — in-memory state for accounts.
 * Persistence is handled by the database layer (op-sqlite).
 */
import { create } from 'zustand';
import type { Account } from '@/types';

interface AccountState {
  accounts: Account[];
  isLoading: boolean;

  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  reorderAccounts: (orderedIds: string[]) => void;

  getTotalBalance: () => number;
  getNetWorth: () => number;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  isLoading: true,

  setAccounts: (accounts) => set({ accounts, isLoading: false }),

  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),

  updateAccount: (id, patch) =>
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
      ),
    })),

  deleteAccount: (id) =>
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    })),

  reorderAccounts: (orderedIds) =>
    set((state) => {
      const map = new Map(state.accounts.map((a) => [a.id, a]));
      const reordered = orderedIds
        .map((id, i) => {
          const a = map.get(id);
          return a ? { ...a, sortOrder: i } : null;
        })
        .filter(Boolean) as Account[];
      return { accounts: reordered };
    }),

  getTotalBalance: () =>
    get().accounts.reduce((sum, a) => sum + a.balance, 0),

  getNetWorth: () =>
    get()
      .accounts.filter((a) => a.includeInNetWorth)
      .reduce((sum, a) => sum + a.balance, 0),
}));
