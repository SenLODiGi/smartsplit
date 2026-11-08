import { Group, Expense, SettlementPayment, OptimizedTransfer, SettlementAnalysis } from '../types';

/**
 * Greedy Bipartite Debt Simplification Engine
 * Computes net balances: Balance = TotalPaid - TotalOwed
 * Sorts debtors and creditors by magnitude and iteratively matches the largest debtor with the largest creditor.
 */
export function calculateGroupBalancesAndOptimization(
  group: Group,
  expenses: Expense[],
  settlements: SettlementPayment[]
): SettlementAnalysis {
  if (!group || !group.members) {
    return {
      netBalances: [],
      rawDebtsCount: 0,
      optimizedTransfers: [],
      optimizedCount: 0,
      savingsPercentage: 0,
    };
  }

  const groupExpenses = expenses.filter((e) => e.groupId === group.id);
  const groupSettlements = settlements.filter(
    (s) => s.groupId === group.id && (s.status === 'completed' || !s.status)
  );

  // Map each member's net balance: balance = totalPaid - totalOwed
  const balanceMap = new Map<string, { name: string; avatar: string; net: number }>();
  for (const m of group.members) {
    balanceMap.set(m.userId, { name: m.name, avatar: m.avatar || '', net: 0 });
  }

  // 1. Process expenses
  for (const exp of groupExpenses) {
    const payer = balanceMap.get(exp.payerId);
    if (payer) {
      payer.net += exp.amount;
    }
    if (exp.splits && Array.isArray(exp.splits)) {
      for (const split of exp.splits) {
        const debtor = balanceMap.get(split.userId);
        if (debtor) {
          debtor.net -= split.amount;
        }
      }
    }
  }

  // 2. Process recorded settlements
  for (const stl of groupSettlements) {
    const payer = balanceMap.get(stl.payerId);
    const payee = balanceMap.get(stl.payeeId);
    if (payer) payer.net += stl.amount; // payer paid down debt
    if (payee) payee.net -= stl.amount; // payee received cash
  }

  const netBalances = Array.from(balanceMap.entries()).map(([userId, data]) => ({
    userId,
    userName: data.name,
    avatar: data.avatar,
    balance: Math.round(data.net * 100) / 100,
  }));

  // Separate into debtors (net < 0) and creditors (net > 0)
  interface Person {
    userId: string;
    userName: string;
    avatar: string;
    amount: number;
  }

  const debtors: Person[] = [];
  const creditors: Person[] = [];

  for (const nb of netBalances) {
    if (nb.balance < -0.01) {
      debtors.push({ userId: nb.userId, userName: nb.userName, avatar: nb.avatar, amount: Math.abs(nb.balance) });
    } else if (nb.balance > 0.01) {
      creditors.push({ userId: nb.userId, userName: nb.userName, avatar: nb.avatar, amount: nb.balance });
    }
  }

  // Sort descending by magnitude
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Estimate raw pairwise debts (without simplification)
  let simulatedRawDebts = 0;
  for (const exp of groupExpenses) {
    if (exp.splits && Array.isArray(exp.splits)) {
      for (const split of exp.splits) {
        if (split.userId !== exp.payerId && split.amount > 0) {
          simulatedRawDebts++;
        }
      }
    }
  }

  // Greedy debt simplification
  const optimizedTransfers: OptimizedTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;
  let transferId = 1;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settled = Math.min(debtor.amount, creditor.amount);
    if (settled > 0.01) {
      optimizedTransfers.push({
        id: `opt_${transferId++}`,
        fromId: debtor.userId,
        fromName: debtor.userName,
        fromAvatar: debtor.avatar,
        toId: creditor.userId,
        toName: creditor.userName,
        toAvatar: creditor.avatar,
        amount: Math.round(settled * 100) / 100,
        currency: group.currency,
      });
    }

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  const rawCount = simulatedRawDebts > 0 ? Math.max(simulatedRawDebts, optimizedTransfers.length) : 0;
  const optimizedCount = optimizedTransfers.length;
  const savings = rawCount > 0 ? Math.round(((rawCount - optimizedCount) / rawCount) * 100) : 0;

  return {
    netBalances: netBalances.map(({ userId, userName, balance }) => ({ userId, userName, balance })),
    rawDebtsCount: rawCount,
    optimizedTransfers,
    optimizedCount,
    savingsPercentage: Math.max(0, savings),
  };
}

