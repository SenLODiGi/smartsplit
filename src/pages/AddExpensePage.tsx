import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  ScanLine,
  Utensils,
  Plane,
  Home,
  Ticket,
  Zap,
  MoreHorizontal,
  Check,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getAvatarColor } from '../utils/formatters';

export const AddExpensePage: React.FC = () => {
  const { activeGroup, currentUser, createExpense, showToast } = useApp();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string>('12000');
  const [category, setCategory] = useState<'food' | 'transport' | 'lodging' | 'entertainment' | 'utilities' | 'other'>('food');
  const [payerId, setPayerId] = useState<string>(currentUser.id);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [splitMethod, setSplitMethod] = useState<'equal' | 'exact' | 'percentage' | 'shares'>('equal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group members
  const members = activeGroup?.members || [];
  const parsedAmount = Math.max(0, Number(amount) || 0);

  // Participants in equal split (which members are participating)
  const [participatingUserIds, setParticipatingUserIds] = useState<string[]>([]);

  // Custom split values per member
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [sharesCount, setSharesCount] = useState<Record<string, number>>({});

  // Initialize values when activeGroup / members changes
  useEffect(() => {
    if (members.length > 0) {
      setParticipatingUserIds(members.map((m) => m.userId));

      const isCurrentInMembers = members.some((m) => m.userId === currentUser.id);
      if (isCurrentInMembers) {
        setPayerId(currentUser.id);
      } else {
        setPayerId(members[0].userId);
      }

      const initExact: Record<string, number> = {};
      const initPct: Record<string, number> = {};
      const initShares: Record<string, number> = {};

      const totalCents = Math.round(parsedAmount * 100);
      const baseCents = Math.floor(totalCents / members.length);
      let remCents = totalCents - baseCents * members.length;

      const basePct = Math.floor((100 / members.length) * 10) / 10;
      let accPct = 0;

      members.forEach((m, idx) => {
        let cents = baseCents;
        if (remCents > 0) {
          cents += 1;
          remCents -= 1;
        }
        initExact[m.userId] = cents / 100;

        if (idx === members.length - 1) {
          initPct[m.userId] = Math.round((100 - accPct) * 10) / 10;
        } else {
          initPct[m.userId] = basePct;
          accPct += basePct;
        }

        initShares[m.userId] = 1;
      });

      setExactAmounts(initExact);
      setPercentages(initPct);
      setSharesCount(initShares);
    }
  }, [activeGroup?.id, currentUser.id]);

  // Quick helper to redistribute exact amounts evenly across members
  const handleAutoDistributeExact = () => {
    if (members.length === 0 || parsedAmount <= 0) return;
    const totalCents = Math.round(parsedAmount * 100);
    const baseCents = Math.floor(totalCents / members.length);
    let remCents = totalCents - baseCents * members.length;
    const newExact: Record<string, number> = {};
    members.forEach((m) => {
      let cents = baseCents;
      if (remCents > 0) {
        cents += 1;
        remCents -= 1;
      }
      newExact[m.userId] = cents / 100;
    });
    setExactAmounts(newExact);
    showToast('Amounts evenly distributed!', 'info');
  };

  // Quick helper to redistribute percentages evenly
  const handleAutoDistributePercentages = () => {
    if (members.length === 0) return;
    const basePct = Math.floor((100 / members.length) * 10) / 10;
    const newPct: Record<string, number> = {};
    let accumulated = 0;
    members.forEach((m, idx) => {
      if (idx === members.length - 1) {
        newPct[m.userId] = Math.round((100 - accumulated) * 10) / 10;
      } else {
        newPct[m.userId] = basePct;
        accumulated += basePct;
      }
    });
    setPercentages(newPct);
    showToast('Percentages evenly distributed!', 'info');
  };

  const toggleParticipant = (userId: string) => {
    if (participatingUserIds.includes(userId)) {
      if (participatingUserIds.length === 1) {
        showToast('At least one member must participate in the expense.', 'warning');
        return;
      }
      setParticipatingUserIds(participatingUserIds.filter((id) => id !== userId));
    } else {
      setParticipatingUserIds([...participatingUserIds, userId]);
    }
  };

  // Computations & Validations
  const sumExact = Object.values(exactAmounts).reduce((a, b) => a + Number(b || 0), 0);
  const diffExact = Math.round((parsedAmount - sumExact) * 100) / 100;

  const sumPercentages = Object.values(percentages).reduce((a, b) => a + Number(b || 0), 0);
  const diffPercentages = Math.round((100 - sumPercentages) * 10) / 10;

  const sumShares = Object.values(sharesCount).reduce((a, b) => a + Number(b || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Please enter an expense title.', 'error');
      return;
    }

    if (parsedAmount <= 0) {
      showToast('Expense amount must be greater than zero.', 'error');
      return;
    }

    if (!activeGroup || members.length === 0) {
      showToast('No active group or members found.', 'error');
      return;
    }

    let splits: any[] = [];
    const totalCents = Math.round(parsedAmount * 100);

    if (splitMethod === 'equal') {
      const activeMembers = members.filter((m) => participatingUserIds.includes(m.userId));
      if (activeMembers.length === 0) {
        showToast('Please select at least one participating member.', 'error');
        return;
      }

      const count = activeMembers.length;
      const baseCents = Math.floor(totalCents / count);
      let remainderCents = totalCents - baseCents * count;

      splits = members.map((m) => {
        if (!participatingUserIds.includes(m.userId)) {
          return { userId: m.userId, userName: m.name, amount: 0 };
        }
        let cents = baseCents;
        if (remainderCents > 0) {
          cents += 1;
          remainderCents -= 1;
        }
        return {
          userId: m.userId,
          userName: m.name,
          amount: cents / 100,
        };
      });
    } else if (splitMethod === 'exact') {
      if (Math.abs(diffExact) > 0.01) {
        showToast(
          `Allocated sum (${formatCurrency(sumExact, activeGroup.currency)}) does not match bill total (${formatCurrency(parsedAmount, activeGroup.currency)}). Difference: ${formatCurrency(Math.abs(diffExact), activeGroup.currency)}`,
          'error'
        );
        return;
      }

      splits = members.map((m) => ({
        userId: m.userId,
        userName: m.name,
        amount: Math.round(Number(exactAmounts[m.userId] || 0) * 100) / 100,
      }));
    } else if (splitMethod === 'percentage') {
      if (Math.abs(diffPercentages) > 0.05) {
        showToast(`Total percentage must equal 100%. Currently at ${sumPercentages}%.`, 'error');
        return;
      }

      let allocatedCents = 0;
      const computedSplits = members.map((m) => {
        const pct = Number(percentages[m.userId] || 0);
        const cents = Math.round((totalCents * pct) / 100);
        allocatedCents += cents;
        return {
          userId: m.userId,
          userName: m.name,
          amount: cents / 100,
          percentage: pct,
          rawCents: cents,
        };
      });

      // Distribute rounding cents to first member with percentage > 0
      const diffCents = totalCents - allocatedCents;
      if (diffCents !== 0) {
        const target = computedSplits.find((s) => (s.percentage || 0) > 0) || computedSplits[0];
        if (target) {
          target.amount = Math.round(target.amount * 100 + diffCents) / 100;
        }
      }

      splits = computedSplits.map(({ rawCents, ...rest }) => rest);
    } else if (splitMethod === 'shares') {
      if (sumShares <= 0) {
        showToast('Total shares must be greater than zero.', 'error');
        return;
      }

      let allocatedCents = 0;
      const computedSplits = members.map((m) => {
        const count = Number(sharesCount[m.userId] || 0);
        const cents = Math.floor((totalCents * count) / sumShares);
        allocatedCents += cents;
        return {
          userId: m.userId,
          userName: m.name,
          amount: cents / 100,
          shares: count,
          rawCents: cents,
        };
      });

      let remainderCents = totalCents - allocatedCents;
      for (let i = 0; i < computedSplits.length && remainderCents > 0; i++) {
        if (computedSplits[i].shares > 0) {
          computedSplits[i].amount = (computedSplits[i].rawCents + 1) / 100;
          computedSplits[i].rawCents += 1;
          remainderCents -= 1;
        }
      }

      splits = computedSplits.map(({ rawCents, ...rest }) => rest);
    }

    setIsSubmitting(true);
    const exp = await createExpense({
      title: title.trim(),
      amount: parsedAmount,
      currency: activeGroup?.currency || 'LKR',
      category,
      payerId,
      date,
      splitMethod,
      splits,
      notes: notes.trim(),
    });

    setIsSubmitting(false);
    if (exp) {
      navigate('/dashboard');
    }
  };

  const categories = [
    { id: 'food', label: 'Food & Drinks', icon: Utensils },
    { id: 'transport', label: 'Transport', icon: Plane },
    { id: 'lodging', label: 'Accommodation', icon: Home },
    { id: 'entertainment', label: 'Activities', icon: Ticket },
    { id: 'utilities', label: 'Bills / Utilities', icon: Zap },
    { id: 'other', label: 'Other', icon: MoreHorizontal },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Add Group Expense
          </h1>
          <p className="text-xs text-slate-500">
            Split manually across members in {activeGroup?.name || 'group'}.
          </p>
        </div>

        <button
          onClick={() => navigate('/receipt/pipeline')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
        >
          <ScanLine className="w-4 h-4" />
          <span>Scan OCR Bill Instead</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        {/* Title & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Expense Description *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ella Odyssey Train Tickets, Dinner at Chill"
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Amount ({activeGroup?.currency || 'LKR'}) *
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-indigo-600"
            />
          </div>
        </div>

        {/* Category Picker */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id as any)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    category === cat.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payer & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Paid By
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} {m.userId === currentUser.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        {/* Split Methods Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Split Calculation Method
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4">
            {[
              { id: 'equal', label: 'Split Equally' },
              { id: 'exact', label: 'Exact Amounts' },
              { id: 'percentage', label: 'Percentages (%)' },
              { id: 'shares', label: 'By Shares' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSplitMethod(m.id as any)}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  splitMethod === m.id
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Dynamic Split Editor */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            {/* 1. EQUAL SPLIT */}
            {splitMethod === 'equal' && (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
                  <span>Select who participated in this expense:</span>
                  <span className="font-semibold text-indigo-600">
                    {participatingUserIds.length} of {members.length} members
                  </span>
                </div>
                <div className="space-y-2">
                  {members.map((m) => {
                    const isChecked = participatingUserIds.includes(m.userId);
                    const activeCount = participatingUserIds.length || 1;
                    const share = isChecked ? Math.round((parsedAmount / activeCount) * 100) / 100 : 0;

                    return (
                      <div
                        key={m.userId}
                        onClick={() => toggleParticipant(m.userId)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-white border-indigo-200 text-slate-900'
                            : 'bg-slate-100/60 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleParticipant(m.userId)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium">{m.name}</span>
                        </div>
                        <span className="font-mono font-bold tabular-nums">
                          {isChecked ? formatCurrency(share, activeGroup?.currency) : 'Excluded (Rs. 0)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. EXACT AMOUNTS */}
            {splitMethod === 'exact' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Member</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoDistributeExact}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Distribute Evenly</span>
                    </button>
                    <span
                      className={`font-semibold font-mono ${
                        Math.abs(diffExact) <= 0.05 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      Sum: {formatCurrency(sumExact, activeGroup?.currency)} / {formatCurrency(parsedAmount, activeGroup?.currency)}
                    </span>
                  </div>
                </div>

                {Math.abs(diffExact) > 0.05 && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {diffExact > 0
                        ? `Rs. ${diffExact.toFixed(2)} remaining to allocate.`
                        : `Rs. ${Math.abs(diffExact).toFixed(2)} allocated over the bill total.`}
                    </span>
                  </div>
                )}

                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-800 font-medium truncate">{m.name}</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={exactAmounts[m.userId] ?? ''}
                      onChange={(e) =>
                        setExactAmounts({ ...exactAmounts, [m.userId]: Number(e.target.value) || 0 })
                      }
                      className="w-32 p-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-semibold"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 3. PERCENTAGES */}
            {splitMethod === 'percentage' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Member</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoDistributePercentages}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Distribute Evenly</span>
                    </button>
                    <span
                      className={`font-semibold font-mono ${
                        Math.abs(diffPercentages) <= 0.1 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      Total: {sumPercentages}% (Target: 100%)
                    </span>
                  </div>
                </div>

                {Math.abs(diffPercentages) > 0.1 && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {diffPercentages > 0
                        ? `${diffPercentages.toFixed(1)}% remaining to reach 100%.`
                        : `${Math.abs(diffPercentages).toFixed(1)}% over 100%.`}
                    </span>
                  </div>
                )}

                {members.map((m) => {
                  const calculatedAmt =
                    Math.round(((parsedAmount * (percentages[m.userId] || 0)) / 100) * 100) / 100;
                  return (
                    <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="text-slate-800 font-medium block truncate">{m.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(calculatedAmt, activeGroup?.currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={percentages[m.userId] ?? ''}
                          onChange={(e) =>
                            setPercentages({ ...percentages, [m.userId]: Number(e.target.value) || 0 })
                          }
                          className="w-20 p-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-semibold"
                        />
                        <span className="text-slate-400 font-mono">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. SHARES */}
            {splitMethod === 'shares' && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500 mb-2">
                  Assign proportional weight shares (e.g. 2 shares for couples, 1 share for individuals).
                </p>
                {members.map((m) => {
                  const shares = sharesCount[m.userId] || 1;
                  const calculatedAmt =
                    sumShares > 0 ? Math.round(((parsedAmount * shares) / sumShares) * 100) / 100 : 0;

                  return (
                    <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="text-slate-800 font-medium block truncate">{m.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatCurrency(calculatedAmt, activeGroup?.currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={sharesCount[m.userId] ?? 1}
                          onChange={(e) =>
                            setSharesCount({
                              ...sharesCount,
                              [m.userId]: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-semibold"
                        />
                        <span className="text-[11px] text-slate-500">share(s)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details about this bill..."
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || parsedAmount <= 0}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            {isSubmitting ? 'Recording Expense...' : 'Save & Split Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};
