/**
 * Chiki command parser — rule-based NLP for natural language financial commands.
 * No LLM. Pure regex + fuzzy matching against real user data.
 *
 * Handles: accounts, transfers, loans, savings goals, spending/income queries.
 */
import type { Account, Transaction, Loan, SavingsGoal } from '@/types';
import { getDatabase } from '@/db/database';
import { updateAccountBalance } from '@/db/accountQueries';
import { insertTransaction } from '@/db/transactionQueries';
import { getAllLoans, updateLoanBalance } from '@/db/loanQueries';
import { getAllGoals, updateGoalAmount } from '@/db/goalQueries';
import { useAccountStore } from '@/stores/accountStore';
import { useTransactionStore } from '@/stores/transactionStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return toLocalISO(new Date());
}

function toISO(d: Date): string {
  return toLocalISO(d);
}

function formatAmt(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Next due date for a given day-of-month */
function getNextDueDate(dueDayOfMonth: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), today.getMonth(), dueDayOfMonth);
  if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, dueDayOfMonth);
  return next;
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

export function parseDate(input: string): { iso: string; label: string; rest: string } {
  const s = input.trim();
  const now = new Date();
  const currentYear = now.getFullYear();

  const yRe = /\byesterday\b/i;
  if (yRe.test(s)) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    return { iso: toISO(d), label: 'yesterday', rest: s.replace(yRe, '').trim() };
  }

  const tRe = /\btoday\b/i;
  if (tRe.test(s))
    return { iso: todayISO(), label: 'today', rest: s.replace(tRe, '').trim() };

  const dowRe = /\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const dowM = s.match(dowRe);
  if (dowM) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = days.indexOf(dowM[1].toLowerCase());
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() - target + 7) % 7 || 7));
    return { iso: toISO(d), label: dowM[0], rest: s.replace(dowRe, '').trim() };
  }

  const mdyRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:[,\s]+(\d{4}))?\b/i;
  const mdyM = s.match(mdyRe);
  if (mdyM) {
    const month = MONTHS[mdyM[1].toLowerCase()];
    const day = parseInt(mdyM[2], 10);
    const year = mdyM[3] ? parseInt(mdyM[3], 10) : currentYear;
    const d = new Date(year, month - 1, day);
    if (!mdyM[3] && d > now) d.setFullYear(year - 1);
    return { iso: toISO(d), label: mdyM[0].trim(), rest: s.replace(mdyRe, '').trim() };
  }

  return { iso: todayISO(), label: 'today', rest: s };
}

export function parseAmount(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/,/g, '');
  const multipliers: [RegExp, number][] = [
    [/(\d+(\.\d+)?)\s*m(illion)?$/, 1_000_000],
    [/(\d+(\.\d+)?)\s*(k|thousand)$/, 1_000],
  ];
  for (const [re, mul] of multipliers) {
    const m = s.match(re);
    if (m) return parseFloat(m[1]) * mul;
  }
  const plain = parseFloat(s);
  return isNaN(plain) ? null : plain;
}

