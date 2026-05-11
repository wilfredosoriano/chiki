/**
 * Offline AI Insights — rule-based engine.
 * Pure function: no stores, no side effects, no network.
 * Takes all financial data as params, returns ranked insight cards.
 */
import { subMonths, format, getDaysInMonth, getDay } from '@/utils/dateUtils';
import type { Transaction, Budget, Loan, SavingsGoal, Account } from '@/types';

export interface Insight {
  id: string;
  icon: string;        // Ionicons glyph
  title: string;
  body: string;
  accentColor: string;
  priority: number;    // lower = show first
}

interface Params {
  transactions: Transaction[];
  budgets: Budget[];
  loans: Loan[];
  goals: SavingsGoal[];
  accounts: Account[];
  categoryNames: Record<string, string>;
}

function fmt(n: number): string {
  return '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format a change percentage in a human-readable way.
 * < 200%  → "85%"
 * 200–499% → "2.4x"
 * 500%+   → "way more" (avoids absurd numbers)
 */
function fmtPct(pct: number): string {
  if (pct < 200) return `${pct}%`;
  const multiplier = pct / 100;
  if (multiplier >= 5) return 'significantly more';
  return `${multiplier.toFixed(1).replace(/\.0$/, '')}x`;
}

function pctLabel(pct: number, direction: 'up' | 'down'): string {
  if (pct < 200) return `${direction === 'up' ? 'up' : 'down'} ${pct}%`;
  const multiplier = pct / 100;
  if (multiplier >= 5) return direction === 'up' ? 'way up' : 'way down';
  return `${multiplier.toFixed(1).replace(/\.0$/, '')}x ${direction === 'up' ? 'higher' : 'lower'}`;
}

function monthPrefix(date: Date): string {
  return format(date, 'yyyy-MM');
}

function catName(id: string, names: Record<string, string>): string {
  return names[id] ?? 'Unknown';
}

export function generateInsights(params: Params): Insight[] {
  const { transactions, budgets, loans, goals, accounts, categoryNames } = params;
  const insights: Insight[] = [];
  const now = new Date();
  const thisMonth = monthPrefix(now);
  const lastMonthDate = subMonths(now, 1);
  const lastMonth = monthPrefix(lastMonthDate);

  const thisExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(thisMonth)
  );
  const thisIncome = transactions.filter(
    (t) => t.type === 'income' && t.date.startsWith(thisMonth)
  );
  const lastExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date.startsWith(lastMonth)
  );
  const lastIncome = transactions.filter(
    (t) => t.type === 'income' && t.date.startsWith(lastMonth)
  );

  const totalThisExpense = thisExpenses.reduce((s, t) => s + t.amount, 0);
  const totalLastExpense = lastExpenses.reduce((s, t) => s + t.amount, 0);
  const totalThisIncome = thisIncome.reduce((s, t) => s + t.amount, 0);
  const totalLastIncome = lastIncome.reduce((s, t) => s + t.amount, 0);

  // Need at least a few transactions for meaningful insights
  if (thisExpenses.length < 3 && thisIncome.length < 1) return [];

  // ── 1. Spending trend vs last month ──────────────────────────────────────
  if (totalThisExpense > 0 && totalLastExpense > 0) {
    const diff = totalThisExpense - totalLastExpense;
    const pct = Math.round(Math.abs(diff / totalLastExpense) * 100);
    if (pct >= 5) {
      if (diff > 0) {
        insights.push({
          id: 'spending_trend_up',
          icon: 'trending-up',
          title: `Spending ${pctLabel(pct, 'up')} from last month`,
          body: `You've spent ${fmt(totalThisExpense)} so far vs ${fmt(totalLastExpense)} last ${format(lastMonthDate, 'MMMM')}.`,
          accentColor: '#F87171',
          priority: 1,
        });
      } else {
        insights.push({
          id: 'spending_trend_down',
          icon: 'trending-down',
          title: `Spending ${pctLabel(pct, 'down')} — nice!`,
          body: `${fmt(Math.abs(diff))} less than last ${format(lastMonthDate, 'MMMM')}. You're trending in the right direction.`,
          accentColor: '#4ADE80',
          priority: 1,
        });
      }
    }
  }

  // ── 2. Top spending category ──────────────────────────────────────────────
  if (thisExpenses.length >= 2) {
    const byCategory: Record<string, number> = {};
    for (const t of thisExpenses) {
      byCategory[t.categoryId] = (byCategory[t.categoryId] ?? 0) + t.amount;
    }
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topCatId, topAmount] = sorted[0];
      const pct = totalThisExpense > 0
        ? Math.round((topAmount / totalThisExpense) * 100)
        : 0;
      insights.push({
        id: 'top_category',
        icon: 'podium',
        title: `${catName(topCatId, categoryNames)} is eating ${pct}% of your budget`,
        body: `You've spent ${fmt(topAmount)} on ${catName(topCatId, categoryNames)} this month across all transactions.`,
        accentColor: '#FCD34D',
        priority: 2,
      });
    }
  }

  // ── 3. Savings rate ───────────────────────────────────────────────────────
  if (totalThisIncome > 0) {
    const saved = totalThisIncome - totalThisExpense;
    const rate = Math.round((saved / totalThisIncome) * 100);
    if (rate > 0) {
      insights.push({
        id: 'savings_rate',
        icon: 'wallet',
        title: `You're saving ${rate}% of income`,
        body: `${fmt(saved)} saved out of ${fmt(totalThisIncome)} earned this month.`,
        accentColor: '#4ADE80',
        priority: rate >= 20 ? 1 : 3,
      });
    } else if (rate < 0) {
      insights.push({
        id: 'savings_rate_negative',
        icon: 'alert-circle',
        title: `Spending exceeds income this month`,
        body: `You've spent ${fmt(Math.abs(saved))} more than you've earned in ${format(now, 'MMMM')}.`,
        accentColor: '#F87171',
        priority: 1,
      });
    }
  }

  // ── 4. Budget projection — will you overspend? ───────────────────────────
  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const fractionElapsed = dayOfMonth / daysInMonth;

  for (const budget of budgets) {
    const prefix = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
    const spent = thisExpenses
      .filter((t) => t.categoryId === budget.categoryId && t.date.startsWith(prefix))
      .reduce((s, t) => s + t.amount, 0);

    const ratio = budget.amount > 0 ? spent / budget.amount : 0;

    // Only show if NOT already exceeded (that's a notification) and we have enough days
    if (ratio >= 0.4 && ratio < 1 && fractionElapsed >= 0.2) {
      const projected = fractionElapsed > 0 ? spent / fractionElapsed : 0;
      if (projected > budget.amount * 1.05) {
        const overage = projected - budget.amount;
        insights.push({
          id: `budget_projection_${budget.categoryId}`,
          icon: 'warning',
          title: `${catName(budget.categoryId, categoryNames)} may go over budget`,
          body: `At this pace you'll spend ~${fmt(projected)} vs your ${fmt(budget.amount)} budget — ${fmt(overage)} over.`,
          accentColor: '#FCD34D',
          priority: 2,
        });
        break; // show only the worst one
      }
    }
  }

  // ── 5. Best managed budget ───────────────────────────────────────────────
  if (budgets.length > 0 && fractionElapsed >= 0.3) {
    let bestBudget: Budget | null = null;
    let bestRemainingPct = -1;

    for (const budget of budgets) {
      const prefix = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
      const spent = thisExpenses
        .filter((t) => t.categoryId === budget.categoryId && t.date.startsWith(prefix))
        .reduce((s, t) => s + t.amount, 0);
      const remaining = budget.amount - spent;
      const remainingPct = budget.amount > 0 ? remaining / budget.amount : 0;

      // Only praise if they have meaningful room left relative to time elapsed
      if (remainingPct > fractionElapsed + 0.15 && remaining > 100) {
        if (remainingPct > bestRemainingPct) {
          bestRemainingPct = remainingPct;
          bestBudget = budget;
        }
      }
    }

    if (bestBudget) {
      const prefix = `${bestBudget.year}-${String(bestBudget.month).padStart(2, '0')}`;
      const spent = thisExpenses
        .filter((t) => t.categoryId === bestBudget!.categoryId && t.date.startsWith(prefix))
        .reduce((s, t) => s + t.amount, 0);
      const remaining = bestBudget.amount - spent;
      insights.push({
        id: `best_budget_${bestBudget.categoryId}`,
        icon: 'checkmark-circle',
        title: `${catName(bestBudget.categoryId, categoryNames)} budget on track`,
        body: `${fmt(remaining)} still available — you're well within your ${fmt(bestBudget.amount)} limit.`,
        accentColor: '#4ADE80',
        priority: 4,
      });
    }
  }

  // ── 6. Weekend vs weekday spending ───────────────────────────────────────
  if (thisExpenses.length >= 6) {
    let weekdayTotal = 0;
    let weekdayCount = 0;
    let weekendTotal = 0;
    let weekendCount = 0;

    for (const t of thisExpenses) {
      const day = getDay(new Date(t.date + 'T00:00:00')); // 0=Sun, 6=Sat
      if (day === 0 || day === 6) {
        weekendTotal += t.amount;
        weekendCount++;
      } else {
        weekdayTotal += t.amount;
        weekdayCount++;
      }
    }

    if (weekdayCount > 0 && weekendCount > 0) {
      const avgWeekday = weekdayTotal / weekdayCount;
      const avgWeekend = weekendTotal / weekendCount;
      const diff = avgWeekend - avgWeekday;
      const pct = Math.round(Math.abs(diff / avgWeekday) * 100);

      if (pct >= 30) {
        if (diff > 0) {
          insights.push({
            id: 'weekend_spending',
            icon: 'calendar',
            title: `You spend ${fmtPct(pct)} more on weekends`,
            body: `Avg weekend spend: ${fmt(avgWeekend)} vs ${fmt(avgWeekday)} on weekdays.`,
            accentColor: '#A78BFA',
            priority: 3,
          });
        } else {
          insights.push({
            id: 'weekday_spending',
            icon: 'briefcase',
            title: `Weekdays cost ${fmtPct(pct)} more than weekends`,
            body: `Avg weekday spend: ${fmt(avgWeekday)} vs ${fmt(avgWeekend)} on weekends.`,
            accentColor: '#60A5FA',
            priority: 4,
          });
        }
      }
    }
  }

  // ── 7. Loan burden ────────────────────────────────────────────────────────
  const activeLoans = loans.filter((l) => l.isActive);
  if (activeLoans.length > 0) {
    const totalMonthlyPayments = activeLoans.reduce((s, l) => s + l.monthlyPayment, 0);
    if (totalThisIncome > 0) {
      const burdenPct = Math.round((totalMonthlyPayments / totalThisIncome) * 100);
      if (burdenPct >= 20) {
        insights.push({
          id: 'loan_burden',
          icon: 'document-text',
          title: `${burdenPct}% of income goes to loans`,
          body: `${fmt(totalMonthlyPayments)}/month across ${activeLoans.length} active loan${activeLoans.length > 1 ? 's' : ''}.`,
          accentColor: burdenPct >= 40 ? '#F87171' : '#FCD34D',
          priority: burdenPct >= 40 ? 1 : 3,
        });
      }
    } else {
      insights.push({
        id: 'loan_burden_no_income',
        icon: 'document-text',
        title: `${fmt(totalMonthlyPayments)} in loan payments due`,
        body: `${activeLoans.length} active loan${activeLoans.length > 1 ? 's' : ''} this month.`,
        accentColor: '#FCD34D',
        priority: 3,
      });
    }
  }

  // ── 8. Goal closest to completion ────────────────────────────────────────
  const activeGoals = goals.filter(
    (g) => g.targetAmount > 0 && g.currentAmount < g.targetAmount
  );
  if (activeGoals.length > 0) {
    const closest = activeGoals.reduce((best, g) =>
      g.currentAmount / g.targetAmount > best.currentAmount / best.targetAmount ? g : best
    );
    const pct = Math.round((closest.currentAmount / closest.targetAmount) * 100);
    if (pct >= 25) {
      const remaining = closest.targetAmount - closest.currentAmount;
      insights.push({
        id: `goal_progress_${closest.id}`,
        icon: 'flag',
        title: `${closest.name} is ${pct}% funded`,
        body: `Just ${fmt(remaining)} more to reach your ${fmt(closest.targetAmount)} goal.`,
        accentColor: '#4ADE80',
        priority: 4,
      });
    }
  }

  // ── 9. Income trend ───────────────────────────────────────────────────────
  if (totalThisIncome > 0 && totalLastIncome > 0) {
    const diff = totalThisIncome - totalLastIncome;
    const pct = Math.round(Math.abs(diff / totalLastIncome) * 100);
    if (pct >= 10 && diff > 0) {
      insights.push({
        id: 'income_trend_up',
        icon: 'arrow-up-circle',
        title: `Income ${pctLabel(pct, 'up')} vs last month`,
        body: `${fmt(totalThisIncome)} earned so far — ${fmt(diff)} more than ${format(lastMonthDate, 'MMMM')}.`,
        accentColor: '#4ADE80',
        priority: 2,
      });
    }
  }

  // ── 10. Biggest single expense ───────────────────────────────────────────
  if (thisExpenses.length >= 3) {
    const biggest = thisExpenses.reduce((max, t) => (t.amount > max.amount ? t : max));
    const pct = totalThisExpense > 0
      ? Math.round((biggest.amount / totalThisExpense) * 100)
      : 0;
    if (pct >= 25) {
      insights.push({
        id: 'biggest_expense',
        icon: 'receipt',
        title: `Biggest single transaction: ${fmt(biggest.amount)}`,
        body: `${biggest.note ? `"${biggest.note}"` : catName(biggest.categoryId, categoryNames)} — that one purchase was ${pct}% of this month's expenses.`,
        accentColor: '#FB923C',
        priority: 3,
      });
    }
  }

  // Sort by priority then trim to max 6
  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);
}
