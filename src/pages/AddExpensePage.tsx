import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency, getAvatarColor } from '../utils/formatters';

export const AddExpensePage: React.FC = () => {
  const { activeGroup, currentUser, createExpense } = useApp();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string>('12000');
  const [category, setCategory] = useState<'food' | 'transport' | 'lodging' | 'entertainment' | 'utilities' | 'other'>('food');
  const [payerId, setPayerId] = useState<string>(currentUser.id);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [splitMethod, setSplitMethod] = useState<'equal' | 'exact' | 'percentage' | 'shares'>('equal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split details state per member
  const members = activeGroup?.members || [];
  const parsedAmount = Number(amount) || 0;

  // Custom split values per member
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [sharesCount, setSharesCount] = useState<Record<string, number>>({});

  // Initialize values when members load
  React.useEffect(() => {
    const initExact: Record<string, number> = {};
    const initPct: Record<string, number> = {};
    const initShares: Record<string, number> = {};

    const equalShare = members.length > 0 ? Math.round((parsedAmount / members.length) * 100) / 100 : 0;
    const equalPct = members.length > 0 ? Math.round((100 / members.length) * 10) / 10 : 0;

    members.forEach((m) => {
      initExact[m.userId] = equalShare;
      initPct[m.userId] = equalPct;
      initShares[m.userId] = 1;
    });

    setExactAmounts(initExact);
    setPercentages(initPct);
    setSharesCount(initShares);
  }, [activeGroup, parsedAmount]);

  // Validation
  const sumExact = Object.values(exactAmounts).reduce((a, b) => a + b, 0);
  const sumPercentages = Object.values(percentages).reduce((a, b) => a + b, 0);
  const sumShares = Object.values(sharesCount).reduce((a, b) => a + b, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || parsedAmount <= 0) return;
    setIsSubmitting(true);

    let splits: any[] = [];

    if (splitMethod === 'equal') {
      const share = Math.round((parsedAmount / members.length) * 100) / 100;
      splits = members.map((m, idx) => ({
        userId: m.userId,
        userName: m.name,
        amount: idx === 0 ? parsedAmount - share * (members.length - 1) : share,
      }));
    } else if (splitMethod === 'exact') {
      splits = members.map((m) => ({
        userId: m.userId,
        userName: m.name,
        amount: exactAmounts[m.userId] || 0,
      }));
    } else if (splitMethod === 'percentage') {
      splits = members.map((m) => ({
        userId: m.userId,
        userName: m.name,
        amount: Math.round(((parsedAmount * (percentages[m.userId] || 0)) / 100) * 100) / 100,
        percentage: percentages[m.userId] || 0,
      }));
    } else if (splitMethod === 'shares') {
      splits = members.map((m) => {
        const count = sharesCount[m.userId] || 1;
        const amt = sumShares > 0 ? Math.round(((parsedAmount * count) / sumShares) * 100) / 100 : 0;
        return {
          userId: m.userId,
          userName: m.name,
          amount: amt,
          shares: count,
        };
      });
    }

    const exp = await createExpense({
      title: title.trim(),
      amount: parsedAmount,
      currency: activeGroup?.currency || 'LKR',
      category,
      payerId,
      date,
      splitMethod,
      splits,
      notes,
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
              min="1"
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
            {splitMethod === 'equal' && (
              <div>
                <p className="text-xs text-slate-600 mb-3">
                  Evenly split between {members.length} members.
                </p>
                <div className="space-y-2">
                  {members.map((m) => {
                    const share = Math.round((parsedAmount / members.length) * 100) / 100;
                    return (
                      <div key={m.userId} className="flex items-center justify-between text-xs py-1">
                        <span className="text-slate-800 font-medium">{m.name}</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(share, activeGroup?.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {splitMethod === 'exact' && (
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Member</span>
                  <span>
                    Allocated: {formatCurrency(sumExact, activeGroup?.currency)} / {formatCurrency(parsedAmount, activeGroup?.currency)}
                  </span>
                </div>
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-800 font-medium truncate">{m.name}</span>
                    <input
                      type="number"
                      min="0"
                      value={exactAmounts[m.userId] || 0}
                      onChange={(e) =>
                        setExactAmounts({ ...exactAmounts, [m.userId]: Number(e.target.value) || 0 })
                      }
                      className="w-28 p-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-semibold"
                    />
                  </div>
                ))}
              </div>
            )}

            {splitMethod === 'percentage' && (
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Member</span>
                  <span className={sumPercentages === 100 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                    Total: {sumPercentages}% (Must be 100%)
                  </span>
                </div>
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-800 font-medium truncate">{m.name}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={percentages[m.userId] || 0}
                        onChange={(e) =>
                          setPercentages({ ...percentages, [m.userId]: Number(e.target.value) || 0 })
                        }
                        className="w-20 p-1.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-semibold"
                      />
                      <span className="text-slate-400 font-mono">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {splitMethod === 'shares' && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-500 mb-2">
                  Assign proportional weight shares (e.g., 2 shares for couples, 1 share for singles).
                </p>
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-800 font-medium truncate">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={sharesCount[m.userId] || 1}
                        onChange={(e) =>
                          setSharesCount({ ...sharesCount, [m.userId]: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-semibold"
                      />
                      <span className="text-[11px] text-slate-500">parts</span>
                    </div>
                  </div>
                ))}
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
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
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