function cleanAccountName(raw: string): string {
  return raw
    .replace(/\byesterday\b/gi, '')
    .replace(/\btoday\b/gi, '')
    .replace(/\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(,?\s*\d{4})?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findAccount(accounts: Account[], query: string): Account | null {
  const q = query.toLowerCase().trim();
  const exact = accounts.find((a) => a.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = accounts.filter((a) => a.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  const starts = accounts.filter((a) => a.name.toLowerCase().startsWith(q));
  if (starts.length === 1) return starts[0];
  if (partial.length > 1) return partial.sort((a, b) => a.name.length - b.name.length)[0];
  return null;
}

function findLoan(loans: Loan[], query: string): Loan | null {
  const q = query.toLowerCase().trim();
  const exact = loans.find((l) => l.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = loans.filter((l) => l.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  const starts = loans.filter((l) => l.name.toLowerCase().startsWith(q));
  if (starts.length === 1) return starts[0];
  if (partial.length > 1) return partial.sort((a, b) => a.name.length - b.name.length)[0];
  // Also match lender name
  const lender = loans.filter((l) => l.lender?.toLowerCase().includes(q));
  if (lender.length === 1) return lender[0];
  return null;
}

function findGoal(goals: SavingsGoal[], query: string): SavingsGoal | null {
  const q = query.toLowerCase().trim();
  const exact = goals.find((g) => g.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = goals.filter((g) => g.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  const starts = goals.filter((g) => g.name.toLowerCase().startsWith(q));
  if (starts.length === 1) return starts[0];
  if (partial.length > 1) return partial.sort((a, b) => a.name.length - b.name.length)[0];
  return null;
}

// ─── Intent types ────────────────────────────────────────────────────────────

export type ChikiIntent =
  | { type: 'transfer';      amount: number; fromRaw: string; toRaw: string; date: string; dateLabel: string }
  | { type: 'add_income';    amount: number; accountRaw: string; date: string; dateLabel: string; note?: string }
  | { type: 'add_expense';   amount: number; accountRaw: string; date: string; dateLabel: string; note?: string }
  | { type: 'balance';       accountRaw?: string }
  | { type: 'networth' }
  // ── Loans ──
  | { type: 'loan_owe';      loanRaw: string }
  | { type: 'loan_due';      loanRaw: string }
  | { type: 'loan_list' }
  | { type: 'loan_pay';      loanRaw: string; accountRaw: string; amount?: number }
  // ── Goals ──
  | { type: 'goal_check';    goalRaw: string }
  | { type: 'goal_list' }
  // ── Spending / income ──
  | { type: 'spending_query'; period: 'today' | 'week' | 'month' }
  | { type: 'income_query';   period: 'today' | 'week' | 'month' }
  | { type: 'help' }
  | { type: 'unknown' };

export type ChikiResultStatus = 'success' | 'error' | 'info';
export interface ChikiResult {
  status: ChikiResultStatus;
  message: string;
  mood: 'happy' | 'sad' | 'warning' | 'thinking' | 'neutral';
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseCommand(input: string): ChikiIntent {
  const { iso: date, label: dateLabel, rest } = parseDate(input);
  const s = rest.trim().toLowerCase();

  // ── Transfer ──
  const transferRe = /^(transfer|move|send|remit)\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+)$/i;
  const tm = s.match(transferRe);
  if (tm) {
    const amount = parseAmount(tm[2]);
    if (amount && amount > 0)
      return { type: 'transfer', amount, fromRaw: cleanAccountName(tm[3]), toRaw: cleanAccountName(tm[4]), date, dateLabel };
  }

  // ── Loan pay: "pay SSS loan from GCash" / "pay 756 on SSS loan from GCash" ──
  const loanPayAmtRe = /^pay\s+(.+?)\s+(?:on|for)\s+(.+?)\s+from\s+(.+)$/i;
  const lpm = s.match(loanPayAmtRe);
  if (lpm) {
    const amount = parseAmount(lpm[1]);
    if (amount && amount > 0)
      return { type: 'loan_pay', loanRaw: lpm[2].trim(), accountRaw: cleanAccountName(lpm[3]), amount };
  }
  const loanPayRe = /^pay\s+(.+?)\s+(?:loan\s+)?from\s+(.+)$/i;
  const lp = s.match(loanPayRe);
  if (lp) {
    // Make sure it's not an account transfer ("pay 5000 from BDO")
    const maybeAmount = parseAmount(lp[1]);
    if (!maybeAmount)
      return { type: 'loan_pay', loanRaw: lp[1].trim(), accountRaw: cleanAccountName(lp[2]) };
  }

  // ── Add income ──
  const addRe = /^(add|deposit|put|credit|received?|got)\s+(.+?)\s+(to|in|into|on)\s+(.+)$/i;
  const am = s.match(addRe);
  if (am) {
    const amount = parseAmount(am[2]);
    if (amount && amount > 0)
      return { type: 'add_income', amount, accountRaw: cleanAccountName(am[4]), date, dateLabel };
  }

  // ── Add expense ──
  const removeRe = /^(remove|spend|deduct|withdraw|paid?|use|charge|bought?|purchase[d]?)\s+(.+?)\s+(from|in|on|using?)\s+(.+)$/i;
  const rm = s.match(removeRe);
  if (rm) {
    const amount = parseAmount(rm[2]);
    if (amount && amount > 0)
      return { type: 'add_expense', amount, accountRaw: cleanAccountName(rm[4]), date, dateLabel };
  }

  // ── Loan owe / remaining ──
  const loanOweRe = /(?:how much|what).{0,20}(?:owe|left|remaining|balance).{0,20}(?:on|for|of|my)?\s+(.+?)(?:\s+loan)?$/i;
  const lom = s.match(loanOweRe);
  if (lom && !s.includes('account')) return { type: 'loan_owe', loanRaw: lom[1].trim() };

  const loanBalRe = /^(?:loan\s+)?(?:balance|remaining)\s+(?:of|for|on)\s+(.+)$/i;
  const lbm = s.match(loanBalRe);
  if (lbm) return { type: 'loan_owe', loanRaw: lbm[1].trim() };

  const loanRemainingRe = /^(.+?)\s+(?:loan\s+)?(?:balance|remaining|owe|left)$/i;
  const lrm = s.match(loanRemainingRe);
  if (lrm && !s.includes('account')) return { type: 'loan_owe', loanRaw: lrm[1].trim() };

  // ── Loan due date ──
  const loanDueRe = /(?:when|due|next payment).{0,20}(?:for|on|of|my)?\s+(.+?)(?:\s+loan)?(?:\s+due)?$/i;
  const ldm = s.match(loanDueRe);
  if (ldm && /when|due|next payment/i.test(s))
    return { type: 'loan_due', loanRaw: ldm[1].trim() };

  // ── Loan list ──
  if (/(?:show|list|all|my)\s+loans?|loans?\s+(?:list|summary)/i.test(s))
    return { type: 'loan_list' };

  // ── Goal check ──
  const goalCheckRe = /(?:how much|what).{0,20}(?:saved?|progress|goal).{0,20}(?:for|on|of|my)?\s+(.+)$/i;
  const gcm = s.match(goalCheckRe);
  if (gcm) return { type: 'goal_check', goalRaw: gcm[1].trim() };

  const goalBalRe = /^(.+?)\s+(?:goal|savings?)\s+(?:progress|balance|status|amount)?$/i;
  const gbm = s.match(goalBalRe);
  if (gbm) return { type: 'goal_check', goalRaw: gbm[1].trim() };

  // ── Goal list ──
  if (/(?:show|list|all|my)\s+(?:savings\s+)?goals?|goals?\s+(?:list|summary)/i.test(s))
    return { type: 'goal_list' };

  // ── Spending query ──
  if (/(?:spend|spent|expense|expenses|cost)\s.{0,20}(?:today)/i.test(s))
    return { type: 'spending_query', period: 'today' };
  if (/(?:spend|spent|expense|expenses|cost)\s.{0,20}(?:week|7 days)/i.test(s))
    return { type: 'spending_query', period: 'week' };
  if (/(?:how much|total)?.{0,10}(?:spend|spent|expense|expenses)\s.{0,20}(?:month|this month)/i.test(s)
    || /(?:this month|monthly)\s.{0,15}(?:spend|spent|expense)/i.test(s))
    return { type: 'spending_query', period: 'month' };

  // ── Income query ──
  if (/(?:earn|earned|income|received|salary)\s.{0,20}today/i.test(s))
    return { type: 'income_query', period: 'today' };
  if (/(?:earn|earned|income|received|salary)\s.{0,20}(?:week|7 days)/i.test(s))
    return { type: 'income_query', period: 'week' };
  if (/(?:how much|total)?.{0,10}(?:earn|earned|income|received)\s.{0,20}(?:month|this month)/i.test(s)
    || /(?:this month|monthly)\s.{0,15}(?:earn|income)/i.test(s))
    return { type: 'income_query', period: 'month' };

  // ── Balance check ──
  const balanceRe1 = /^(balance|how much|check).+(in|of|for|on)\s+(.+)$/i;
  const bm1 = s.match(balanceRe1);
  if (bm1) return { type: 'balance', accountRaw: bm1[3].trim() };

  const balanceRe2 = /^(.+)\s+balance$/i;
  const bm2 = s.match(balanceRe2);
  if (bm2) return { type: 'balance', accountRaw: bm2[1].trim() };

  // ── Net worth ──
  if (/net\s*worth|total\s*balance|total\s*assets|overall\s*balance|all\s*balance/i.test(s))
    return { type: 'networth' };

  // ── Help ──
  if (/^help|what can you do|commands?/i.test(s))
    return { type: 'help' };

  return { type: 'unknown' };
}

// ─── Executor ────────────────────────────────────────────────────────────────

export async function executeCommand(input: string): Promise<ChikiResult> {
  const intent = parseCommand(input);
  const { accounts, updateAccount } = useAccountStore.getState();
  const { addTransaction, transactions } = useTransactionStore.getState();

  switch (intent.type) {

    // ────────────────────────────────────────────────────────────────────────
    // ACCOUNTS
    // ────────────────────────────────────────────────────────────────────────

    case 'transfer': {
      const from = findAccount(accounts, intent.fromRaw);
      const to   = findAccount(accounts, intent.toRaw);
      if (!from && !to)
        return { status: 'error', mood: 'sad', message: `I can't find accounts named "${intent.fromRaw}" or "${intent.toRaw}". Check your account names in Settings.` };
      if (!from)
        return { status: 'error', mood: 'sad', message: `I can't find an account called "${intent.fromRaw}". Maybe you meant something else?` };
      if (!to)
        return { status: 'error', mood: 'sad', message: `I can't find an account called "${intent.toRaw}". Did you mean a different account?` };
      if (from.id === to.id)
        return { status: 'error', mood: 'warning', message: `You can't transfer to the same account! Pick a different destination.` };
      if (from.balance < intent.amount)
        return { status: 'error', mood: 'sad', message: `${from.name} only has ${formatAmt(from.balance)}. Not enough to transfer ${formatAmt(intent.amount)}.` };

      const db = await getDatabase();
      const now = new Date().toISOString();
      await updateAccountBalance(db, from.id, from.balance - intent.amount);
      await updateAccountBalance(db, to.id, to.balance + intent.amount);
      updateAccount(from.id, { balance: from.balance - intent.amount });
      updateAccount(to.id,   { balance: to.balance   + intent.amount });

      const tx: Transaction = {
        id: genId(), accountId: from.id, toAccountId: to.id,
        type: 'transfer', amount: intent.amount, categoryId: 'cat_other',
        note: `${from.name} → ${to.name}`,
        date: intent.date, isRecurring: false, createdAt: now, updatedAt: now,
      };
      await insertTransaction(db, tx);
      addTransaction(tx);

      return {
        status: 'success', mood: 'happy',
        message: `Done! Transferred ${formatAmt(intent.amount)} from ${from.name} to ${to.name} (${intent.dateLabel}). 🎉\n\n${from.name}: ${formatAmt(from.balance - intent.amount)}\n${to.name}: ${formatAmt(to.balance + intent.amount)}`,
      };
    }

    case 'add_income': {
      const acct = findAccount(accounts, intent.accountRaw);
      if (!acct)
        return { status: 'error', mood: 'sad', message: `Can't find account "${intent.accountRaw}". Check your account names!` };

      const db = await getDatabase();
      const now = new Date().toISOString();
      await updateAccountBalance(db, acct.id, acct.balance + intent.amount);
      updateAccount(acct.id, { balance: acct.balance + intent.amount });

      const tx: Transaction = {
        id: genId(), accountId: acct.id, type: 'income',
        amount: intent.amount, categoryId: 'cat_other_income',
        note: intent.note ?? 'Chiki: Income',
        date: intent.date, isRecurring: false, createdAt: now, updatedAt: now,
      };
      await insertTransaction(db, tx);
      addTransaction(tx);

      return {
        status: 'success', mood: 'happy',
        message: `Added ${formatAmt(intent.amount)} to ${acct.name} (${intent.dateLabel})! 💰\n\nNew balance: ${formatAmt(acct.balance + intent.amount)}`,
      };
    }

    case 'add_expense': {
      const acct = findAccount(accounts, intent.accountRaw);
      if (!acct)
        return { status: 'error', mood: 'sad', message: `Can't find account "${intent.accountRaw}". Check your account names!` };
      if (acct.balance < intent.amount)
        return { status: 'error', mood: 'warning', message: `${acct.name} only has ${formatAmt(acct.balance)}. Not enough to deduct ${formatAmt(intent.amount)}.` };

      const db = await getDatabase();
      const now = new Date().toISOString();
      await updateAccountBalance(db, acct.id, acct.balance - intent.amount);
      updateAccount(acct.id, { balance: acct.balance - intent.amount });

      const tx: Transaction = {
        id: genId(), accountId: acct.id, type: 'expense',
        amount: intent.amount, categoryId: 'cat_other',
        note: intent.note ?? 'Chiki: Expense',
        date: intent.date, isRecurring: false, createdAt: now, updatedAt: now,
      };
      await insertTransaction(db, tx);
      addTransaction(tx);

      return {
        status: 'success', mood: 'happy',
        message: `Got it! Deducted ${formatAmt(intent.amount)} from ${acct.name} (${intent.dateLabel}).\n\nNew balance: ${formatAmt(acct.balance - intent.amount)}`,
      };
    }

    case 'balance': {
      if (!intent.accountRaw) {
        const lines = accounts.map((a) => `${a.name}: ${formatAmt(a.balance)}`).join('\n');
        return { status: 'info', mood: 'neutral', message: `Here are all your balances:\n\n${lines}` };
      }
      const acct = findAccount(accounts, intent.accountRaw);
      if (!acct)
        return { status: 'error', mood: 'sad', message: `Can't find account "${intent.accountRaw}".` };
      return { status: 'info', mood: 'neutral', message: `${acct.name} has ${formatAmt(acct.balance)}.` };
    }

    case 'networth': {
      const total = accounts.filter((a) => a.includeInNetWorth).reduce((sum, a) => sum + a.balance, 0);
      const lines = accounts.filter((a) => a.includeInNetWorth).map((a) => `${a.name}: ${formatAmt(a.balance)}`).join('\n');
      return { status: 'info', mood: 'neutral', message: `Your net worth is ${formatAmt(total)}.\n\n${lines}` };
    }

    // ────────────────────────────────────────────────────────────────────────
    // LOANS
    // ────────────────────────────────────────────────────────────────────────

    case 'loan_owe': {
      const db = await getDatabase();
      const loans = await getAllLoans(db);
      const activeLoans = loans.filter((l) => l.isActive);
      const loan = findLoan(activeLoans, intent.loanRaw);
      if (!loan) {
        const names = activeLoans.map((l) => `• ${l.name}`).join('\n');
        return { status: 'error', mood: 'sad', message: `I can't find a loan called "${intent.loanRaw}".\n\nYour active loans:\n${names || 'None yet!'}` };
      }
      const nextDue = getNextDueDate(loan.dueDayOfMonth);
      const days = daysUntil(nextDue);
      const dueMsg = days === 0 ? 'due today!' : days === 1 ? 'due tomorrow!' : `due in ${days} days`;
      return {
        status: 'info', mood: 'neutral',
        message: `${loan.name}\n\n💰 Remaining: ${formatAmt(loan.remainingBalance)}\n📅 Monthly: ${formatAmt(loan.monthlyPayment)}\n⏰ Next payment ${dueMsg} (${ordinal(loan.dueDayOfMonth)} of the month)${loan.lender ? `\n🏦 Lender: ${loan.lender}` : ''}`,
      };
    }

    case 'loan_due': {
      const db = await getDatabase();
      const loans = await getAllLoans(db);
      const activeLoans = loans.filter((l) => l.isActive);
      const loan = findLoan(activeLoans, intent.loanRaw);
      if (!loan) {
        const names = activeLoans.map((l) => `• ${l.name}`).join('\n');
        return { status: 'error', mood: 'sad', message: `I can't find a loan called "${intent.loanRaw}".\n\nYour active loans:\n${names || 'None yet!'}` };
      }
      const nextDue = getNextDueDate(loan.dueDayOfMonth);
      const days = daysUntil(nextDue);
      const dayName = nextDue.toLocaleDateString('en-PH', { weekday: 'long' });
      const dateStr = nextDue.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' });
      const urgency = days === 0 ? '🔴 Due today!' : days <= 3 ? `🔴 ${days} day${days > 1 ? 's' : ''} left — very soon!` : days <= 7 ? `🟡 ${days} days left` : `🟢 ${days} days left`;
      return {
        status: 'info', mood: days <= 3 ? 'warning' : 'neutral',
        message: `${loan.name} payment\n\n📅 ${dateStr} (${dayName})\n${urgency}\n💰 Amount due: ${formatAmt(loan.monthlyPayment)}`,
      };
    }

    case 'loan_list': {
      const db = await getDatabase();
      const loans = await getAllLoans(db);
      const activeLoans = loans.filter((l) => l.isActive);
      if (activeLoans.length === 0)
        return { status: 'info', mood: 'happy', message: `You have no active loans! 🎉 You're debt-free!` };

      const total = activeLoans.reduce((s, l) => s + l.remainingBalance, 0);
      const lines = activeLoans.map((l) => {
        const days = daysUntil(getNextDueDate(l.dueDayOfMonth));
        const due = days === 0 ? '🔴 due today' : days <= 3 ? `🔴 due in ${days}d` : days <= 7 ? `🟡 due in ${days}d` : `🟢 due in ${days}d`;
        return `• ${l.name} — ${formatAmt(l.remainingBalance)} (${due})`;
      }).join('\n');

      return {
        status: 'info', mood: 'neutral',
        message: `You have ${activeLoans.length} active loan${activeLoans.length > 1 ? 's' : ''}:\n\n${lines}\n\nTotal owed: ${formatAmt(total)}`,
      };
    }

    case 'loan_pay': {
      const db = await getDatabase();
      const loans = await getAllLoans(db);
      const activeLoans = loans.filter((l) => l.isActive);
      const loan = findLoan(activeLoans, intent.loanRaw);
      if (!loan) {
        const names = activeLoans.map((l) => `• ${l.name}`).join('\n');
        return { status: 'error', mood: 'sad', message: `I can't find a loan called "${intent.loanRaw}".\n\nYour active loans:\n${names || 'None yet!'}` };
      }
      const acct = findAccount(accounts, intent.accountRaw);
      if (!acct)
        return { status: 'error', mood: 'sad', message: `Can't find account "${intent.accountRaw}". Check your account names!` };

      const payAmount = intent.amount ?? loan.monthlyPayment;
      if (acct.balance < payAmount)
        return { status: 'error', mood: 'sad', message: `${acct.name} only has ${formatAmt(acct.balance)}, but ${loan.name} payment is ${formatAmt(payAmount)}. Not enough!` };

      const now = new Date().toISOString();
      const localDate = todayISO();

      // Deduct from account
      const newAcctBalance = Math.round((acct.balance - payAmount) * 100) / 100;
      await updateAccountBalance(db, acct.id, newAcctBalance);
      updateAccount(acct.id, { balance: newAcctBalance });

      // Reduce loan balance
      const newLoanBalance = Math.max(0, Math.round((loan.remainingBalance - payAmount) * 100) / 100);
      await updateLoanBalance(db, loan.id, newLoanBalance);

      // Record transaction
      const tx: Transaction = {
        id: genId(), accountId: acct.id, type: 'expense',
        amount: payAmount, categoryId: 'cat_loan_payment',
        note: `Loan Payment: ${loan.name}`,
        date: localDate, isRecurring: false, createdAt: now, updatedAt: now,
      };
      await insertTransaction(db, tx);
      addTransaction(tx);

      const isPaidOff = newLoanBalance === 0;
      return {
        status: 'success', mood: isPaidOff ? 'happy' : 'happy',
        message: isPaidOff
          ? `🎉 ${loan.name} is fully paid off! Amazing job!\n\n${acct.name} new balance: ${formatAmt(newAcctBalance)}`
          : `Paid ${formatAmt(payAmount)} for ${loan.name} from ${acct.name}! ✅\n\n${loan.name} remaining: ${formatAmt(newLoanBalance)}\n${acct.name} new balance: ${formatAmt(newAcctBalance)}`,
      };
    }

    // ────────────────────────────────────────────────────────────────────────
    // GOALS
    // ────────────────────────────────────────────────────────────────────────

    case 'goal_check': {
      const db = await getDatabase();
      const goals = await getAllGoals(db);
      const goal = findGoal(goals, intent.goalRaw);
      if (!goal) {
        const names = goals.map((g) => `• ${g.name}`).join('\n');
        return { status: 'error', mood: 'sad', message: `I can't find a goal called "${intent.goalRaw}".\n\nYour goals:\n${names || 'No goals yet!'}` };
      }
      const pct = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
      const remaining = goal.targetAmount - goal.currentAmount;
      const isComplete = goal.currentAmount >= goal.targetAmount;
      return {
        status: 'info', mood: isComplete ? 'happy' : 'neutral',
        message: isComplete
          ? `🎉 ${goal.name} is complete! You've reached your ${formatAmt(goal.targetAmount)} target!`
          : `${goal.name}\n\n✅ Saved: ${formatAmt(goal.currentAmount)}\n🎯 Target: ${formatAmt(goal.targetAmount)}\n📊 Progress: ${pct}%\n💸 Still need: ${formatAmt(remaining)}${goal.targetDate ? `\n📅 Target date: ${new Date(goal.targetDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}`,
      };
    }

    case 'goal_list': {
      const db = await getDatabase();
      const goals = await getAllGoals(db);
      if (goals.length === 0)
        return { status: 'info', mood: 'thinking', message: `You don't have any savings goals yet. Add one from the Goals tab!` };

      const lines = goals.map((g) => {
        const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
        const done = g.currentAmount >= g.targetAmount ? ' ✅' : '';
        return `• ${g.name}${done} — ${formatAmt(g.currentAmount)} / ${formatAmt(g.targetAmount)} (${pct}%)`;
      }).join('\n');

      const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
      return {
        status: 'info', mood: 'neutral',
        message: `Your savings goals:\n\n${lines}\n\nTotal saved: ${formatAmt(totalSaved)}`,
      };
    }

    // ────────────────────────────────────────────────────────────────────────
    // SPENDING / INCOME
    // ────────────────────────────────────────────────────────────────────────

    case 'spending_query': {
      const now = new Date();
      let filtered: typeof transactions;
      let label: string;

      if (intent.period === 'today') {
        const today = todayISO();
        filtered = transactions.filter((t) => t.type === 'expense' && t.date === today);
        label = 'today';
      } else if (intent.period === 'week') {
        const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7);
        filtered = transactions.filter((t) => t.type === 'expense' && t.date >= toISO(cutoff));
        label = 'the last 7 days';
      } else {
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        filtered = transactions.filter((t) => t.type === 'expense' && t.date.startsWith(monthStr));
        label = 'this month';
      }

      const total = filtered.reduce((s, t) => s + t.amount, 0);
      return {
        status: 'info', mood: total === 0 ? 'happy' : 'neutral',
        message: total === 0
          ? `No expenses recorded for ${label} yet!`
          : `You spent ${formatAmt(total)} ${label}. 💸\n\n(${filtered.length} transaction${filtered.length !== 1 ? 's' : ''})`,
      };
    }

    case 'income_query': {
      const now = new Date();
      let filtered: typeof transactions;
      let label: string;

      if (intent.period === 'today') {
        const today = todayISO();
        filtered = transactions.filter((t) => t.type === 'income' && t.date === today && t.note !== 'Initial Balance');
        label = 'today';
      } else if (intent.period === 'week') {
        const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7);
        filtered = transactions.filter((t) => t.type === 'income' && t.date >= toISO(cutoff) && t.note !== 'Initial Balance');
        label = 'the last 7 days';
      } else {
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        filtered = transactions.filter((t) => t.type === 'income' && t.date.startsWith(monthStr) && t.note !== 'Initial Balance');
        label = 'this month';
      }

      const total = filtered.reduce((s, t) => s + t.amount, 0);
      return {
        status: 'info', mood: total === 0 ? 'thinking' : 'happy',
        message: total === 0
          ? `No income recorded for ${label} yet.`
          : `You earned ${formatAmt(total)} ${label}! 💰\n\n(${filtered.length} transaction${filtered.length !== 1 ? 's' : ''})`,
      };
    }

    // ────────────────────────────────────────────────────────────────────────
    // HELP / UNKNOWN
    // ────────────────────────────────────────────────────────────────────────

    case 'help':
      return {
        status: 'info', mood: 'thinking',
        message: `Here's what I can do:\n\n💳 Accounts\n• Transfer 2000 from BDO to GCash\n• Add 5000 to Maya\n• Remove 1500 from Cash\n• Balance of BDO\n• Net worth\n\n🏦 Loans\n• How much do I owe on SSS loan?\n• When is my BDO loan due?\n• Show my loans\n• Pay SSS loan from GCash\n• Pay 756 on SSS loan from GCash\n\n🎯 Goals\n• How much have I saved for Emergency Fund?\n• Show my goals\n\n📊 Spending\n• How much did I spend this month?\n• How much did I earn this month?`,
      };

    default:
      return {
        status: 'error', mood: 'thinking',
        message: `Hmm, I didn't quite get that. 🤔\n\nTry:\n• "How much do I owe on SSS loan?"\n• "Pay SSS loan from GCash"\n• "How much did I spend this month?"\n• "How much saved for Emergency Fund?"\n• Type "help" for everything I can do!`,
      };
  }
}
