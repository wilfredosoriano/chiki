/**
 * Pure function — generates AppAlerts from current financial data.
 * No store imports — takes all data as params, returns alert list.
 */
import { differenceInCalendarDays } from '@/utils/dateUtils';
import type { Budget, Loan, SavingsGoal, Transaction } from '@/types';
import type { AppAlert } from '@/stores/alertStore';

function fmt(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function generateAlerts(params: {
  budgets: Budget[];
  transactions: Transaction[];
  loans: Loan[];
  goals: SavingsGoal[];
  categoryNames: Record<string, string>;
}): AppAlert[] {
  const { budgets, transactions, loans, goals, categoryNames } = params;
  const now = new Date();
  const nowIso = now.toISOString();
  const alerts: AppAlert[] = [];

  // ── Budget alerts ──────────────────────────────────────────────────────────
  for (const budget of budgets) {
    const monthStr = String(budget.month).padStart(2, '0');
    const prefix = `${budget.year}-${monthStr}`;

    const spent = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === budget.categoryId &&
          t.date.startsWith(prefix)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const ratio = budget.amount > 0 ? spent / budget.amount : 0;
    const catName = categoryNames[budget.categoryId] ?? budget.categoryId;

    if (ratio >= 1) {
      // Budget exceeded
      const over = spent - budget.amount;
      alerts.push({
        id: `budget_exceeded_${budget.categoryId}_${budget.year}_${budget.month}`,
        kind: 'budget_exceeded',
        title: `${catName} over budget`,
        body: `You spent ${fmt(spent)} — ${fmt(over)} over your ${fmt(budget.amount)} budget`,
        icon: 'alert-circle',
        iconColor: '#F87171',
        createdAt: nowIso,
        isRead: false,
      });
    } else if (ratio >= 0.8) {
      // Budget warning — 80–99%
      const pct = Math.round(ratio * 100);
      alerts.push({
        id: `budget_warning_${budget.categoryId}_${budget.year}_${budget.month}`,
        kind: 'budget_warning',
        title: `${catName} budget at ${pct}%`,
        body: `You've used ${fmt(spent)} of your ${fmt(budget.amount)} budget`,
        icon: 'warning',
        iconColor: '#FCD34D',
        createdAt: nowIso,
        isRead: false,
      });
    }
  }

  // ── Loan due-soon alerts ───────────────────────────────────────────────────
  for (const loan of loans) {
    if (!loan.isActive) continue;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDue = new Date(today.getFullYear(), today.getMonth(), loan.dueDayOfMonth);
    if (nextDue <= today) {
      nextDue = new Date(today.getFullYear(), today.getMonth() + 1, loan.dueDayOfMonth);
    }

    const daysLeft = differenceInCalendarDays(nextDue, today);
    if (daysLeft > 7) continue;

    const dueYear = nextDue.getFullYear();
    const dueMonth = nextDue.getMonth() + 1;

    if (daysLeft === 0) {
      alerts.push({
        id: `loan_due_${loan.id}_${dueYear}_${dueMonth}`,
        kind: 'loan_due',
        title: `${loan.name} payment due today`,
        body: `${fmt(loan.monthlyPayment)} payment due on the ${ordinal(loan.dueDayOfMonth)}`,
        icon: 'calendar',
        iconColor: '#F87171',
        createdAt: nowIso,
        isRead: false,
      });
    } else {
      alerts.push({
        id: `loan_due_${loan.id}_${dueYear}_${dueMonth}`,
        kind: 'loan_due',
        title: `${loan.name} payment due in ${daysLeft} days`,
        body: `${fmt(loan.monthlyPayment)} payment due on the ${ordinal(loan.dueDayOfMonth)}`,
        icon: 'calendar',
        iconColor: '#FCD34D',
        createdAt: nowIso,
        isRead: false,
      });
    }
  }

  // ── Goal milestone alerts (50%) ───────────────────────────────────────────
  for (const goal of goals) {
    const ratio = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
    if (ratio >= 0.5 && ratio < 1) {
      alerts.push({
        id: `goal_milestone_${goal.id}_50`,
        kind: 'goal_milestone',
        title: `${goal.name} halfway there!`,
        body: `You've saved ${fmt(goal.currentAmount)} of your ${fmt(goal.targetAmount)} goal — 50% done 🎯`,
        icon: 'trophy',
        iconColor: '#4ADE80',
        createdAt: nowIso,
        isRead: false,
      });
    }
  }

  // Sort: unread first, then by createdAt descending (all same timestamp here,
  // so secondary sort by id for stability)
  alerts.sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    const timeDiff = b.createdAt.localeCompare(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  return alerts;
}
