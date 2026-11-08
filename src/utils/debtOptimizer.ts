import { Group, Expense, SettlementPayment, OptimizedTransfer, SettlementAnalysis, MemberBalance } from '../types';

/**
 * Greedy Bipartite Debt Simplification Engine
 * Computes net balances: Balance = TotalPaid - TotalOwed
 * Positive balance: Member should receive money (gets back).
 * Negative balance: Member owes money (owes).
 * Sorts debtors and creditors by magnitude and iteratively matches the largest debtor with the largest creditor.
 */
export function calculateGroupBalancesAndOptimization(
  group: Group,
  expenses: Expense[],
  settlements: SettlementPayment[]
): SettlementAnalysis {
  if (!group || !group.members || group.members.length === 0) {
    return {
      netBalances: [],
      rawDebtsCount: 0,
      optimizedTransfers: [],
      optimizedCount: 0,
      savingsPercentage: 0,
    };
  }

  const groupExpenses = (expenses || []).filter((e) => e.groupId === group.id);
  const groupSettlements = (settlements || []).filter(
    (s) => s.groupId === group.id && (s.status === 'completed' || !s.status)
  );

  // Map each member's financial state: totalPaid, totalOwed, net
  interface MemberState {
    userId: string;
    userName: string;
    avatar: string;
    totalPaid: number;
    totalOwed: number;
  }

  const memberStates = new Map<string, MemberState>();
  const idLookup = new Map<string, string>(); // Maps id, userId, or lowercase name -> canonical userId

  for (const m of group.members) {
    const canonicalId = m.userId || m.id;
    const state: MemberState = {
      userId: canonicalId,
      userName: m.name,
      avatar: m.avatar || '',
      totalPaid: 0,
      totalOwed: 0,
    };
    memberStates.set(canonicalId, state);

    if (m.userId) idLookup.set(m.userId, canonicalId);
    if (m.id) idLookup.set(m.id, canonicalId);
    if (m.name) idLookup.set(m.name.trim().toLowerCase(), canonicalId);
  }

  const getMemberState = (idOrName?: string, fallbackName?: string): MemberState | undefined => {
    if (!idOrName && !fallbackName) return undefined;
    if (idOrName) {
      const canonical = idLookup.get(idOrName) || idLookup.get(idOrName.trim().toLowerCase());
      if (canonical && memberStates.has(canonical)) return memberStates.get(canonical);
    }
    if (fallbackName) {
      const canonical = idLookup.get(fallbackName.trim().toLowerCase());
      if (canonical && memberStates.has(canonical)) return memberStates.get(canonical);
    }
    return undefined;
  };

  // 1. Process Expenses
  for (const exp of groupExpenses) {
    // 1A. Payer(s) paid for the expense
    if (exp.payers && Array.isArray(exp.payers) && exp.payers.length > 0) {
      for (const p of exp.payers) {
        const payer = getMemberState(p.userId, p.userName);
        if (payer) {
          payer.totalPaid += Number(p.amount) || 0;
        }
      }
    } else {
      const payer = getMemberState(exp.payerId, exp.payerName);
      if (payer) {
        payer.totalPaid += Number(exp.amount) || 0;
      }
    }

    // 1B. Splits (each participant owes their allocated split amount)
    if (exp.splits && Array.isArray(exp.splits)) {
      for (const split of exp.splits) {
        const debtor = getMemberState(split.userId, split.userName);
        if (debtor) {
          debtor.totalOwed += Number(split.amount) || 0;
        }
      }
    }
  }

  // 2. Process Recorded Settlements (Direct peer debt paydowns)
  for (const stl of groupSettlements) {
    const payer = getMemberState(stl.payerId, stl.payerName);
    const payee = getMemberState(stl.payeeId, stl.payeeName);
    const amount = Number(stl.amount) || 0;

    if (payer) {
      payer.totalPaid += amount; // Sender paid down debt
    }
    if (payee) {
      payee.totalOwed += amount; // Receiver got paid
    }
  }

  // 3. Assemble Net Positions using: Net Balance = Total Paid - Total Owed
  const netBalances: MemberBalance[] = Array.from(memberStates.values()).map((state) => {
    const totalPaid = Math.round(state.totalPaid * 100) / 100;
    const totalOwed = Math.round(state.totalOwed * 100) / 100;
    const balance = Math.round((totalPaid - totalOwed) * 100) / 100;
    const getsBack = balance > 0.01 ? balance : 0;
    const owes = balance < -0.01 ? Math.round(Math.abs(balance) * 100) / 100 : 0;

    return {
      userId: state.userId,
      userName: state.userName,
      avatar: state.avatar,
      totalPaid,
      totalOwed,
      balance,
      getsBack,
      owes,
    };
  });

  // 4. Separate into Debtors (Net < 0) and Creditors (Net > 0)
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
      debtors.push({ userId: nb.userId, userName: nb.userName, avatar: nb.avatar || '', amount: Math.abs(nb.balance) });
    } else if (nb.balance > 0.01) {
      creditors.push({ userId: nb.userId, userName: nb.userName, avatar: nb.avatar || '', amount: nb.balance });
    }
  }

  // Sort descending by magnitude
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Estimate raw pairwise debts (without simplification)
  let simulatedRawDebts = 0;
  for (const exp of groupExpenses) {
    if (exp.splits && Array.isArray(exp.splits)) {
      const payersList =
        exp.payers && exp.payers.length > 0
          ? exp.payers
          : [{ userId: exp.payerId, userName: exp.payerName, amount: exp.amount }];

      for (const split of exp.splits) {
        if (split.amount > 0) {
          for (const p of payersList) {
            if (p.userId !== split.userId && p.amount > 0) {
              simulatedRawDebts++;
              break;
            }
          }
        }
      }
    }
  }

  // 5. Greedy Debt Minimization
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

    debtor.amount = Math.round((debtor.amount - settled) * 100) / 100;
    creditor.amount = Math.round((creditor.amount - settled) * 100) / 100;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  const rawCount = simulatedRawDebts > 0 ? Math.max(simulatedRawDebts, optimizedTransfers.length) : 0;
  const optimizedCount = optimizedTransfers.length;
  const savings = rawCount > 0 ? Math.round(((rawCount - optimizedCount) / rawCount) * 100) : 0;

  return {
    netBalances,
    rawDebtsCount: rawCount,
    optimizedTransfers,
    optimizedCount,
    savingsPercentage: Math.max(0, savings),
  };
}

